import { useEffect, useState } from 'react'
import { CharacterTrackingGrid } from '../../components/CharacterTrackingPicker/CharacterTrackingGrid'
import { MapleSpinner } from '../../components/MapleSpinner/MapleSpinner'
import { getCharacterPickerRoster } from '../../features/schedule-sync/schedule-sync'
import type { CharacterPickerEntry } from '../../types'

export interface ContentCharacterStepProps {
  isSubmitting: boolean
  onSubmit: (ocids: string[]) => void
}

// ADR-053 결정 3: 이 단계는 모달이 아니라 페이지라 그리드 자리에 직접 그린다 — 판정 순서는
// 피커(CharacterTrackingPicker)와 같다. 보여줄 항목이 하나라도 있으면 조회 중이어도 그리드를
// 그리고(ADR-016 캐시 우선 표시), 항목이 없을 때만 조회 중(스피너)/실패(에러)/0건(빈 상태)을
// 구분한다. 실패 문구는 이 화면에 재시도 수단이 없어 앱 재실행을 안내한다(피커는 "닫고 다시 열기").
function RosterBody(props: {
  roster: CharacterPickerEntry[]
  isLoading: boolean
  loadFailed: boolean
  onChange: (ocids: string[]) => void
}): React.JSX.Element {
  if (props.roster.length > 0) {
    return <CharacterTrackingGrid entries={props.roster} trackedOcids={[]} onChange={props.onChange} />
  }

  if (props.isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="캐릭터 목록을 불러오는 중"
        className="flex min-h-[120px] items-center justify-center"
      >
        <MapleSpinner size={32} className="text-primary" />
      </div>
    )
  }

  if (props.loadFailed) {
    return (
      <p className="flex min-h-[120px] items-center justify-center px-4 text-center text-sm text-error">
        캐릭터 목록을 불러오지 못했어요 — 네트워크를 확인한 뒤 앱을 다시 실행해주세요
      </p>
    )
  }

  return (
    <p className="flex min-h-[120px] items-center justify-center px-4 text-center text-sm text-text-muted">
      표시할 캐릭터가 없어요
    </p>
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
  const [rosterFailed, setRosterFailed] = useState(false)
  const [selectedOcids, setSelectedOcids] = useState<string[]>([])

  // ADR-016/017: 캐시가 있으면 즉시 그 값으로 먼저 그리고, character/basic 응답이 하나씩
  // 도착하는 대로 patch한다(ContentScreen의 피커 열기와 동일 패턴).
  // ADR-053 결정 3: 결과를 삼키지 않고 로딩·실패로 남긴다 — 401/429는 reject로 나오므로
  // finally에서 반드시 로딩을 해제해야 스피너가 영구히 걸리지 않는다.
  useEffect(() => {
    let cancelled = false
    getCharacterPickerRoster((entries) => {
      if (!cancelled) setRoster(entries)
    })
      .catch(() => {
        if (!cancelled) setRosterFailed(true)
      })
      .finally(() => {
        if (!cancelled) setIsRosterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="w-full space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text">추적할 캐릭터를 선택해주세요</h2>
        <p className="text-sm text-text-muted">
          선택한 캐릭터만 스케줄러 목록에 표시됩니다. 최소 한 명은 선택해주세요.
        </p>
      </div>

      <RosterBody
        roster={roster}
        isLoading={isRosterLoading}
        loadFailed={rosterFailed}
        onChange={setSelectedOcids}
      />

      <button
        type="button"
        disabled={selectedOcids.length === 0 || props.isSubmitting}
        aria-busy={props.isSubmitting}
        aria-label={props.isSubmitting ? '저장 중' : undefined}
        onClick={() => props.onSubmit(selectedOcids)}
        className="flex w-full items-center justify-center rounded-full bg-primary text-bg font-semibold hover:bg-primary-hover px-5 py-2.5 disabled:opacity-50"
      >
        {props.isSubmitting ? <MapleSpinner size={20} /> : '계속하기'}
      </button>
    </div>
  )
}
