import { useState } from 'react'
import { useBodyScrollLock } from '../../lib/use-body-scroll-lock'
import type { CharacterPickerEntry } from '../../types'
import { MapleSpinner } from '../MapleSpinner/MapleSpinner'
import { CharacterTrackingGrid } from './CharacterTrackingGrid'

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
  // 조회가 전역 실패(401/429 등)로 끝났는지 — "활성 캐릭터 0명"과 구분해 안내하기 위함.
  loadFailed: boolean
  onSave: (ocids: string[]) => void
  onClose: () => void
}

// ADR-053 결정 3: 그리드 자리에 그릴 것을 고른다. 보여줄 항목이 하나라도 있으면 조회 중이어도
// 그리드를 그린다 — 캐시 우선 표시(ADR-016)를 스피너로 가리지 않기 위해서다. 항목이 없을 때만
// 조회 중(스피너) / 조회 완료 후 0건(빈 상태) / 조회 실패(에러)를 구분한다.
function PickerBody(props: CharacterTrackingPickerProps & { onChange: (ocids: string[]) => void }): React.JSX.Element {
  if (props.entries.length > 0) {
    return (
      <CharacterTrackingGrid
        entries={props.entries}
        trackedOcids={props.trackedOcids}
        onChange={props.onChange}
      />
    )
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
        캐릭터 목록을 불러오지 못했어요 — 닫고 다시 열어주세요
      </p>
    )
  }

  return (
    <p className="flex min-h-[120px] items-center justify-center px-4 text-center text-sm text-text-muted">
      표시할 캐릭터가 없어요
    </p>
  )
}

export function CharacterTrackingPicker(props: CharacterTrackingPickerProps): React.JSX.Element {
  useBodyScrollLock()
  const [selectedOcids, setSelectedOcids] = useState<string[]>(props.trackedOcids)
  const isUnchanged = isSameOcidSet(selectedOcids, props.trackedOcids)

  return (
    <div
      data-testid="character-tracking-picker-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70"
    >
      <div className="w-full max-w-sm rounded-[14px] border border-border bg-surface p-6">
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold text-text">캐릭터 관리</h2>
          <p className="text-sm text-text-muted">체크한 캐릭터만 스케줄러 목록에 표시됩니다.</p>
        </div>

        <PickerBody {...props} onChange={setSelectedOcids} />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => props.onSave(selectedOcids)}
            disabled={isUnchanged}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
