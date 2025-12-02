// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client'

import React, { useEffect, useState } from 'react'
import { groupsApi } from '@/apis/groups'
import type { GroupCreate, GroupDetail, GroupUpdate } from '@/types/group'
import { useTranslation } from '@/hooks/useTranslation'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const isCreate = groupId === null

  useEffect(() => {
    if (isOpen && !isCreate && groupId) {
      loadGroup()
    } else if (isOpen && isCreate) {
      setName('')
      setDescription('')
    }
  }, [isOpen, isCreate, groupId])

  const loadGroup = async () => {
    if (!groupId) return
    try {
      const group = await groupsApi.getGroup(groupId)
      setName(group.name)
      setDescription(group.description || '')
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
        <Label htmlFor="group-name">{t('groups.name')}</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('groups.name_placeholder')}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-description">{t('groups.description')}</Label>
        <Input
          id="group-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('groups.description_placeholder')}
          disabled={isLoading}
        />
      </div>

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
