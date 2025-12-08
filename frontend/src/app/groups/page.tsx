// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client'

import { useState, useEffect } from 'react'
import { groupApi, Group } from '@/apis/groups'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PlusIcon, UsersIcon } from '@heroicons/react/24/outline'
import { useTranslation } from '@/hooks/useTranslation'

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation('common')

  const loadGroups = async () => {
    try {
      setLoading(true)
      const data = await groupApi.listGroups(true)
      setGroups(data)
    } catch (error) {
      console.error('Failed to load groups:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">
              Groups
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Manage your groups and collaborate with team members
            </p>
          </div>
          <Button
            onClick={() => {
              // TODO: Open create group modal
            }}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  // TODO: Navigate to group detail page
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <UsersIcon className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-semibold text-text-primary">
                        {group.display_name}
                      </h3>
                    </div>
                    <p className="text-sm text-text-muted mb-2">
                      @{group.name}
                    </p>
                    {group.description && (
                      <p className="text-sm text-text-secondary line-clamp-2 mb-3">
                        {group.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <span>
                        {group.member_count || 0} member
                        {(group.member_count || 0) !== 1 ? 's' : ''}
                      </span>
                      {group.role && (
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                          {group.role}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-muted rounded">
                        {group.visibility}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="text-center py-12">
            <UsersIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No groups yet
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Create your first group to start collaborating
            </p>
            <Button
              onClick={() => {
                // TODO: Open create group modal
              }}
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Group
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
