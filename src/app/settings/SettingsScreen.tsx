import { useState } from 'react'
import { useSettingsStore } from '../../features/settings/store'
import { useThemeStore } from '../../features/theme/store'
import { ApiKeyForm } from '../onboarding/ApiKeyForm'
import { AccountSelectionList } from '../onboarding/AccountSelectionList'
import { ThemeSelector } from './ThemeSelector'
import { DisconnectConfirm } from './DisconnectConfirm'
import { formatSettingsError } from './error-message'

export function SettingsScreen(): React.JSX.Element {
  const settingsStore = useSettingsStore()
  const themeStore = useThemeStore()
  const { status, accounts, error, prefetchProgress, changeApiKey, refreshAccounts, selectAccount, reset } =
    settingsStore

  const [showApiKeyForm, setShowApiKeyForm] = useState(false)
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const isBusy = status === 'verifying'

  async function handleApiKeySubmit(apiKey: string): Promise<void> {
    setShowApiKeyForm(false)
    await changeApiKey(apiKey)
  }

  async function handleDisconnectConfirm(): Promise<void> {
    setIsDisconnecting(true)
    await settingsStore.disconnect()
  }

  const percent =
    prefetchProgress !== null && prefetchProgress.total > 0
      ? Math.round((prefetchProgress.completed / prefetchProgress.total) * 100)
      : 0

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold text-text">설정</h1>

      <section className="rounded-[14px] bg-surface border border-border p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-text">계정</h2>
          <p className="text-sm text-text-muted">API 키를 다시 입력하거나 사용할 메이플 ID를 변경할 수 있습니다.</p>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setShowApiKeyForm((prev) => !prev)}
            className="text-sm font-medium text-text-muted hover:text-text disabled:opacity-50"
          >
            API 키 변경
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => refreshAccounts()}
            className="text-sm font-medium text-text-muted hover:text-text disabled:opacity-50"
          >
            계정 변경
          </button>
        </div>

        {status === 'idle' && showApiKeyForm && (
          <ApiKeyForm isSubmitting={false} errorMessage={null} onSubmit={handleApiKeySubmit} />
        )}

        {status === 'verifying' && <p className="text-sm text-text-muted">캐릭터 목록을 확인하고 있어요...</p>}

        {status === 'selectingAccount' && (
          <AccountSelectionList
            accounts={accounts}
            isSubmitting={false}
            errorMessage={null}
            onSelect={selectAccount}
          />
        )}

        {status === 'prefetching' && (
          <div className="space-y-2">
            <p className="text-sm text-text-muted">
              캐릭터 정보를 준비하고 있어요
              {prefetchProgress !== null ? ` (${prefetchProgress.completed}/${prefetchProgress.total})` : ''}
            </p>
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            >
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-2">
            <p className="text-sm text-error">
              {error !== null ? formatSettingsError(error) : '오류가 발생했습니다'}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-full bg-primary text-bg font-semibold hover:bg-primary-hover px-5 py-2.5 text-sm"
            >
              다시 시도
            </button>
          </div>
        )}
      </section>

      <ThemeSelector theme={themeStore.theme} onSelect={themeStore.selectTheme} />

      <section className="rounded-[14px] bg-surface border border-border p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-text">연결 해제</h2>
          <p className="text-sm text-text-muted">API 키와 계정 연결을 해제하고 온보딩 화면으로 돌아갑니다.</p>
        </div>

        <button
          type="button"
          onClick={() => setIsDisconnectOpen(true)}
          className="rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error hover:bg-error/10"
        >
          연결 해제
        </button>
      </section>

      <DisconnectConfirm
        isOpen={isDisconnectOpen}
        isDisconnecting={isDisconnecting}
        onConfirm={() => {
          void handleDisconnectConfirm()
        }}
        onCancel={() => setIsDisconnectOpen(false)}
      />
    </div>
  )
}
