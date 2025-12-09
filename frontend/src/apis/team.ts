// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client';
import type { TeamBot, Team, PaginationParams } from '@/types/api';

// Team Request/Response Types
export interface CreateTeamRequest {
  name: string;
  description?: string;
  bots?: TeamBot[];
  workflow?: Record<string, unknown>;
  is_active?: boolean;
  namespace?: string;
}

export interface TeamListResponse {
  total: number;
  items: Team[];
}

// Team Share Response Type
export interface TeamShareResponse {
  share_url: string;
  share_token: string;
}

// Team Share Info Response Type
export interface TeamShareInfoResponse {
  user_id: number;
  user_name: string;
  team_id: number;
  team_name: string;
}

// Team Share Join Request Type
export interface TeamShareJoinRequest {
  share_token: string;
}

// Team Input Parameters Response Type
export interface TeamInputParametersResponse {
  has_parameters: boolean;
  parameters: Array<{
    variable: string;
    label: string | Record<string, string>;
    required: boolean;
    type: string;
    options?: string[];
    max_length?: number;
    placeholder?: string;
    default?: string;
    hint?: string;
  }>;
  app_mode?: string; // Dify app mode: 'chat', 'chatflow', 'workflow', 'completion', 'agent'
}

export const teamApis = {
  /**
   * Get teams list based on scope
   *
   * @param params - Pagination parameters
   * @param scope - Scope for resource query:
   *   - undefined or 'default': Personal teams only (default behavior)
   *   - 'all': Personal + all group teams user has access to
   *   - 'group:{name}': Specific group teams
   */
  async getTeams(params?: PaginationParams, scope?: string): Promise<TeamListResponse> {
    const p = params ? params : { page: 1, limit: 100 };
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(p.page || 1));
    queryParams.append('limit', String(p.limit || 100));
    if (scope) {
      queryParams.append('scope', scope);
    }
    return apiClient.get(`/teams?${queryParams.toString()}`);
  },
  async createTeam(data: CreateTeamRequest): Promise<Team> {
    return apiClient.post('/teams', data);
  },
  async deleteTeam(id: number): Promise<void> {
    await apiClient.delete(`/teams/${id}`);
  },
  async updateTeam(id: number, data: CreateTeamRequest): Promise<Team> {
    return apiClient.put(`/teams/${id}`, data);
  },
  async shareTeam(id: number): Promise<TeamShareResponse> {
    return apiClient.post(`/teams/${id}/share`);
  },
  async getTeamShareInfo(shareToken: string): Promise<TeamShareInfoResponse> {
    return apiClient.get(`/teams/share/info?share_token=${shareToken}`);
  },
  async joinSharedTeam(data: TeamShareJoinRequest): Promise<void> {
    return apiClient.post('/teams/share/join', data);
  },
  async getTeamInputParameters(teamId: number): Promise<TeamInputParametersResponse> {
    return apiClient.get(`/teams/${teamId}/input-parameters`);
  },
};
