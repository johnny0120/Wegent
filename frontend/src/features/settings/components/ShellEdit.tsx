// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { BeakerIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useTranslation } from '@/hooks/useTranslation'
import { shellApis, UnifiedShell, ImageCheckResult } from '@/apis/shells'

interface ShellEditProps {
  shell: UnifiedShell | null
  onClose: () => void
  toast: ReturnType<typeof import('@/hooks/use-toast').useToast>['toast']
}

const ShellEdit: React.FC<ShellEditProps> = ({ shell, onClose, toast }) => {
  const { t } = useTranslation('common')
  const isEditing = !!shell

  // Form state
  const [name, setName] = useState(shell?.name || '')
  const [displayName, setDisplayName] = useState(shell?.displayName || '')
  const [baseShellRef, setBaseShellRef] = useState(shell?.baseShellRef || '')
  const [baseImage, setBaseImage] = useState(shell?.baseImage || '')
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<{
    status: 'submitted' | 'skipped' | 'error' | 'success' | 'failed'
    message: string
    valid?: boolean
    checks?: ImageCheckResult[]
    errors?: string[]
  } | null>(null)

  // Available base shells (public local_engine shells)
  const [baseShells, setBaseShells] = useState<UnifiedShell[]>([])
  const [loadingBaseShells, setLoadingBaseShells] = useState(true)

  useEffect(() => {
    const fetchBaseShells = async () => {
      try {
        const shells = await shellApis.getLocalEngineShells()
        setBaseShells(shells)
      } catch (error) {
        console.error('Failed to fetch base shells:', error)
      } finally {
        setLoadingBaseShells(false)
      }
    }
    fetchBaseShells()
  }, [])

  const handleValidateImage = async () => {
    if (!baseImage || !baseShellRef) {
      toast({
        variant: 'destructive',
        title: t('shells.errors.base_image_and_shell_required'),
      })
      return
    }

    // Find the runtime for selected base shell
    const selectedBaseShell = baseShells.find(s => s.name === baseShellRef)
    if (!selectedBaseShell) {
      toast({
        variant: 'destructive',
        title: t('shells.errors.base_shell_not_found'),
      })
      return
    }

    setValidating(true)
    setValidationStatus(null)

    try {
      const result = await shellApis.validateImage({
        image: baseImage,
        shellType: selectedBaseShell.runtime,
        shellName: name || undefined,
      })

      // Handle different response statuses
      if (result.status === 'skipped') {
        // Dify type - validation not needed
        setValidationStatus({
          status: 'success',
          message: result.message,
          valid: true,
          checks: [],
          errors: [],
        })
        toast({
          title: t('shells.validation_skipped'),
          description: result.message,
        })
      } else if (result.status === 'submitted') {
        // Async validation task submitted
        setValidationStatus({
          status: 'submitted',
          message: result.message,
          valid: undefined,
        })
        toast({
          title: t('shells.validation_submitted'),
          description: t('shells.validation_async_hint'),
        })
      } else if (result.status === 'error') {
        // Error submitting validation
        setValidationStatus({
          status: 'error',
          message: result.message,
          valid: false,
          errors: result.errors || [],
        })
        toast({
          variant: 'destructive',
          title: t('shells.validation_failed'),
          description: result.message,
        })
      }
    } catch (error) {
      setValidationStatus({
        status: 'error',
        message: (error as Error).message,
        valid: false,
        errors: [(error as Error).message],
      })
      toast({
        variant: 'destructive',
        title: t('shells.validation_failed'),
        description: (error as Error).message,
      })
    } finally {
      setValidating(false)
    }
  }

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: t('shells.errors.name_required'),
      })
      return
    }

    // Validate name format (lowercase letters, numbers, and hyphens only)
    const nameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/
    if (!nameRegex.test(name)) {
      toast({
        variant: 'destructive',
        title: t('shells.errors.name_invalid'),
      })
      return
    }

    if (!isEditing) {
      if (!baseShellRef) {
        toast({
          variant: 'destructive',
          title: t('shells.errors.base_shell_required'),
        })
        return
      }

      if (!baseImage.trim()) {
        toast({
          variant: 'destructive',
          title: t('shells.errors.base_image_required'),
        })
        return
      }
    }

    setSaving(true)
    try {
      if (isEditing) {
        await shellApis.updateShell(shell.name, {
          displayName: displayName.trim() || undefined,
          baseImage: baseImage.trim() || undefined,
        })
        toast({
          title: t('shells.update_success'),
        })
      } else {
        await shellApis.createShell({
          name: name.trim(),
          displayName: displayName.trim() || undefined,
          baseShellRef,
          baseImage: baseImage.trim(),
        })
        toast({
          title: t('shells.create_success'),
        })
      }

      onClose()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: isEditing ? t('shells.errors.update_failed') : t('shells.errors.create_failed'),
        description: (error as Error).message,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleBack = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      handleBack()
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [handleBack])

  return (
    <div className="flex flex-col w-full bg-surface rounded-lg px-2 py-4 min-h-[500px]">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center text-text-muted hover:text-text-primary text-base"
          title={t('common.back')}
        >
          <svg
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mr-1"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
          {t('common.back')}
        </button>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? t('actions.saving') : t('actions.save')}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6 max-w-xl mx-2">
        {/* Shell Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-lg font-semibold text-text-primary">
            {t('shells.shell_name')} <span className="text-red-400">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="my-custom-shell"
            disabled={isEditing}
            className="bg-base"
          />
          <p className="text-xs text-text-muted">
            {isEditing ? t('shells.name_readonly_hint') : t('shells.name_hint')}
          </p>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName" className="text-lg font-semibold text-text-primary">
            {t('shells.display_name')}
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={t('shells.display_name_placeholder')}
            className="bg-base"
          />
          <p className="text-xs text-text-muted">{t('shells.display_name_hint')}</p>
        </div>

        {/* Base Shell Reference */}
        <div className="space-y-2">
          <Label htmlFor="baseShellRef" className="text-lg font-semibold text-text-primary">
            {t('shells.base_shell')} <span className="text-red-400">*</span>
          </Label>
          <Select
            value={baseShellRef}
            onValueChange={setBaseShellRef}
            disabled={isEditing || loadingBaseShells}
          >
            <SelectTrigger className="bg-base">
              <SelectValue placeholder={t('shells.select_base_shell')} />
            </SelectTrigger>
            <SelectContent>
              {baseShells.map(shell => (
                <SelectItem key={shell.name} value={shell.name}>
                  <div className="flex items-center gap-2">
                    <span>{shell.displayName || shell.name}</span>
                    <span className="text-xs text-text-muted">({shell.runtime})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-text-muted">{t('shells.base_shell_hint')}</p>
        </div>

        {/* Base Image */}
        <div className="space-y-2">
          <Label htmlFor="baseImage" className="text-lg font-semibold text-text-primary">
            {t('shells.base_image')} <span className="text-red-400">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="baseImage"
              value={baseImage}
              onChange={e => {
                setBaseImage(e.target.value)
                setValidationStatus(null) // Clear validation status on change
              }}
              placeholder="ghcr.io/your-org/your-image:latest"
              className="bg-base flex-1"
            />
            <Button
              variant="outline"
              onClick={handleValidateImage}
              disabled={validating || !baseImage || !baseShellRef}
            >
              {validating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BeakerIcon className="w-4 h-4 mr-1" />
              )}
              {t('shells.validate')}
            </Button>
          </div>
          <p className="text-xs text-text-muted">{t('shells.base_image_hint')}</p>

          {/* Validation Status */}
          {validationStatus && (
            <div
              className={`mt-3 p-3 rounded-md border ${
                validationStatus.status === 'success' || validationStatus.valid === true
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                  : validationStatus.status === 'submitted'
                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                    : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {validationStatus.status === 'success' || validationStatus.valid === true ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : validationStatus.status === 'submitted' ? (
                  <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
                <span
                  className={`font-medium ${
                    validationStatus.status === 'success' || validationStatus.valid === true
                      ? 'text-green-700 dark:text-green-300'
                      : validationStatus.status === 'submitted'
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {validationStatus.status === 'success'
                    ? t('shells.validation_passed')
                    : validationStatus.status === 'submitted'
                      ? t('shells.validation_in_progress')
                      : t('shells.validation_not_passed')}
                </span>
              </div>
              <p className="text-sm text-text-secondary">{validationStatus.message}</p>
              {validationStatus.checks && validationStatus.checks.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {validationStatus.checks.map((check, index) => (
                    <li key={index} className="flex items-center gap-2">
                      {check.status === 'pass' ? (
                        <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className="text-text-secondary">
                        {check.name}
                        {check.version && ` (${check.version})`}
                        {check.message && `: ${check.message}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {validationStatus.errors && validationStatus.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-red-600 dark:text-red-400">
                  {validationStatus.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShellEdit
