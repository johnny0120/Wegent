// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import '@/features/common/scrollbar.css'
import LoadingState from '@/features/common/LoadingState'
import {
  PencilIcon,
  TrashIcon,
  UsersIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { groupsApi } from '@/apis/groups'
import type { GroupDetail, GroupListItem } from '@/types/group'
import UnifiedAddButton from '@/components/common/UnifiedAddButton'
import { useTranslation } from '@/hooks/useTranslation'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tag } from '@/components/ui/tag'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import GroupEditDrawer from './GroupEditDrawer'

export default function GroupList() {
  const { t } = useTranslation('common')
  const { toast } = useToast()
  const [groups, setGroups] = useState<GroupListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const isMobile = useMediaQuery('(max-width: 639px)')
  const isEditing = editingGroupId !== null

  const loadGroups = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await groupsApi.listGroups()
      setGroups(response.items || [])
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('groups.load_failed'),
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const handleCreateGroup = () => {
    setEditingGroupId(0) // Use 0 to mark new creation
  }

  const handleEditGroup = (group: GroupListItem) => {
    setEditingGroupId(group.id)
  }

  const handleDelete = (groupId: number) => {
    setGroupToDelete(groupId)
    setDeleteConfirmVisible(true)
  }

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return

    setDeletingId(groupToDelete)
    try {
      await groupsApi.deleteGroup(groupToDelete)
      setGroups((prev) => prev.filter((group) => group.id !== groupToDelete))
      setDeleteConfirmVisible(false)
      setGroupToDelete(null)
      toast({
        title: t('groups.delete_success'),
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('groups.delete_failed'),
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirmVisible(false)
    setGroupToDelete(null)
  }

  const handleSaveGroup = async () => {
    await loadGroups()
    setEditingGroupId(null)
  }

  const handleCancelEdit = () => {
    setEditingGroupId(null)
  }

  // Get role display tag
  const getRoleTag = (role: string) => {
    if (role === 'owner') {
      return <Tag variant="success">{t('groups.role_owner')}</Tag>
    } else if (role === 'admin') {
      return <Tag variant="info">{t('groups.role_admin')}</Tag>
    }
    return <Tag variant="default">{t('groups.role_member')}</Tag>
  }

  // Check if edit and delete buttons should be shown
  const canEditOrDelete = (group: GroupListItem) => {
    return group.my_role === 'Owner' || group.my_role === 'Maintainer'
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingState />
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{t('settings.groups')}</h2>
          <p className="text-sm text-text-muted mt-1">{t('groups.description')}</p>
        </div>
        <UnifiedAddButton onClick={handleCreateGroup}>{t('groups.create_new')}</UnifiedAddButton>
      </div>

      {/* Group List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
            <UserGroupIcon className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">{t('groups.empty')}</p>
            <p className="text-xs mt-2">{t('groups.empty_hint')}</p>
          </div>
        ) : (
          <div className="space-y-3 p-1">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <UserGroupIcon className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-medium truncate">{group.display_name || group.name}</h3>
                        {getRoleTag(group.my_role)}
                      </div>
                      {group.description && (
                        <p className="text-sm text-text-muted mt-1 truncate">
                          {group.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <UsersIcon className="w-3 h-3" />
                          {group.member_count || 0} {t('groups.members')}
                        </span>
                      </div>
                    </div>
                  </div>
                  {canEditOrDelete(group) && (
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditGroup(group)
                        }}
                        title={t('common.edit')}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-error hover:text-error hover:bg-error/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(group.id)
                        }}
                        disabled={deletingId === group.id}
                        title={t('common.delete')}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmVisible} onOpenChange={setDeleteConfirmVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('groups.delete_confirm_title')}</DialogTitle>
            <DialogDescription>{t('groups.delete_confirm_message')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deletingId !== null}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Edit Drawer */}
      {isEditing && (
        <GroupEditDrawer
          isOpen={isEditing}
          onClose={handleCancelEdit}
          onSave={handleSaveGroup}
          groupId={editingGroupId === 0 ? null : editingGroupId}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}
