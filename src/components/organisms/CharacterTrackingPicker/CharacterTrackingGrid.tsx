import { Ban, Star } from 'lucide-react'
import { useState } from 'react'
import { worldEmblemUrl } from '../../../lib/world-emblem'
import type { CharacterPickerEntry } from '@core/types'

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

// 그리드가 들어가는 자리의 최소 높이 — **카드 3줄이 렌더링될 때와 같은 높이**(실측 385px =
// 카드 123px × 3 + gap-2 8px × 2). 카드 123px 안쪽은 아바타 56 + gap 4 + 이름행 17(월드 엠블럼
// h-[17px]가 정하는 값, 엠블럼이 없으면 16) + gap 4 + 레벨 16 + py-3 24 + 테두리 2다.
//
// 이 자리는 상태에 따라 그리드/스피너/실패/빈 상태로 갈리는데, 각 상태의 높이가 다르면 그 아래
// CTA(온보딩 "계속하기", 모달 "닫기·저장")가 상태마다 위아래로 움직이고 실패 문구의 액션 버튼과
// CTA가 붙어 보인다(사용자 보고 2026-07-30). 높이를 3줄로 못 박아 그 의존을 끊는다 —
// [[ADR-054]] 정정 4에서 라벨행 높이를 h-6으로 명시 고정한 것과 같은 처방이다.
export const ROSTER_BODY_MIN_H = 'min-h-[385px]'

export interface CharacterTrackingGridProps {
  entries: CharacterPickerEntry[]
  // 최초 선택 상태(초기값으로만 쓴다 — 이후엔 그리드가 자체 상태로 관리한다).
  trackedOcids: string[]
  // 선택이 바뀔 때마다 그 시점의 선택 ocid 배열을 통지한다 — 부모(모달의 저장 버튼,
  // 온보딩 페이지의 계속하기 버튼)가 이 값을 받아 자기 CTA에 연결한다.
  onChange: (selectedOcids: string[]) => void
}

// ADR-035 결정: "캐릭터 관리" 모달과 온보딩의 컨텐츠 캐릭터 선택 단계가 동일한 그리드
// 렌더링(정렬·얼굴 크롭·즐겨찾기·월드 엠블럼)을 공유하도록 CharacterTrackingPicker에서
// 그리드만 떼어냈다. 오버레이·카드·스크롤 잠금은 모달 쪽에만 남는다.
export function CharacterTrackingGrid(props: CharacterTrackingGridProps): React.JSX.Element {
  const [checkedOcids, setCheckedOcids] = useState<string[]>(props.trackedOcids)

  function toggle(ocid: string): void {
    const next = checkedOcids.includes(ocid) ? checkedOcids.filter((id) => id !== ocid) : [...checkedOcids, ocid]
    setCheckedOcids(next)
    props.onChange(next)
  }

  const available = props.entries.filter((entry) => entry.unavailable !== true)
  const unavailable = props.entries.filter((entry) => entry.unavailable === true)
  const sortedEntries = sortForDisplay(available, checkedOcids)

  function card(entry: CharacterPickerEntry): React.JSX.Element {
        const isChecked = checkedOcids.includes(entry.ocid)
        // ADR-068 결정 4: 조회 불가 항목은 **해제만** 가능하다 — 고를 수 없는 후보를 새로 고르게 하면
        // 그 즉시 매 동기화 실패로 이어진다. 이미 추적 중인 경우의 해제는 유일한 탈출구라 막지 않는다.
        const isUnavailable = entry.unavailable === true
        const canToggle = !isUnavailable || isChecked
        const emblemUrl = entry.world ? worldEmblemUrl(entry.world) : null
        return (
          <button
            key={entry.ocid}
            type="button"
            aria-pressed={isChecked}
            onClick={canToggle ? () => toggle(entry.ocid) : undefined}
            className={
              isUnavailable
                ? `relative flex flex-col items-center gap-1 rounded-[14px] border border-border px-1 py-3 text-center ${isChecked ? 'bg-surface-2' : 'opacity-60'}`
                : isChecked
                ? 'relative flex flex-col items-center gap-1 rounded-[14px] border border-primary bg-primary-tint px-1 py-3 text-center'
                : 'relative flex flex-col items-center gap-1 rounded-[14px] border border-border px-1 py-3 text-center hover:bg-primary-tint'
            }
          >
            {isUnavailable ? (
              <Ban className="absolute right-1.5 top-1.5 h-4 w-4 text-text-muted" strokeWidth={1.75} />
            ) : (
              <Star
                className={
                  isChecked
                    ? 'absolute right-1.5 top-1.5 h-4 w-4 fill-primary-ink text-primary-ink'
                    : 'absolute right-1.5 top-1.5 h-4 w-4 text-text-muted'
                }
                strokeWidth={1.5}
              />
            )}
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
            <span className="flex w-full items-center justify-center gap-0.5">
              {emblemUrl !== null && (
                <img
                  src={emblemUrl}
                  alt={entry.world ?? ''}
                  className="h-[17px] w-auto shrink-0 object-contain"
                />
              )}
              <span className="min-w-0 truncate text-xs font-semibold text-text">{entry.name}</span>
            </span>
            <span className="text-xs text-text-muted">Lv.{entry.level}</span>
          </button>
        )
  }

  // 조회 불가 항목은 정상 후보 아래 별도 섹션으로 내린다([[ADR-068]] 결정 4) — 숨기지 않는 이유는
  // 사용자가 추적을 해제할 자리가 필요하기 때문이다(이슈 #78 A-1).
  //
  // 높이 상한도 스크롤도 여기 없다([[ADR-107]] 결정 3) — 스크롤포트는 **쓰는 쪽**이 자기 자리에
  // 맞게 둔다(모달은 카드 상한에 맞춰 테두리까지, 온보딩은 페이지라 max-h-[70vh]). 인디케이터는
  // 콘텐츠가 아니라 스크롤포트 위에 그려지므로, 그 상자를 어디에 두느냐가 곧 인디케이터 위치다.
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">{sortedEntries.map(card)}</div>

      {unavailable.length > 0 && (
        <div data-testid="unavailable-roster" className="mt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-text-muted">
            <Ban className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            조회할 수 없는 캐릭터
          </p>
          <div className="grid grid-cols-3 gap-2">{unavailable.map(card)}</div>
        </div>
      )}
    </div>
  )
}
