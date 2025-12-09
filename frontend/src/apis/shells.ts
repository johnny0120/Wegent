// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client';

// Shell Types
export type ShellTypeEnum = 'public' | 'user' | 'group';

export interface UnifiedShell {
  name: string;
  type: ShellTypeEnum; // 'public', 'user', or 'group' - identifies shell source
  displayName?: string | null;
  shellType: string; // Agent type: 'ClaudeCode' | 'Agno' | 'Dify'
  baseImage?: string | null;
  baseShellRef?: string | null;
  supportModel?: string[] | null;
  executionType?: 'local_engine' | 'external_api' | null; // Shell execution type
  groupName?: string; // Group name for group resources
}

export interface UnifiedShellListResponse {
  data: UnifiedShell[];
}

export interface ShellCreateRequest {
  name: string;
  displayName?: string;
  baseShellRef: string; // Required: base public shell name (e.g., "ClaudeCode")
  baseImage: string; // Required: custom base image address
}

export interface ShellUpdateRequest {
  displayName?: string;
  baseImage?: string;
}

// Image Validation Types
export interface ImageValidationRequest {
  image: string;
  shellType: string; // e.g., "ClaudeCode", "Agno"
  shellName?: string; // Optional shell name for tracking
}

export interface ImageCheckResult {
  name: string;
  version?: string | null;
  status: 'pass' | 'fail';
  message?: string | null;
}

export interface ImageValidationResponse {
  status: 'submitted' | 'skipped' | 'error';
  message: string;
  validationId?: string | null; // UUID for polling validation status
  validationTaskId?: number | null; // Legacy field
  // For immediate results (e.g., Dify skip)
  valid?: boolean | null;
  checks?: ImageCheckResult[] | null;
  errors?: string[] | null;
}

// Validation Status Types
export type ValidationStage =
  | 'submitted'
  | 'pulling_image'
  | 'starting_container'
  | 'running_checks'
  | 'completed';

export interface ValidationStatusResponse {
  validationId: string;
  status: ValidationStage;
  stage: string; // Human-readable stage description
  progress: number; // 0-100
  valid?: boolean | null;
  checks?: ImageCheckResult[] | null;
  errors?: string[] | null;
  errorMessage?: string | null;
}

// Shell Services
export const shellApis = {
  /**
   * Get unified list of all available shells (both public and user-defined)
   *
   * Each shell includes a 'type' field ('public', 'user', or 'group') to identify its source.
   *
   * @param scope - Scope for resource query:
   *   - undefined or 'default': Personal + public shells (default behavior)
   *   - 'all': Personal + public + all group shells user has access to
   *   - 'group:{name}': Specific group + public shells
   */
  async getUnifiedShells(scope?: string): Promise<UnifiedShellListResponse> {
    const params = new URLSearchParams();
    if (scope) {
      params.append('scope', scope);
    }
    const queryString = params.toString();
    return apiClient.get(`/shells/unified${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get a specific shell by name and optional type
   *
   * @param shellName - Shell name
   * @param shellType - Optional shell type ('public', 'user', or 'group')
   * @param scope - Scope for resource query (required when shellType is 'group'):
   *   - 'default': Search in personal namespace
   *   - 'group:{name}': Search in specific group namespace
   */
  async getUnifiedShell(
    shellName: string,
    shellType?: ShellTypeEnum,
    scope?: string
  ): Promise<UnifiedShell> {
    const params = new URLSearchParams();
    if (shellType) {
      params.append('shell_type', shellType);
    }
    if (scope) {
      params.append('scope', scope);
    }
    const queryString = params.toString();
    return apiClient.get(
      `/shells/unified/${encodeURIComponent(shellName)}${queryString ? `?${queryString}` : ''}`
    );
  },

  /**
   * Create a new user-defined or group shell
   *
   * @param request - Shell creation request
   * @param scope - Scope for resource creation:
   *   - undefined or 'default': Create in personal namespace (default behavior)
   *   - 'group:{name}': Create in specific group namespace
   */
  async createShell(request: ShellCreateRequest, scope?: string): Promise<UnifiedShell> {
    const params = new URLSearchParams();
    if (scope) {
      params.append('scope', scope);
    }
    const queryString = params.toString();
    return apiClient.post(`/shells${queryString ? `?${queryString}` : ''}`, request);
  },

  /**
   * Update an existing user-defined or group shell
   *
   * @param name - Shell name
   * @param request - Shell update request
   * @param scope - Scope for resource update:
   *   - undefined or 'default': Update in personal namespace (default behavior)
   *   - 'group:{name}': Update in specific group namespace
   */
  async updateShell(
    name: string,
    request: ShellUpdateRequest,
    scope?: string
  ): Promise<UnifiedShell> {
    const params = new URLSearchParams();
    if (scope) {
      params.append('scope', scope);
    }
    const queryString = params.toString();
    return apiClient.put(
      `/shells/${encodeURIComponent(name)}${queryString ? `?${queryString}` : ''}`,
      request
    );
  },

  /**
   * Delete a user-defined or group shell
   *
   * @param name - Shell name
   * @param scope - Scope for resource deletion:
   *   - undefined or 'default': Delete from personal namespace (default behavior)
   *   - 'group:{name}': Delete from specific group namespace
   */
  async deleteShell(name: string, scope?: string): Promise<void> {
    const params = new URLSearchParams();
    if (scope) {
      params.append('scope', scope);
    }
    const queryString = params.toString();
    return apiClient.delete(
      `/shells/${encodeURIComponent(name)}${queryString ? `?${queryString}` : ''}`
    );
  },

  /**
   * Validate base image compatibility with a shell type
   */
  async validateImage(request: ImageValidationRequest): Promise<ImageValidationResponse> {
    return apiClient.post('/shells/validate-image', request);
  },

  /**
   * Get validation status by validation ID (for polling)
   *
   * @param validationId - UUID of the validation task
   */
  async getValidationStatus(validationId: string): Promise<ValidationStatusResponse> {
    return apiClient.get(`/shells/validation-status/${encodeURIComponent(validationId)}`);
  },

  /**
   * Get public shells only (filter from unified list)
   */
  async getPublicShells(scope?: string): Promise<UnifiedShell[]> {
    const response = await this.getUnifiedShells(scope);
    return (response.data || []).filter(shell => shell.type === 'public');
  },

  /**
   * Get local_engine type shells only (for base shell selection)
   */
  async getLocalEngineShells(scope?: string): Promise<UnifiedShell[]> {
    const response = await this.getUnifiedShells(scope);
    return (response.data || []).filter(
      shell => shell.type === 'public' && shell.executionType === 'local_engine'
    );
  },
};
