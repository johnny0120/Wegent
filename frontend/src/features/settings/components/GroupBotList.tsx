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
  UsersIcon,
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import BotEdit from './BotEdit';
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
import UnifiedAddButton from '@/components/common/UnifiedAddButton';

interface GroupBotListProps {
  groupId?: number | null;
}

// Bot display interface
interface DisplayBot {
  name: string;
  displayName: string;
  isPublic: boolean;
  isGroup: boolean;
  config: Record<string, unknown>;
}

const GroupBotList: React.FC<GroupBotListProps> = ({ groupId }) => {
  const { t } = useTranslation('common');
  const { toast } = useToast();
  const [bots, setBots] = useState<DisplayBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBot, setEditingBot] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmBot, setDeleteConfirmBot] = useState<DisplayBot | null>(null);
  const [loadingBotName, setLoadingBotName] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: Implement unified bots API similar to models
      // For now, show empty state
      setBots([]);
    } catch (error) {
      console.error('Failed to fetch bots:', error);
      toast({
        variant: 'destructive',
        title: '加载机器人失败',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const handleDelete = async () => {
    if (!deleteConfirmBot) return;

    try {
      // TODO: Implement bot deletion API
      toast({
        title: '删除成功',
      });
      setDeleteConfirmBot(null);
      fetchBots();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: (error as Error).message,
      });
    }
  };

  const handleEdit = async (bot: DisplayBot) => {
    if (bot.isPublic) return;

    setLoadingBotName(bot.name);
    try {
      // TODO: Implement bot editing
      setEditingBot(bot);
    } catch (error) {
      console.warn('Failed to fetch bot data:', error);
    } finally {
      setLoadingBotName(null);
    }
  };

  const handleEditClose = () => {
    setEditingBot(null);
    setIsCreating(false);
    fetchBots();
  };

  const getBotTypeLabel = (bot: DisplayBot) => {
    if (bot.isPublic) return '公共';
    if (bot.isGroup) return '群组';
    return '个人';
  };

  const getBotTypeVariant = (bot: DisplayBot): "default" | "info" | "success" | "error" | "warning" => {
    if (bot.isPublic) return 'info';
    if (bot.isGroup) return 'default';
    return 'success';
  };

  if (editingBot || isCreating) {
    // TODO: Implement proper BotEdit integration for group bots
    // For now, show a placeholder
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">编辑群组机器人</h2>
          <Button onClick={handleEditClose}>返回</Button>
        </div>
        <div className="p-8 text-center text-text-muted">
          群组机器人编辑功能开发中...
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-1">群组机器人</h2>
        <p className="text-sm text-text-muted mb-1">管理群组中的机器人配置</p>
      </div>

      {/* Content Container */}
      <div className="bg-base border border-border rounded-md p-2 w-full max-h-[70vh] flex flex-col overflow-y-auto custom-scrollbar">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        )}

        {/* Empty State */}
        {!loading && bots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UsersIcon className="w-12 h-12 text-text-muted mb-4" />
            <p className="text-text-muted">暂无群组机器人</p>
            <p className="text-sm text-text-muted mt-1">创建群组专属的机器人配置</p>
          </div>
        )}

        {/* Bot List */}
        {!loading && bots.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-1">
              {bots.map(bot => {
                return (
                  <Card
                    key={`${bot.isPublic ? 'public' : bot.isGroup ? 'group' : 'user'}-${bot.name}`}
                    className={`p-4 bg-base hover:bg-hover transition-colors ${
                      bot.isPublic ? 'border-l-2 border-l-blue-500' : 
                      bot.isGroup ? 'border-l-2 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between min-w-0">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        {bot.isGroup ? (
                          <UserGroupIcon className="w-5 h-5 text-primary flex-shrink-0" />
                        ) : (
                          <UsersIcon className="w-5 h-5 text-primary flex-shrink-0" />
                        )}
                        <div className="flex flex-col justify-center min-w-0 flex-1">
                          <div className="flex items-center space-x-2 min-w-0">
                            <h3 className="text-base font-medium text-text-primary mb-0 truncate">
                              {bot.displayName}
                            </h3>
                            <Tag variant={getBotTypeVariant(bot)} className="text-xs">
                              {getBotTypeLabel(bot)}
                            </Tag>
                          </div>
                          {bot.displayName !== bot.name && (
                            <p className="text-xs text-text-muted truncate">
                              ID: {bot.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                        {!bot.isPublic && bot.isGroup && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(bot)}
                              disabled={loadingBotName === bot.name}
                              title="编辑"
                            >
                              {loadingBotName === bot.name ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <PencilIcon className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-error"
                              onClick={() => setDeleteConfirmBot(bot)}
                              title="删除"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* Add Button */}
        {!loading && (
          <div className="border-t border-border pt-3 mt-3 bg-base">
            <div className="flex justify-center">
              <UnifiedAddButton onClick={() => setIsCreating(true)}>
                创建群组机器人
              </UnifiedAddButton>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmBot} onOpenChange={() => setDeleteConfirmBot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除机器人</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除机器人 "{deleteConfirmBot?.name}" 吗？此操作无法撤销。
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

export default GroupBotList;