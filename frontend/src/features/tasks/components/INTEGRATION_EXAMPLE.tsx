// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Example integration of GroupChatSyncManager into ChatArea component
 *
 * This file demonstrates how to integrate the real-time sync functionality
 * into the existing ChatArea component. Copy the relevant sections into
 * your actual ChatArea.tsx file.
 */

import { useCallback, useEffect, useState } from 'react'
import { GroupChatSyncManager } from './group-chat'
import type { SubtaskWithSender } from '@/apis/group-chat'
import type { TaskDetailSubtask } from '@/types/api'
import { useTaskContext } from '../contexts/taskContext'

/**
 * Step 1: Add state for tracking group chat sync
 * Add this near the top of your ChatArea component
 */
function useChatAreaGroupSync() {
  const { selectedTaskDetail } = useTaskContext()
  const [groupChatMessages, setGroupChatMessages] = useState<SubtaskWithSender[]>([])

  // Check if current task is a group chat
  const isGroupChat = selectedTaskDetail?.is_group_chat || false
  const taskId = selectedTaskDetail?.id

  return {
    isGroupChat,
    taskId,
    groupChatMessages,
    setGroupChatMessages,
  }
}

/**
 * Step 2: Implement message handlers
 * Add these callbacks in your ChatArea component
 */
function useGroupChatHandlers(
  selectedTaskDetail: any,
  refreshSelectedTaskDetail: () => Promise<void>
) {
  /**
   * Handle new messages polled from backend
   */
  const handleNewMessages = useCallback((messages: SubtaskWithSender[]) => {
    console.log('[GroupChat] Received new messages:', messages)

    // Option 1: Refresh the entire task detail to get new subtasks
    if (messages.length > 0) {
      refreshSelectedTaskDetail()
    }

    // Option 2: Manually append new subtasks (more efficient)
    // if (selectedTaskDetail) {
    //   const newSubtasks = messages.map(convertToTaskDetailSubtask)
    //   setSelectedTaskDetail(prev => ({
    //     ...prev,
    //     subtasks: [...prev.subtasks, ...newSubtasks]
    //   }))
    // }
  }, [refreshSelectedTaskDetail])

  /**
   * Handle streaming content updates
   */
  const handleStreamContent = useCallback((content: string, subtaskId: number) => {
    console.log('[GroupChat] Stream content update:', { subtaskId, contentLength: content.length })

    // Update the specific subtask's content in real-time
    // This requires modifying the subtasks array in selectedTaskDetail
    // You can implement this by updating the task context or local state

    // Example implementation (pseudo-code):
    // setSelectedTaskDetail(prev => ({
    //   ...prev,
    //   subtasks: prev.subtasks.map(sub =>
    //     sub.id === subtaskId
    //       ? { ...sub, result: { ...sub.result, value: content }, status: 'RUNNING' }
    //       : sub
    //   )
    // }))
  }, [])

  /**
   * Handle streaming completion
   */
  const handleStreamComplete = useCallback((subtaskId: number, result?: Record<string, any>) => {
    console.log('[GroupChat] Stream complete:', { subtaskId, result })

    // Mark the subtask as completed and refresh to get the final result
    refreshSelectedTaskDetail()

    // Or update locally:
    // setSelectedTaskDetail(prev => ({
    //   ...prev,
    //   subtasks: prev.subtasks.map(sub =>
    //     sub.id === subtaskId
    //       ? { ...sub, result, status: 'COMPLETED' }
    //       : sub
    //   )
    // }))
  }, [refreshSelectedTaskDetail])

  return {
    handleNewMessages,
    handleStreamContent,
    handleStreamComplete,
  }
}

/**
 * Step 3: Add GroupChatSyncManager to the component JSX
 * Insert this in the render section of ChatArea, typically near the top
 * before MessagesArea
 */
export function ExampleChatAreaIntegration() {
  const { selectedTaskDetail, refreshSelectedTaskDetail } = useTaskContext()
  const { isGroupChat, taskId } = useChatAreaGroupSync()

  const {
    handleNewMessages,
    handleStreamContent,
    handleStreamComplete,
  } = useGroupChatHandlers(selectedTaskDetail, refreshSelectedTaskDetail)

  return (
    <div className="chat-area-container">
      {/* Add GroupChatSyncManager when viewing a group chat task */}
      {isGroupChat && taskId && (
        <GroupChatSyncManager
          taskId={taskId}
          isGroupChat={isGroupChat}
          enabled={true}
          onNewMessages={handleNewMessages}
          onStreamContent={handleStreamContent}
          onStreamComplete={handleStreamComplete}
        />
      )}

      {/* Rest of your ChatArea component */}
      {/* <MessagesArea subtasks={subtasks} isGroupChat={isGroupChat} /> */}
      {/* <ChatInput ... /> */}
    </div>
  )
}

/**
 * Step 4: Update MessagesArea to display sender names
 * In your MessagesArea component, pass the isGroupChat flag
 * and current user info to MessageBubble
 */
export function ExampleMessagesAreaIntegration() {
  const isGroupChat = true // Get from props or context
  const currentUserId = 123 // Get from user context

  return (
    <div className="messages-area">
      {/* Map over subtasks and render MessageBubble with group chat support */}
      {/* {subtasks.map(subtask => (
        <MessageBubble
          key={subtask.id}
          subtask={subtask}
          isGroupChat={isGroupChat}
          currentUserId={currentUserId}
          showSenderName={isGroupChat}
        />
      ))} */}
    </div>
  )
}

/**
 * Step 5: Update MessageBubble to show sender information
 * Add this logic to your MessageBubble component
 */
export function ExampleMessageBubbleIntegration({ subtask, isGroupChat, currentUserId }: any) {
  const isOwnMessage = subtask.sender_user_id === currentUserId || subtask.user_id === currentUserId
  const senderName = subtask.sender_username || 'Unknown User'
  const isUserMessage = subtask.role === 'USER' || subtask.sender_type === 'USER'
  const isAIMessage = subtask.role === 'ASSISTANT' || subtask.sender_type === 'TEAM'

  return (
    <div className={`message-bubble ${isOwnMessage ? 'own-message' : 'other-message'}`}>
      {/* Show sender name for group chat messages from other users */}
      {isGroupChat && !isOwnMessage && isUserMessage && (
        <div className="text-xs text-text-muted mb-1 font-medium">
          {senderName}
        </div>
      )}

      {/* Show "AI (triggered by XXX)" for AI responses */}
      {isGroupChat && isAIMessage && subtask.sender_username && (
        <div className="text-xs text-text-muted mb-1 flex items-center gap-1">
          <span>🤖 AI</span>
          <span className="text-text-secondary">(triggered by {subtask.sender_username})</span>
        </div>
      )}

      {/* Message content */}
      <div className="message-content">
        {/* Your existing message rendering logic */}
      </div>
    </div>
  )
}

/**
 * INTEGRATION CHECKLIST:
 *
 * [ ] 1. Add is_group_chat field to TaskDetail type (✅ Done)
 * [ ] 2. Add sender fields to TaskDetailSubtask type (✅ Done)
 * [ ] 3. Import GroupChatSyncManager in ChatArea.tsx
 * [ ] 4. Add state and handlers using the hooks above
 * [ ] 5. Insert <GroupChatSyncManager /> in ChatArea JSX
 * [ ] 6. Update MessagesArea to pass isGroupChat prop
 * [ ] 7. Update MessageBubble to display sender names
 * [ ] 8. Test with multiple users in a group chat
 * [ ] 9. Verify polling works (check network tab)
 * [ ] 10. Verify streaming works (check SSE connection)
 *
 * TESTING STEPS:
 *
 * 1. Create a group chat task (convert existing task)
 * 2. Invite another user to the group chat
 * 3. Send a message from User A
 * 4. Verify User B sees the message within 1 second
 * 5. Trigger AI from User A (send @TeamName message)
 * 6. Verify User B sees the AI response streaming in real-time
 * 7. Refresh the page during streaming
 * 8. Verify the stream continues (offset-based recovery)
 * 9. Check browser console for any errors
 * 10. Check network tab for polling requests (every 1s)
 */
