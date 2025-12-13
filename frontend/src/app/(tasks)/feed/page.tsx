// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import TopNavigation from '@/features/layout/TopNavigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  RssIcon,
  PlusIcon,
  SearchIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
  ExternalLinkIcon,
} from 'lucide-react'
import { subscriptionsApi } from '@/apis/subscriptions'
import { Subscription, SubscriptionItem } from '@/types/subscription'
import '@/features/common/scrollbar.css'

export default function FeedPage() {
  const { t } = useTranslation('feed')
  const router = useRouter()

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [items, setItems] = useState<SubscriptionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'alerts'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Load subscriptions
  const loadSubscriptions = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await subscriptionsApi.getSubscriptions({ limit: 100 })
      setSubscriptions(response.items)
      if (response.items.length > 0 && !selectedSubscription) {
        setSelectedSubscription(response.items[0])
      }
    } catch (error) {
      console.error('Failed to load subscriptions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedSubscription])

  // Load items for selected subscription
  const loadItems = useCallback(async () => {
    if (!selectedSubscription) return

    try {
      setItemsLoading(true)
      const params: Record<string, unknown> = { limit: 50 }
      if (filter === 'unread') params.is_read = false
      if (filter === 'alerts') params.should_alert = true
      if (searchQuery) params.search = searchQuery

      const response = await subscriptionsApi.getSubscriptionItems(
        selectedSubscription.id,
        params as { is_read?: boolean; should_alert?: boolean; search?: string; limit?: number }
      )
      setItems(response.items)
    } catch (error) {
      console.error('Failed to load items:', error)
    } finally {
      setItemsLoading(false)
    }
  }, [selectedSubscription, filter, searchQuery])

  useEffect(() => {
    loadSubscriptions()
  }, [loadSubscriptions])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleMarkRead = async (item: SubscriptionItem) => {
    if (!selectedSubscription || item.is_read) return

    try {
      await subscriptionsApi.markItemRead(selectedSubscription.id, item.id)
      setItems(items.map(i => (i.id === item.id ? { ...i, is_read: true } : i)))
      setSubscriptions(
        subscriptions.map(s =>
          s.id === selectedSubscription.id
            ? { ...s, unread_count: Math.max(0, s.unread_count - 1) }
            : s
        )
      )
    } catch (error) {
      console.error('Failed to mark item as read:', error)
    }
  }

  const handleMarkAllRead = async () => {
    if (!selectedSubscription) return

    try {
      await subscriptionsApi.markAllItemsRead(selectedSubscription.id)
      setItems(items.map(i => ({ ...i, is_read: true })))
      setSubscriptions(
        subscriptions.map(s =>
          s.id === selectedSubscription.id ? { ...s, unread_count: 0 } : s
        )
      )
    } catch (error) {
      console.error('Failed to mark all items as read:', error)
    }
  }

  const totalUnread = subscriptions.reduce((sum, s) => sum + s.unread_count, 0)

  return (
    <div className="flex smart-h-screen bg-base text-text-primary box-border">
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavigation activePage="feed" variant="with-sidebar">
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <Badge variant="destructive" className="rounded-full">
                {totalUnread}
              </Badge>
            )}
          </div>
        </TopNavigation>

        <div className="flex-1 flex overflow-hidden">
          {/* Subscriptions sidebar */}
          <div className="w-64 border-r border-border flex flex-col bg-surface">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">{t('subscriptions')}</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push('/feed/subscriptions')}
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="p-4 text-center text-text-secondary text-sm">Loading...</div>
              ) : subscriptions.length === 0 ? (
                <div className="p-4 text-center">
                  <RssIcon className="h-8 w-8 mx-auto mb-2 text-text-muted" />
                  <p className="text-sm text-text-secondary">{t('empty_subscriptions')}</p>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => router.push('/feed/subscriptions')}
                  >
                    {t('create_subscription')}
                  </Button>
                </div>
              ) : (
                <div className="p-2">
                  {subscriptions.map(subscription => (
                    <button
                      key={subscription.id}
                      className={`w-full p-3 rounded-lg text-left transition-colors mb-1 ${
                        selectedSubscription?.id === subscription.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedSubscription(subscription)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {subscription.name}
                        </span>
                        {subscription.unread_count > 0 && (
                          <Badge variant="secondary" className="ml-2 rounded-full text-xs">
                            {subscription.unread_count}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                        <span
                          className={`inline-flex items-center ${
                            subscription.enabled ? 'text-green-500' : 'text-text-muted'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1 ${
                              subscription.enabled ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                          />
                          {subscription.enabled ? t('subscription_enabled') : t('subscription_disabled')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedSubscription ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-border bg-surface">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-lg font-semibold">{selectedSubscription.name}</h1>
                      {selectedSubscription.description && (
                        <p className="text-sm text-text-secondary mt-1">
                          {selectedSubscription.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        {t('mark_all_read')}
                      </Button>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-4 mt-4">
                    <div className="relative flex-1 max-w-md">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      <Input
                        placeholder={t('search_items')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                      <TabsList>
                        <TabsTrigger value="all">{t('all')}</TabsTrigger>
                        <TabsTrigger value="unread">{t('unread')}</TabsTrigger>
                        <TabsTrigger value="alerts">{t('alerts_only')}</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                {/* Items list */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                  {itemsLoading ? (
                    <div className="text-center py-8 text-text-secondary">Loading...</div>
                  ) : items.length === 0 ? (
                    <div className="text-center py-8">
                      <RssIcon className="h-12 w-12 mx-auto mb-3 text-text-muted" />
                      <p className="text-text-secondary">{t('empty_items')}</p>
                      <p className="text-sm text-text-muted mt-1">{t('empty_items_hint')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map(item => (
                        <Card
                          key={item.id}
                          className={`cursor-pointer transition-colors ${
                            !item.is_read ? 'bg-primary/5 border-primary/20' : ''
                          }`}
                          onClick={() => handleMarkRead(item)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <CardTitle className="text-base font-medium flex items-center gap-2">
                                {item.should_alert && (
                                  <BellIcon className="h-4 w-4 text-orange-500" />
                                )}
                                {!item.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-primary" />
                                )}
                                {item.title}
                              </CardTitle>
                              {item.source_url && (
                                <a
                                  href={item.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-text-muted hover:text-primary"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <ExternalLinkIcon className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {item.summary && (
                              <p className="text-sm text-text-secondary line-clamp-2">
                                {item.summary}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                              <span className="flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                {new Date(item.created_at).toLocaleString()}
                              </span>
                              {item.should_alert && item.alert_reason && (
                                <Badge variant="outline" className="text-orange-500 border-orange-500">
                                  {item.alert_reason}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <RssIcon className="h-16 w-16 mx-auto mb-4 text-text-muted" />
                  <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
                  <p className="text-text-secondary mb-4">{t('empty_subscriptions_hint')}</p>
                  <Button onClick={() => router.push('/feed/subscriptions')}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    {t('create_subscription')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
