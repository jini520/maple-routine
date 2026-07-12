import { AccountSelectionList } from '../onboarding/AccountSelectionList'
import { formatSettingsError } from './error-message'
import type { SettingsError, SettingsStatus, PrefetchProgress } from '../../features/settings/state'
import type { MapleAccount } from '../../types'

export interface AccountFlowStatusProps {
  status: SettingsStatus
  accounts: MapleAccount[]
  error: SettingsError | null
  prefetchProgress: PrefetchProgress | null
  onSelectAccount: (accountId: string) => void
  onRetry: () => void
}

// ApiKeyModal/AccountModal이 공유하는 상태 렌더링 — 두 모달 모두 "API 키/저장된 키로
// 계정을 검증하고, 필요하면 선택받고, 예열한다"는 동일한 SettingsStore 상태 머신을 보여준다.
export function AccountFlowStatus(props: AccountFlowStatusProps): React.JSX.Element | null {
  switch (props.status) {
    case 'idle':
      return null

    // ApiKeyForm/AccountSelectionList가 각자 자체 카드 스타일(rounded-[14px] bg-surface
    // border p-6)을 갖고 있으므로, 이 컴포넌트가 만드는 상태들도 같은 카드 스타일을 직접
    // 둘러 일관되게 보이도록 한다 — Modal은 이 컴포넌트를 card=false로 감싸는 것이 전제.
    case 'verifying':
      return (
        <p className="rounded-[14px] bg-surface border border-border p-6 text-sm text-text-muted">
          캐릭터 목록을 확인하고 있어요...
        </p>
      )

    case 'selectingAccount':
      return (
        <AccountSelectionList
          accounts={props.accounts}
          isSubmitting={false}
          errorMessage={null}
          onSelect={props.onSelectAccount}
        />
      )

    case 'prefetching': {
      const percent =
        props.prefetchProgress !== null && props.prefetchProgress.total > 0
          ? Math.round((props.prefetchProgress.completed / props.prefetchProgress.total) * 100)
          : 0
      return (
        <div className="rounded-[14px] bg-surface border border-border p-6 space-y-2">
          <p className="text-sm text-text-muted">
            캐릭터 정보를 준비하고 있어요
            {props.prefetchProgress !== null
              ? ` (${props.prefetchProgress.completed}/${props.prefetchProgress.total})`
              : ''}
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
      )
    }

    case 'error':
      return (
        <div className="rounded-[14px] bg-surface border border-border p-6 space-y-2">
          <p className="text-sm text-error">
            {props.error !== null ? formatSettingsError(props.error) : '오류가 발생했습니다'}
          </p>
          <button
            type="button"
            onClick={props.onRetry}
            className="rounded-full bg-primary text-bg font-semibold hover:bg-primary-hover px-5 py-2.5 text-sm"
          >
            다시 시도
          </button>
        </div>
      )
  }
}
