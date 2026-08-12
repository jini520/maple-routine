// AccountModal(계정 변경)이 쓰는 상태 렌더링 — "저장된 키로 계정을 검증하고, 필요하면
// 선택받고, 예열한다"는 SettingsStore 상태 머신을 보여준다([[ADR-086]] · [[ADR-113]] · [[ADR-114]]).
//
// ── RN 으로 옮기며 갈린 것 셋 ────────────────────────────────────────────────────────
//
// ① **카드가 `border-panel-border` 를 직접 쓴다.** 웹은 오버레이가 `.panel-on-scrim-parent > *`
//    선택자로 **직계 자식**의 테두리를 스크림 위 톤으로 낮췄는데([[ADR-122]] 결정 3), RN 에는
//    자손 선택자가 없어 부모가 자식의 스타일을 정할 방법이 없다(`Modal.tsx` 의 `ModalPanel` 주석).
//    그 선택자가 실제로 잡던 것이 **정확히 이 파일의 카드들**이라(유일한 호출부가 `AccountModal`
//    이고 그 안에서 `Modal.Panel` 의 직계 자식이 여기다) 같은 클래스를 여기서 직접 붙인다.
//    안쪽의 `AccountSelectionList`·`ContentCharacterStep` 은 온보딩과 공유되지만 **직계 자식이
//    아니라 웹에서도 이 규칙에 안 걸렸다** — 그래서 그쪽은 손대지 않는다.
// ② `<p>` → `Text`, `space-y-*` → `gap-*`, `Button` 의 글자 클래스는 `textClassName` 으로.
// ③ 「취소」 버튼의 `w-full` 은 상자(레이아웃)라 그대로 `className` 이다 — 가운데 정렬은 RN 에서
//    `items-center` 가 맡는다(웹은 `<button>` 의 기본 정렬이 가운데였다).
import { Text } from 'react-native'

import type {
  PrefetchProgress,
  SettingsError,
  SettingsStatus,
} from '@core/features/settings/state'
import type { MapleAccount } from '@core/types'

import { Button } from '../../components/atoms/Button/Button'
import { Card } from '../../components/atoms/Card/Card'
import { ProgressBar } from '../../components/atoms/ProgressBar/ProgressBar'
import { AccountSelectionList } from '../onboarding/AccountSelectionList'
import { ContentCharacterStep } from '../onboarding/ContentCharacterStep'
import { formatSettingsError } from './error-message'

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

/** 이 컴포넌트가 만드는 상태들이 공유하는 카드 — 스크림 위 테두리 톤은 파일 머리 ①. */
const PANEL_CARD_CLASS = 'border-panel-border p-6'

export function AccountFlowStatus(props: AccountFlowStatusProps): React.JSX.Element | null {
  switch (props.status) {
    case 'idle':
      return null

    // 이 컴포넌트가 만드는 상태들은 모두 같은 카드(Card + p-6)를 직접 둘러 일관되게 보이도록
    // 한다 — Modal 은 이 컴포넌트를 `Modal.Panel`(껍데기 없음)로 감싸는 것이 전제.
    // AccountSelectionList 는 온보딩 페이지형 개편으로 자체 카드를 잃었으므로, selectingAccount
    // 케이스에서도 여기서 카드로 감싸야 배경 없이 뜨지 않는다.
    //
    // ADR-113 결정 5: verifying(저장된 키로 character/list 재조회) 다음에 오는 것이
    // selectingAccount 의 프로브 대기(같은 진행률 바)라, 앞 단계가 문구면 마크가 중간에 바뀌어
    // 사용자가 두 번 기다린 것으로 읽는다. 같은 자리에 같은 프리미티브를 둬 하나의 연속된 로딩으로
    // 보이게 한다. 문구도 (n/total) 숫자도 붙이지 않는다 — character/list 는 한 번이라 총량이
    // 없고, 0% 바는 "시작했다"는 사실만 말한다.
    case 'verifying':
      return (
        <Card className={PANEL_CARD_CLASS}>
          <ProgressBar percent={0} aria={{ now: 0, max: 100 }} />
        </Card>
      )

    case 'selectingAccount':
      return (
        <Card className={PANEL_CARD_CLASS}>
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
        <Card className={`${PANEL_CARD_CLASS} gap-2`}>
          <Text className="text-sm text-text-muted">
            캐릭터 정보를 준비하고 있어요
            {props.prefetchProgress !== null
              ? ` (${props.prefetchProgress.completed}/${props.prefetchProgress.total})`
              : ''}
          </Text>
          <ProgressBar percent={percent} aria={{ now: percent, max: 100 }} />
        </Card>
      )
    }

    // ADR-086 결정 6: 예열이 끝나면 닫지 않고 새 계정에서 캐릭터를 다시 고르게 한다 — 저장하는
    // 순간에야 selectedAccountId·trackedCharacters 가 함께 커밋된다. 취소하면 이전 계정 그대로다.
    case 'selectingCharacters':
      return (
        <Card className={`${PANEL_CARD_CLASS} gap-3`}>
          <ContentCharacterStep
            accountId={props.pendingAccountId ?? undefined}
            isSubmitting={props.isCommitting}
            submitLabel="저장"
            onSubmit={props.onCommitCharacters}
          />
          <Button
            variant="text"
            disabled={props.isCommitting}
            onPress={props.onCancel}
            className={`w-full items-center${props.isCommitting ? ' opacity-50' : ''}`}
          >
            취소
          </Button>
        </Card>
      )

    // ADR-114 결정 2: 429에는 액션을 주지 않는다 — 문구의 처방이 재시도가 아니라 "키 단계 확인"이라
    // 버튼이 있으면 화면이 두 말을 한다(error-resilience.md 원칙 3도 원래 429는 액션 없음이다).
    // 여기서 재시도가 유일한 진행 수단이었으므로 429에서는 모달을 닫는 것 외에 길이 없어지는데,
    // 지금 앱 안에서 실제로 할 수 있는 일이 없는 것이 맞다.
    //
    // error가 null인 폴백('오류가 발생했습니다')에는 버튼을 남긴다 — 원인을 모르는 실패는
    // 재시도 가능이 폴백 원칙이다. `props.error?.kind` 가 undefined라 조건이 자연히 참이 된다.
    case 'error':
      return (
        <Card className={`${PANEL_CARD_CLASS} items-start gap-2`}>
          <Text className="text-sm text-error-ink">
            {props.error !== null ? formatSettingsError(props.error) : '오류가 발생했습니다'}
          </Text>
          {props.error?.kind !== 'rateLimited' && (
            <Button variant="primary" onPress={props.onRetry} textClassName="text-sm">
              다시 시도
            </Button>
          )}
        </Card>
      )
  }
}
