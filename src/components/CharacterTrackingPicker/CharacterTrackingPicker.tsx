import { Star } from 'lucide-react'
import { useState } from 'react'
import { useBodyScrollLock } from '../../lib/use-body-scroll-lock'
import { worldEmblemUrl } from '../../lib/world-emblem'
import type { CharacterPickerEntry } from '../../types'

export interface CharacterTrackingPickerProps {
  entries: CharacterPickerEntry[]
  trackedOcids: string[]
  onSave: (ocids: string[]) => void
  onClose: () => void
}

// ADR-015: character/basic이 반환하는 기본 300x300 전신 룩 이미지에서 얼굴만 보이도록
// CSS로 확대·정렬해 자른다. 헤어스타일/포즈에 따라 완벽히 얼굴만 나오지 않을 수 있는
// 근사치라 실제 이미지로 시각 검증하며 조정이 필요하다(ADR-015 미확정 항목).
const SOURCE_IMAGE_SIZE = 300
const FACE_CROP_BOX = { x: 115, y: 120, size: 64 }
const AVATAR_SIZE = 56

function faceCropStyle(): React.CSSProperties {
  const scale = AVATAR_SIZE / FACE_CROP_BOX.size
  return {
    width: SOURCE_IMAGE_SIZE * scale,
    height: SOURCE_IMAGE_SIZE * scale,
    left: -FACE_CROP_BOX.x * scale,
    top: -FACE_CROP_BOX.y * scale,
  }
}

// ADR-015: 즐겨찾기(선택)한 캐릭터를 그룹 맨 앞으로 보내고, 각 그룹 내부에서는
// entries가 이미 레벨 내림차순이므로 필터만으로 순서가 그대로 유지된다.
function sortForDisplay(entries: CharacterPickerEntry[], checkedOcids: string[]): CharacterPickerEntry[] {
  const checked = new Set(checkedOcids)
  const favorited = entries.filter((entry) => checked.has(entry.ocid))
  const rest = entries.filter((entry) => !checked.has(entry.ocid))
  return [...favorited, ...rest]
}

export function CharacterTrackingPicker(props: CharacterTrackingPickerProps): React.JSX.Element {
  useBodyScrollLock()
  const [checkedOcids, setCheckedOcids] = useState<string[]>(props.trackedOcids)

  function toggle(ocid: string): void {
    setCheckedOcids((prev) => (prev.includes(ocid) ? prev.filter((id) => id !== ocid) : [...prev, ocid]))
  }

  const sortedEntries = sortForDisplay(props.entries, checkedOcids)

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

        <div className="grid max-h-[70vh] grid-cols-3 gap-2 overflow-y-auto">
          {sortedEntries.map((entry) => {
            const isChecked = checkedOcids.includes(entry.ocid)
            const emblemUrl = entry.world ? worldEmblemUrl(entry.world) : null
            return (
              <button
                key={entry.ocid}
                type="button"
                aria-pressed={isChecked}
                onClick={() => toggle(entry.ocid)}
                className={
                  isChecked
                    ? 'relative flex flex-col items-center gap-1 rounded-[14px] border border-primary bg-primary/15 px-1 py-3 text-center'
                    : 'relative flex flex-col items-center gap-1 rounded-[14px] border border-border px-1 py-3 text-center hover:bg-primary/15'
                }
              >
                <Star
                  className={
                    isChecked
                      ? 'absolute right-1.5 top-1.5 h-4 w-4 fill-primary text-primary'
                      : 'absolute right-1.5 top-1.5 h-4 w-4 text-text-muted'
                  }
                  strokeWidth={1.5}
                />
                <span className="relative h-14 w-14">
                  <span className="absolute inset-0 overflow-hidden rounded-full bg-surface-2">
                    {entry.imageUrl !== null ? (
                      <img
                        src={entry.imageUrl}
                        alt={entry.name}
                        className="absolute max-w-none"
                        style={faceCropStyle()}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                        ?
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex w-full items-center justify-center gap-1">
                  {emblemUrl !== null && (
                    <img
                      src={emblemUrl}
                      alt={entry.world ?? ''}
                      className="h-3.5 w-auto shrink-0 object-contain"
                    />
                  )}
                  <span className="min-w-0 truncate text-xs font-semibold text-text">{entry.name}</span>
                </span>
                <span className="text-xs text-text-muted">Lv.{entry.level}</span>
              </button>
            )
          })}
        </div>
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
            onClick={() => props.onSave(checkedOcids)}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
