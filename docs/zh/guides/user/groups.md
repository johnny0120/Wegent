# 组（Groups）- 组织级资源管理

Wegent 的组功能支持组织级别的协作和资源共享，类似于 GitLab 的组管理。

## 概述

组功能允许您：
- 将用户组织成具有层级结构的团队
- 在组内共享资源（模型、机器人、团队）
- 通过基于角色的权限控制访问
- 在组织层面管理资源

## 组角色

### 权限矩阵

| 角色 | 查看 | 创建 | 编辑 | 删除 | 邀请成员 | 移除成员 | 修改角色 | 删除组 | 转让所有权 | 离开组 |
|------|------|------|------|------|---------|---------|---------|--------|-----------|--------|
| **Owner（所有者）** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗（必须先转让）|
| **Maintainer（维护者）** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓（不能修改Owner）| ✗ | ✗ | ✓ |
| **Developer（开发者）** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Reporter（观察者）** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

## 核心特性

### 层级组结构
- 组可以有父子关系
- 权限从父组继承
- 父组成员自动获得子组的访问权限

### 资源共享
- 资源（模型、机器人、团队）可以分配给组
- 所有组成员根据其角色访问组资源
- 资源标记其来源（公共、个人、组、共享）

### 成员管理
- 通过用户名邀请用户并指定角色
- 更新成员角色（需要 Maintainer+ 权限）
- 移除成员或离开组
- 批量邀请所有系统用户（仅 Owner）

### 所有权转让
- Owner 可以将所有权转让给任何 Maintainer
- 原 Owner 转让后变为 Maintainer
- Owner 不能直接离开，必须先转让所有权

### 资源迁移
- 成员离开时，其资源自动转移给组的 Owner
- 确保没有资源被孤立

## API 接口

### 组管理
- `GET /api/groups` - 列出用户的组
- `POST /api/groups` - 创建新组
- `GET /api/groups/{id}` - 获取组详情
- `PUT /api/groups/{id}` - 更新组
- `DELETE /api/groups/{id}` - 删除组（仅 Owner）

### 成员管理
- `GET /api/groups/{id}/members` - 列出成员
- `POST /api/groups/{id}/members` - 邀请成员
- `PUT /api/groups/{id}/members/{user_id}` - 更新成员角色
- `DELETE /api/groups/{id}/members/{user_id}` - 移除成员
- `POST /api/groups/{id}/members/invite-all` - 邀请所有用户（仅 Owner）
- `POST /api/groups/{id}/leave` - 离开组
- `POST /api/groups/{id}/transfer-ownership` - 转让所有权

### 资源查询
- `GET /api/groups/{id}/models` - 列出组的模型
- `GET /api/groups/{id}/bots` - 列出组的机器人
- `GET /api/groups/{id}/teams` - 列出组的团队

## 数据库结构

### Namespace（组）表
- `id` - 主键
- `name` - 组名称
- `parent_id` - 父组 ID（可为空，用于层级结构）
- `owner_user_id` - 所有者用户 ID
- `visibility` - 可见性设置（当前为 'private'，保留用于未来）
- `description` - 组描述
- `is_active` - 激活状态
- `created_at`, `updated_at` - 时间戳

### Namespace Members（组成员）表
- `id` - 主键
- `group_id` - 外键到 groups
- `user_id` - 外键到 users
- `role` - 成员角色（Owner, Maintainer, Developer, Reporter）
- `invited_by_user_id` - 邀请人用户 ID
- `is_active` - 激活状态
- `created_at`, `updated_at` - 时间戳

### Kinds 表增强
- 添加 `group_id` 字段（可为空）以关联资源和组
- `user_id = 0` 表示公共资源（从 public_models/public_shells 迁移）

## 迁移说明

### 公共资源迁移
- `public_models` 表的所有记录迁移到 `kinds`，设置 `user_id=0, kind='Model'`
- `public_shells` 表的所有记录迁移到 `kinds`，设置 `user_id=0, kind='Shell'`
- 迁移后删除原始的 `public_models` 和 `public_shells` 表
- 公共资源现在在 `kinds` 表中统一管理，通过特殊的 `user_id=0` 标记

## 前端集成

TypeScript 类型和 API 客户端位于：
- `frontend/src/types/group.ts` - 类型定义
- `frontend/src/apis/groups.ts` - API 客户端方法

Settings 页面的前端 UI 组件计划在未来实现。

## 未来增强

计划在未来版本中实现的功能：
- 组可见性设置（公开/私有）
- Settings 页面的上下文切换器
- 完整的组管理 Settings UI
- 列表视图中的资源来源标签
- 组资源过滤
- 高级权限配置
