// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';
import type { SensitiveMatch } from '@/apis/sensitive-content';

interface SensitiveContentWarningDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog state changes */
  onOpenChange: (open: boolean) => void;
  /** List of detected sensitive content */
  matches: SensitiveMatch[];
  /** Callback when user confirms to proceed */
  onConfirm: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
}

/**
 * Warning dialog for sensitive content detection
 *
 * Shows detected sensitive content and requires user acknowledgment before proceeding
 */
export default function SensitiveContentWarningDialog({
  open,
  onOpenChange,
  matches,
  onConfirm,
  onCancel,
}: SensitiveContentWarningDialogProps) {
  const [acknowledged, setAcknowledged] = React.useState(false);

  // Reset acknowledged state when dialog opens
  React.useEffect(() => {
    if (open) {
      setAcknowledged(false);
    }
  }, [open]);

  const handleConfirm = () => {
    if (acknowledged) {
      onConfirm();
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md sm:max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-error/10">
              <AlertTriangle className="h-6 w-6 text-error" />
            </div>
            <AlertDialogTitle className="text-xl">检测到敏感信息</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-3">
            <p className="text-text-primary">
              您的输入内容可能包含以下敏感信息,继续发送可能存在安全风险:
            </p>
            <div className="space-y-2 bg-surface rounded-lg p-4 border border-border">
              {matches.map((match, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-error font-medium">•</span>
                  <div className="flex-1">
                    <p className="text-text-primary font-medium">{match.message}</p>
                    <p className="text-text-muted text-xs mt-1">
                      匹配内容: <code className="bg-code-bg px-1 rounded">{match.matched_text}</code>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-muted rounded-lg p-3 text-text-secondary text-sm space-y-2">
              <p className="font-medium text-text-primary">⚠️ 安全提示:</p>
              <ul className="space-y-1 pl-4 list-disc text-xs">
                <li>请勿在对话中直接分享密码、API密钥等敏感凭证</li>
                <li>避免发送个人身份信息、手机号码、银行卡号等</li>
                <li>如需分享敏感信息,建议使用安全的替代方式</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-2 py-2">
          <Checkbox
            id="acknowledge-risk"
            checked={acknowledged}
            onCheckedChange={checked => setAcknowledged(checked as boolean)}
            className="mt-0.5"
          />
          <label
            htmlFor="acknowledge-risk"
            className="text-sm text-text-secondary cursor-pointer select-none"
          >
            我已知晓风险,仍要继续发送
          </label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} className="sm:mr-2">
            取消发送
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!acknowledged}
            className="bg-error hover:bg-error/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            继续发送
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
