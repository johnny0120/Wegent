# Groups - Organization-Level Resource Management

Wegent Groups feature enables organization-level collaboration and resource sharing, similar to GitLab groups.

## Overview

Groups allow you to:
- Organize users into teams with hierarchical structure
- Share resources (Models, Bots, Teams) within a group
- Control access with role-based permissions
- Manage resources at organization level

## Group Roles

### Permission Matrix

| Role | View | Create | Edit | Delete | Invite Members | Remove Members | Change Roles | Delete Group | Transfer Ownership | Leave Group |
|------|------|--------|------|--------|----------------|----------------|--------------|--------------|-------------------|-------------|
| **Owner** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ (must transfer first) |
| **Maintainer** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (cannot change Owner) | ✗ | ✗ | ✓ |
| **Developer** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Reporter** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

## Key Features

### Hierarchical Groups
- Groups use path-based naming with "/" delimiter for hierarchy
  - Root group: `"groupname"`
  - Child group: `"parent/child"`
  - Nested child: `"parent/child/grandchild"`
- Create child groups by providing `parent_path` parameter
- Permissions are inherited from parent groups
- Members in parent groups automatically have access to child groups

### Resource Sharing
- Resources (Models, Bots, Teams) can be assigned to a group
- All group members can access group resources based on their role
- Resources are marked with their source (Public, Personal, Group, Shared)

### Member Management
- Invite users by username with specific roles
- Update member roles (Maintainer+ permission required)
- Remove members or leave groups
- Bulk invite all system users (Owner only)

### Ownership Transfer
- Owner can transfer ownership to any Maintainer
- Original owner becomes Maintainer after transfer
- Owner cannot leave without transferring ownership first

### Resource Migration
- When a member leaves, their resources are transferred to the group Owner
- Ensures no resources are orphaned

## API Endpoints

### Group Management
- `GET /api/groups` - List user's groups
- `POST /api/groups` - Create new group
- `GET /api/groups/{id}` - Get group details
- `PUT /api/groups/{id}` - Update group
- `DELETE /api/groups/{id}` - Delete group (Owner only)

### Member Management
- `GET /api/groups/{id}/members` - List members
- `POST /api/groups/{id}/members` - Invite member
- `PUT /api/groups/{id}/members/{user_id}` - Update member role
- `DELETE /api/groups/{id}/members/{user_id}` - Remove member
- `POST /api/groups/{id}/members/invite-all` - Invite all users (Owner only)
- `POST /api/groups/{id}/leave` - Leave group
- `POST /api/groups/{id}/transfer-ownership` - Transfer ownership

### Resource Queries
- `GET /api/groups/{id}/models` - List group models
- `GET /api/groups/{id}/bots` - List group bots
- `GET /api/groups/{id}/teams` - List group teams

## Database Schema

### Namespace Table (stores groups)
- `id` - Primary key
- `name` - Group name (unique, String(255))
  - Uses path-based naming for hierarchy (e.g., "parent/child")
  - Immutable after creation
- `display_name` - User-friendly display name (modifiable)
- `owner_user_id` - Owner user ID
- `visibility` - Visibility setting (currently 'private', reserved for future)
- `description` - Group description
- `is_active` - Active status
- `created_at`, `updated_at` - Timestamps

### Namespace Members Table (stores group members)
- `id` - Primary key
- `group_name` - References namespace.name (string-based foreign key)
- `user_id` - Foreign key to users
- `role` - Member role (Owner, Maintainer, Developer, Reporter)
- `invited_by_user_id` - Inviter user ID
- `is_active` - Active status
- `created_at`, `updated_at` - Timestamps

### Kinds Table (Resource Association)
- Resources are associated with groups via the `namespace` field:
  - Public resources: `user_id=0, namespace='default'`
  - Personal resources: `user_id=xxx, namespace='default'`
  - Group resources: `user_id=xxx (creator), namespace=group_name`
- The `group_id` field has been removed - namespace directly stores the group name

## Migration Notes

### Public Resources Migration
- All records from `public_models` table migrated to `kinds` with `user_id=0, kind='Model'`
- All records from `public_shells` table migrated to `kinds` with `user_id=0, kind='Shell'`
- Original `public_models` and `public_shells` tables dropped after migration
- Public resources now unified in `kinds` table with special `user_id=0` marker

## Frontend Integration

TypeScript types and API client are available in:
- `frontend/src/types/group.ts` - Type definitions
- `frontend/src/apis/groups.ts` - API client methods

Frontend UI components for Settings page are planned for future implementation.

## Future Enhancements

Planned features for future releases:
- Group visibility settings (public/private)
- Context switcher in Settings page
- Complete Settings UI for group management
- Resource source tags in list views
- Group resource filtering
- Advanced permission configurations
