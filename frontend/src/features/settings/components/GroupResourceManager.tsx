// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client';

import { useState, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { 
  CpuChipIcon, 
  CommandLineIcon, 
  UsersIcon,
  PlusIcon,
  ChevronLeftIcon,
  UserGroupIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { groupsApi } from '@/apis/groups';
import { GroupListItem } from '@/types/group';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import GroupEditDrawer from './GroupEditDrawer';
import GroupModelList from './GroupModelList';

interface GroupResourceManagerProps {
  selectedGroupId?: number | null;
  onGroupSelect: (groupId: number | null) => void;
}

export default function GroupResourceManager({ 
  selectedGroupId, 
  onGroupSelect 
}: GroupResourceManagerProps) {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupListItem | null>(null);
  const [subTabIndex, setSubTabIndex] = useState(0);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // 检测屏幕尺寸
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // 加载用户的群组列表
  const loadGroups = async () => {
    try {
      setLoading(true);
      const response = await groupsApi.listGroups();
      setGroups(response.items);
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  // 当选择的群组ID变化时，更新选中的群组
  useEffect(() => {
    if (selectedGroupId) {
      const group = groups.find(g => g.id === selectedGroupId);
      setSelectedGroup(group || null);
    } else {
      setSelectedGroup(null);
    }
  }, [selectedGroupId, groups]);

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
            className="p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onGroupSelect(group.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-medium truncate">{group.name}</h4>
                  <p className="text-sm text-text-muted truncate">{group.description || '无描述'}</p>
                  <div className="flex items-center space-x-3 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {group.member_count} 成员
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {group.resource_count} 资源
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {group.my_role}
                    </Badge>
                  </div>
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-text-muted" />
            </div>
          </Card>
        ))}
      </div>
    );
  };

  // 渲染群组资源管理界面
  const renderGroupResources = () => {
    if (!selectedGroup) return null;

    return (
      <div>
        {/* 返回按钮和群组信息 */}
        <div className="flex items-center space-x-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onGroupSelect(null)}
          >
            <ChevronLeftIcon className="w-4 h-4 mr-2" />
            返回群组列表
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{selectedGroup.name}</h2>
            <p className="text-text-muted">{selectedGroup.description || '无描述'}</p>
          </div>
        </div>

        {/* 群组资源子标签页 */}
        <Tab.Group selectedIndex={subTabIndex} onChange={setSubTabIndex}>
          <Tab.List className="flex space-x-1 mb-6 bg-surface rounded-lg p-1">
            <Tab
              className={({ selected }) =>
                `flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm rounded-md transition-colors duration-200 focus:outline-none ${
                  selected
                    ? 'bg-base text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-hover'
                }`
              }
            >
              <CpuChipIcon className="w-4 h-4" />
              <span>模型</span>
            </Tab>
            <Tab
              className={({ selected }) =>
                `flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm rounded-md transition-colors duration-200 focus:outline-none ${
                  selected
                    ? 'bg-base text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-hover'
                }`
              }
            >
              <CommandLineIcon className="w-4 h-4" />
              <span>执行器</span>
            </Tab>
            <Tab
              className={({ selected }) =>
                `flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm rounded-md transition-colors duration-200 focus:outline-none ${
                  selected
                    ? 'bg-base text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-hover'
                }`
              }
            >
              <UsersIcon className="w-4 h-4" />
              <span>机器人</span>
            </Tab>
          </Tab.List>
          
          <Tab.Panels>
            <Tab.Panel className="focus:outline-none">
              <GroupModelList groupId={selectedGroup.id} />
            </Tab.Panel>
            <Tab.Panel className="focus:outline-none">
              <GroupShells groupId={selectedGroup.id} />
            </Tab.Panel>
            <Tab.Panel className="focus:outline-none">
              <GroupBots groupId={selectedGroup.id} />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    );
  };

  const handleCreateSuccess = () => {
    setIsCreateDrawerOpen(false);
    loadGroups(); // 重新加载群组列表
  };

  return (
    <div>
      {selectedGroup ? renderGroupResources() : renderGroupList()}
      
      {/* 创建群组弹窗 */}
      <GroupEditDrawer
        isOpen={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        onSave={handleCreateSuccess}
        groupId={null} // null 表示创建新群组
        isMobile={!isDesktop}
      />
    </div>
  );
}

// 群组模型组件
function GroupModels({ groupId }: { groupId: number }) {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoading(true);
        const response = await groupsApi.listGroupModels(groupId);
        setModels(response.items || []);
      } catch (error) {
        console.error('Failed to load group models:', error);
        setModels([]);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [groupId]);

  if (loading) {
    return <div className="text-center py-8 text-text-muted">加载中...</div>;
  }

  if (models.length === 0) {
    return (
      <div className="text-center py-8">
        <CpuChipIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <p className="text-text-muted mb-4">该群组还没有模型</p>
        <Button variant="outline" size="sm">
          <PlusIcon className="w-4 h-4 mr-2" />
          添加模型
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold">群组模型</h4>
        <Button variant="outline" size="sm">
          <PlusIcon className="w-4 h-4 mr-2" />
          添加模型
        </Button>
      </div>
      
      {models.map((model: any) => (
        <Card key={model.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium">{model.name}</h5>
              <p className="text-sm text-text-muted">{model.namespace}</p>
            </div>
            <Badge variant="secondary">群组</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

// 群组执行器组件
function GroupShells({ groupId }: { groupId: number }) {
  return (
    <div className="text-center py-8">
      <CommandLineIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
      <p className="text-text-muted mb-4">该群组还没有执行器</p>
      <Button variant="outline" size="sm">
        <PlusIcon className="w-4 h-4 mr-2" />
        添加执行器
      </Button>
    </div>
  );
}

// 群组机器人组件
function GroupBots({ groupId }: { groupId: number }) {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBots = async () => {
      try {
        setLoading(true);
        const response = await groupsApi.listGroupBots(groupId);
        setBots(response.items || []);
      } catch (error) {
        console.error('Failed to load group bots:', error);
        setBots([]);
      } finally {
        setLoading(false);
      }
    };

    loadBots();
  }, [groupId]);

  if (loading) {
    return <div className="text-center py-8 text-text-muted">加载中...</div>;
  }

  if (bots.length === 0) {
    return (
      <div className="text-center py-8">
        <UsersIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <p className="text-text-muted mb-4">该群组还没有机器人</p>
        <Button variant="outline" size="sm">
          <PlusIcon className="w-4 h-4 mr-2" />
          添加机器人
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold">群组机器人</h4>
        <Button variant="outline" size="sm">
          <PlusIcon className="w-4 h-4 mr-2" />
          添加机器人
        </Button>
      </div>
      
      {bots.map((bot: any) => (
        <Card key={bot.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium">{bot.name}</h5>
              <p className="text-sm text-text-muted">{bot.namespace}</p>
            </div>
            <Badge variant="secondary">群组</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}