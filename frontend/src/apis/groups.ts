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
import type { UnifiedModel } from './models'

export interface GroupUnifiedModelsResponse {
  data: UnifiedModel[]
}

const GROUPS_BASE = '/groups'

// Group Management APIs
export const groupsApi = {
  /**
   * Get list of groups where current user is a member
   */
  listGroups: async (params?: {
    skip?: number
    limit?: number
  }): Promise<GroupListResponse> => {
    console.log('groupsApi.listGroups called with params:', params);
    try {
      console.log('Making API call to:', GROUPS_BASE);
      const response = await apiClient.get<GroupListResponse>(GROUPS_BASE, {
        params,
      });
      console.log('API client returned:', response);
      return response;
    } catch (error) {
      console.error('Error in groupsApi.listGroups:', error);
      throw error;
    }
  },

  /**
   * Create a new group
   */
  createGroup: async (data: GroupCreate): Promise<GroupDetail> => {
    const response = await apiClient.post<GroupDetail>(GROUPS_BASE, data)
    return response
  },

  /**
   * Get group detail
   */
  getGroup: async (groupId: number): Promise<GroupDetail> => {
    const response = await apiClient.get<GroupDetail>(
      `${GROUPS_BASE}/${groupId}`
    )
    return response
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
    return response
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
    return response
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
    return response
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
    return response
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
    return response
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
    return response
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
    return response
  },

  /**
   * Get unified models available to a group
   */
  getGroupUnifiedModels: async (
    groupId: number,
    shellType?: string,
    includeConfig: boolean = false
  ): Promise<GroupUnifiedModelsResponse> => {
    const params = new URLSearchParams()
    if (shellType) params.append('shell_type', shellType)
    if (includeConfig) params.append('include_config', 'true')
    
    const response = await apiClient.get<GroupUnifiedModelsResponse>(
      `${GROUPS_BASE}/${groupId}/models/unified?${params}`
    )
    return response
  },

  /**
   * Create a model in a group
   */
  createGroupModel: async (
    groupId: number,
    modelData: any
  ): Promise<{ message: string; model: any; resource_id: number }> => {
    const response = await apiClient.post<{ message: string; model: any; resource_id: number }>(
      `${GROUPS_BASE}/${groupId}/models`,
      modelData
    )
    return response
  },

  /**
   * Update a model in a group
   */
  updateGroupModel: async (
    groupId: number,
    modelId: string,
    modelData: any
  ): Promise<{ message: string; model: any; resource_id: number }> => {
    const response = await apiClient.put<{ message: string; model: any; resource_id: number }>(
      `${GROUPS_BASE}/${groupId}/models/${modelId}`,
      modelData
    )
    return response
  },

  /**
   * Delete a model from a group
   */
  deleteGroupModel: async (groupId: number, modelId: string): Promise<void> => {
    await apiClient.delete(`${GROUPS_BASE}/${groupId}/models/${modelId}`)
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
    return response
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
    return response
  },

  /**
   * Get a bot detail in a group
   */
  getGroupBot: async (groupId: number, botId: number): Promise<any> => {
    const response = await apiClient.get(`${GROUPS_BASE}/${groupId}/bots/${botId}`)
    return response
  },

  /**
   * Get unified bots available to a group (public + group bots)
   */
  getGroupUnifiedBots: async (
    groupId: number,
    includeConfig: boolean = false
  ): Promise<{ data: any[] }> => {
    const params = new URLSearchParams()
    if (includeConfig) params.append('include_config', 'true')
    
    const response = await apiClient.get<{ data: any[] }>(
      `${GROUPS_BASE}/${groupId}/bots/unified?${params}`
    )
    return response
  },

  /**
   * Create a bot in a group
   */
  createGroupBot: async (
    groupId: number,
    botData: any
  ): Promise<{ message: string; bot: any; resource_id: number }> => {
    const response = await apiClient.post<{ message: string; bot: any; resource_id: number }>(
      `${GROUPS_BASE}/${groupId}/bots`,
      botData
    )
    return response
  },

  /**
   * Update a bot in a group
   */
  updateGroupBot: async (
    groupId: number,
    botId: number,
    botData: any
  ): Promise<{ message: string; bot: any; resource_id: number }> => {
    const response = await apiClient.put<{ message: string; bot: any; resource_id: number }>(
      `${GROUPS_BASE}/${groupId}/bots/${botId}`,
      botData
    )
    return response
  },

  /**
   * Delete a bot from a group
   */
  deleteGroupBot: async (groupId: number, botId: number): Promise<void> => {
    await apiClient.delete(`${GROUPS_BASE}/${groupId}/bots/${botId}`)
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
    return response
  },

  // Group Shell APIs
  /**
   * Get unified shells available to a group
   */
  getGroupUnifiedShells: async (
    groupId: number,
    includeConfig: boolean = false
  ): Promise<{ data: any[] }> => {
    const params = new URLSearchParams()
    if (includeConfig) params.append('include_config', 'true')
    
    const response = await apiClient.get<{ data: any[] }>(
      `${GROUPS_BASE}/${groupId}/shells/unified?${params}`
    )
    return response
  },

  /**
   * Create a shell in a group
   */
  createGroupShell: async (
    groupId: number,
    shellData: any
  ): Promise<{ message: string; shell: any; resource_id: number }> => {
    const response = await apiClient.post<{ message: string; shell: any; resource_id: number }>(
      `${GROUPS_BASE}/${groupId}/shells`,
      shellData
    )
    return response
  },

  /**
   * Update a shell in a group
   */
  updateGroupShell: async (
    groupId: number,
    shellId: string,
    shellData: any
  ): Promise<{ message: string; shell: any; resource_id: number }> => {
    const response = await apiClient.put<{ message: string; shell: any; resource_id: number }>(
      `${GROUPS_BASE}/${groupId}/shells/${shellId}`,
      shellData
    )
    return response
  },

  /**
   * Delete a shell from a group
   */
  deleteGroupShell: async (groupId: number, shellId: string): Promise<void> => {
    await apiClient.delete(`${GROUPS_BASE}/${groupId}/shells/${shellId}`)
  },
}

export default groupsApi
