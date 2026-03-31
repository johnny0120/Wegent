// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client'

import React, { useState } from 'react'
import { Share2, Check, Loader2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/hooks/useTranslation'
import { createAttachmentShareLink } from '@/apis/attachments'

interface ExpiryOption {
  days: number
  labelKey: string
}

interface ShareButtonProps {
  /** Attachment ID to share */
  attachmentId: number
  /** Whether the user can share (owner only) */
  canShare?: boolean
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost'
  /** Button size */
  size?: 'sm' | 'default' | 'icon'
  /** Additional CSS classes */
  className?: string
}

export function ShareButton({
  attachmentId,
  canShare,
  variant = 'outline',
  size = 'sm',
  className = '',
}: ShareButtonProps) {
  const { t, i18n } = useTranslation('common')
  const { toast } = useToast()
  const [isSharing, setIsSharing] = useState(false)
  const [shared, setShared] = useState(false)
  const [open, setOpen] = useState(false)

  // Expiry options - supporting up to 3650 days (10 years) for long-term access
  const expiryOptions: ExpiryOption[] = [
    { days: 1, labelKey: 'attachment.share.expiry.1day' },
    { days: 7, labelKey: 'attachment.share.expiry.7days' },
    { days: 30, labelKey: 'attachment.share.expiry.30days' },
    { days: 365, labelKey: 'attachment.share.expiry.1year' },
    { days: 3650, labelKey: 'attachment.share.expiry.10years' },
  ]

  const handleShare = async (days: number) => {
    if (!attachmentId || !canShare) return

    setIsSharing(true)
    setOpen(false)
    try {
      const response = await createAttachmentShareLink(attachmentId, days)
      await navigator.clipboard.writeText(response.share_url)
      setShared(true)

      // Calculate expiry date for display
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + days)
      const formattedDate = expiryDate.toLocaleDateString(
        i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' }
      )

      toast({
        title: t('attachment.share.link_copied_title'),
        description: t('attachment.share.link_copied_with_expiry', {
          date: formattedDate,
          days:
            days >= 3650
              ? t('attachment.share.expiry.10years')
              : `${days}${t('attachment.share.expiry.days')}`,
        }),
      })

      // Reset copied state after 2 seconds
      setTimeout(() => setShared(false), 2000)
    } catch (err) {
      console.error('Failed to create share link:', err)
      toast({
        variant: 'destructive',
        title: t('attachment.share.generate_failed_title'),
        description: err instanceof Error ? err.message : t('attachment.share.retry'),
      })
    } finally {
      setIsSharing(false)
    }
  }

  if (!canShare) {
    return null
  }

  const buttonIcon = isSharing ? (
    <Loader2 className="w-4 h-4 animate-spin" />
  ) : shared ? (
    <Check className="w-4 h-4" />
  ) : (
    <Share2 className="w-4 h-4" />
  )

  const buttonText = isSharing
    ? t('actions.generating')
    : shared
      ? t('actions.copied')
      : t('actions.share')

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isSharing}
          className={`h-9 px-2 sm:px-3 ${className}`}
          title={t('actions.share')}
        >
          {buttonIcon}
          <span className="hidden sm:inline ml-2">{buttonText}</span>
          {!isSharing && !shared && <ChevronDown className="w-3 h-3 ml-1 opacity-50" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t('attachment.share.expiry.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {expiryOptions.map(option => (
          <DropdownMenuItem
            key={option.days}
            onClick={() => handleShare(option.days)}
            disabled={isSharing}
          >
            {t(option.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
