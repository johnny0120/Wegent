// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client';
import '@/features/common/scrollbar.css';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import {
  CpuChipIcon,
  PencilIcon,
  TrashIcon,
  BeakerIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import ModelEdit from './ModelEdit';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { modelApis, ModelCRD, UnifiedModel } from '@/apis/models';
import { groupsApi } from '@/apis/groups';
import { apiClient } from '@/apis/client';
import UnifiedAddButton from '@/components/common/UnifiedAddButton';

interface GroupModelListProps {
  groupId?: number | null;
}

// Unified display model interface
interface DisplayModel {
  name: string; // Unique identifier (ID)
  displayName: string; // Human-readable name (falls back to name if not set)
  modelType: string; // Provider type: 'openai' | 'claude'
  modelId: string;
  isPublic: boolean;
  isGroup: boolean;
  config: Record<string, unknown>; // Full config from unified API
  creatorUserId?: number; // Creator user ID for group models
}

const GroupModelList: React.FC<GroupModelListProps> = ({ groupId }) => {
  const { t } = useTranslation('common');
  const { toast } = useToast();
  const [unifiedModels, setUnifiedModels] = useState<UnifiedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<ModelCRD | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmModel, setDeleteConfirmModel] = useState<DisplayModel | null>(null);
  const [testingModelName, setTestingModelName] = useState<string | null>(null);
  const [loadingModelName, setLoadingModelName] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(groupId || null);
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  // Fetch user's groups
  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const response = await groupsApi.listGroups();
      setGroups(response.items || []);
      
      // Use functional update to avoid dependency on selectedGroupId
      setSelectedGroupId(currentGroupId => {
        // If no group is selected and there are groups, select the first one
        if (!currentGroupId && response.items && response.items.length > 0) {
          return response.items[0].id;
        }
        return currentGroupId;
      });
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      toast({
        variant: 'destructive',
        title: '获取群组列表失败',
      });
    } finally {
      setLoadingGroups(false);
    }
  }, [toast]);

  // Get current user's role in the selected group
  const getCurrentUserRole = useCallback(() => {
    if (!selectedGroupId || !groups.length) {
      setCurrentUserRole(null);
      return;
    }
    
    const selectedGroup = groups.find(group => group.id === selectedGroupId);
    if (selectedGroup && selectedGroup.my_role) {
      setCurrentUserRole(selectedGroup.my_role);
    } else {
      setCurrentUserRole(null);
    }
  }, [selectedGroupId, groups]);

  const fetchModels = useCallback(async () => {
    if (!selectedGroupId) return;

    setLoading(true);
    try {
      // Get group name from groups list
      const selectedGroup = groups.find(group => group.id === selectedGroupId);
      if (!selectedGroup) {
        throw new Error('Selected group not found');
      }

      // Use unified models API with group scope parameter
      const unifiedResponse = await modelApis.getUnifiedModels(
        undefined, // shellType
        true,      // includeConfig
        `group:${selectedGroup.name}` // scope parameter
      );
      setUnifiedModels(unifiedResponse.data || []);
    } catch (error) {
      console.error('Failed to fetch group models:', error);
      toast({
        variant: 'destructive',
        title: t('models.errors.load_models_failed'),
      });
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, groups, toast, t]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      fetchModels();
      getCurrentUserRole();
    }
  }, [fetchModels, selectedGroupId, getCurrentUserRole]);

  // Convert unified models to display format, filtering for group and public models
  const displayModels: DisplayModel[] = React.useMemo(() => {
    const result: DisplayModel[] = [];

    for (const model of unifiedModels) {
      const isPublic = model.type === 'public';
      const isGroup = model.type === 'group';
      
      // Only show public and group models in group context
      // Personal user models are excluded by the backend API
      if (!isPublic && !isGroup) continue;

      // Extract config info from unified model
      const config = (model.config as Record<string, unknown>) || {};
      const env = (config?.env as Record<string, unknown>) || {};
      result.push({
        name: model.name,
        displayName: model.displayName || model.name,
        modelType: model.provider || (env.model as string) || 'claude',
        modelId: model.modelId || (env.model_id as string) || '',
        isPublic,
        isGroup,
        config,
        creatorUserId: model.creatorUserId, // Include creator user ID for group models
      });
    }

    // Sort models: group models first, then public models
    return result.sort((a, b) => {
      if (a.isGroup && !b.isGroup) return -1;
      if (!a.isGroup && b.isGroup) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [unifiedModels]);

  // Separate models by type for display
  const groupModels = displayModels.filter(model => model.isGroup);
  const publicModels = displayModels.filter(model => model.isPublic);

  // Convert DisplayModel to ModelCRD for editing
  const convertToModelCRD = (displayModel: DisplayModel): ModelCRD => {
    const env = (displayModel.config?.env as Record<string, unknown>) || {};
    return {
      apiVersion: 'agent.wecode.io/v1',
      kind: 'Model',
      metadata: {
        name: displayModel.name,
        namespace: 'default',
        displayName:
          displayModel.displayName !== displayModel.name ? displayModel.displayName : undefined,
      },
      spec: {
        modelConfig: {
          env: {
            model: displayModel.modelType === 'openai' ? 'openai' : 'claude',
            model_id: displayModel.modelId,
            api_key: (env.api_key as string) || '',
            base_url: env.base_url as string | undefined,
            custom_headers: env.custom_headers as Record<string, string> | undefined,
          },
        },
      },
      status: {
        state: 'Available',
      },
    };
  };

  const handleTestConnection = async (displayModel: DisplayModel) => {
    if (displayModel.isPublic) {
      // Public models cannot be tested (no API key access)
      return;
    }

    setTestingModelName(displayModel.name);
    try {
      const env = (displayModel.config?.env as Record<string, unknown>) || {};
      const apiKey = (env.api_key as string) || '';

      // Test connection requires api_key
      const result = await modelApis.testConnection({
        provider_type: displayModel.modelType === 'openai' ? 'openai' : 'anthropic',
        model_id: displayModel.modelId,
        api_key: apiKey,
        base_url: env.base_url as string | undefined,
      });

      if (result.success) {
        toast({
          title: t('models.test_success'),
          description: result.message,
        });
      } else {
        toast({
          variant: 'destructive',
          title: t('models.test_failed'),
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('models.test_failed'),
        description: (error as Error).message,
      });
    } finally {
      setTestingModelName(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmModel || !selectedGroupId) return;

    try {
      // Get group name from groups list
      const selectedGroup = groups.find(group => group.id === selectedGroupId);
      if (!selectedGroup) {
        throw new Error('Selected group not found');
      }

      if (deleteConfirmModel.isGroup) {
        // Delete group model using Kubernetes-style API with group namespace
        await apiClient.delete(`/v1/namespaces/${encodeURIComponent(selectedGroup.name)}/models/${encodeURIComponent(deleteConfirmModel.name)}`);
      } else if (!deleteConfirmModel.isPublic) {
        // Delete personal model (shouldn't happen in group context, but handle it)
        await modelApis.deleteModel(deleteConfirmModel.name);
      }
      // Public models cannot be deleted

      toast({
        title: t('models.delete_success'),
      });
      setDeleteConfirmModel(null);
      fetchModels();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('models.errors.delete_failed'),
        description: (error as Error).message,
      });
    }
  };
  const handleEdit = async (displayModel: DisplayModel) => {
    if (displayModel.isPublic) return;

    setLoadingModelName(displayModel.name);
    try {
      // For group models, construct from unified data since we have all the info
      // and will use the group-specific update API
      if (displayModel.isGroup) {
        console.log(`Editing group model '${displayModel.name}' in group ${selectedGroupId}`);
        setEditingModel(convertToModelCRD(displayModel));
      } else {
        // For personal models, fetch the full CRD data for editing
        const modelCRD = await modelApis.getModel(displayModel.name);
        setEditingModel(modelCRD);
      }
    } catch (error) {
      // If fetch fails, construct from unified data
      console.warn('Failed to fetch model CRD, using unified data:', error);
      setEditingModel(convertToModelCRD(displayModel));
    } finally {
      setLoadingModelName(null);
    }
  };

  const handleEditClose = () => {
    setEditingModel(null);
    setIsCreating(false);
    fetchModels();
  };

  const getProviderLabel = (modelType: string) => {
    return modelType === 'openai' ? 'OpenAI' : 'Anthropic';
  };

  const getModelTypeLabel = (displayModel: DisplayModel) => {
    if (displayModel.isPublic) return t('models.public');
    if (displayModel.isGroup) return '群组';
    return '个人';
  };

  const getModelTypeVariant = (displayModel: DisplayModel): "default" | "info" | "success" | "error" | "warning" => {
    if (displayModel.isPublic) return 'info';
    if (displayModel.isGroup) return 'default';
    return 'success';
  };

  if (editingModel || isCreating) {
    return (
      <ModelEdit
        model={editingModel}
        onClose={handleEditClose}
        toast={toast}
        groupId={selectedGroupId}
        groups={groups}
        isGroupContext={true}
      />
    );
  }

  // If no groups available, show empty state
  if (!loadingGroups && groups.length === 0) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-1">群组模型</h2>
          <p className="text-sm text-text-muted mb-1">管理群组中的AI模型配置</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <UserGroupIcon className="w-12 h-12 text-text-muted mb-4" />
          <p className="text-text-muted">暂无群组</p>
          <p className="text-sm text-text-muted mt-1">请先创建或加入群组</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-1">群组模型</h2>
        <p className="text-sm text-text-muted mb-1">管理群组中的AI模型配置</p>
      </div>

      {/* Group Selector */}
      {!groupId && groups.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-primary mb-2">
            选择群组
          </label>
          <select
            value={selectedGroupId || ''}
            onChange={(e) => setSelectedGroupId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-border rounded-md bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">请选择群组</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content Container */}
      <div className="bg-base border border-border rounded-md p-2 w-full max-h-[70vh] flex flex-col overflow-y-auto custom-scrollbar">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        )}

        {/* Empty State */}
        {!loading && displayModels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CpuChipIcon className="w-12 h-12 text-text-muted mb-4" />
            <p className="text-text-muted">暂无群组模型</p>
            <p className="text-sm text-text-muted mt-1">创建群组专属的AI模型配置</p>
          </div>
        )}

        {/* Model List */}
        {!loading && displayModels.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 p-1">
              {/* Group Models Section */}
              {groupModels.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-2">
                    <UserGroupIcon className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-medium text-text-primary">群组模型</h3>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>
                  {groupModels.map(displayModel => (
                    <Card
                      key={`group-${displayModel.name}`}
                      className="p-4 bg-base hover:bg-hover transition-colors border-l-2 border-l-primary"
                    >
                      <div className="flex items-center justify-between min-w-0">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <UserGroupIcon className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <div className="flex items-center space-x-2 min-w-0">
                              <h3 className="text-base font-medium text-text-primary mb-0 truncate">
                                {displayModel.displayName}
                              </h3>
                              <Tag variant={getModelTypeVariant(displayModel)} className="text-xs">
                                {getModelTypeLabel(displayModel)}
                              </Tag>
                            </div>
                            {/* Show ID if different from display name */}
                            {displayModel.displayName !== displayModel.name && (
                              <p className="text-xs text-text-muted truncate">
                                ID: {displayModel.name}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2 min-w-0">
                              <Tag variant="default" className="capitalize">
                                {getProviderLabel(displayModel.modelType)}
                              </Tag>
                              <Tag variant="info" className="hidden sm:inline-flex">
                                {displayModel.modelId}
                              </Tag>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                          {/* 编辑按钮 - Developer+ 权限 */}
                          {currentUserRole && ['Developer', 'Maintainer', 'Owner'].includes(currentUserRole) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(displayModel)}
                              disabled={loadingModelName === displayModel.name}
                              title={t('models.edit')}
                            >
                              {loadingModelName === displayModel.name ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <PencilIcon className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {/* 删除按钮 - Maintainer+ 权限 */}
                          {currentUserRole && ['Maintainer', 'Owner'].includes(currentUserRole) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-error"
                              onClick={() => setDeleteConfirmModel(displayModel)}
                              title={t('models.delete')}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Public Models Section */}
              {publicModels.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-2">
                    <CpuChipIcon className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-medium text-text-primary">公共模型</h3>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>
                  {publicModels.map(displayModel => (
                    <Card
                      key={`public-${displayModel.name}`}
                      className="p-4 bg-base hover:bg-hover transition-colors border-l-2 border-l-blue-500"
                    >
                      <div className="flex items-center justify-between min-w-0">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <CpuChipIcon className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <div className="flex items-center space-x-2 min-w-0">
                              <h3 className="text-base font-medium text-text-primary mb-0 truncate">
                                {displayModel.displayName}
                              </h3>
                              <Tag variant={getModelTypeVariant(displayModel)} className="text-xs">
                                {getModelTypeLabel(displayModel)}
                              </Tag>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2 min-w-0">
                              <Tag variant="default" className="capitalize">
                                {getProviderLabel(displayModel.modelType)}
                              </Tag>
                              <Tag variant="info" className="hidden sm:inline-flex">
                                {displayModel.modelId}
                              </Tag>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Add Button - Developer+ 权限 */}
        {!loading && currentUserRole && ['Developer', 'Maintainer', 'Owner'].includes(currentUserRole) && (
          <div className="border-t border-border pt-3 mt-3 bg-base">
            <div className="flex justify-center">
              <UnifiedAddButton onClick={() => setIsCreating(true)}>
                创建群组模型
              </UnifiedAddButton>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmModel} onOpenChange={() => setDeleteConfirmModel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('models.delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('models.delete_confirm_message', { name: deleteConfirmModel?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-error hover:bg-error/90">
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GroupModelList;