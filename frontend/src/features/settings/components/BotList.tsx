// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client';
import '@/features/common/scrollbar.css';

import { useCallback, useEffect, useState } from 'react';
import { PencilIcon, TrashIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { RiRobot2Line } from 'react-icons/ri';
import LoadingState from '@/features/common/LoadingState';
import { Bot } from '@/types/api';
import { fetchBotsList, deleteBot, isPredefinedModel, getModelFromConfig } from '../services/bots';
import BotEdit from './BotEdit';
import UnifiedAddButton from '@/components/common/UnifiedAddButton';
import { useTranslation } from '@/hooks/useTranslation';
import { sortBotsByUpdatedAt } from '@/utils/bot';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { groupsApi } from '@/apis/groups';

interface BotListProps {
  groupId?: number | null;
  groups?: any[];
}

export default function BotList({ groupId, groups = [] }: BotListProps = {}) {
  const { t } = useTranslation('common');
  const { toast } = useToast();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loadedGroups, setLoadedGroups] = useState<any[]>(groups);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(groupId || null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBotId, setEditingBotId] = useState<number | null>(null);
  const [cloningBot, setCloningBot] = useState<Bot | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [botToDelete, setBotToDelete] = useState<number | null>(null);
  const isEditing = editingBotId !== null;
  
  // Check if we're in group context
  const isGroupContext = groupId !== undefined && groupId !== null;

  const setBotsSorted = useCallback<React.Dispatch<React.SetStateAction<Bot[]>>>(
    updater => {
      setBots(prev => {
        const next =
          typeof updater === 'function' ? (updater as (value: Bot[]) => Bot[])(prev) : updater;
        return sortBotsByUpdatedAt(next);
      });
    },
    [setBots]
  );

  // Load groups on mount (only when in group context)
  useEffect(() => {
    async function loadGroups() {
      if (isGroupContext && groups.length === 0) {
        try {
          const groupsResponse = await groupsApi.listGroups();
          setLoadedGroups((groupsResponse as any).items || []);
          // Auto-select first group if none selected
          if (!selectedGroupId && (groupsResponse as any).items?.length > 0) {
            setSelectedGroupId((groupsResponse as any).items[0].id);
          }
        } catch (error) {
          console.error('Failed to load groups:', error);
        }
      }
    }
    loadGroups();
  }, [groups, selectedGroupId, isGroupContext]);

  // Load bots when selectedGroupId changes (for group context) or on mount (for personal context)
  useEffect(() => {
    async function loadBots() {
      // In group context, require selectedGroupId
      if (isGroupContext && !selectedGroupId) {
        setBots([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        if (isGroupContext && selectedGroupId && groups.length > 0) {
          // Load group bots using unified API with scope parameter
          const selectedGroup = groups.find(group => group.id === selectedGroupId);
          if (selectedGroup) {
            const response = await botApis.getBots({ page: 1, limit: 1000 }, `group:${selectedGroup.name}`);
            setBotsSorted(response.items || []);
          } else {
            console.error('Selected group not found');
            setBotsSorted([]);
          }
        } else {
          // Load personal bots
          const bots = await fetchBotsList();
          setBotsSorted(bots);
        }
      } catch (error) {
        console.error('Failed to load bots:', error);
        toast({
          variant: 'destructive',
          title: t('bots.loading'),
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadBots();
  }, [selectedGroupId, isGroupContext, groups, toast, setBotsSorted, t]);

  const handleCreateBot = () => {
    setCloningBot(null);
    setEditingBotId(0); // Use 0 to mark new creation
  };

  const handleEditBot = (bot: Bot) => {
    setCloningBot(null);
    setEditingBotId(bot.id);
  };

  const handleCloneBot = (bot: Bot) => {
    setCloningBot(bot);
    setEditingBotId(0);
  };

  const handleCloseEditor = () => {
    setEditingBotId(null);
    setCloningBot(null);
  };

  const handleDeleteBot = (botId: number) => {
    setBotToDelete(botId);
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!botToDelete) return;

    try {
      await deleteBot(botToDelete);
      setBotsSorted(prev => prev.filter(b => b.id !== botToDelete));
      setDeleteConfirmVisible(false);
      setBotToDelete(null);
    } catch (e) {
      const errorMessage = e instanceof Error && e.message ? e.message : t('bots.delete');
      toast({
        variant: 'destructive',
        title: errorMessage,
      });
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmVisible(false);
    setBotToDelete(null);
  };

  return (
    <>
      <div className="space-y-3">
        {isGroupContext && loadedGroups.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              目标群组
            </label>
            <select
              value={selectedGroupId || ''}
              onChange={(e) => setSelectedGroupId(Number(e.target.value) || null)}
              className="w-full px-3 py-2 border border-border rounded-md bg-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">请选择群组</option>
              {loadedGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-1">{t('bots.title')}</h2>
          <p className="text-sm text-text-muted mb-1">{t('bots.description')}</p>
        </div>
        <div
          className={`bg-base border border-border rounded-md p-2 w-full ${
            isEditing
              ? 'md:min-h-[70vh] flex flex-col overflow-y-auto custom-scrollbar'
              : 'max-h-[70vh] flex flex-col overflow-y-auto custom-scrollbar'
          }`}
        >
          {isLoading ? (
            <LoadingState fullScreen={false} message={t('bots.loading')} />
          ) : (
            <>
              {/* Edit/New mode */}
              {isEditing ? (
                <BotEdit
                  bots={bots}
                  setBots={setBotsSorted}
                  editingBotId={editingBotId}
                  cloningBot={cloningBot}
                  onClose={handleCloseEditor}
                  toast={toast}
                  groupId={selectedGroupId || undefined}
                />
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-1">
                    {bots.length > 0 ? (
                      bots.map(bot => (
                        <Card key={bot.id} className="p-4 bg-base hover:bg-hover transition-colors">
                          <div className="flex items-center justify-between min-w-0">
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                              <RiRobot2Line className="w-5 h-5 text-primary flex-shrink-0" />
                              <div className="flex flex-col justify-center min-w-0 flex-1">
                                <div className="flex items-center space-x-2 min-w-0">
                                  <h3 className="text-base font-medium text-text-primary mb-0 truncate">
                                    {bot.name}
                                  </h3>
                                  <div className="flex items-center space-x-1 flex-shrink-0">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{
                                        backgroundColor: bot.is_active
                                          ? 'rgb(var(--color-success))'
                                          : 'rgb(var(--color-border))',
                                      }}
                                    ></div>
                                    <span className="text-xs text-text-muted">
                                      {bot.is_active ? t('bots.active') : t('bots.inactive')}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-2 min-w-0">
                                  <Tag variant="default" className="capitalize">
                                    {bot.shell_type}
                                  </Tag>
                                  <Tag variant="info" className="hidden sm:inline-flex capitalize">
                                    {isPredefinedModel(bot.agent_config)
                                      ? getModelFromConfig(bot.agent_config)
                                      : 'CustomModel'}
                                  </Tag>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditBot(bot)}
                                title={t('bots.edit')}
                                className="h-8 w-8"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCloneBot(bot)}
                                title={t('bots.copy')}
                                className="h-8 w-8"
                              >
                                <DocumentDuplicateIcon className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteBot(bot?.id)}
                                title={t('bots.delete')}
                                className="h-8 w-8 hover:text-error"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center text-text-muted py-8">
                        <p className="text-sm">{t('bots.no_bots')}</p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border pt-3 mt-3 bg-base">
                    <div className="flex justify-center">
                      <UnifiedAddButton onClick={handleCreateBot}>
                        {t('bots.new_bot')}
                      </UnifiedAddButton>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmVisible} onOpenChange={setDeleteConfirmVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bots.delete_confirm_title')}</DialogTitle>
            <DialogDescription>{t('bots.delete_confirm_message')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={handleCancelDelete}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
