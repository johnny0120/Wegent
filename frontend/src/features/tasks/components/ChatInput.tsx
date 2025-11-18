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

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = e.target as HTMLTextAreaElement;
    const value = textarea.value;

    // Handle line formatting similar to markdown
    // When user presses Enter, maintain the indentation and formatting
    if (value.includes('\n')) {
      const lines = value.split('\n');
      const formattedLines = lines.map((line, index) => {
        // For lines after the first one, preserve leading spaces/tabs
        if (index > 0) {
          // Count leading whitespace in the previous line
          const prevLine = lines[index - 1];
          const leadingWhitespace = prevLine.match(/^\s*/)?.[0] || '';

          // If current line is empty and previous line has content, preserve indentation
          if (line.trim() === '' && prevLine.trim() !== '') {
            return leadingWhitespace;
          }
        }
        return line;
      });

      const formattedValue = formattedLines.join('\n');
      if (formattedValue !== value) {
        setMessage(formattedValue);
        return;
      }
    }

    setMessage(value);
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
        onInput={handleInput}
        onKeyDown={handleKeyPress}
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
