// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client';

import { useState, useEffect } from 'react';
import {
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  UserIcon,
  EyeIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { groupsApi } from '@/apis/groups';
import { GroupListItem, GroupMemberListItem, GroupRole } from '@/types/group';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import GroupEditDrawer from './GroupEditDrawer';

export default function GroupManagement() {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupListItem | null>(null);
  const [members, setMembers] = useState<GroupMemberListItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState<GroupRole>(GroupRole.REPORTER);
  const [isDesktop, setIsDesktop] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const { toast } = useToast();

  // 响应式检测
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // 加载用户的群组列表
  // 加载用户的群组列表
  const loadGroups = async () => {
    try {
      setLoading(true);
      
      // Check authentication first
      const { userApis } = await import('@/apis/user');
      const isAuth = userApis.isAuthenticated();
      console.log('Is authenticated:', isAuth);
      
      if (!isAuth) {
        console.error('User is not authenticated');
        toast({
          title: '认证失败',
          description: '用户未登录，请重新登录',
          variant: 'destructive'
        });
        return;
      }
      
      console.log('Making API call to /api/groups...');
      const response = await groupsApi.listGroups();
      console.log('Groups API response:', response);
      console.log('Response type:', typeof response);
      console.log('Response keys:', response ? Object.keys(response) : 'null/undefined');
      
      // 处理不同的响应格式
      if (response && Array.isArray(response)) {
        console.log('Response is array, length:', response.length);
        setGroups(response);
      } else if (response && response.items && Array.isArray(response.items)) {
        console.log('Response has items array, length:', response.items.length);
        setGroups(response.items);
      } else if (response && response.total !== undefined && response.items) {
        // Handle case where items might be empty array but structure is correct
        console.log('Response has total and items, total:', response.total);
        setGroups(response.items || []);
      } else {
        console.warn('Unexpected response format:', response);
        console.warn('Setting empty groups array');
        setGroups([]);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
      console.error('Error details:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      setGroups([]);
      toast({
        title: '加载失败',
        description: `加载群组列表失败：${error instanceof Error ? error.message : '未知错误'}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  // 加载群组成员
  const loadMembers = async (groupId: number) => {
    try {
      setLoadingMembers(true);
      const response = await groupsApi.listGroupMembers(groupId);
      console.log('Members API response:', response);
      
      // 处理不同的响应格式
      if (response && Array.isArray(response)) {
        setMembers(response);
      } else if (response && response.items && Array.isArray(response.items)) {
        setMembers(response.items);
      } else {
        console.warn('Unexpected members response format:', response);
        setMembers([]);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
      setMembers([]);
      toast({
        title: '加载失败',
        description: '加载成员列表失败，请重试',
        variant: 'destructive'
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    loadGroups();
    loadCurrentUser();
  }, []);

  // 加载当前用户信息
  const loadCurrentUser = async () => {
    try {
      const { userApis } = await import('@/apis/user');
      const userInfo = await userApis.getCurrentUser();
      setCurrentUserId(userInfo.id);
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  useEffect(() => {
    if (selectedGroup) {
      loadMembers(selectedGroup.id);
    }
  }, [selectedGroup]);

  // 邀请成员
  const handleInviteMember = async () => {
    if (!selectedGroup || !inviteUsername.trim()) return;

    try {
      await groupsApi.inviteMember(selectedGroup.id, {
        user_name: inviteUsername.trim(),
        role: inviteRole
      });
      
      toast({
        title: '邀请成功',
        description: `已成功邀请 ${inviteUsername} 加入群组`
      });
      
      setIsInviteDialogOpen(false);
      setInviteUsername('');
      setInviteRole(GroupRole.REPORTER);
      loadMembers(selectedGroup.id);
    } catch (error: any) {
      toast({
        title: '邀请失败',
        description: error.response?.data?.detail || '邀请成员失败，请重试',
        variant: 'destructive'
      });
    }
  };

  // 移除成员
  const handleRemoveMember = async (userId: number, username: string) => {
    if (!selectedGroup) return;

    try {
      await groupsApi.removeMember(selectedGroup.id, userId);
      toast({
        title: '移除成功',
        description: `已将 ${username} 从群组中移除`
      });
      loadMembers(selectedGroup.id);
    } catch (error: any) {
      toast({
        title: '移除失败',
        description: error.response?.data?.detail || '移除成员失败，请重试',
        variant: 'destructive'
      });
    }
  };

  // 离开群组
  const handleLeaveGroup = async (groupId: number, groupName: string) => {
    try {
      await groupsApi.leaveGroup(groupId);
      toast({
        title: '离开成功',
        description: `已离开群组 ${groupName}`
      });
      loadGroups();
      setSelectedGroup(null);
    } catch (error: any) {
      toast({
        title: '离开失败',
        description: error.response?.data?.detail || '离开群组失败，请重试',
        variant: 'destructive'
      });
    }
  };

  // 删除群组
  const handleDeleteGroup = async (groupToDelete?: GroupListItem) => {
    const targetGroup = groupToDelete || selectedGroup;
    if (!targetGroup) return;

    try {
      await groupsApi.deleteGroup(targetGroup.id);
      toast({
        title: '删除成功',
        description: `群组 ${targetGroup.name} 已被删除`
      });
      setIsDeleteDialogOpen(false);
      setSelectedGroup(null);
      loadGroups();
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error.response?.data?.detail || '删除群组失败，请重试',
        variant: 'destructive'
      });
    }
  };

  // 修改成员角色
  const handleUpdateMemberRole = async (userId: number, username: string, newRole: GroupRole) => {
    if (!selectedGroup) return;

    try {
      await groupsApi.updateMemberRole(selectedGroup.id, userId, { role: newRole });
      toast({
        title: '角色更新成功',
        description: `已将 ${username} 的角色更新为 ${newRole}`
      });
      loadMembers(selectedGroup.id);
      // If the role was changed to Owner, reload groups to reflect ownership change
      if (newRole === GroupRole.OWNER) {
        loadGroups();
      }
    } catch (error: any) {
      toast({
        title: '角色更新失败',
        description: error.response?.data?.detail || '更新成员角色失败，请重试',
        variant: 'destructive'
      });
    }
  };

  // 获取角色图标
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Owner':
        return <UserIcon className="w-4 h-4 text-yellow-500" />;
      case 'Maintainer':
        return <ShieldCheckIcon className="w-4 h-4 text-blue-500" />;
      case 'Developer':
        return <UserIcon className="w-4 h-4 text-green-500" />;
      case 'Reporter':
        return <EyeIcon className="w-4 h-4 text-gray-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  // 获取角色颜色
  const getRoleBadgeVariant = (role: string): "default" | "secondary" => {
    switch (role) {
      case 'Owner':
        return 'default';
      case 'Maintainer':
        return 'secondary';
      case 'Developer':
        return 'secondary';
      case 'Reporter':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  // 渲染群组列表
  const renderGroupList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-text-muted">加载中...</div>
        </div>
      );
    }

    if (groups.length === 0) {
      return (
        <div className="text-center py-8">
          <UserGroupIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-muted mb-4">您还没有加入任何群组</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateDrawerOpen(true)}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            创建群组
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">我的群组</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateDrawerOpen(true)}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            创建群组
          </Button>
        </div>
        
        {groups.map((group) => (
          <Card
            key={group.id}
            className="p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <UserGroupIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-base font-medium truncate text-text-primary">{group.name}</h4>
                    {group.parent_id && (
                      <span className="text-xs text-text-muted bg-gray-100 px-2 py-1 rounded">
                        父群组: {groups.find(g => g.id === group.parent_id)?.name || `ID: ${group.parent_id}`}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted truncate">{group.description || '无描述'}</p>
                  <div className="flex items-center space-x-3 mt-2">
                    <div className="flex items-center space-x-1">
                      {getRoleIcon(group.my_role)}
                      <Badge variant={getRoleBadgeVariant(group.my_role)} className="text-xs">
                        {group.my_role}
                      </Badge>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {group.member_count} 成员
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {group.resource_count} 资源
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedGroup(group);
                  }}
                  className="h-8 w-8"
                  title="成员管理"
                >
                  <UsersIcon className="w-4 h-4" />
                </Button>
                
                {group.my_role === 'Owner' && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="h-8 w-8"
                        title="删除群组"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>确认删除群组</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-text-muted">
                          您确定要删除群组 <strong>{group.name}</strong> 吗？
                        </p>
                        <p className="text-sm text-red-600">
                          ⚠️ 此操作不可撤销。删除群组前请确保：
                        </p>
                        <ul className="text-sm text-text-muted list-disc list-inside space-y-1">
                          <li>群组内没有子群组</li>
                          <li>群组内没有资源（模型、机器人、团队等）</li>
                        </ul>
                        <div className="flex justify-end space-x-2">
                          <DialogTrigger asChild>
                            <Button variant="outline">
                              取消
                            </Button>
                          </DialogTrigger>
                          <Button
                            variant="destructive"
                            onClick={() => handleDeleteGroup(group)}
                          >
                            确认删除
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  // 渲染群组详情
  const renderGroupDetails = () => {
    if (!selectedGroup) return null;

    const canInvite = ['Owner', 'Maintainer'].includes(selectedGroup.my_role);
    const canLeave = selectedGroup.my_role !== 'Owner';
    const canDelete = selectedGroup.my_role === 'Owner';

    return (
      <div>
        {/* 返回按钮和群组信息 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedGroup(null)}
            >
              ← 返回群组列表
            </Button>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{selectedGroup.name}</h2>
              <p className="text-text-muted">{selectedGroup.description || '无描述'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {canInvite && (
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <UserPlusIcon className="w-4 h-4 mr-2" />
                    邀请成员
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>邀请成员</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">
                        用户名
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="username"
                        value={inviteUsername}
                        onChange={(e) => setInviteUsername(e.target.value)}
                        placeholder="请输入用户名"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">角色</Label>
                      <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as GroupRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={GroupRole.REPORTER}>
                            <div className="flex flex-col items-start">
                              <span>Reporter</span>
                              <span className="text-xs text-text-muted">只能查看资源</span>
                            </div>
                          </SelectItem>
                          <SelectItem value={GroupRole.DEVELOPER}>
                            <div className="flex flex-col items-start">
                              <span>Developer</span>
                              <span className="text-xs text-text-muted">可创建、编辑资源</span>
                            </div>
                          </SelectItem>
                          <SelectItem value={GroupRole.MAINTAINER}>
                            <div className="flex flex-col items-start">
                              <span>Maintainer</span>
                              <span className="text-xs text-text-muted">拥有管理权限</span>
                            </div>
                          </SelectItem>
                          <SelectItem value={GroupRole.OWNER}>
                            <div className="flex flex-col items-start">
                              <span>Owner</span>
                              <span className="text-xs text-text-muted">拥有所有权限</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* 角色权限详细说明 */}
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <h4 className="text-sm font-medium mb-2">角色权限说明</h4>
                        <div className="space-y-2 text-xs text-text-muted">
                          {inviteRole === GroupRole.REPORTER && (
                            <div>
                              <strong>Reporter：</strong>只能查看群组资源，无法进行任何修改操作，可离开群组
                            </div>
                          )}
                          {inviteRole === GroupRole.DEVELOPER && (
                            <div>
                              <strong>Developer：</strong>可查看、创建、编辑群组资源，可离开群组，但无法删除资源或管理成员
                            </div>
                          )}
                          {inviteRole === GroupRole.MAINTAINER && (
                            <div>
                              <strong>Maintainer：</strong>拥有除删除群组和转让Owner外的所有权限，包括：
                              <ul className="list-disc list-inside ml-2 mt-1">
                                <li>管理所有资源（查看、创建、编辑、删除）</li>
                                <li>邀请和移除成员</li>
                                <li>修改成员角色（除Owner外）</li>
                                <li>可离开群组</li>
                              </ul>
                            </div>
                          )}
                          {inviteRole === GroupRole.OWNER && (
                            <div>
                              <strong>Owner：</strong>拥有群组的完全控制权，包括：
                              <ul className="list-disc list-inside ml-2 mt-1">
                                <li>管理所有资源和成员</li>
                                <li>删除群组</li>
                                <li>转让Owner权限</li>
                                <li>无法直接离开群组（需先转让Owner）</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleInviteMember}>
                        邀请
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            
            {canLeave && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLeaveGroup(selectedGroup.id, selectedGroup.name)}
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
                离开群组
              </Button>
            )}
            
          </div>
        </div>

        {/* 成员列表 */}
        <div>
          <h3 className="text-lg font-semibold mb-4">成员列表</h3>
          
          {loadingMembers ? (
            <div className="text-center py-8 text-text-muted">加载中...</div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <Card key={member.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h5 className="font-medium text-text-primary">{member.user_name}</h5>
                        <div className="text-sm text-text-muted space-y-1">
                          <p>加入时间：{new Date(member.created_at).toLocaleDateString()}</p>
                          {member.invited_by_user_name && (
                            <p>邀请者：{member.invited_by_user_name}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        {getRoleIcon(member.role)}
                        {/* Owner 可以修改所有人的角色，Maintainer 可以修改除 Owner 外的角色 */}
                        {(selectedGroup.my_role === 'Owner' ||
                          (selectedGroup.my_role === 'Maintainer' && member.role !== 'Owner')) &&
                          member.user_id !== currentUserId ? (
                          <Select
                            value={member.role}
                            onValueChange={(value) => handleUpdateMemberRole(member.user_id, member.user_name, value as GroupRole)}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={GroupRole.REPORTER}>Reporter</SelectItem>
                              <SelectItem value={GroupRole.DEVELOPER}>Developer</SelectItem>
                              <SelectItem value={GroupRole.MAINTAINER}>Maintainer</SelectItem>
                              {/* Maintainer 不能将成员设置为 Owner */}
                              {selectedGroup.my_role === 'Owner' && (
                                <SelectItem value={GroupRole.OWNER}>Owner</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={getRoleBadgeVariant(member.role)}>
                            {member.role}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Owner 可以移除所有人，Maintainer 可以移除除 Owner 外的成员 */}
                      {(selectedGroup.my_role === 'Owner' ||
                        (selectedGroup.my_role === 'Maintainer' && member.role !== 'Owner')) &&
                        member.user_id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.user_id, member.user_name)}
                          title="移除成员"
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
        </div>
      </div>
    );
  };

  const handleCreateSuccess = () => {
    setIsCreateDrawerOpen(false);
    loadGroups();
  };

  return (
    <div>
      {selectedGroup ? renderGroupDetails() : renderGroupList()}
      
      {/* 创建群组弹窗 */}
      <GroupEditDrawer
        isOpen={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        onSave={handleCreateSuccess}
        groupId={null}
        isMobile={!isDesktop}
      />
    </div>
  );
}