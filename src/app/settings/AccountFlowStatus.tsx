import { AccountSelectionList } from '../onboarding/AccountSelectionList'
import { ContentCharacterStep } from '../onboarding/ContentCharacterStep'
import { formatSettingsError } from './error-message'
import type { SettingsError, SettingsStatus, PrefetchProgress } from '../../features/settings/state'
import type { MapleAccount } from '../../types'
import { ProgressBar } from '../../components/ProgressBar/ProgressBar'
import { Button } from '../../components/Button/Button'
import { Card } from '../../components/Card/Card'

export interface AccountFlowStatusProps {
  status: SettingsStatus
  accounts: MapleAccount[]
  error: SettingsError | null
  prefetchProgress: PrefetchProgress | null
  // ADR-086 결정 6: 아직 저장되지 않은 후보 계정 — 캐릭터 선택 단계가 이 계정으로 목록을 그린다.
  pendingAccountId: string | null
  isCommitting: boolean
  onSelectAccount: (accountId: string) => void
  onCommitCharacters: (ocids: string[]) => void
  onCancel: () => void
  onRetry: () => void
}

// AccountModal(계정 변경)이 쓰는 상태 렌더링 — "저장된 키로 계정을 검증하고, 필요하면
// 선택받고, 예열한다"는 SettingsStore 상태 머신을 보여준다.
export function AccountFlowStatus(props: AccountFlowStatusProps): React.JSX.Element | null {
  switch (props.status) {
    case 'idle':
      return null

    // 이 컴포넌트가 만드는 상태들은 모두 같은 카드 스타일(rounded-[14px] bg-surface border p-6)을
    // 직접 둘러 일관되게 보이도록 한다 — Modal은 이 컴포넌트를 card=false로 감싸는 것이 전제.
    // AccountSelectionList는 온보딩 페이지형 개편으로 자체 카드를 잃었으므로(w-full space-y-4만
    // 남음), selectingAccount 케이스에서도 여기서 카드로 감싸야 배경 없이 뜨지 않는다.
    case 'verifying':
      return (
        <p className="rounded-[14px] bg-surface border border-border p-6 text-sm text-text-muted">
          캐릭터 목록을 확인하고 있어요...
        </p>
      )

    case 'selectingAccount':
      return (
        <Card className="p-6">
          <AccountSelectionList
            accounts={props.accounts}
            isSubmitting={false}
            onSelect={props.onSelectAccount}
          />
        </Card>
      )

    case 'prefetching': {
      const percent =
        props.prefetchProgress !== null && props.prefetchProgress.total > 0
          ? Math.round((props.prefetchProgress.completed / props.prefetchProgress.total) * 100)
          : 0
      return (
        <Card className="p-6 space-y-2">
          <p className="text-sm text-text-muted">
            캐릭터 정보를 준비하고 있어요
            {props.prefetchProgress !== null
              ? ` (${props.prefetchProgress.completed}/${props.prefetchProgress.total})`
              : ''}
          </p>
          <ProgressBar percent={percent} aria={{ now: percent, max: 100 }} />
        </Card>
      )
    }

    // ADR-086 결정 6: 예열이 끝나면 닫지 않고 새 계정에서 캐릭터를 다시 고르게 한다 — 저장하는
    // 순간에야 selectedAccountId·trackedCharacters 가 함께 커밋된다. 취소하면 이전 계정 그대로다.
    case 'selectingCharacters':
      return (
        <Card className="p-6 space-y-3">
          <ContentCharacterStep
            accountId={props.pendingAccountId ?? undefined}
            isSubmitting={props.isCommitting}
            submitLabel="저장"
            onSubmit={props.onCommitCharacters}
          />
          <Button
            variant="text"
            disabled={props.isCommitting}
            onClick={props.onCancel}
            className="w-full disabled:opacity-50"
          >
            취소
          </Button>
        </Card>
      )

    case 'error':
      return (
        <Card className="p-6 space-y-2">
          <p className="text-sm text-error-ink">
            {props.error !== null ? formatSettingsError(props.error) : '오류가 발생했습니다'}
          </p>
          <Button
            variant="primary"
            onClick={props.onRetry}
            className="text-sm"
          >
            다시 시도
          </Button>
        </Card>
      )
  }
}
