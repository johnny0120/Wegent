// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import TopNavigation from '@/features/layout/TopNavigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RssIcon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  SettingsIcon,
  ClockIcon,
  LinkIcon,
  ArrowLeftIcon,
} from 'lucide-react'
import { subscriptionsApi } from '@/apis/subscriptions'
import { Subscription, SubscriptionCreate, TriggerType } from '@/types/subscription'
import { teamService } from '@/features/tasks/service/teamService'
import { Team } from '@/types/api'
import '@/features/common/scrollbar.css'

export default function SubscriptionsPage() {
  const { t } = useTranslation('feed')
  const router = useRouter()

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)

  // Form state
  const [formData, setFormData] = useState<{
    name: string
    description: string
    team_id: string
    trigger_type: TriggerType
    cron_expression: string
    cron_timezone: string
    alert_enabled: boolean
    alert_prompt: string
    retention_days: number
    enabled: boolean
  }>({
    name: '',
    description: '',
    team_id: '',
    trigger_type: 'cron',
    cron_expression: '0 */30 * * * *',
    cron_timezone: 'Asia/Shanghai',
    alert_enabled: true,
    alert_prompt: '',
    retention_days: 30,
    enabled: true,
  })

  // Load subscriptions
  const loadSubscriptions = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await subscriptionsApi.getSubscriptions({ limit: 100 })
      setSubscriptions(response.items)
    } catch (error) {
      console.error('Failed to load subscriptions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load teams
  const loadTeams = useCallback(async () => {
    try {
      const response = await teamService.getTeams()
      setTeams(response)
    } catch (error) {
      console.error('Failed to load teams:', error)
    }
  }, [])

  useEffect(() => {
    loadSubscriptions()
    loadTeams()
  }, [loadSubscriptions, loadTeams])

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      team_id: '',
      trigger_type: 'cron',
      cron_expression: '0 */30 * * * *',
      cron_timezone: 'Asia/Shanghai',
      alert_enabled: true,
      alert_prompt: '',
      retention_days: 30,
      enabled: true,
    })
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.team_id) return

    try {
      const data: SubscriptionCreate = {
        name: formData.name,
        description: formData.description || undefined,
        team_id: parseInt(formData.team_id),
        trigger: {
          type: formData.trigger_type,
          cron:
            formData.trigger_type === 'cron'
              ? {
                  expression: formData.cron_expression,
                  timezone: formData.cron_timezone,
                }
              : undefined,
        },
        alert_policy: {
          enabled: formData.alert_enabled,
          prompt: formData.alert_prompt || undefined,
        },
        retention: {
          days: formData.retention_days,
        },
        enabled: formData.enabled,
      }

      await subscriptionsApi.createSubscription(data)
      setShowCreateDialog(false)
      resetForm()
      loadSubscriptions()
    } catch (error) {
      console.error('Failed to create subscription:', error)
    }
  }

  const handleToggleEnabled = async (subscription: Subscription) => {
    try {
      if (subscription.enabled) {
        await subscriptionsApi.disableSubscription(subscription.id)
      } else {
        await subscriptionsApi.enableSubscription(subscription.id)
      }
      loadSubscriptions()
    } catch (error) {
      console.error('Failed to toggle subscription:', error)
    }
  }

  const handleDelete = async () => {
    if (!selectedSubscription) return

    try {
      await subscriptionsApi.deleteSubscription(selectedSubscription.id)
      setShowDeleteDialog(false)
      setSelectedSubscription(null)
      loadSubscriptions()
    } catch (error) {
      console.error('Failed to delete subscription:', error)
    }
  }

  const handleTriggerRun = async (subscription: Subscription) => {
    try {
      await subscriptionsApi.triggerSubscriptionRun(subscription.id)
      loadSubscriptions()
    } catch (error) {
      console.error('Failed to trigger run:', error)
    }
  }

  return (
    <div className="flex smart-h-screen bg-base text-text-primary box-border">
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavigation activePage="feed" variant="with-sidebar">
          <Button variant="ghost" size="sm" onClick={() => router.push('/feed')}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            {t('feed')}
          </Button>
        </TopNavigation>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">{t('subscriptions')}</h1>
                <p className="text-text-secondary mt-1">{t('empty_subscriptions_hint')}</p>
              </div>
              <Button onClick={() => setShowCreateDialog(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                {t('create_subscription')}
              </Button>
            </div>

            {/* Subscriptions list */}
            {isLoading ? (
              <div className="text-center py-12 text-text-secondary">Loading...</div>
            ) : subscriptions.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <RssIcon className="h-16 w-16 mx-auto mb-4 text-text-muted" />
                  <h2 className="text-lg font-semibold mb-2">{t('empty_subscriptions')}</h2>
                  <p className="text-text-secondary mb-4">{t('empty_subscriptions_hint')}</p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    {t('create_subscription')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {subscriptions.map(subscription => (
                  <Card key={subscription.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {subscription.name}
                            <Badge
                              variant={subscription.enabled ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {subscription.enabled
                                ? t('subscription_enabled')
                                : t('subscription_disabled')}
                            </Badge>
                          </CardTitle>
                          {subscription.description && (
                            <CardDescription className="mt-1">
                              {subscription.description}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTriggerRun(subscription)}
                          >
                            <PlayIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleEnabled(subscription)}
                          >
                            {subscription.enabled ? (
                              <PauseIcon className="h-4 w-4" />
                            ) : (
                              <PlayIcon className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSubscription(subscription)
                              setShowDeleteDialog(true)
                            }}
                          >
                            <TrashIcon className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-text-muted">{t('subscription_team')}:</span>
                          <p className="font-medium">{subscription.team_name}</p>
                        </div>
                        <div>
                          <span className="text-text-muted">{t('trigger_type')}:</span>
                          <p className="font-medium flex items-center gap-1">
                            {subscription.trigger_type === 'cron' ? (
                              <>
                                <ClockIcon className="h-3 w-3" />
                                {t('trigger_cron')}
                              </>
                            ) : (
                              <>
                                <LinkIcon className="h-3 w-3" />
                                {t('trigger_webhook')}
                              </>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-text-muted">{t('total_items')}:</span>
                          <p className="font-medium">{subscription.total_item_count}</p>
                        </div>
                        <div>
                          <span className="text-text-muted">{t('unread_items')}:</span>
                          <p className="font-medium">
                            {subscription.unread_count > 0 ? (
                              <Badge variant="secondary">{subscription.unread_count}</Badge>
                            ) : (
                              '0'
                            )}
                          </p>
                        </div>
                      </div>
                      {subscription.last_run_time && (
                        <div className="mt-3 text-xs text-text-muted">
                          {t('last_run')}: {new Date(subscription.last_run_time).toLocaleString()}
                          <Badge
                            variant={
                              subscription.last_run_status === 'success'
                                ? 'default'
                                : subscription.last_run_status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="ml-2"
                          >
                            {subscription.last_run_status}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('create_subscription')}</DialogTitle>
            <DialogDescription>{t('empty_subscriptions_hint')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('subscription_name')}</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Subscription"
              />
            </div>

            <div>
              <Label>{t('subscription_description')}</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div>
              <Label>{t('subscription_team')}</Label>
              <Select
                value={formData.team_id}
                onValueChange={value => setFormData({ ...formData, team_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={String(team.id)}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('trigger_type')}</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={value =>
                  setFormData({ ...formData, trigger_type: value as TriggerType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cron">{t('trigger_cron')}</SelectItem>
                  <SelectItem value="webhook">{t('trigger_webhook')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.trigger_type === 'cron' && (
              <div>
                <Label>{t('cron_expression')}</Label>
                <Input
                  value={formData.cron_expression}
                  onChange={e =>
                    setFormData({ ...formData, cron_expression: e.target.value })
                  }
                  placeholder="0 */30 * * * *"
                />
                <p className="text-xs text-text-muted mt-1">
                  {t('cron_examples')}: {t('cron_every_30min')} (0 */30 * * * *)
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>{t('alert_enabled')}</Label>
              <Switch
                checked={formData.alert_enabled}
                onCheckedChange={checked =>
                  setFormData({ ...formData, alert_enabled: checked })
                }
              />
            </div>

            {formData.alert_enabled && (
              <div>
                <Label>{t('alert_prompt')}</Label>
                <Textarea
                  value={formData.alert_prompt}
                  onChange={e =>
                    setFormData({ ...formData, alert_prompt: e.target.value })
                  }
                  placeholder={t('alert_prompt_placeholder')}
                  rows={3}
                />
              </div>
            )}

            <div>
              <Label>{t('retention_days')}</Label>
              <Input
                type="number"
                value={formData.retention_days}
                onChange={e =>
                  setFormData({ ...formData, retention_days: parseInt(e.target.value) || 30 })
                }
                min={1}
                max={365}
              />
              <p className="text-xs text-text-muted mt-1">{t('retention_days_hint')}</p>
            </div>

            <div className="flex items-center justify-between">
              <Label>{t('subscription_enabled')}</Label>
              <Switch
                checked={formData.enabled}
                onCheckedChange={checked => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name || !formData.team_id}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete_subscription')}</DialogTitle>
            <DialogDescription>{t('delete_subscription_confirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
