// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'

// Shell Types
export type ShellTypeEnum = 'public' | 'user'

export interface UnifiedShell {
  name: string
  type: ShellTypeEnum // 'public' or 'user' - identifies shell source
  displayName?: string | null
  runtime: string
  baseImage?: string | null
  baseShellRef?: string | null
  supportModel?: string[] | null
  shellType?: 'local_engine' | 'external_api' | null // Shell execution type
}

export interface UnifiedShellListResponse {
  data: UnifiedShell[]
}

export interface ShellCreateRequest {
  name: string
  displayName?: string
  baseShellRef: string // Required: base public shell name (e.g., "ClaudeCode")
  baseImage: string // Required: custom base image address
}

export interface ShellUpdateRequest {
  displayName?: string
  baseImage?: string
}

// Image Validation Types
export interface ImageValidationRequest {
  image: string
  shellType: string // e.g., "ClaudeCode", "Agno"
}

export interface ImageCheckResult {
  name: string
  version?: string | null
  status: 'pass' | 'fail'
  message?: string | null
}

export interface ImageValidationResponse {
  valid: boolean
  checks: ImageCheckResult[]
  errors: string[]
}

// Shell Services
export const shellApis = {
  /**
   * Get unified list of all available shells (both public and user-defined)
   *
   * Each shell includes a 'type' field ('public' or 'user') to identify its source.
   */
  async getUnifiedShells(): Promise<UnifiedShellListResponse> {
    return apiClient.get('/shells/unified')
  },

  /**
   * Get a specific shell by name and optional type
   *
   * @param shellName - Shell name
   * @param shellType - Optional shell type ('public' or 'user')
   */
  async getUnifiedShell(shellName: string, shellType?: ShellTypeEnum): Promise<UnifiedShell> {
    const params = new URLSearchParams()
    if (shellType) {
      params.append('shell_type', shellType)
    }
    const queryString = params.toString()
    return apiClient.get(
      `/shells/unified/${encodeURIComponent(shellName)}${queryString ? `?${queryString}` : ''}`
    )
  },

  /**
   * Create a new user-defined shell
   */
  async createShell(request: ShellCreateRequest): Promise<UnifiedShell> {
    return apiClient.post('/shells', request)
  },

  /**
   * Update an existing user-defined shell
   */
  async updateShell(name: string, request: ShellUpdateRequest): Promise<UnifiedShell> {
    return apiClient.put(`/shells/${encodeURIComponent(name)}`, request)
  },

  /**
   * Delete a user-defined shell
   */
  async deleteShell(name: string): Promise<void> {
    return apiClient.delete(`/shells/${encodeURIComponent(name)}`)
  },

  /**
   * Validate base image compatibility with a shell type
   */
  async validateImage(request: ImageValidationRequest): Promise<ImageValidationResponse> {
    return apiClient.post('/shells/validate-image', request)
  },

  /**
   * Get public shells only (filter from unified list)
   */
  async getPublicShells(): Promise<UnifiedShell[]> {
    const response = await this.getUnifiedShells()
    return (response.data || []).filter(shell => shell.type === 'public')
  },

  /**
   * Get local_engine type shells only (for base shell selection)
   */
  async getLocalEngineShells(): Promise<UnifiedShell[]> {
    const response = await this.getUnifiedShells()
    return (response.data || []).filter(
      shell => shell.type === 'public' && shell.shellType === 'local_engine'
    )
  },
}
