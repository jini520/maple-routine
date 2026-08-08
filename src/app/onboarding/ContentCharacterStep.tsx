import { useEffect, useState } from 'react'
import {
  CharacterTrackingGrid,
  ROSTER_BODY_MIN_H,
} from '../../components/organisms/CharacterTrackingPicker/CharacterTrackingGrid'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { StaleBanner } from '../../components/molecules/ErrorState/StaleBanner'
import { MapleSpinner } from '../../components/atoms/MapleSpinner/MapleSpinner'
import { MapleSweepSpinner } from '../../components/atoms/MapleSweepSpinner/MapleSweepSpinner'
import { formatRosterError, formatStaleRosterError } from '../../features/schedule-sync/format'
import { getCharacterPickerRoster, toScheduleSyncError } from '../../features/schedule-sync/schedule-sync'
import type { ScheduleSyncError } from '../../features/schedule-sync/schedule-sync'
import type { CharacterPickerEntry } from '../../types'
import { Button } from '../../components/atoms/Button/Button'

export interface ContentCharacterStepProps {
  isSubmitting: boolean
  onSubmit: (ocids: string[]) => void
  /** ADR-086 결정 6: 설정의 계정 변경은 **커밋 전** 후보 계정으로 목록을 그린다. 생략하면 저장된 계정. */
  accountId?: string
  /** 확정 CTA 라벨. 온보딩은 다음 단계로 가므로 기본값("계속하기")이고, 설정은 여기서 끝나 "저장"이다. */
  submitLabel?: string
  /** ADR-086 결정 8: 후보가 0명일 때의 탈출구. 온보딩은 계정 선택으로 되돌아간다. */
  emptyAction?: { label: string; onClick: () => void }
}

// ADR-053 결정 3: 이 단계는 모달이 아니라 페이지라 그리드 자리에 직접 그린다 — 판정 순서는
// 피커(CharacterTrackingPicker)와 같다. 보여줄 항목이 하나라도 있으면 조회 중이어도 그리드를
// 그리고(ADR-016 캐시 우선 표시), 항목이 없을 때만 조회 중(스피너)/실패(에러)/0건(빈 상태)을
// 구분한다.
//
// ADR-062: 실패도 피커와 같은 공용 ErrorState를 쓰고 스탈 배너 분기도 같다. 다른 것은 액션뿐 —
// 온보딩 중에는 설정 화면이 없으므로 invalidApiKey도 재시도이고 설명만 갈린다(formatRosterError의
// place='onboarding'). 재시도 수단이 생겼으므로 "앱을 다시 실행해주세요" 안내는 없어진다.
//
// ADR-114 결정 3: 다만 **배너와 ErrorState의 액션 규칙은 서로 다르다.** 배너는 아래에 목록이
// 그대로 남아 있어 액션이 없어도 막다른 길이 아니라, 재시도가 실제로 통하는 실패에만 액션을
// 준다(429·401·characterUnavailable은 버튼 없음). ErrorState는 자리 전체가 실패라 같은 401에서
// 액션을 빼면 화면에 아무 길도 남지 않으므로 재시도를 유지한다 — 같은 근거의 뒷면이다.
function RosterBody(props: {
  roster: CharacterPickerEntry[]
  isLoading: boolean
  loadError: ScheduleSyncError | null
  onRetry: () => void
  onChange: (ocids: string[]) => void
  emptyAction?: { label: string; onClick: () => void }
}): React.JSX.Element {
  if (props.roster.length > 0) {
    const stale = props.loadError === null ? null : formatStaleRosterError(props.loadError)
    return (
      <>
        {stale !== null && (
          <StaleBanner
            message={stale.message}
            // 배너의 액션은 재시도뿐이다 — 401도 429도 characterUnavailable도 액션이 없다
            // ([[ADR-114]] 결정 3, [[ADR-115]] 결정 7). 그래도 kind를 확인해 매핑한다: 지금은
            // 타입상 'retry' 하나뿐이라 결과가 같지만, 재시도가 아닌 액션이 새로 생기면 그 자리에
            // 갈 곳 없는 버튼을 그리는 대신 여기서 버튼이 사라져 드러난다.
            action={
              stale.action?.kind === 'retry' ? { label: stale.action.label, onClick: props.onRetry } : undefined
            }
          />
        )}
        {/* ADR-107 결정 3: 스크롤포트는 그리드가 아니라 쓰는 쪽이 갖는다. 여기는 모달이 아니라
            페이지라 상한을 스스로 들고 있어야 한다 — 값은 그리드가 갖고 있던 것 그대로다. */}
        <div className="max-h-[70vh] overflow-y-auto">
          <CharacterTrackingGrid entries={props.roster} trackedOcids={[]} onChange={props.onChange} />
        </div>
      </>
    )
  }

  if (props.isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="캐릭터 목록을 불러오는 중"
        className="flex flex-1 items-center justify-center"
      >
        <MapleSweepSpinner size={32} className="text-primary" />
      </div>
    )
  }

  if (props.loadError !== null) {
    const copy = formatRosterError(props.loadError, 'onboarding')
    // 액션이 있으면 항상 재시도다(타입상으로도 'retry' 하나뿐이다). 영구 실패(조회 불가 캐릭터)와
    // 429는 액션이 없고([[ADR-067]] 결정 1, [[ADR-114]] 결정 2), 401은 이 자리에서만 재시도를
    // 유지한다 — 온보딩 중에는 무효화 경로가 성립하지 않아 재시도가 실제 처방이다([[ADR-115]] 결정 6).
    return (
      <ErrorState
        title={copy.title}
        description={copy.description}
        action={copy.action === undefined ? undefined : { label: copy.action.label, onClick: props.onRetry }}
      />
    )
  }

  // ADR-060/061: 확정된 빈 상태는 실패(ErrorState)와 디자인을 공유하지 않는다 — 문구는 그대로 두고
  // ADR-086 결정 8의 탈출구만 아래에 붙인다(고른 계정에 고를 수 있는 캐릭터가 하나도 없는 경우).
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm text-text-muted">표시할 캐릭터가 없어요</p>
      {props.emptyAction !== undefined && (
        <button
          type="button"
          onClick={props.emptyAction.onClick}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:bg-primary-hover"
        >
          {props.emptyAction.label}
        </button>
      )}
    </div>
  )
}

// ADR-035 결정 13: 온보딩의 컨텐츠 추적 캐릭터 선택 단계. 캐릭터 관리 모달과 동일한 그리드
// (CharacterTrackingGrid)를 오버레이·카드 없이 페이지 레이아웃으로 재사용한다. 온보딩을 끝내려면
// 최소 1명은 선택해야 하므로 CTA는 selectedOcids가 비면 비활성화된다 — 이 제약은 이 페이지
// 전용이고, 재사용하는 그리드나 "캐릭터 관리" 모달에는 넣지 않는다(모달은 전부 해제 가능해야 함).
export function ContentCharacterStep(props: ContentCharacterStepProps): React.JSX.Element {
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  // ADR-053 결정 3: 조회를 소유한 화면이 로딩·실패를 관리한다(ContentScreen·BossScreen과 동일).
  // 이 단계는 피커와 달리 마운트 즉시 조회를 시작하므로 첫 렌더부터 로딩이다.
  const [isRosterLoading, setIsRosterLoading] = useState(true)
  // ADR-062 결정 2: boolean이 아니라 원인을 들고 있어야 원인별 문구·액션을 그릴 수 있다.
  const [rosterError, setRosterError] = useState<ScheduleSyncError | null>(null)
  // ADR-062: 재조회 트리거. 이 값이 바뀌면 아래 조회 effect가 다시 돈다.
  const [rosterReloadNonce, setRosterReloadNonce] = useState(0)
  const [selectedOcids, setSelectedOcids] = useState<string[]>([])

  function reloadRoster(): void {
    setIsRosterLoading(true)
    setRosterError(null)
    setRosterReloadNonce((nonce) => nonce + 1)
  }

  // ADR-016/017: 캐시가 있으면 즉시 그 값으로 먼저 그리고, character/basic 응답이 하나씩
  // 도착하는 대로 patch한다(ContentScreen의 피커 열기와 동일 패턴).
  // ADR-053 결정 3: 결과를 삼키지 않고 로딩·실패로 남긴다 — 401/429는 reject로 나오므로
  // finally에서 반드시 로딩을 해제해야 스피너가 영구히 걸리지 않는다.
  const accountId = props.accountId
  useEffect(() => {
    let cancelled = false
    getCharacterPickerRoster(
      (entries) => {
        if (!cancelled) setRoster(entries)
      },
      accountId === undefined ? undefined : { accountId },
    )
      .catch((error: unknown) => {
        if (!cancelled) setRosterError(toScheduleSyncError(error))
      })
      .finally(() => {
        if (!cancelled) setIsRosterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [rosterReloadNonce, accountId])

  return (
    <div className="w-full space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text">추적할 캐릭터를 선택해주세요</h2>
        <p className="text-sm text-text-muted">
          선택한 캐릭터만 스케줄러 목록에 표시됩니다. 최소 한 명은 선택해주세요.
        </p>
      </div>

      {/* 상태가 바뀌어도 이 자리의 높이가 고정돼 아래 "계속하기"가 움직이지 않는다 —
          실패 상태의 "다시 시도"가 CTA에 붙어 보이던 문제(사용자 보고 2026-07-30). */}
      <div className={`flex flex-col ${ROSTER_BODY_MIN_H}`}>
        <RosterBody
          roster={roster}
          isLoading={isRosterLoading}
          loadError={rosterError}
          onRetry={reloadRoster}
          onChange={setSelectedOcids}
          emptyAction={props.emptyAction}
        />
      </div>

      <Button
        variant="primary"
        disabled={selectedOcids.length === 0 || props.isSubmitting}
        aria-busy={props.isSubmitting}
        onClick={() => props.onSubmit(selectedOcids)}
        className="flex w-full items-center justify-center gap-2 disabled:opacity-50"
      >
        {/* ADR-061 결정 5·9 — 스피너 + 말줄임표 없는 '~중' 라벨 */}
        {props.isSubmitting && <MapleSpinner size={16} />}
        {props.isSubmitting ? '저장 중' : (props.submitLabel ?? '계속하기')}
      </Button>
    </div>
  )
}
