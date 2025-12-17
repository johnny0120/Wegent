# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""Chat Shell direct chat service (Refactored Version)."""

import asyncio
import json
import logging
import time
from typing import Any, AsyncGenerator

from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.services.chat.base import ChatServiceBase, get_http_client
from app.services.chat.db_handler import db_handler
from app.services.chat.message_builder import message_builder
from app.services.chat.providers import get_provider
from app.services.chat.providers.base import ChunkType, StreamChunk
from app.services.chat.session_manager import session_manager
from app.services.chat.stream_manager import StreamState, stream_manager
from app.services.chat.tool_handler import ToolCallAccumulator, ToolHandler
from app.services.chat.tools import Tool, cleanup_mcp_session, get_mcp_session

logger = logging.getLogger(__name__)

# Semaphore for concurrent chat limit (lazy initialized)
_chat_semaphore: asyncio.Semaphore | None = None

# SSE response headers
_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "Content-Encoding": "none",
}


def _get_chat_semaphore() -> asyncio.Semaphore:
    """Get or create the chat semaphore for concurrency limiting."""
    global _chat_semaphore
    if _chat_semaphore is None:
        _chat_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_CHATS)
    return _chat_semaphore


def _sse_data(data: dict) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps(data)}\n\n"


class ChatService(ChatServiceBase):
    """Chat Shell direct chat service with modular architecture."""

    async def chat_stream(
        self,
        subtask_id: int,
        task_id: int,
        message: str | dict[str, Any],
        model_config: dict[str, Any],
        system_prompt: str = "",
        tools: list[Tool] | None = None,
    ) -> StreamingResponse:
        """
        Stream chat response from LLM API with tool calling support.

        This method automatically loads MCP tools if CHAT_MCP_ENABLED is True
        and CHAT_MCP_SERVERS is configured. MCP sessions are managed per-task
        and cleaned up when the stream ends.

        Args:
            subtask_id: The subtask ID
            task_id: The task ID
            message: User message (string or dict with content)
            model_config: Model configuration dict
            system_prompt: System prompt for the conversation
            tools: Optional list of Tool instances (web search, etc.)

        Returns:
            StreamingResponse with SSE events
        """
        semaphore = _get_chat_semaphore()
        chunk_queue: asyncio.Queue = asyncio.Queue()
        mcp_session = None

        async def generate() -> AsyncGenerator[str, None]:
            nonlocal mcp_session
            acquired = False
            consumer_task = None
            cancel_event = await session_manager.register_stream(subtask_id)

            try:
                # Acquire semaphore with timeout
                try:
                    acquired = await asyncio.wait_for(semaphore.acquire(), timeout=5.0)
                except asyncio.TimeoutError:
                    yield _sse_data({"error": "Too many concurrent chat requests"})
                    await db_handler.update_subtask_status(
                        subtask_id, "FAILED", error="Too many concurrent chat requests"
                    )
                    return

                await db_handler.update_subtask_status(subtask_id, "RUNNING")

                # Build messages and initialize components
                history = await session_manager.get_chat_history(task_id)
                messages = message_builder.build_messages(
                    history, message, system_prompt
                )

                # Prepare all tools (passed tools + MCP tools)
                all_tools: list[Tool] = list(tools) if tools else []

                # Load MCP tools if enabled
                mcp_session = await get_mcp_session(task_id)
                if mcp_session:
                    all_tools.extend(mcp_session.get_tools())

                # Initialize tool handler if we have any tools
                tool_handler = ToolHandler(all_tools) if all_tools else None
                client = await get_http_client()
                provider = get_provider(model_config, client)

                # Create stream generator
                stream_gen = (
                    self._handle_tool_calling_flow(
                        provider, messages, tool_handler, cancel_event
                    )
                    if tool_handler and tool_handler.has_tools
                    else provider.stream_chat(messages, cancel_event, tools=None)
                )

                # Start background consumer
                state = StreamState(
                    subtask_id=subtask_id, task_id=task_id, user_message=message
                )
                consumer_task = await stream_manager.create_consumer_task(
                    state, stream_gen, cancel_event, chunk_queue
                )

                # Yield chunks to client
                async for sse_event in self._process_queue(chunk_queue, consumer_task):
                    yield sse_event

            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("[STREAM] subtask=%s error", subtask_id)
            finally:
                if not consumer_task:
                    await session_manager.unregister_stream(subtask_id)
                if acquired:
                    semaphore.release()
                # Cleanup MCP session when stream ends
                if mcp_session:
                    await cleanup_mcp_session(task_id)

        return StreamingResponse(
            generate(), media_type="text/event-stream", headers=_SSE_HEADERS
        )

    async def _process_queue(
        self, chunk_queue: asyncio.Queue, consumer_task: asyncio.Task
    ) -> AsyncGenerator[str, None]:
        """Process queue items and yield SSE events."""
        while True:
            try:
                item = await asyncio.wait_for(chunk_queue.get(), timeout=30.0)
            except asyncio.TimeoutError:
                if consumer_task.done():
                    break
                continue

            item_type = item["type"]
            if item_type == "chunk":
                yield _sse_data({"content": item["content"], "done": False})
            elif item_type == "done":
                yield _sse_data(
                    {"content": "", "done": True, "result": item.get("result")}
                )
                break
            elif item_type == "cancelled":
                yield _sse_data({"content": "", "done": True, "cancelled": True})
                break
            elif item_type == "error":
                yield _sse_data({"error": item["message"]})
                break
            elif item_type == "end":
                break

    async def _handle_tool_calling_flow(
        self,
        provider,
        messages: list[dict[str, Any]],
        tool_handler: ToolHandler,
        cancel_event: asyncio.Event,
    ) -> AsyncGenerator[StreamChunk, None]:
        """
        Handle tool calling flow with request count and time limiting.

        The flow suppresses all intermediate content and only outputs the final
        response after tool execution is complete. The model is asked to summarize
        the tool results in the final step.

        Args:
            provider: LLM provider instance
            messages: Conversation messages
            tool_handler: Tool handler instance
            cancel_event: Cancellation event

        Yields:
            StreamChunk objects for the final response only
        """
        # Use settings
        max_requests = settings.CHAT_TOOL_MAX_REQUESTS
        max_time_seconds = settings.CHAT_TOOL_MAX_TIME_SECONDS

        tools = tool_handler.format_for_provider(provider.provider_name)
        start_time = time.monotonic()
        request_count = 0
        all_tool_results: list[dict[str, Any]] = []

        # Extract original question content for summary request
        original_question = messages[-1]

        while request_count < max_requests:
            # Check time limit
            elapsed = time.monotonic() - start_time
            if elapsed >= max_time_seconds:
                logger.warning(
                    "Tool calling flow exceeded time limit: %.1fs >= %.1fs",
                    elapsed,
                    max_time_seconds,
                )
                break

            # Check cancellation
            if cancel_event.is_set():
                return

            request_count += 1
            logger.debug(
                "Tool calling request %d/%d, elapsed %.1fs/%.1fs",
                request_count,
                max_requests,
                elapsed,
                max_time_seconds,
            )
            accumulator = ToolCallAccumulator()

            async for chunk in provider.stream_chat(
                messages, cancel_event, tools=tools
            ):
                if chunk.type == ChunkType.TOOL_CALL and chunk.tool_call:
                    # Pass thought_signature for Gemini 3 Pro function calling support
                    accumulator.add_chunk(chunk.tool_call, chunk.thought_signature)

            # No tool calls - exit loop to generate final response
            if not accumulator.has_calls():
                break

            # Execute tool calls (suppress intermediate content)
            tool_calls = accumulator.get_calls()
            # Add assistant message with tool calls
            messages.append(ToolHandler.build_assistant_message(None, tool_calls))
            # Execute tools and collect results
            tool_results = await tool_handler.execute_all(tool_calls)
            messages.extend(tool_results)
            all_tool_results.extend(tool_results)

            logger.info(
                "Executed %d tool calls in step %d",
                len(tool_calls),
                request_count,
            )

        logger.info(
            "Tool calling flow completed (requests=%d, time=%.1fs, tool_calls=%d), "
            "generating final response",
            request_count,
            time.monotonic() - start_time,
            len(all_tool_results),
        )

        # If tool execution occurred, add summary request
        if all_tool_results:
            summary_request = (
                "Based on the tool execution results above, directly answer my "
                "original question in the same locale as the question. "
            )
            messages.append({"role": "user", "content": summary_request})
            messages.append(original_question)
        # Final request without tools to get the response
        async for chunk in provider.stream_chat(messages, cancel_event, tools=None):
            yield chunk


# Global chat service instance
chat_service = ChatService()
