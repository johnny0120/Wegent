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
  CommandLineIcon,
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import ShellEdit from './ShellEdit';
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
import { groupsApi } from '@/apis/groups';
import { UnifiedShell } from '@/apis/shells';
import UnifiedAddButton from '@/components/common/UnifiedAddButton';

interface GroupShellListProps {
  groupId?: number | null;
}

// Unified display shell interface
interface DisplayShell {
  name: string; // Unique identifier (ID)
  displayName: string; // Human-readable name (falls back to name if not set)
  shellType: string; // Agent type: 'ClaudeCode' | 'Agno' | 'Dify'
  baseImage?: string;
  baseShellRef?: string;
  executionType?: string;
  isPublic: boolean;
  isGroup: boolean;
  config: Record<string, unknown>; // Full config from unified API
  creatorUserId?: number; // Creator user ID for group shells
}

const GroupShellList: React.FC<GroupShellListProps> = ({ groupId }) => {
  const { t } = useTranslation('common');
  const { toast } = useToast();
  const [unifiedShells, setUnifiedShells] = useState<UnifiedShell[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingShell, setEditingShell] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmShell, setDeleteConfirmShell] = useState<DisplayShell | null>(null);
  const [loadingShellName, setLoadingShellName] = useState<string | null>(null);
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

  const fetchShells = useCallback(async () => {
    if (!selectedGroupId) return;
    
    setLoading(true);
    try {
      // Use group-specific unified API to get shells available to this group
      const unifiedResponse = await groupsApi.getGroupUnifiedShells(selectedGroupId, true); // include_config=true for full details
      setUnifiedShells(unifiedResponse.data || []);
    } catch (error) {
      console.error('Failed to fetch group shells:', error);
      toast({
        variant: 'destructive',
        title: '加载群组执行器失败',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, toast]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      fetchShells();
      getCurrentUserRole();
    }
  }, [fetchShells, selectedGroupId, getCurrentUserRole]);
// Convert unified shells to display format, filtering for group and public shells
const displayShells: DisplayShell[] = React.useMemo(() => {
  const result: DisplayShell[] = [];

  for (const shell of unifiedShells) {
    const isPublic = shell.type === 'public';
    // Group shells have type 'group'
    const isGroup = shell.type === 'group';
    
    // Only show public and group shells in group context
    if (!isPublic && !isGroup) {
      continue;
    }

    result.push({
      name: shell.name,
      displayName: shell.displayName || shell.name,
      shellType: shell.shellType,
      baseImage: shell.baseImage || undefined,
      baseShellRef: shell.baseShellRef || undefined,
      executionType: shell.executionType || undefined,
      isPublic,
      isGroup,
      config: {}, // Shell config structure may differ from models
      creatorUserId: (shell as any).creatorUserId, // Include creator user ID for group shells
    });
  }
  
  // Sort shells: group shells first, then public shells
    // Sort shells: group shells first, then public shells
    return result.sort((a, b) => {
      if (a.isGroup && !b.isGroup) return -1;
      if (!a.isGroup && b.isGroup) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [unifiedShells]);

  // Separate shells by type for display
  const groupShells = displayShells.filter(shell => shell.isGroup);
  const publicShells = displayShells.filter(shell => shell.isPublic);

  const handleDelete = async () => {
    if (!deleteConfirmShell || !selectedGroupId) return;

    try {
      if (deleteConfirmShell.isGroup) {
        // Use group-specific delete API for group shells
        await groupsApi.deleteGroupShell(selectedGroupId, deleteConfirmShell.name);
      } else {
        // Public shells cannot be deleted
        toast({
          variant: 'destructive',
          title: '无法删除公共执行器',
        });
        return;
      }
      
      toast({
        title: '删除成功',
      });
      setDeleteConfirmShell(null);
      fetchShells();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: (error as Error).message,
      });
    }
  };

  const handleEdit = async (shell: DisplayShell) => {
    if (shell.isPublic) return;

    setLoadingShellName(shell.name);
    try {
      // For group shells, construct from unified data since we have all the info
      // and will use the group-specific update API
      if (shell.isGroup) {
        console.log(`Editing group shell '${shell.name}' in group ${selectedGroupId}`);
        setEditingShell({
          name: shell.name,
          displayName: shell.displayName,
          shellType: shell.shellType,
          baseImage: shell.baseImage,
          baseShellRef: shell.baseShellRef,
          type: 'group'
        });
      }
    } catch (error) {
      console.warn('Failed to fetch shell data:', error);
    } finally {
      setLoadingShellName(null);
    }
  };

  const handleEditClose = () => {
    setEditingShell(null);
    setIsCreating(false);
    fetchShells();
  };

  const getShellTypeLabel = (shell: DisplayShell) => {
    if (shell.isPublic) return '公共';
    if (shell.isGroup) return '群组';
    return '个人';
  };

  const getShellTypeVariant = (shell: DisplayShell): "default" | "info" | "success" | "error" | "warning" => {
    if (shell.isPublic) return 'info';
    if (shell.isGroup) return 'default';
    return 'success';
  };

  const getExecutionTypeLabel = (executionType?: string) => {
    if (executionType === 'local_engine') return 'Local Engine';
    if (executionType === 'external_api') return 'External API';
    return executionType || 'Unknown';
  };

  if (editingShell || isCreating) {
    return (
      <ShellEdit
        shell={editingShell}
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
          <h2 className="text-xl font-semibold text-text-primary mb-1">群组执行器</h2>
          <p className="text-sm text-text-muted mb-1">管理群组中的执行器配置</p>
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
        <h2 className="text-xl font-semibold text-text-primary mb-1">群组执行器</h2>
        <p className="text-sm text-text-muted mb-1">管理群组中的执行器配置</p>
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
        {!loading && displayShells.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CommandLineIcon className="w-12 h-12 text-text-muted mb-4" />
            <p className="text-text-muted">暂无群组执行器</p>
            <p className="text-sm text-text-muted mt-1">创建群组专属的执行器配置</p>
          </div>
        )}

        {/* Shell List */}
        {!loading && displayShells.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 p-1">
              {/* Group Shells Section */}
              {groupShells.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-2">
                    <UserGroupIcon className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-medium text-text-primary">群组执行器</h3>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>
                  {groupShells.map(shell => (
                    <Card
                      key={`group-${shell.name}`}
                      className="p-4 bg-base hover:bg-hover transition-colors border-l-2 border-l-primary"
                    >
                      <div className="flex items-center justify-between min-w-0">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <UserGroupIcon className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <div className="flex items-center space-x-2 min-w-0">
                              <h3 className="text-base font-medium text-text-primary mb-0 truncate">
                                {shell.displayName}
                              </h3>
                              <Tag variant={getShellTypeVariant(shell)} className="text-xs">
                                {getShellTypeLabel(shell)}
                              </Tag>
                            </div>
                            {/* Show ID if different from display name */}
                            {shell.displayName !== shell.name && (
                              <p className="text-xs text-text-muted truncate">
                                ID: {shell.name}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2 min-w-0">
                              <Tag variant="default" className="capitalize">
                                {shell.shellType}
                              </Tag>
                              {shell.executionType && (
                                <Tag variant="info" className="hidden sm:inline-flex text-xs">
                                  {getExecutionTypeLabel(shell.executionType)}
                                </Tag>
                              )}
                              {shell.baseImage && (
                                <Tag
                                  variant="default"
                                  className="hidden md:inline-flex text-xs truncate max-w-[200px]"
                                >
                                  {shell.baseImage}
                                </Tag>
                              )}
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
                              onClick={() => handleEdit(shell)}
                              disabled={loadingShellName === shell.name}
                              title="编辑"
                            >
                              {loadingShellName === shell.name ? (
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
                              onClick={() => setDeleteConfirmShell(shell)}
                              title="删除"
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

              {/* Public Shells Section */}
              {publicShells.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-2">
                    <CommandLineIcon className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-medium text-text-primary">公共执行器</h3>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>
                  {publicShells.map(shell => (
                    <Card
                      key={`public-${shell.name}`}
                      className="p-4 bg-base hover:bg-hover transition-colors border-l-2 border-l-blue-500"
                    >
                      <div className="flex items-center justify-between min-w-0">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <CommandLineIcon className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <div className="flex items-center space-x-2 min-w-0">
                              <h3 className="text-base font-medium text-text-primary mb-0 truncate">
                                {shell.displayName}
                              </h3>
                              <Tag variant={getShellTypeVariant(shell)} className="text-xs">
                                {getShellTypeLabel(shell)}
                              </Tag>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2 min-w-0">
                              <Tag variant="default" className="capitalize">
                                {shell.shellType}
                              </Tag>
                              {shell.executionType && (
                                <Tag variant="info" className="hidden sm:inline-flex text-xs">
                                  {getExecutionTypeLabel(shell.executionType)}
                                </Tag>
                              )}
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
                创建群组执行器
              </UnifiedAddButton>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmShell} onOpenChange={() => setDeleteConfirmShell(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除执行器</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除执行器 "{deleteConfirmShell?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-error hover:bg-error/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GroupShellList;