// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Group API client
 */
import { apiClient } from './client'
import type {
  GroupCreate,
  GroupDetail,
  GroupListResponse,
  GroupMemberInvite,
  GroupMemberListResponse,
  GroupMemberUpdate,
  GroupRole,
  GroupUpdate,
  InviteAllUsersRequest,
  TransferOwnershipRequest,
} from '../types/group'

const GROUPS_BASE = '/api/groups'

// Group Management APIs
export const groupsApi = {
  /**
   * Get list of groups where current user is a member
   */
  listGroups: async (params?: {
    skip?: number
    limit?: number
  }): Promise<GroupListResponse> => {
    const response = await apiClient.get<GroupListResponse>(GROUPS_BASE, {
      params,
    })
    return response.data
  },

  /**
   * Create a new group
   */
  createGroup: async (data: GroupCreate): Promise<GroupDetail> => {
    const response = await apiClient.post<GroupDetail>(GROUPS_BASE, data)
    return response.data
  },

  /**
   * Get group detail
   */
  getGroup: async (groupId: number): Promise<GroupDetail> => {
    const response = await apiClient.get<GroupDetail>(
      `${GROUPS_BASE}/${groupId}`
    )
    return response.data
  },

  /**
   * Update group information
   */
  updateGroup: async (
    groupId: number,
    data: GroupUpdate
  ): Promise<GroupDetail> => {
    const response = await apiClient.put<GroupDetail>(
      `${GROUPS_BASE}/${groupId}`,
      data
    )
    return response.data
  },

  /**
   * Delete a group
   */
  deleteGroup: async (groupId: number): Promise<void> => {
    await apiClient.delete(`${GROUPS_BASE}/${groupId}`)
  },

  // Group Member Management APIs
  /**
   * Get list of group members
   */
  listGroupMembers: async (
    groupId: number,
    params?: { skip?: number; limit?: number }
  ): Promise<GroupMemberListResponse> => {
    const response = await apiClient.get<GroupMemberListResponse>(
      `${GROUPS_BASE}/${groupId}/members`,
      { params }
    )
    return response.data
  },

  /**
   * Invite a user to the group
   */
  inviteMember: async (
    groupId: number,
    data: GroupMemberInvite
  ): Promise<{ message: string; member_id: number }> => {
    const response = await apiClient.post<{
      message: string
      member_id: number
    }>(`${GROUPS_BASE}/${groupId}/members`, data)
    return response.data
  },

  /**
   * Update member role
   */
  updateMemberRole: async (
    groupId: number,
    userId: number,
    data: GroupMemberUpdate
  ): Promise<{ message: string; member_id: number }> => {
    const response = await apiClient.put<{
      message: string
      member_id: number
    }>(`${GROUPS_BASE}/${groupId}/members/${userId}`, data)
    return response.data
  },

  /**
   * Remove a member from the group
   */
  removeMember: async (groupId: number, userId: number): Promise<void> => {
    await apiClient.delete(`${GROUPS_BASE}/${groupId}/members/${userId}`)
  },

  /**
   * Invite all system users to the group
   */
  inviteAllUsers: async (
    groupId: number,
    data: InviteAllUsersRequest
  ): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post<{ message: string; count: number }>(
      `${GROUPS_BASE}/${groupId}/members/invite-all`,
      data
    )
    return response.data
  },

  /**
   * Leave a group
   */
  leaveGroup: async (groupId: number): Promise<void> => {
    await apiClient.post(`${GROUPS_BASE}/${groupId}/leave`)
  },

  /**
   * Transfer group ownership
   */
  transferOwnership: async (
    groupId: number,
    data: TransferOwnershipRequest
  ): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(
      `${GROUPS_BASE}/${groupId}/transfer-ownership`,
      data
    )
    return response.data
  },

  // Group Resource APIs
  /**
   * Get models in group
   */
  listGroupModels: async (
    groupId: number,
    params?: { skip?: number; limit?: number }
  ) => {
    const response = await apiClient.get(
      `${GROUPS_BASE}/${groupId}/models`,
      { params }
    )
    return response.data
  },

  /**
   * Get bots in group
   */
  listGroupBots: async (
    groupId: number,
    params?: { skip?: number; limit?: number }
  ) => {
    const response = await apiClient.get(`${GROUPS_BASE}/${groupId}/bots`, {
      params,
    })
    return response.data
  },

  /**
   * Get teams in group
   */
  listGroupTeams: async (
    groupId: number,
    params?: { skip?: number; limit?: number }
  ) => {
    const response = await apiClient.get(`${GROUPS_BASE}/${groupId}/teams`, {
      params,
    })
    return response.data
  },
}

export default groupsApi
