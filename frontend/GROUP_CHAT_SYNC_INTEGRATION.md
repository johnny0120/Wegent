# Group Chat Real-Time Sync - Frontend Integration Guide

## Overview

This document describes the frontend implementation for real-time message synchronization in group chats. The implementation uses a polling + SSE hybrid architecture to ensure all group members receive live updates.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                Frontend Components                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  GroupChatSyncManager (React Component)                 │
│         │                                                │
│         ├─── useGroupChatPolling (Hook)                 │
│         │         └─── pollNewMessages() every 1s       │
│         │                                                │
│         └─── useGroupChatStream (Hook)                  │
│                   └─── subscribeGroupStream() via SSE   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. API Client (`/src/apis/group-chat.ts`)

Provides three API functions:

- **`pollNewMessages(taskId, lastSubtaskId?, since?)`**
  Polls for new messages since the last received message.

- **`getStreamingStatus(taskId)`**
  Gets the current streaming status for a task.

- **`subscribeGroupStream(taskId, subtaskId, offset?)`**
  Creates an EventSource to subscribe to a stream via SSE.

### 2. Polling Hook (`/src/hooks/useGroupChatPolling.ts`)

Polls for new messages every 1 second (configurable).

**Usage:**
```tsx
const {
  newMessages,      // New messages received
  isPolling,        // Whether currently polling
  hasStreaming,     // Whether there's an active stream
  streamingSubtaskId, // ID of streaming subtask
  error,            // Any polling errors
  clearMessages,    // Clear accumulated messages
} = useGroupChatPolling({
  taskId: 123,
  isGroupChat: true,
  enabled: true,
  pollingInterval: 1000,
  onNewMessages: (messages) => {
    // Handle new messages
  },
  onStreamingDetected: (subtaskId) => {
    // Handle stream detection
  },
})
```

### 3. Stream Hook (`/src/hooks/useGroupChatStream.ts`)

Subscribes to an active stream via SSE.

**Usage:**
```tsx
const {
  content,          // Accumulated streaming content
  isStreaming,      // Whether currently streaming
  isComplete,       // Whether stream completed
  error,            // Any stream errors
  result,           // Final result when complete
  disconnect,       // Manually disconnect
} = useGroupChatStream({
  taskId: 123,
  subtaskId: 456,   // undefined = not subscribed
  offset: 0,        // For recovery
  onChunk: (chunk) => {
    // Handle each chunk
  },
  onComplete: (result) => {
    // Handle completion
  },
  onError: (error) => {
    // Handle errors
  },
})
```

### 4. Sync Manager Component (`/src/features/tasks/components/group-chat/GroupChatSyncManager.tsx`)

Combines polling and streaming into a single component.

**Usage:**
```tsx
<GroupChatSyncManager
  taskId={currentTaskId}
  isGroupChat={task.isGroupChat}
  enabled={isActive}
  onNewMessages={(messages) => {
    // Add messages to message list
  }}
  onStreamContent={(content, subtaskId) => {
    // Update streaming content
  }}
  onStreamComplete={(subtaskId, result) => {
    // Finalize message
  }}
/>
```

## Integration Steps

### Step 1: Add GroupChatSyncManager to ChatArea

In `/src/features/tasks/components/ChatArea.tsx`:

```tsx
import { GroupChatSyncManager } from './group-chat'

export default function ChatArea({ ... }) {
  // ... existing code ...

  return (
    <div>
      {/* Add sync manager for group chats */}
      {currentTask && isGroupChat && (
        <GroupChatSyncManager
          taskId={currentTask.id}
          isGroupChat={isGroupChat}
          enabled={isActive}
          onNewMessages={handleNewMessages}
          onStreamContent={handleStreamContent}
          onStreamComplete={handleStreamComplete}
        />
      )}

      {/* Existing MessagesArea and ChatInput */}
      <MessagesArea ... />
      <ChatInput ... />
    </div>
  )
}
```

### Step 2: Implement Message Handlers

```tsx
const handleNewMessages = useCallback((messages: SubtaskWithSender[]) => {
  // Add new messages to the messages list
  setMessages(prev => [...prev, ...messages])

  // Scroll to bottom
  scrollToBottom()
}, [])

const handleStreamContent = useCallback((content: string, subtaskId: number) => {
  // Update the streaming message in real-time
  setMessages(prev => prev.map(msg =>
    msg.id === subtaskId
      ? { ...msg, content, status: 'RUNNING' }
      : msg
  ))
}, [])

const handleStreamComplete = useCallback((subtaskId: number, result?: Record<string, any>) => {
  // Mark message as complete
  setMessages(prev => prev.map(msg =>
    msg.id === subtaskId
      ? { ...msg, status: 'COMPLETED', result }
      : msg
  ))
}, [])
```

### Step 3: Update MessageBubble to Show Sender

In `/src/features/tasks/components/MessageBubble.tsx`:

```tsx
interface MessageBubbleProps {
  message: SubtaskWithSender
  isGroupChat?: boolean
  currentUserId?: number
}

export function MessageBubble({ message, isGroupChat, currentUserId }: MessageBubbleProps) {
  const isOwnMessage = message.sender_user_id === currentUserId
  const senderName = message.sender_username || 'Unknown'

  return (
    <div className={isOwnMessage ? 'self-end' : 'self-start'}>
      {/* Show sender name for group chat */}
      {isGroupChat && !isOwnMessage && message.sender_type === 'USER' && (
        <div className="text-xs text-text-muted mb-1">
          {senderName}
        </div>
      )}

      {/* Show "AI (triggered by XXX)" for AI messages */}
      {isGroupChat && message.sender_type === 'TEAM' && (
        <div className="text-xs text-text-muted mb-1">
          🤖 AI (triggered by {senderName})
        </div>
      )}

      {/* Message content */}
      <div className="rounded-lg p-3 bg-surface">
        {message.content}
      </div>
    </div>
  )
}
```

## Configuration

### Polling Interval

Default is 1000ms (1 second). Adjust via `pollingInterval` prop:

```tsx
<GroupChatSyncManager
  pollingInterval={2000} // 2 seconds
  ...
/>
```

### Stream Recovery

The stream hook supports offset-based recovery:

```tsx
useGroupChatStream({
  taskId,
  subtaskId,
  offset: lastReceivedCharCount, // Continue from this position
})
```

## Error Handling

Both hooks expose error states:

```tsx
const { error: pollingError } = useGroupChatPolling(...)
const { error: streamError } = useGroupChatStream(...)

// Show error toast
useEffect(() => {
  if (pollingError) {
    toast.error('Failed to poll messages')
  }
}, [pollingError])
```

## Performance Considerations

1. **Polling Frequency**: 1 second is recommended. Lower values increase server load.
2. **Message Limit**: Backend limits messages to prevent memory issues.
3. **Cleanup**: Hooks automatically clean up on unmount.
4. **EventSource**: Automatically reconnects on connection loss.

## Testing Checklist

- [ ] Polling fetches new messages correctly
- [ ] Streaming content updates in real-time
- [ ] Multiple users see each other's messages
- [ ] AI responses from other users are visible
- [ ] Sender names display correctly
- [ ] Reconnection works after disconnect
- [ ] Error states show appropriate messages
- [ ] Component unmounts cleanly

## Future Enhancements

1. **WebSocket Support**: Replace polling with WebSocket for better performance
2. **Message Caching**: Cache messages in IndexedDB for offline access
3. **Read Receipts**: Track who has read which messages
4. **Typing Indicators**: Show when other users are typing
5. **Message Reactions**: Allow users to react to messages

## Related Files

- Backend API: `/backend/app/api/endpoints/subtasks.py`
- Backend Service: `/backend/app/services/subtask.py`
- Backend Session Manager: `/backend/app/services/chat/session_manager.py`
- Frontend API Client: `/frontend/src/apis/group-chat.ts`
- Frontend Hooks: `/frontend/src/hooks/useGroupChatPolling.ts`, `/frontend/src/hooks/useGroupChatStream.ts`
- Frontend Component: `/frontend/src/features/tasks/components/group-chat/GroupChatSyncManager.tsx`
