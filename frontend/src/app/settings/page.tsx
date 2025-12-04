// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TopNavigation from '@/features/layout/TopNavigation';
import UserMenu from '@/features/layout/UserMenu';
import {
  PuzzlePieceIcon,
  UsersIcon,
  CpuChipIcon,
  CommandLineIcon,
  UserGroupIcon,
  UserIcon,
  CogIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import GitHubIntegration from '@/features/settings/components/GitHubIntegration';
import GroupResourceManager from '@/features/settings/components/GroupResourceManager';
import GroupManagement from '@/features/settings/components/GroupManagement';
import GroupModelList from '@/features/settings/components/GroupModelList';
import GroupShellList from '@/features/settings/components/GroupShellList';
import GroupBotList from '@/features/settings/components/GroupBotList';
import NotificationSettings from '@/features/settings/components/NotificationSettings';
import ModelList from '@/features/settings/components/ModelList';
import ShellList from '@/features/settings/components/ShellList';
import BotList from '@/features/settings/components/BotList';
import { UserProvider } from '@/features/common/UserContext';
import { useTranslation } from '@/hooks/useTranslation';
import { GithubStarButton } from '@/features/layout/GithubStarButton';

// 定义菜单项类型
type MenuItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: MenuItem[];
  component?: React.ComponentType<any>;
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation('common');

  // 菜单结构定义
  const menuItems: MenuItem[] = [
    {
      id: 'personal',
      label: '个人',
      icon: UserIcon,
      children: [
        {
          id: 'personal-models',
          label: '模型',
          icon: CpuChipIcon,
          component: ModelList
        },
        {
          id: 'personal-shells',
          label: '执行器',
          icon: CommandLineIcon,
          component: ShellList
        },
        {
          id: 'personal-bots',
          label: '机器人',
          icon: UsersIcon,
          component: BotList
        }
      ]
    },
    {
      id: 'groups',
      label: '群组',
      icon: UserGroupIcon,
      children: [
        {
          id: 'groups-management',
          label: '组管理',
          icon: UserGroupIcon,
          component: () => <GroupManagement />
        },
        {
          id: 'groups-models',
          label: '模型',
          icon: CpuChipIcon,
          component: GroupModelList
        },
        {
          id: 'groups-shells',
          label: '执行器',
          icon: CommandLineIcon,
          component: GroupShellList
        },
        {
          id: 'groups-bots',
          label: '机器人',
          icon: UsersIcon,
          component: GroupBotList
        }
      ]
    },
    {
      id: 'integrations',
      label: '集成',
      icon: PuzzlePieceIcon,
      component: GitHubIntegration
    },
    {
      id: 'general',
      label: '通用',
      icon: CogIcon,
      component: NotificationSettings
    }
  ];

  // 状态管理
  const [selectedItemId, setSelectedItemId] = useState<string>('personal-models');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['personal', 'groups']));
  const [isDesktop, setIsDesktop] = useState(false);

  // 响应式检测
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // 从 URL 初始化选中项
  useEffect(() => {
    const section = searchParams.get('section');
    const subsection = searchParams.get('subsection');
    
    if (section && subsection) {
      const itemId = `${section}-${subsection}`;
      setSelectedItemId(itemId);
      setExpandedItems(prev => new Set([...prev, section]));
    } else if (section) {
      // 如果只有 section，选择第一个子项或该项本身
      if (section === 'personal') {
        setSelectedItemId('personal-models');
        setExpandedItems(prev => new Set([...prev, 'personal']));
      } else if (section === 'groups') {
        setSelectedItemId('groups-management');
        setExpandedItems(prev => new Set([...prev, 'groups']));
      } else {
        setSelectedItemId(section);
      }
    }
  }, [searchParams]);

  // 处理菜单项点击
  const handleMenuItemClick = useCallback((item: MenuItem) => {
    if (item.children) {
      // 如果有子项，切换展开状态
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
    } else {
      // 如果没有子项，选中该项
      setSelectedItemId(item.id);
      
      // 更新 URL
      const parts = item.id.split('-');
      if (parts.length === 2) {
        router.replace(`?section=${parts[0]}&subsection=${parts[1]}`);
      } else {
        router.replace(`?section=${item.id}`);
      }
    }
  }, [router]);

  // 获取当前选中的组件
  const getCurrentComponent = () => {
    for (const item of menuItems) {
      if (item.id === selectedItemId && item.component) {
        return item.component;
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.id === selectedItemId && child.component) {
            return child.component;
          }
        }
      }
    }
    return ModelList; // 默认组件
  };

  // 渲染菜单项
  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const isSelected = selectedItemId === item.id;
    const hasChildren = item.children && item.children.length > 0;
    
    return (
      <div key={item.id}>
        <button
          onClick={() => handleMenuItemClick(item)}
          className={`w-full flex items-center space-x-3 px-3 py-2 text-sm rounded-md transition-colors duration-200 focus:outline-none ${
            level > 0 ? 'ml-6' : ''
          } ${
            isSelected
              ? 'bg-muted text-text-primary'
              : 'text-text-muted hover:text-text-primary hover:bg-muted'
          }`}
        >
          {hasChildren && (
            <span className="w-4 h-4 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDownIcon className="w-3 h-3" />
              ) : (
                <ChevronRightIcon className="w-3 h-3" />
              )}
            </span>
          )}
          {!hasChildren && level > 0 && <span className="w-4 h-4" />}
          <item.icon className="w-4 h-4" />
          <span>{item.label}</span>
        </button>
        
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children!.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const CurrentComponent = getCurrentComponent();

  return (
    <div className="flex smart-h-screen bg-base text-text-primary box-border">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation */}
        <TopNavigation activePage="dashboard" variant="standalone" showLogo={true}>
          <GithubStarButton />
          <UserMenu />
        </TopNavigation>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex h-full">
            {/* Sidebar Navigation */}
            <div className={`${isDesktop ? 'w-64' : 'w-full'} bg-base border-r border-border flex flex-col`}>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <nav className="space-y-1">
                  {menuItems.map(item => renderMenuItem(item))}
                </nav>
              </div>
            </div>

            {/* Main Content Area */}
            {(isDesktop || selectedItemId) && (
              <div className="flex-1 min-h-0 px-8 py-4 overflow-y-auto">
                <CurrentComponent />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <UserProvider>
      <Suspense fallback={<div>Loading...</div>}>
        <DashboardContent />
      </Suspense>
    </UserProvider>
  );
}
