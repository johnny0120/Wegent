// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client'

import React, { useEffect, useState } from 'react'
import { groupsApi } from '@/apis/groups'
import type { GroupCreate, GroupDetail, GroupUpdate, GroupListItem } from '@/types/group'
import { useTranslation } from '@/hooks/useTranslation'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
interface GroupEditDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  groupId: number | null // null for create, number for edit
  isMobile: boolean
}

export default function GroupEditDrawer({
  isOpen,
  onClose,
  onSave,
  groupId,
  isMobile,
}: GroupEditDrawerProps) {
  const { t } = useTranslation('common')
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState<number | null>(null)
  const [availableGroups, setAvailableGroups] = useState<GroupListItem[]>([])
  const isCreate = groupId === null

  useEffect(() => {
    if (isOpen) {
      loadAvailableGroups()
      if (!isCreate && groupId) {
        loadGroup()
      } else if (isCreate) {
        setName('')
        setDescription('')
        setParentId(null)
      }
    }
  }, [isOpen, isCreate, groupId])

  const loadAvailableGroups = async () => {
    try {
      const response = await groupsApi.listGroups()
      const groups = response && response.items ? response.items : (Array.isArray(response) ? response : [])
      // Filter out the current group if editing to prevent circular reference
      const filteredGroups = isCreate ? groups : groups.filter(g => g.id !== groupId)
      setAvailableGroups(filteredGroups)
    } catch (error) {
      console.error('Failed to load available groups:', error)
      setAvailableGroups([])
    }
  }

  const loadGroup = async () => {
    if (!groupId) return
    try {
      const group = await groupsApi.getGroup(groupId)
      setName(group.name)
      setDescription(group.description || '')
      setParentId(group.parent_id || null)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('groups.load_failed'),
      })
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: t('groups.name_required'),
      })
      return
    }

    setIsLoading(true)
    try {
      if (isCreate) {
        const data: GroupCreate = {
          name: name.trim(),
          description: description.trim() || undefined,
          parent_id: parentId || undefined,
        }
        await groupsApi.createGroup(data)
        toast({
          title: t('groups.create_success'),
        })
      } else if (groupId) {
        const data: GroupUpdate = {
          name: name.trim(),
          description: description.trim() || undefined,
        }
        await groupsApi.updateGroup(groupId, data)
        toast({
          title: t('groups.update_success'),
        })
      }
      onSave()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: isCreate ? t('groups.create_failed') : t('groups.update_failed'),
        description: error?.response?.data?.detail || error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="group-name">
          {t('groups.name')}
          <span className="text-red-500 ml-1">*</span>
        </Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('groups.name_placeholder')}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-description">群组描述</Label>
        <Input
          id="group-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="请输入群组描述"
          disabled={isLoading}
        />
      </div>

      {isCreate && (
        <div className="space-y-2">
          <Label htmlFor="parent-group">父群组</Label>
          <Select value={parentId?.toString() || 'none'} onValueChange={(value) => setParentId(value === 'none' ? null : parseInt(value))}>
            <SelectTrigger>
              <SelectValue placeholder="选择父群组（留空表示顶级群组）" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">无（顶级群组）</SelectItem>
              {availableGroups.map((group) => (
                <SelectItem key={group.id} value={group.id.toString()}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? t('common.saving') : isCreate ? t('common.create') : t('common.save')}
        </Button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>
              {isCreate ? t('groups.create_new') : t('groups.edit_group')}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? t('groups.create_new') : t('groups.edit_group')}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">{content}</div>
      </DialogContent>
    </Dialog>
  )
}
