import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { DifficultyBadge } from '../../components/DifficultyBadge/DifficultyBadge'
import { DropEffectOverlay } from '../../components/DropEffectOverlay/DropEffectOverlay'
import {
  getAccessoryBoxContents,
  getBossDropCandidates,
  getRingBoxContents,
  isBoxItem,
} from '../../lib/boss-drops'
import { getItemIconUrl } from '../../lib/item-icons'
import { isValuableDrop } from '../../lib/valuable-drops'
import type { BossDifficulty } from '../../types'
import type { DropCandidate, DropCategory, RecordedDrop } from '../../types/drops'

const CATEGORY_LABELS: Record<DropCategory, string> = {
  fixed: '고정',
  equipment: '장비',
  consumable: '소비',
}
// 값나가는 장비·소비를 먼저 노출한다.
const DISPLAY_ORDER: DropCategory[] = ['equipment', 'consumable', 'fixed']

interface BossDropSheetProps {
  boss: string
  difficulty: BossDifficulty
  initialDrops: RecordedDrop[]
  onSave: (drops: RecordedDrop[]) => void
  onClose: () => void
}

function ItemThumb(props: { name: string; slot?: string }): React.JSX.Element {
  const url = getItemIconUrl(props.name, props.slot)
  if (url !== null) {
    return <img src={url} alt="" className="h-9 w-9 object-contain" />
  }
  return <div className="h-9 w-9 rounded-lg bg-surface-2" aria-hidden="true" />
}

// 드롭 결과 하나가 이 후보(일반 아이템/상자)와 일치하는지.
function findNormalDrop(drops: RecordedDrop[], name: string): RecordedDrop | undefined {
  return drops.find((drop) => drop.itemName === name && drop.boxOrigin === undefined)
}
function findBoxDrop(drops: RecordedDrop[], boxName: string): RecordedDrop | undefined {
  return drops.find((drop) => drop.boxOrigin === boxName)
}

export function BossDropSheet(props: BossDropSheetProps): React.JSX.Element {
  const [selected, setSelected] = useState<RecordedDrop[]>(props.initialDrops)
  const [activeBox, setActiveBox] = useState<{ name: string; category: DropCategory } | null>(null)
  // 고가 아이템을 새로 추가하면 전체화면 연출을 띄운다(ADR-038).
  const [effect, setEffect] = useState<{ itemName: string; slot?: string } | null>(null)

  const candidates = getBossDropCandidates(props.boss, props.difficulty)
  const byCategory = new Map<DropCategory, DropCandidate[]>()
  for (const candidate of candidates) {
    const list = byCategory.get(candidate.category) ?? []
    list.push(candidate)
    byCategory.set(candidate.category, list)
  }

  function toggleNormal(candidate: DropCandidate): void {
    const isAdding = findNormalDrop(selected, candidate.name) === undefined
    setSelected((prev) => {
      if (!isAdding) {
        return prev.filter((drop) => !(drop.itemName === candidate.name && drop.boxOrigin === undefined))
      }
      return [
        ...prev,
        { category: candidate.category, itemName: candidate.name, slot: candidate.slot, quantity: 1 },
      ]
    })
    if (isAdding && isValuableDrop(candidate.name)) {
      setEffect({ itemName: candidate.name, slot: candidate.slot })
    }
  }

  function applyBoxResult(boxName: string, category: DropCategory, itemName: string, ringLevel?: number): void {
    setSelected((prev) => [
      ...prev.filter((drop) => drop.boxOrigin !== boxName),
      { category, itemName, boxOrigin: boxName, ringLevel, quantity: 1 },
    ])
    setActiveBox(null)
    if (isValuableDrop(itemName)) {
      setEffect({ itemName })
    }
  }
  function removeBoxResult(boxName: string): void {
    setSelected((prev) => prev.filter((drop) => drop.boxOrigin !== boxName))
    setActiveBox(null)
  }

  function handleTileTap(candidate: DropCandidate): void {
    if (isBoxItem(candidate.name)) {
      setActiveBox({ name: candidate.name, category: candidate.category })
    } else {
      toggleNormal(candidate)
    }
  }

  return (
    <>
      <BottomSheet onClose={props.onClose} testId="boss-drop-sheet">
      {activeBox === null ? (
        <div>
          <div className="flex items-center gap-2 px-4 pb-3 pt-1">
            <span className="text-base font-bold text-text">{props.boss}</span>
            <DifficultyBadge difficulty={props.difficulty} />
            <span className="text-xs text-text-muted">획득한 드롭을 선택하세요</span>
          </div>

          {candidates.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-text-muted">이 보스의 드롭 데이터가 아직 없습니다.</p>
          ) : (
            DISPLAY_ORDER.filter((category) => byCategory.has(category)).map((category) => (
              <section key={category} className="px-4 pb-3">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {CATEGORY_LABELS[category]}
                </h3>
                <ul className="grid grid-cols-4 gap-2">
                  {(byCategory.get(category) ?? []).map((candidate) => {
                    const box = isBoxItem(candidate.name)
                    const boxDrop = box ? findBoxDrop(selected, candidate.name) : undefined
                    const on = box ? boxDrop !== undefined : findNormalDrop(selected, candidate.name) !== undefined
                    const displayName = boxDrop?.itemName ?? candidate.name
                    return (
                      <li key={candidate.name}>
                        <button
                          type="button"
                          onClick={() => handleTileTap(candidate)}
                          className={`relative flex w-full flex-col items-center gap-1 rounded-xl border p-2 ${
                            on ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                          } ${box ? 'border-dashed' : ''}`}
                        >
                          {on && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                              ✓
                            </span>
                          )}
                          <ItemThumb name={displayName} slot={boxDrop ? undefined : candidate.slot} />
                          <span className="line-clamp-2 h-[2.4em] text-center text-[10px] leading-tight text-text">
                            {displayName}
                          </span>
                          {box && (
                            <span className="text-[9px] font-bold text-primary-text">
                              {boxDrop
                                ? boxDrop.ringLevel !== undefined
                                  ? `${boxDrop.ringLevel}레벨`
                                  : '지정됨'
                                : '탭하여 결과 ›'}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}

          <div className="sticky bottom-0 border-t border-border bg-bg px-4 py-3">
            <button
              type="button"
              onClick={() => {
                props.onSave(selected)
                props.onClose()
              }}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white"
            >
              추가 완료{selected.length > 0 ? ` · ${selected.length}개` : ''}
            </button>
          </div>
        </div>
      ) : (
        <BoxDrillDown
          boxName={activeBox.name}
          category={activeBox.category}
          existing={findBoxDrop(selected, activeBox.name)}
          onBack={() => setActiveBox(null)}
          onConfirm={(itemName, ringLevel) =>
            applyBoxResult(activeBox.name, activeBox.category, itemName, ringLevel)
          }
          onRemove={() => removeBoxResult(activeBox.name)}
        />
      )}
      </BottomSheet>

      {effect !== null && (
        <DropEffectOverlay
          itemName={effect.itemName}
          slot={effect.slot}
          onClose={() => setEffect(null)}
        />
      )}
    </>
  )
}

interface BoxDrillDownProps {
  boxName: string
  category: DropCategory
  existing: RecordedDrop | undefined
  onBack: () => void
  onConfirm: (itemName: string, ringLevel?: number) => void
  onRemove: () => void
}

// 랜덤 상자 결과 선택(ADR-038 결정 2). 반지 상자=등급+반지 2축, 칠흑 장신구=1축. 확률 자동추정 없음.
function BoxDrillDown(props: BoxDrillDownProps): React.JSX.Element {
  const ring = getRingBoxContents(props.boxName)
  const accessory = ring === null ? getAccessoryBoxContents(props.boxName) : null

  const [level, setLevel] = useState<number | null>(props.existing?.ringLevel ?? null)
  const [item, setItem] = useState<string | null>(props.existing?.itemName ?? null)

  const canConfirm = item !== null && (ring === null || level !== null)

  return (
    <div>
      <div className="flex items-center gap-2 px-4 pb-3 pt-1">
        <button type="button" onClick={props.onBack} aria-label="뒤로" className="text-lg text-text">
          ‹
        </button>
        <span className="text-sm font-bold text-text">{props.boxName}</span>
      </div>

      {ring !== null && (
        <section className="px-4 pb-3">
          <h3 className="mb-2 text-xs font-bold text-text-muted">등급</h3>
          <div className="flex gap-1.5">
            {ring.levels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevel(lvl)}
                className={`flex-1 rounded-lg border py-2 text-xs font-bold ${
                  level === lvl ? 'border-primary bg-primary/10 text-primary-text' : 'border-border text-text-muted'
                }`}
              >
                {lvl}레벨
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="px-4 pb-3">
        <h3 className="mb-2 text-xs font-bold text-text-muted">{ring !== null ? '반지' : '장신구'}</h3>
        <ul className="grid grid-cols-4 gap-2">
          {(ring?.rings ?? accessory ?? []).map((entry) => (
            <li key={entry.name}>
              <button
                type="button"
                onClick={() => setItem(entry.name)}
                className={`relative flex w-full flex-col items-center gap-1 rounded-xl border p-2 ${
                  item === entry.name ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                }`}
              >
                {item === entry.name && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                    ✓
                  </span>
                )}
                <ItemThumb name={entry.name} />
                <span className="line-clamp-2 h-[2.4em] text-center text-[10px] leading-tight text-text">
                  {entry.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-bg px-4 py-3">
        {props.existing !== undefined && (
          <button
            type="button"
            onClick={props.onRemove}
            className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-text-muted"
          >
            제거
          </button>
        )}
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => {
            if (item !== null) props.onConfirm(item, level ?? undefined)
          }}
          className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          이 결과로 기록
        </button>
      </div>
    </div>
  )
}
