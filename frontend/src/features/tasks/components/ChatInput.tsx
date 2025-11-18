// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client';

import React, { useState, useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useTranslation } from '@/hooks/useTranslation';
import { useIsMobile } from '@/features/layout/hooks/useMediaQuery';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  handleSendMessage: () => void;
  isLoading: boolean;
  disabled?: boolean;
  taskType?: 'chat' | 'code';
}

export default function ChatInput({
  message,
  setMessage,
  handleSendMessage,
  disabled = false,
  taskType = 'code',
}: ChatInputProps) {
  const { t } = useTranslation('common');
  const placeholderKey = taskType === 'chat' ? 'chat.placeholder_chat' : 'chat.placeholder_code';
  const [isComposing, setIsComposing] = useState(false);
  const isMobile = useIsMobile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Mobile: Allow Enter to create new lines, users send via button
    if (isMobile) {
      return;
    }

    // Desktop: Enter sends message, Shift+Enter creates new line
    if (e.key === 'Enter' && !e.shiftKey && !disabled && !isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Enter key for auto-indentation (only when Shift+Enter)
    if (e.key === 'Enter' && e.shiftKey && !disabled && !isComposing) {
      e.preventDefault();

      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      // Get the current line and its leading whitespace
      const lines = value.substring(0, start).split('\n');
      const currentLine = lines[lines.length - 1];
      const leadingWhitespace = currentLine.match(/^\s*/)?.[0] || '';

      // Insert new line with preserved indentation
      const newValue = value.substring(0, start) + '\n' + leadingWhitespace + value.substring(end);

      setMessage(newValue);

      // Set cursor position after the inserted whitespace
      setTimeout(() => {
        textarea.selectionStart = start + 1 + leadingWhitespace.length;
        textarea.selectionEnd = start + 1 + leadingWhitespace.length;
      }, 0);
    }
  };

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="w-full">
      <TextareaAutosize
        ref={textareaRef}
        value={message}
        onChange={e => {
          if (!disabled) setMessage(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onKeyPress={handleKeyPress}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        placeholder={t(placeholderKey)}
        className={`w-full p-3 bg-transparent custom-scrollbar text-text-primary text-base placeholder:text-text-muted placeholder:text-base focus:outline-none data-[focus]:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={disabled}
        minRows={isMobile ? 2 : 3}
        maxRows={isMobile ? 6 : 8}
        style={{ resize: 'none', overflow: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
      />
    </div>
  );
}
