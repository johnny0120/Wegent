// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

import { paths } from '../config/paths';
import { POST_LOGIN_REDIRECT_KEY, sanitizeRedirectPath } from '@/features/login/constants';

// API Configuration and Client
const API_BASE_URL = '/api';

// Token management
import { getToken, removeToken } from './user';

// HTTP Client with interceptors
class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const token = getToken();

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    console.log('API Request:', {
      url,
      method: config.method || 'GET',
      hasToken: !!token,
      tokenPrefix: token ? token.substring(0, 20) + '...' : 'none'
    });

    try {
      const response = await fetch(url, config);
      console.log('API Response:', {
        url,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });
      // Handle authentication errors
      if (response.status === 401) {
        removeToken();
        if (typeof window !== 'undefined') {
          const loginPath = paths.auth.login.getHref();
          if (window.location.pathname === loginPath) {
            window.location.href = loginPath;
          } else {
            const disallowedTargets = [loginPath, '/login/oidc'];
            const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
            const redirectTarget = sanitizeRedirectPath(currentPathWithSearch, disallowedTargets);
            if (redirectTarget) {
              sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, redirectTarget);
              window.location.href = `${loginPath}?redirect=${encodeURIComponent(redirectTarget)}`;
            } else {
              sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
              window.location.href = loginPath;
            }
          }
        }
        throw new Error('Authentication failed');
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = errorText;
        try {
          // Try to parse as JSON and extract detail field
          const json = JSON.parse(errorText);
          if (json && typeof json.detail === 'string') {
            errorMsg = json.detail;
          }
        } catch {
          // Not JSON, use original text directly
        }
        throw new Error(errorMsg);
      }

      // Handle empty responses (204 No Content, etc.)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T;
      }
      
      const text = await response.text();
      if (!text.trim()) {
        return {} as T;
      }
      
      try {
        const result = JSON.parse(text);
        return result;
      } catch (error) {
        console.error('Failed to parse JSON response:', text);
        return {} as T;
      }
    } catch (error) {
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: { params?: Record<string, any> }): Promise<T> {
    let url = endpoint;
    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new APIClient(API_BASE_URL);
