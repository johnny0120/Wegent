#!/usr/bin/env python

# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

# -*- coding: utf-8 -*-

"""
API routes module, defines FastAPI routes and models
"""

import os
import time
from executor_manager.config.config import EXECUTOR_DISPATCHER_MODE
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from shared.logger import setup_logger
from executor_manager.tasks.task_processor import TaskProcessor
from executor_manager.clients.task_api_client import TaskApiClient
from shared.models.task import TasksRequest
from executor_manager.executors.dispatcher import ExecutorDispatcher
from typing import Optional, Dict, Any

# Setup logger
logger = setup_logger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Executor Manager API",
    description="API for managing executor tasks and callbacks",
)

# Create task processor for handling callbacks
task_processor = TaskProcessor()
# Create API client for direct API calls
api_client = TaskApiClient()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Middleware: Log request duration and source IP"""
    start_time = time.time()
    client_ip = request.client.host if request.client else "unknown"
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration in milliseconds
    process_time_ms = (time.time() - start_time) * 1000
    
    # Only log request completion with duration and IP for monitoring purposes
    # Avoid duplicate logging since FastAPI already logs basic request info
    logger.info(f"Request: {request.method} {request.url.path} from {client_ip} - "
                f"Status: {response.status_code} - Time: {process_time_ms:.0f}ms")
    
    return response


# Define callback request model
class CallbackRequest(BaseModel):
    task_id: int
    subtask_id: int
    task_title: Optional[str] = None
    progress: int
    executor_name: Optional[str] = None
    executor_namespace: Optional[str] = None
    status: Optional[str] = None
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


@app.post("/executor-manager/callback")
async def callback_handler(request: CallbackRequest, http_request: Request):
    """
    Receive callback interface for executor task progress and completion.

    Args:
        request: Request body containing task ID, pod name, and progress.

    Returns:
        dict: Processing result
    """
    try:
        client_ip = http_request.client.host if http_request.client else "unknown"
        logger.info(f"Received callback: body={request} from {client_ip}")
        # Directly call the API client to update task status
        success, result = api_client.update_task_status_by_fields(
            task_id=request.task_id,
            subtask_id=request.subtask_id,
            progress=request.progress,
            executor_name=request.executor_name,
            executor_namespace=request.executor_namespace,
            status=request.status,
            error_message=request.error_message,
            title=request.task_title,
            result=request.result,
        )
        if not success:
            logger.warning(f"Failed to update status for task {request.task_id}: {result}")
        logger.info(f"Successfully processed callback for task {request.task_id}")
        return {
            "status": "success",
            "message": f"Successfully processed callback for task {request.task_id}",
        }
    except Exception as e:
        logger.error(f"Error processing callback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/executor-manager/tasks/receive")
async def receive_tasks(request: TasksRequest, http_request: Request):
    """
    Receive tasks in batch via POST.
    Args:
        request: TasksRequest containing a list of tasks.
    Returns:
        dict: result code
    """
    try:
        client_ip = http_request.client.host if http_request.client else "unknown"
        logger.info(
            f"Received {len(request.tasks)} tasks, first task: {request.tasks[0].task_title if request.tasks else 'None'} from {client_ip}"
        )
        # Call the task processor to handle the tasks
        task_processor.process_tasks([task.dict() for task in request.tasks])
        return {"code": 0}
    except Exception as e:
        logger.error(f"Error processing tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


class DeleteExecutorRequest(BaseModel):
    executor_name: str


@app.post("/executor-manager/executor/delete")
async def delete_executor(request: DeleteExecutorRequest, http_request: Request):
    try:
        client_ip = http_request.client.host if http_request.client else "unknown"
        logger.info(f"Received request to delete executor: {request.executor_name} from {client_ip}")
        executor = ExecutorDispatcher.get_executor(EXECUTOR_DISPATCHER_MODE)
        result = executor.delete_executor(request.executor_name)
        return result
    except Exception as e:
        logger.error(f"Error deleting executor '{request.executor_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/executor-manager/executor/load")
async def get_executor_load(http_request: Request):
    try:
        client_ip = http_request.client.host if http_request.client else "unknown"
        logger.info(f"Received request to get executor load from {client_ip}")
        executor = ExecutorDispatcher.get_executor(EXECUTOR_DISPATCHER_MODE)
        result = executor.get_executor_count()
        result["total"] = int(os.getenv("MAX_CONCURRENT_TASKS", "5"))
        return result
    except Exception as e:
        logger.error(f"Error getting executor load: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CancelTaskRequest(BaseModel):
    task_id: int


class ValidateImageRequest(BaseModel):
    """Request body for validating base image compatibility"""
    image: str
    shell_type: str  # e.g., "ClaudeCode", "Agno"


class ImageCheckResult(BaseModel):
    """Individual check result"""
    name: str
    version: Optional[str] = None
    status: str  # 'pass' or 'fail'
    message: Optional[str] = None


class ValidateImageResponse(BaseModel):
    """Response for image validation"""
    valid: bool
    checks: list
    errors: list


@app.post("/executor-manager/images/validate")
async def validate_image(request: ValidateImageRequest, http_request: Request):
    """
    Validate if a base image is compatible with a specific shell type.

    This endpoint pulls the image and runs a temporary container to check for required dependencies:
    - ClaudeCode: Node.js 20.x, claude-code CLI, SQLite 3.50+, Python 3.12
    - Agno: Python 3.12
    - Dify: No check needed (external_api type)

    Note: Only supports public image registries.
    """
    import subprocess
    import re as re_module

    client_ip = http_request.client.host if http_request.client else "unknown"
    logger.info(f"Received image validation request: image={request.image}, shell_type={request.shell_type} from {client_ip}")

    shell_type = request.shell_type
    image = request.image

    # Dify doesn't need validation
    if shell_type == "Dify":
        return ValidateImageResponse(
            valid=True,
            checks=[],
            errors=["Dify is an external_api type and doesn't require image validation"],
        )

    # Define checks based on shell type
    checks_config = {
        "ClaudeCode": [
            {
                "name": "node",
                "command": "node --version",
                "version_regex": r"v(\d+\.\d+\.\d+)",
                "min_version": "20.0.0",
            },
            {
                "name": "claude-code",
                "command": "claude --version 2>/dev/null || echo 'not found'",
                "version_regex": r"(\d+\.\d+\.\d+)",
                "min_version": None,
            },
            {
                "name": "sqlite",
                "command": "sqlite3 --version",
                "version_regex": r"(\d+\.\d+\.\d+)",
                "min_version": "3.50.0",
            },
            {
                "name": "python",
                "command": "python3 --version",
                "version_regex": r"Python (\d+\.\d+\.\d+)",
                "min_version": "3.12.0",
            },
        ],
        "Agno": [
            {
                "name": "python",
                "command": "python3 --version",
                "version_regex": r"Python (\d+\.\d+\.\d+)",
                "min_version": "3.12.0",
            },
        ],
    }

    if shell_type not in checks_config:
        return ValidateImageResponse(
            valid=False, checks=[], errors=[f"Unknown shell type: {shell_type}"]
        )

    checks_to_run = checks_config[shell_type]
    results = []
    errors = []
    all_passed = True

    try:
        # Pull the image first (with timeout)
        logger.info(f"Pulling image {image} for validation...")
        pull_result = subprocess.run(
            ["docker", "pull", image],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutes timeout for pull
        )
        if pull_result.returncode != 0:
            logger.error(f"Failed to pull image {image}: {pull_result.stderr}")
            return ValidateImageResponse(
                valid=False,
                checks=[],
                errors=[f"Failed to pull image: {pull_result.stderr}"],
            )

        # Run checks in a single container for efficiency
        for check in checks_to_run:
            try:
                result = subprocess.run(
                    [
                        "docker",
                        "run",
                        "--rm",
                        image,
                        "sh",
                        "-c",
                        check["command"],
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )

                output = result.stdout.strip()
                if result.returncode != 0 or "not found" in output.lower():
                    results.append(
                        ImageCheckResult(
                            name=check["name"],
                            status="fail",
                            message="Command failed or not found",
                        ).model_dump()
                    )
                    all_passed = False
                    continue

                # Extract version
                version_match = re_module.search(check["version_regex"], output)
                if version_match:
                    version = version_match.group(1)
                    # Check minimum version if specified
                    if check["min_version"]:
                        from packaging import version as pkg_version

                        try:
                            if pkg_version.parse(version) < pkg_version.parse(
                                check["min_version"]
                            ):
                                results.append(
                                    ImageCheckResult(
                                        name=check["name"],
                                        version=version,
                                        status="fail",
                                        message=f"Version {version} < required {check['min_version']}",
                                    ).model_dump()
                                )
                                all_passed = False
                                continue
                        except Exception:
                            pass  # Skip version comparison on error

                    results.append(
                        ImageCheckResult(
                            name=check["name"], version=version, status="pass"
                        ).model_dump()
                    )
                else:
                    results.append(
                        ImageCheckResult(
                            name=check["name"],
                            status="pass",
                            message="Detected but version not parsed",
                        ).model_dump()
                    )

            except subprocess.TimeoutExpired:
                results.append(
                    ImageCheckResult(
                        name=check["name"], status="fail", message="Check timed out"
                    ).model_dump()
                )
                all_passed = False
            except Exception as e:
                results.append(
                    ImageCheckResult(
                        name=check["name"], status="fail", message=str(e)
                    ).model_dump()
                )
                all_passed = False

    except subprocess.TimeoutExpired:
        logger.error(f"Image pull timed out for {image}")
        return ValidateImageResponse(
            valid=False, checks=results, errors=["Image pull timed out"]
        )
    except Exception as e:
        logger.error(f"Image validation error for {image}: {e}")
        return ValidateImageResponse(
            valid=False, checks=results, errors=[f"Validation error: {str(e)}"]
        )

    logger.info(f"Image validation completed for {image}: valid={all_passed}")
    return ValidateImageResponse(valid=all_passed, checks=results, errors=errors)


@app.post("/executor-manager/tasks/cancel")
async def cancel_task(request: CancelTaskRequest, http_request: Request):
    """
    Cancel a running task by calling the executor's cancel API.

    Args:
        request: Request containing task_id to cancel

    Returns:
        dict: Cancellation result
    """
    try:
        client_ip = http_request.client.host if http_request.client else "unknown"
        logger.info(f"Received request to cancel task {request.task_id} from {client_ip}")

        executor = ExecutorDispatcher.get_executor(EXECUTOR_DISPATCHER_MODE)
        result = executor.cancel_task(request.task_id)

        if result["status"] == "success":
            logger.info(f"Successfully cancelled task {request.task_id}")
            return result
        else:
            logger.warning(f"Failed to cancel task {request.task_id}: {result.get('error_msg', 'Unknown error')}")
            raise HTTPException(status_code=400, detail=result.get("error_msg", "Failed to cancel task"))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling task {request.task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
