// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

/**
 * API client for Group management
 */

import { apiClient } from './client'

export interface Group {
  id: number
  name: string
  display_name: string
  description?: string
  visibility: 'private' | 'public'
  parent_id?: number
  owner_user_id: number
  is_active: boolean
  created_at: string
  updated_at: string
  member_count?: number
  role?: string
}

export interface GroupMember {
  id: number
  group_name: string
  user_id: number
  role: 'owner' | 'admin' | 'member'
  invited_by_user_id?: number
  is_active: boolean
  created_at: string
  updated_at: string
  user_name?: string
  user_email?: string
}

export interface CreateGroupRequest {
  name: string
  display_name: string
  description?: string
  visibility?: 'private' | 'public'
  parent_id?: number
}

export interface UpdateGroupRequest {
  display_name?: string
  description?: string
  visibility?: 'private' | 'public'
  parent_id?: number
}

export interface AddMemberRequest {
  user_id: number
  role?: 'admin' | 'member'
}

export interface UpdateMemberRequest {
  role: 'admin' | 'member'
}

export const groupApi = {
  /**
   * Create a new group
   */
  async createGroup(data: CreateGroupRequest): Promise<Group> {
    const response = await apiClient.post('/groups', data)
    return response.data
  },

  /**
   * List all groups accessible to the current user
   */
  async listGroups(includePublic: boolean = true): Promise<Group[]> {
    const response = await apiClient.get('/groups', {
      params: { include_public: includePublic },
    })
    return response.data
  },

  /**
   * Get a specific group by name
   */
  async getGroup(groupName: string): Promise<Group> {
    const response = await apiClient.get(`/groups/${groupName}`)
    return response.data
  },

  /**
   * Update a group
   */
  async updateGroup(
    groupName: string,
    data: UpdateGroupRequest
  ): Promise<Group> {
    const response = await apiClient.put(`/groups/${groupName}`, data)
    return response.data
  },

  /**
   * Delete a group
   */
  async deleteGroup(groupName: string): Promise<void> {
    await apiClient.delete(`/groups/${groupName}`)
  },

  /**
   * Add a member to a group
   */
  async addMember(
    groupName: string,
    data: AddMemberRequest
  ): Promise<GroupMember> {
    const response = await apiClient.post(`/groups/${groupName}/members`, data)
    return response.data
  },

  /**
   * List all members of a group
   */
  async listMembers(
    groupName: string,
    includeInactive: boolean = false
  ): Promise<GroupMember[]> {
    const response = await apiClient.get(`/groups/${groupName}/members`, {
      params: { include_inactive: includeInactive },
    })
    return response.data
  },

  /**
   * Update a member's role
   */
  async updateMemberRole(
    groupName: string,
    userId: number,
    data: UpdateMemberRequest
  ): Promise<GroupMember> {
    const response = await apiClient.put(
      `/groups/${groupName}/members/${userId}`,
      data
    )
    return response.data
  },

  /**
   * Remove a member from a group
   */
  async removeMember(groupName: string, userId: number): Promise<void> {
    await apiClient.delete(`/groups/${groupName}/members/${userId}`)
  },
}
