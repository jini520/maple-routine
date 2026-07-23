import { useState } from 'react'
import { useBodyScrollLock } from '../../lib/use-body-scroll-lock'
import type { CharacterPickerEntry } from '../../types'
import { CharacterTrackingGrid } from './CharacterTrackingGrid'

export interface CharacterTrackingPickerProps {
  entries: CharacterPickerEntry[]
  trackedOcids: string[]
  onSave: (ocids: string[]) => void
  onClose: () => void
}

export function CharacterTrackingPicker(props: CharacterTrackingPickerProps): React.JSX.Element {
  useBodyScrollLock()
  const [selectedOcids, setSelectedOcids] = useState<string[]>(props.trackedOcids)

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

        <CharacterTrackingGrid
          entries={props.entries}
          trackedOcids={props.trackedOcids}
          onChange={setSelectedOcids}
        />

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
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
