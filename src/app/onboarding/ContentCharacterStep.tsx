import { useEffect, useState } from 'react'
import { CharacterTrackingGrid } from '../../components/CharacterTrackingPicker/CharacterTrackingGrid'
import { MapleSpinner } from '../../components/MapleSpinner/MapleSpinner'
import { getCharacterPickerRoster } from '../../features/schedule-sync/schedule-sync'
import type { CharacterPickerEntry } from '../../types'

export interface ContentCharacterStepProps {
  isSubmitting: boolean
  onSubmit: (ocids: string[]) => void
}

// ADR-035 결정 13: 온보딩의 컨텐츠 추적 캐릭터 선택 단계. 캐릭터 관리 모달과 동일한 그리드
// (CharacterTrackingGrid)를 오버레이·카드 없이 페이지 레이아웃으로 재사용한다. 온보딩을 끝내려면
// 최소 1명은 선택해야 하므로 CTA는 selectedOcids가 비면 비활성화된다 — 이 제약은 이 페이지
// 전용이고, 재사용하는 그리드나 "캐릭터 관리" 모달에는 넣지 않는다(모달은 전부 해제 가능해야 함).
export function ContentCharacterStep(props: ContentCharacterStepProps): React.JSX.Element {
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  const [selectedOcids, setSelectedOcids] = useState<string[]>([])

  // ADR-016/017: 캐시가 있으면 즉시 그 값으로 먼저 그리고, character/basic 응답이 하나씩
  // 도착하는 대로 patch한다(ContentScreen의 피커 열기와 동일 패턴).
  useEffect(() => {
    let cancelled = false
    getCharacterPickerRoster((entries) => {
      if (!cancelled) setRoster(entries)
    }).catch(() => {})
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

      <CharacterTrackingGrid entries={roster} trackedOcids={[]} onChange={setSelectedOcids} />

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
