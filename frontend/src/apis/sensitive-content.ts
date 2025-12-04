// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Sensitive content detection API client
 */

import { apiClient } from './client';

/**
 * Sensitive match information
 */
export interface SensitiveMatch {
  /** Type of sensitive content */
  type: string;
  /** Matched text (partially masked) */
  matched_text: string;
  /** Position in original text */
  position: number;
  /** Description message */
  message: string;
}

/**
 * Sensitive content check response
 */
export interface SensitiveContentCheckResponse {
  /** Whether sensitive content was detected */
  is_sensitive: boolean;
  /** List of detected sensitive content */
  matches: SensitiveMatch[];
}

/**
 * Check if content contains sensitive information
 *
 * @param content - Content to check
 * @returns Detection result with list of matched sensitive content
 */
export async function checkSensitiveContent(
  content: string
): Promise<SensitiveContentCheckResponse> {
  const response = await apiClient.post<SensitiveContentCheckResponse>(
    '/sensitive-content/check',
    {
      content,
    }
  );
  return response.data;
}

export const sensitiveContentApis = {
  checkSensitiveContent,
};
