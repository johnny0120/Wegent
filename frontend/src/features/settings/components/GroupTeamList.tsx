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
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
  DocumentDuplicateIcon,
  ChatBubbleLeftEllipsisIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { RiRobot2Line } from 'react-icons/ri';
import { AiOutlineTeam } from 'react-icons/ai';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import TeamEdit from './TeamEdit';
import BotList from './BotList';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import UnifiedAddButton from '@/components/common/UnifiedAddButton';
import { groupsApi } from '@/apis/groups';
import { Bot, Team } from '@/types/api';
import { sortTeamsByUpdatedAt } from '@/utils/team';
import { sortBotsByUpdatedAt } from '@/utils/bot';
import { useRouter } from 'next/navigation';

interface GroupTeamListProps {
  groupId?: number | null;
}

const GroupTeamList: React.FC<GroupTeamListProps> = ({ groupId }) => {
  const { t } = useTranslation('common');
  const { toast } = useToast();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [prefillTeam, setPrefillTeam] = useState<Team | null>(null);
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<Team | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(groupId || null);
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [botListVisible, setBotListVisible] = useState(false);
  const isEditing = editingTeamId !== null;

  // Fetch user's groups
  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const response = await groupsApi.listGroups();
      setGroups(response.items || []);
      
      setSelectedGroupId(currentGroupId => {
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

  const setTeamsSorted = useCallback<React.Dispatch<React.SetStateAction<Team[]>>>(
    updater => {
      setTeams(prev => {
        const next =
          typeof updater === 'function' ? (updater as (value: Team[]) => Team[])(prev) : updater;
        return sortTeamsByUpdatedAt(next);
      });
    },
    [setTeams]
  );

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

  const fetchData = useCallback(async () => {
    if (!selectedGroupId) return;
    
    setLoading(true);
    try {
      const [teamsResponse, botsResponse] = await Promise.all([
        groupsApi.listGroupTeams(selectedGroupId),
        groupsApi.listGroupBots(selectedGroupId)
      ]);
      
      setTeamsSorted((teamsResponse as any).items || []);
      setBotsSorted((botsResponse as any).items || []);
    } catch (error) {
      console.error('Failed to fetch teams and bots:', error);
      toast({
        variant: 'destructive',
        title: '加载数据失败',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, toast, setTeamsSorted, setBotsSorted]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      fetchData();
      getCurrentUserRole();
    }
  }, [fetchData, selectedGroupId, getCurrentUserRole]);

  useEffect(() => {
    if (editingTeamId === null) {
      setPrefillTeam(null);
    }
  }, [editingTeamId]);

  const handleCreateTeam = () => {
    setPrefillTeam(null);
    setEditingTeamId(0);
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeamId(team.id);
  };

  const handleCopyTeam = (team: Team) => {
    const clone: Team = {
      ...team,
      bots: team.bots.map(bot => ({ ...bot })),
      workflow: team.workflow ? { ...team.workflow } : {},
    };
    setPrefillTeam(clone);
    setEditingTeamId(0);
  };

  const handleChatTeam = (team: Team) => {
    const params = new URLSearchParams();
    params.set('teamId', String(team.id));
    router.push(`/chat?${params.toString()}`);
  };

  const handleDeleteTeam = (team: Team) => {
    setDeleteConfirmTeam(team);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTeam || !selectedGroupId) return;

    try {
      // TODO: Implement group team deletion API
      // await groupsApi.deleteGroupTeam(selectedGroupId, deleteConfirmTeam.id);
      toast({
        title: t('teams.delete_success') || '删除成功',
      });
      setDeleteConfirmTeam(null);
      fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('teams.delete') || '删除失败',
        description: (error as Error).message,
      });
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmTeam(null);
  };

  // Get team status label
  const getTeamStatusLabel = (team: Team) => {
    if (team.share_status === 1) {
      return <Tag variant="info">{t('teams.sharing')}</Tag>;
    } else if (team.share_status === 2 && team.user?.user_name) {
      return <Tag variant="success">{t('teams.shared_by', { author: team.user.user_name })}</Tag>;
    }
    return null;
  };

  // Check if edit and delete buttons should be shown
  const shouldShowEditDelete = (team: Team) => {
    return team.share_status !== 2;
  };

  // If no groups available, show empty state
  if (!loadingGroups && groups.length === 0) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-1">群组机器人</h2>
          <p className="text-sm text-text-muted mb-1">管理群组中的团队和机器人配置</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <UserGroupIcon className="w-12 h-12 text-text-muted mb-4" />
          <p className="text-text-muted">暂无群组</p>
          <p className="text-sm text-text-muted mt-1">请先创建或加入群组</p>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-3">
        <TeamEdit
          teams={teams}
          setTeams={setTeamsSorted}
          editingTeamId={editingTeamId}
          setEditingTeamId={setEditingTeamId}
          initialTeam={prefillTeam}
          bots={bots}
          setBots={setBotsSorted}
          toast={toast}
          groupId={selectedGroupId}
          groups={groups}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-1">群组机器人</h2>
        <p className="text-sm text-text-muted mb-1">管理群组中的团队和机器人配置</p>
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
        {!loading && teams.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AiOutlineTeam className="w-12 h-12 text-text-muted mb-4" />
            <p className="text-text-muted">暂无群组团队</p>
            <p className="text-sm text-text-muted mt-1">创建群组专属的团队配置</p>
          </div>
        )}

        {/* Team List */}
        {!loading && teams.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-1">
              {teams.map(team => (
                <Card
                  key={team.id}
                  className="p-4 bg-base hover:bg-hover transition-colors"
                >
                  <div className="flex items-center justify-between min-w-0">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <AiOutlineTeam className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="flex flex-col justify-center min-w-0 flex-1">
                        <div className="flex items-center space-x-2 min-w-0">
                          <h3 className="text-base font-medium text-text-primary mb-0 truncate">
                            {team.name}
                          </h3>
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: team.is_active
                                  ? 'rgb(var(--color-success))'
                                  : 'rgb(var(--color-border))',
                              }}
                            ></div>
                            <span className="text-xs text-text-muted">
                              {team.is_active ? t('teams.active') : t('teams.inactive')}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 min-w-0">
                          {team.workflow?.mode && (
                            <Tag variant="default" className="capitalize">
                              {t(`team_model.${String(team.workflow.mode)}`)}
                            </Tag>
                          )}
                          {getTeamStatusLabel(team)}
                          {team.bots && team.bots.length > 0 && (
                            <Tag variant="info" className="hidden sm:inline-flex">
                              {team.bots.length} {team.bots.length === 1 ? 'Bot' : 'Bots'}
                            </Tag>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleChatTeam(team)}
                        title={t('teams.chat')}
                        className="h-8 w-8"
                      >
                        <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
                      </Button>
                      {shouldShowEditDelete(team) && currentUserRole && ['Developer', 'Maintainer', 'Owner'].includes(currentUserRole) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditTeam(team)}
                          title={t('teams.edit')}
                          className="h-8 w-8"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </Button>
                      )}
                      {currentUserRole && ['Developer', 'Maintainer', 'Owner'].includes(currentUserRole) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyTeam(team)}
                          title={t('teams.copy')}
                          className="h-8 w-8"
                        >
                          <DocumentDuplicateIcon className="w-4 h-4" />
                        </Button>
                      )}
                      {shouldShowEditDelete(team) && currentUserRole && ['Maintainer', 'Owner'].includes(currentUserRole) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTeam(team)}
                          title={t('teams.delete')}
                          className="h-8 w-8 hover:text-error"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Add Buttons - Developer+ permission */}
        {!loading && currentUserRole && ['Developer', 'Maintainer', 'Owner'].includes(currentUserRole) && (
          <div className="border-t border-border pt-3 mt-3 bg-base">
            <div className="flex justify-center gap-3">
              <UnifiedAddButton onClick={handleCreateTeam}>
                新建群组团队
              </UnifiedAddButton>
              <Button
                variant="outline"
                onClick={() => setBotListVisible(true)}
                className="flex items-center gap-2"
              >
                <RiRobot2Line className="w-4 h-4" />
                管理群组机器人
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmTeam} onOpenChange={() => setDeleteConfirmTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('teams.delete_confirm_title') || '确认删除团队'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('teams.delete_confirm_message') || `您确定要删除团队 "${deleteConfirmTeam?.name}" 吗？此操作无法撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>{t('common.cancel') || '取消'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-error hover:bg-error/90">
              {t('common.confirm') || '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bot list dialog */}
      <Dialog open={botListVisible} onOpenChange={setBotListVisible}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('bots.title') || '机器人管理'}</DialogTitle>
            <DialogDescription>{t('bots.description') || '管理群组中的机器人配置'}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <BotList groupId={selectedGroupId} groups={groups} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupTeamList;