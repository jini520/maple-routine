import { useState } from 'react'
import { useBodyScrollLock } from '../../../lib/use-body-scroll-lock'
import { formatRosterError, formatStaleRosterError } from '@core/features/schedule-sync/format'
import type { ScheduleSyncError } from '@core/features/schedule-sync/schedule-sync'
import type { CharacterPickerEntry } from '@core/types'
import { ErrorState } from '../../molecules/ErrorState/ErrorState'
import { StaleBanner } from '../../molecules/ErrorState/StaleBanner'
import { MapleSweepSpinner } from '../../atoms/MapleSweepSpinner/MapleSweepSpinner'
import { CharacterTrackingGrid } from './CharacterTrackingGrid'
import { Button } from '../../atoms/Button/Button'
import { Card } from '../../atoms/Card/Card'

// 본문 자리의 최소 높이 — 값은 `ROSTER_BODY_MIN_H`(카드 3줄 385px)와 같지만, 모달에서는 **들어갈
// 자리가 없을 때 양보하도록** 클램프한다([[ADR-107]] 결정 2). CSS 에서 min-height 는 max-height 를
// 이기므로, 385px 를 그대로 두면 짧은 기기에서 카드 상한(결정 1)이 통째로 무효가 된다.
// 15rem = 카드 크롬 194px(패딩 48 · 테두리 2 · 헤더 72 · 간격 32 · 버튼 40) + 오버레이 여백 32px
// 올림값이다. 이 상수가 다소 어긋나도 안전하다 — 클램프는 385px 가 애초에 들어가지 않는 기기
// (대략 뷰포트 625px + 안전영역 미만)에서만 발동하고, 그 위에서는 min() 이 항상 385px 를 고른다.
const PICKER_BODY_MIN_H = 'min-h-[min(385px,calc(100dvh-var(--sa-top)-var(--sa-bottom)-15rem))]'

// ADR-043 결정 1: 그리드의 토글이 ocid를 배열 끝에 append하므로 같은 집합이어도 배열
// 순서가 달라진다 — 저장 버튼 활성 여부는 반드시 멤버십(집합)으로만 판정한다.
function isSameOcidSet(a: string[], b: string[]): boolean {
  const left = new Set(a)
  const right = new Set(b)
  if (left.size !== right.size) return false
  return [...left].every((ocid) => right.has(ocid))
}

export interface CharacterTrackingPickerProps {
  entries: CharacterPickerEntry[]
  trackedOcids: string[]
  // 후보 목록 조회가 진행 중인지(ADR-053 결정 3). 호출부가 getCharacterPickerRoster의
  // Promise 완료 시점으로 판정해 내려준다.
  isLoading: boolean
  // 조회가 전역 실패(401/429 등)로 끝났는지 + 그 원인(ADR-062 결정 2) — "활성 캐릭터 0명"과
  // 구분하는 것을 넘어 원인별 문구·액션을 그리기 위해 boolean이 아니라 에러 종류를 받는다.
  loadError: ScheduleSyncError | null
  onSave: (ocids: string[]) => void
  onClose: () => void
  // 재조회. 호출부가 피커를 여는 경로와 같은 초기화를 재사용한다(ADR-062 트레이드오프).
  onRetry: () => void
}

// ADR-053 결정 3: 그리드 자리에 그릴 것을 고른다. 보여줄 항목이 하나라도 있으면 조회 중이어도
// 그리드를 그린다 — 캐시 우선 표시(ADR-016)를 스피너로 가리지 않기 위해서다. 항목이 없을 때만
// 조회 중(스피너) / 조회 완료 후 0건(빈 상태) / 조회 실패(에러)를 구분한다.
//
// ADR-062 결정 4: 항목이 있는 채로 실패했으면 그리드를 지우지 않고 위에 스탈 배너를 얹는다 —
// 캐시 stub이 네트워크보다 먼저 방출되므로(ADR-017 결정 6) 예열이 끝난 정상 경로에서는 이쪽이
// 기본 분기다. 배너가 없으면 실패의 대다수가 무음이 된다.
//
// ADR-114 결정 3: 그 배너의 문구도 액션도 원인별로 갈린다(전에는 원인과 무관하게 "목록이 최신이
// 아닙니다" + 다시 시도 하나였다 — 기본 분기인 이 자리가 곧 실패의 대다수가 원인을 잃던 자리다).
// **재시도가 실제로 통하는 실패에만 액션을 준다** — 429는 눌러도 또 429고 characterUnavailable은
// 언제 눌러도 같은 400이라 배너에 버튼이 없다. 액션을 뺄 수 있는 근거는 자리다: **배너 아래에
// 목록이 그대로 남아 있어 액션이 없어도 막다른 길이 아니다.**
//
// ADR-115 결정 7: 401은 배너에도 ErrorState에도 액션이 없다 — 그 401은 곧 키 무효화라 화면이
// 스스로 키 입력으로 이동하므로 **누를 것이 없다**(옛 설정 이동 액션은 목적지가 비어 있었다).
// 그래서 이 화면의 401 표시는 이동 직전 한 프레임이자 안전망이다.
function PickerBody(props: CharacterTrackingPickerProps & { onChange: (ocids: string[]) => void }): React.JSX.Element {
  if (props.entries.length > 0) {
    const stale = props.loadError === null ? null : formatStaleRosterError(props.loadError)
    return (
      <>
        {/* 스탈 배너는 스크롤포트 밖이다 — 목록을 굴려도 "최신이 아님"은 계속 보여야 한다. */}
        {stale !== null && (
          <StaleBanner
            message={stale.message}
            action={
              stale.action === undefined
                ? undefined
                : { label: stale.action.label, onClick: props.onRetry }
            }
          />
        )}
        {/* ADR-107 결정 3: 스크롤포트를 카드 패딩(p-6) 바깥까지 넓혀 인디케이터를 모달 오른쪽
            끝에 붙이고, 같은 크기 pr-6 으로 콘텐츠 여백을 되돌린다(폭은 그대로다).
            min-h-0 은 flex 아이템의 자동 최소 크기(콘텐츠 높이)를 풀어 카드 상한 아래로
            줄어들 수 있게 한다 — 없으면 목록이 길 때 카드 밖으로 넘친다. */}
        <div data-testid="character-tracking-picker-scroll" className="-mr-6 min-h-0 overflow-y-auto pr-6">
          <CharacterTrackingGrid
            entries={props.entries}
            trackedOcids={props.trackedOcids}
            onChange={props.onChange}
          />
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
    const copy = formatRosterError(props.loadError, 'picker')
    return (
      <ErrorState
        title={copy.title}
        description={copy.description}
        // 영구 실패(조회 불가 캐릭터)와 401에는 액션이 없다 — 눌러도 실패하는 버튼도, 이동이
        // 이미 일어난 자리의 버튼도 주지 않는다([[ADR-062]] 결정 3, [[ADR-067]] 결정 1,
        // [[ADR-115]] 결정 7). 남은 액션은 전부 재시도다.
        action={
          copy.action === undefined ? undefined : { label: copy.action.label, onClick: props.onRetry }
        }
      />
    )
  }

  return (
    <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-text-muted">
      표시할 캐릭터가 없어요
    </p>
  )
}

export function CharacterTrackingPicker(props: CharacterTrackingPickerProps): React.JSX.Element {
  useBodyScrollLock()
  const [selectedOcids, setSelectedOcids] = useState<string[]>(props.trackedOcids)
  const isUnchanged = isSameOcidSet(selectedOcids, props.trackedOcids)
  // ADR-086 결정 7: 목록을 통째로 비울 수 없다 — 0명은 화면을 빈 상태로 만들 뿐 어떤 사용자
  // 의도도 표현하지 않는다. 온보딩 캐릭터 단계와 같은 규칙이다.
  const isEmptySelection = selectedOcids.length === 0

  return (
    <div
      data-testid="character-tracking-picker-overlay"
      // ADR-107 결정 1: 카드 높이의 상한은 화면이 아니라 **안전영역을 뺀 화면**이다. 오버레이가
      // 인셋 + 1rem 을 비우고(인셋 0인 기기에서도 화면에 붙지 않게), 카드가 max-h-full 로 그 안에
      // 갇힌다 — vh 로 묶으면 시스템 바가 계산에서 빠져 인셋이 큰 기기일수록 더 침범한다.
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim px-4 pt-[calc(1rem+var(--sa-top))] pb-[calc(1rem+var(--sa-bottom))]"
    >
      {/* 자체 오버레이라 Modal.Card 를 안 쓴다 — 스크림 위 테두리 톤다운은 직접 붙인다([[ADR-122]]). */}
      <Card className="panel-on-scrim flex max-h-full w-full max-w-sm flex-col p-6">
        <div className="mb-4 shrink-0 space-y-1">
          <h2 className="text-lg font-semibold text-text">캐릭터 관리</h2>
          <p className="text-sm text-text-muted">
            체크한 캐릭터만 스케줄러 목록에 표시됩니다. 최소 한 명은 선택해주세요.
          </p>
        </div>

        {/* 상태가 바뀌어도 이 자리의 높이가 고정돼 아래 닫기·저장 버튼이 움직이지 않는다.
            남는 높이를 받고 모자라면 줄어드는 것도 이 자리뿐이다(헤더·푸터는 shrink-0). */}
        <div className={`flex flex-col ${PICKER_BODY_MIN_H}`}>
          <PickerBody {...props} onChange={setSelectedOcids} />
        </div>

        <div className="mt-4 flex shrink-0 justify-end gap-2">
          <Button
            variant="text"
            onClick={props.onClose}
            
          >
            닫기
          </Button>
          <Button
            variant="primary"
            onClick={() => props.onSave(selectedOcids)}
            disabled={isUnchanged || isEmptySelection}
            className="text-sm disabled:opacity-50"
          >
            저장
          </Button>
        </div>
      </Card>
    </div>
  )
}
