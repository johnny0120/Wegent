// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Link, X, Crown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/use-toast'
import { taskMemberApi, TaskMember } from '@/apis/task-member'
import { useTranslation } from '@/hooks/useTranslation'
import { InviteLinkDialog } from './InviteLinkDialog'
import { cn } from '@/lib/utils'

interface TaskMembersPanelProps {
  open: boolean
  onClose: () => void
  taskId: number
  taskTitle: string
  currentUserId: number
}

export function TaskMembersPanel({
  open,
  onClose,
  taskId,
  taskTitle,
  currentUserId,
}: TaskMembersPanelProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [members, setMembers] = useState<TaskMember[]>([])
  const [taskOwnerId, setTaskOwnerId] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)

  const isOwner = currentUserId === taskOwnerId

  const fetchMembers = useCallback(async () => {
    if (!open) return

    setLoading(true)
    try {
      const response = await taskMemberApi.getMembers(taskId)
      setMembers(response.members)
      setTaskOwnerId(response.task_owner_id)
    } catch (error: unknown) {
      toast({
        title: t('groupChat.members.loadFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [open, taskId, toast, t])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleRemoveMember = async (userId: number, username: string) => {
    if (!isOwner) return

    try {
      await taskMemberApi.removeMember(taskId, userId)
      toast({
        title: t('groupChat.members.removeSuccess', { name: username }),
      })
      fetchMembers()
    } catch (error: unknown) {
      toast({
        title: t('groupChat.members.removeFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('groupChat.members.title')} ({members.length})
            </DialogTitle>
            <DialogDescription>
              {taskTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowInviteDialog(true)}
              >
                <Link className="w-4 h-4 mr-2" />
                {t('groupChat.members.inviteLink')}
              </Button>
            </div>

            {/* Member list */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.id || `owner-${member.user_id}`}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg',
                      'bg-muted hover:bg-muted/80 transition-colors'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar placeholder */}
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {member.username.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-sm">
                            {member.username}
                          </span>
                          {member.is_owner && (
                            <Crown className="w-3 h-3 text-yellow-500" />
                          )}
                          {member.user_id === currentUserId && (
                            <span className="text-xs text-text-muted">
                              ({t('groupChat.members.you')})
                            </span>
                          )}
                        </div>
                        {!member.is_owner && (
                          <p className="text-xs text-text-muted">
                            {t('groupChat.members.invitedBy', {
                              name: member.inviter_name,
                            })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Remove button (only for owner, cannot remove self or other owner) */}
                    {isOwner &&
                      !member.is_owner &&
                      member.user_id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-text-muted hover:text-destructive"
                          onClick={() =>
                            handleRemoveMember(member.user_id, member.username)
                          }
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Link Dialog */}
      <InviteLinkDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        taskId={taskId}
        taskTitle={taskTitle}
      />
    </>
  )
}
