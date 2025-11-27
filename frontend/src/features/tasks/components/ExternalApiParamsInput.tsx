// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { teamApis } from '@/apis/team';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

interface ExternalApiParamsInputProps {
  teamId: number;
  onParamsChange: (params: Record<string, string>) => void;
  onAppModeChange?: (appMode: string | undefined) => void;
  initialParams?: Record<string, string>;
  forceRefresh?: boolean; // Force refresh from API, bypass cache
}

interface ParameterField {
  variable: string;
  label: string | Record<string, string>;
  required: boolean;
  type: string;
  options?: string[];
}

// Cache expiration time: 30 minutes
const CACHE_EXPIRATION_MS = 30 * 60 * 1000;

interface CachedParametersData {
  parameters: ParameterField[];
  app_mode?: string;
  timestamp: number;
}

/**
 * Helper function to get label text from either string or i18n object
 */
function getLabelText(label: string | Record<string, string>, fallback: string): string {
  if (typeof label === 'string') {
    return label;
  }
  return label?.en || label?.['en-US'] || label?.['zh-CN'] || fallback;
}

/**
 * Get cached parameters from localStorage
 */
function getCachedParameters(teamId: number): CachedParametersData | null {
  try {
    const cacheKey = `team_${teamId}_api_params`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const data: CachedParametersData = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired (30 minutes)
    if (now - data.timestamp > CACHE_EXPIRATION_MS) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    // Refresh timestamp on read
    data.timestamp = now;
    localStorage.setItem(cacheKey, JSON.stringify(data));

    return data;
  } catch (e) {
    console.error('Failed to get cached parameters:', e);
    return null;
  }
}

/**
 * Save parameters to localStorage cache
 */
function setCachedParameters(
  teamId: number,
  parameters: ParameterField[],
  app_mode?: string
): void {
  try {
    const cacheKey = `team_${teamId}_api_params`;
    const data: CachedParametersData = {
      parameters,
      app_mode,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to cache parameters:', e);
  }
}

/**
 * Generic external API parameters input component
 * Works with any external API type (Dify, etc.) without exposing implementation details
 * Parameters are fetched through team API based on team_id
 */
export default function ExternalApiParamsInput({
  teamId,
  onParamsChange,
  onAppModeChange,
  initialParams = {},
  forceRefresh = false,
}: ExternalApiParamsInputProps) {
  const { t } = useTranslation('common');
  const [isLoading, setIsLoading] = useState(false);
  const [paramFields, setParamFields] = useState<ParameterField[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>(initialParams);
  const [error, setError] = useState<string>('');

  // Fetch parameters when teamId changes or forceRefresh is triggered
  useEffect(() => {
    if (!teamId) return;

    let cancelled = false;

    // Reset loading state at the start of each effect
    setIsLoading(false);
    setError('');

    const fetchParameters = async () => {
      // Try to load from cache first (unless forceRefresh is true)
      if (!forceRefresh) {
        const cachedData = getCachedParameters(teamId);
        if (cachedData) {
          console.log('[ExternalApiParamsInput] Using cached parameters for team', teamId);
          setParamFields(cachedData.parameters);

          // Pass app_mode to parent component
          if (onAppModeChange) {
            onAppModeChange(cachedData.app_mode);
          }

          // Load user input values from localStorage
          const userValuesCacheKey = `team_${teamId}_params`;
          let cachedParams: Record<string, string> = {};
          try {
            const cached = localStorage.getItem(userValuesCacheKey);
            if (cached) {
              cachedParams = JSON.parse(cached);
            }
          } catch (e) {
            console.error('Failed to load cached user values:', e);
          }

          // Initialize param values with priority: initialParams > cachedParams > empty
          const initialValues = cachedData.parameters.reduce(
            (acc, field) => {
              acc[field.variable] =
                initialParams[field.variable] || cachedParams[field.variable] || '';
              return acc;
            },
            {} as Record<string, string>
          );
          setParamValues(initialValues);
          if (cachedData.parameters.length > 0) {
            onParamsChange(initialValues);
          }
          return;
        }
      }

      // Fetch from API
      setIsLoading(true);
      setError('');

      try {
        console.log('[ExternalApiParamsInput] Fetching parameters from API for team', teamId);
        const response = await teamApis.getTeamInputParameters(teamId);

        if (cancelled) return;

        if (response.has_parameters) {
          const fields = response.parameters || [];
          setParamFields(fields);

          // Cache the API response
          setCachedParameters(teamId, fields, response.app_mode);

          // Pass app_mode to parent component if available
          if (onAppModeChange) {
            onAppModeChange(response.app_mode);
          }

          // Load user input values from localStorage
          const userValuesCacheKey = `team_${teamId}_params`;
          let cachedParams: Record<string, string> = {};
          try {
            const cached = localStorage.getItem(userValuesCacheKey);
            if (cached) {
              cachedParams = JSON.parse(cached);
            }
          } catch (e) {
            console.error('Failed to load cached user values:', e);
          }

          // Initialize param values with priority: initialParams > cachedParams > empty
          const initialValues = fields.reduce(
            (acc, field) => {
              acc[field.variable] =
                initialParams[field.variable] || cachedParams[field.variable] || '';
              return acc;
            },
            {} as Record<string, string>
          );
          setParamValues(initialValues);
          // Only call onParamsChange if we have actual parameters
          if (fields.length > 0) {
            onParamsChange(initialValues);
          }
        } else {
          setParamFields([]);
          setParamValues({});
          // Clear params when no parameters are available
          onParamsChange({});
          if (onAppModeChange) {
            onAppModeChange(response.app_mode);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch team parameters:', err);
        setError('Failed to load application parameters');
        setParamFields([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchParameters();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, forceRefresh]); // Re-fetch when teamId or forceRefresh changes

  // Update params when values change and save to localStorage
  const handleParamChange = (variable: string, value: string) => {
    const newValues = { ...paramValues, [variable]: value };
    setParamValues(newValues);
    onParamsChange(newValues);

    // Save to localStorage for this team
    const cacheKey = `team_${teamId}_params`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(newValues));
    } catch (e) {
      console.error('Failed to save params to localStorage:', e);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">Loading parameters...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-500 py-2">{error}</div>;
  }

  if (paramFields.length === 0) {
    return null; // No parameters to display
  }

  return (
    <div className="w-full mb-4">
      <Accordion type="single" collapsible defaultValue="params">
        <AccordionItem value="params" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {t('bot.dify_app_parameters') || 'Application Parameters'}
              </span>
              <span className="text-xs text-text-muted">
                ({paramFields.length} {t('bot.dify_parameters_count') || 'parameters'})
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-3">
              <p className="text-xs text-text-muted">
                {t('bot.dify_parameters_hint') ||
                  'Configure the input parameters for this application.'}
              </p>
              {paramFields.map(field => (
                <div key={field.variable} className="flex flex-col">
                  <Label
                    htmlFor={`param-${field.variable}`}
                    className="text-sm font-medium text-text-primary mb-1"
                  >
                    {getLabelText(field.label, field.variable)}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </Label>

                  {field.type === 'select' && field.options ? (
                    <select
                      id={`param-${field.variable}`}
                      value={paramValues[field.variable] || ''}
                      onChange={e => handleParamChange(field.variable, e.target.value)}
                      className="w-full px-3 py-2 bg-base rounded-md text-text-primary border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                    >
                      <option value="">Select...</option>
                      {field.options.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'text-input' || field.type === 'paragraph' ? (
                    <textarea
                      id={`param-${field.variable}`}
                      value={paramValues[field.variable] || ''}
                      onChange={e => handleParamChange(field.variable, e.target.value)}
                      placeholder={getLabelText(field.label, '')}
                      rows={field.type === 'paragraph' ? 3 : 2}
                      className="w-full px-3 py-2 bg-base rounded-md text-text-primary placeholder:text-text-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm resize-none"
                    />
                  ) : (
                    <input
                      id={`param-${field.variable}`}
                      type="text"
                      value={paramValues[field.variable] || ''}
                      onChange={e => handleParamChange(field.variable, e.target.value)}
                      placeholder={getLabelText(field.label, '')}
                      className="w-full px-3 py-2 bg-base rounded-md text-text-primary placeholder:text-text-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
