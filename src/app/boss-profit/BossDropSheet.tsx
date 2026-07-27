import { useState } from 'react'
import { FlaskConical, Pin, Sword, type LucideIcon } from 'lucide-react'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { DifficultyBadge, DifficultyChip } from '../../components/DifficultyBadge/DifficultyBadge'
import { DropEffectOverlay } from '../../components/DropEffectOverlay/DropEffectOverlay'
import { useDropEffectStore } from '../../features/drop-effect/store'
import {
  getAccessoryBoxContents,
  getBossDropCandidates,
  getBossFixedDrops,
  getRingBoxContents,
  isBoxItem,
} from '../../lib/boss-drops'
import { getItemIconUrl } from '../../lib/item-icons'
import { isValuableDrop } from '../../lib/valuable-drops'
import type { BossDifficulty } from '../../types'
import type {
  DropCandidate,
  DropCategory,
  RecordedDrop,
  SelectableDropCategory,
} from '../../types/drops'

// 선택 가능한 카테고리(장비·소비)의 라벨과 아이콘(ADR-040 결정 4 — 노란 점 대신 아이콘). 고정은
// 읽기 전용 별도 섹션이라 여기 없다.
const CATEGORY_META: Record<SelectableDropCategory, { label: string; Icon: LucideIcon }> = {
  equipment: { label: '장비', Icon: Sword },
  consumable: { label: '소비', Icon: FlaskConical },
}
// 값나가는 장비를 소비보다 먼저 노출한다.
const DISPLAY_ORDER: SelectableDropCategory[] = ['equipment', 'consumable']

interface BossDropSheetProps {
  boss: string
  difficulty: BossDifficulty
  initialDrops: RecordedDrop[]
  onSave: (drops: RecordedDrop[]) => void
  onClose: () => void
}

function ItemThumb(props: { name: string; slot?: string; level?: number }): React.JSX.Element {
  const url = getItemIconUrl(props.name, props.slot)
  return (
    <span className="relative inline-block h-9 w-9">
      {url !== null ? (
        <img src={url} alt="" className="h-9 w-9 object-contain" />
      ) : (
        <span className="block h-9 w-9 rounded-lg bg-surface-2" aria-hidden="true" />
      )}
      {props.level !== undefined && (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1 py-px text-[8px] font-bold leading-none text-white ring-1 ring-bg">
          lv{props.level}
        </span>
      )}
    </span>
  )
}

// 드롭 결과 하나가 이 후보(일반 아이템/상자)와 일치하는지.
function findNormalDrop(drops: RecordedDrop[], name: string): RecordedDrop | undefined {
  return drops.find((drop) => drop.itemName === name && drop.boxOrigin === undefined)
}
function findBoxDrop(drops: RecordedDrop[], boxName: string): RecordedDrop | undefined {
  return drops.find((drop) => drop.boxOrigin === boxName)
}

// 연출 끄기 토글(ADR-040 결정 6). 활성(ON) = 연출을 끔(고가 드롭을 추가해도 연출이 안 뜸).
// 값은 전역 스토어라 시트 밖에서도 공유·영구 저장.
function EffectToggle(props: { off: boolean; onToggle: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.off}
      aria-label="연출 끄기"
      onClick={props.onToggle}
      className="ml-auto flex shrink-0 items-center gap-1.5"
    >
      <span className="text-[11px] font-semibold text-text-muted">연출 끄기</span>
      <span
        className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          props.off ? 'bg-primary' : 'bg-border-strong'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
            props.off ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

export function BossDropSheet(props: BossDropSheetProps): React.JSX.Element {
  const [selected, setSelected] = useState<RecordedDrop[]>(props.initialDrops)
  const [activeBox, setActiveBox] = useState<{ name: string; category: SelectableDropCategory } | null>(
    null,
  )
  // 고가 아이템을 새로 추가하면 전체화면 연출을 띄운다(ADR-038). 연출 표시 여부는 전역 토글(ADR-040).
  const [effect, setEffect] = useState<{ itemName: string; slot?: string } | null>(null)
  const effectEnabled = useDropEffectStore((state) => state.enabled)
  const setEffectEnabled = useDropEffectStore((state) => state.setEnabled)

  // 난이도 무관 통합 표시(ADR-040): 장비·소비는 전 난이도 통합 후보, 고정은 난이도별 그룹.
  const candidates = getBossDropCandidates(props.boss)
  const fixedGroups = getBossFixedDrops(props.boss)
  const byCategory = new Map<SelectableDropCategory, DropCandidate[]>()
  for (const candidate of candidates) {
    const list = byCategory.get(candidate.category) ?? []
    list.push(candidate)
    byCategory.set(candidate.category, list)
  }
  const isEmpty = candidates.length === 0 && fixedGroups.length === 0

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
    if (isAdding && effectEnabled && isValuableDrop(candidate.name)) {
      setEffect({ itemName: candidate.name, slot: candidate.slot })
    }
  }

  function applyBoxResult(
    boxName: string,
    category: DropCategory,
    itemName: string,
    ringLevel?: number,
  ): void {
    setSelected((prev) => [
      ...prev.filter((drop) => drop.boxOrigin !== boxName),
      { category, itemName, boxOrigin: boxName, ringLevel, quantity: 1 },
    ])
    setActiveBox(null)
    if (effectEnabled && isValuableDrop(itemName)) {
      setEffect({ itemName })
    }
  }
  function removeBoxResult(boxName: string): void {
    setSelected((prev) => prev.filter((drop) => drop.boxOrigin !== boxName))
  }

  function handleTileTap(candidate: DropCandidate): void {
    if (isBoxItem(candidate.name)) {
      // 이미 결과가 지정된 상자를 다시 탭하면 드릴다운을 열지 않고 선택을 제거한다(일반 아이템 토글과 동일).
      if (findBoxDrop(selected, candidate.name) !== undefined) {
        removeBoxResult(candidate.name)
      } else {
        setActiveBox({ name: candidate.name, category: candidate.category })
      }
    } else {
      toggleNormal(candidate)
    }
  }

  return (
    <>
      <BottomSheet onClose={props.onClose} testId="boss-drop-sheet">
      {activeBox === null ? (
        <div>
          <div className="flex items-center gap-2 px-4 pb-1 pt-1">
            <span className="text-lg font-bold text-text">{props.boss}</span>
            <EffectToggle off={!effectEnabled} onToggle={() => void setEffectEnabled(!effectEnabled)} />
          </div>
          <p className="px-4 pb-3 text-xs text-text-muted">획득한 드롭을 선택하세요</p>

          {isEmpty ? (
            <p className="px-4 pb-4 text-sm text-text-muted">이 보스의 드롭 데이터가 아직 없습니다.</p>
          ) : (
            <>
              {DISPLAY_ORDER.filter((category) => byCategory.has(category)).map((category) => {
                const { label, Icon } = CATEGORY_META[category]
                return (
                  <section key={category} className="px-4 pb-3">
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-text-muted">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-third/15 text-third-text">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      {label}
                    </h3>
                    <ul className="grid grid-cols-4 gap-2">
                      {(byCategory.get(category) ?? []).map((candidate) => {
                        const box = isBoxItem(candidate.name)
                        const boxDrop = box ? findBoxDrop(selected, candidate.name) : undefined
                        const on = box
                          ? boxDrop !== undefined
                          : findNormalDrop(selected, candidate.name) !== undefined
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
                              <ItemThumb
                                name={displayName}
                                slot={boxDrop ? undefined : candidate.slot}
                                level={boxDrop?.ringLevel}
                              />
                              <span className="line-clamp-2 h-[2.4em] text-balance break-keep text-center text-[10px] leading-tight text-text">
                                {displayName}
                              </span>
                              <span
                                className="absolute left-1 top-1 flex gap-0.5"
                                aria-hidden="true"
                              >
                                {candidate.difficulties.map((difficulty) => (
                                  <DifficultyChip key={difficulty} difficulty={difficulty} />
                                ))}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}

              {fixedGroups.length > 0 && (
                <section className="px-4 pb-3">
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-text-muted">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-third/15 text-third-text">
                      <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    고정
                  </h3>
                  {/* 고정 드롭은 값이 난이도마다 달라 통합하지 않고 난이도별로 값만 읽기 전용 표시(ADR-040) */}
                  <div className="space-y-2">
                    {fixedGroups.map((group) => (
                      <div
                        key={group.difficulty}
                        className="rounded-xl border border-border bg-surface p-2.5"
                      >
                        <div className="mb-1.5">
                          <DifficultyBadge difficulty={group.difficulty} />
                        </div>
                        <ul className="space-y-1">
                          {group.items.map((item) => (
                            <li
                              key={item.name}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="text-text">{item.name}</span>
                              {item.amount !== undefined && (
                                <span className="shrink-0 font-semibold text-text-muted">
                                  {item.amount}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <div className="sticky bottom-0 border-t border-border bg-bg px-4 pt-3 pb-[calc(0.75rem+var(--sa-bottom))]">
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
          onBack={() => setActiveBox(null)}
          onConfirm={(itemName, ringLevel) =>
            applyBoxResult(activeBox.name, activeBox.category, itemName, ringLevel)
          }
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
  onBack: () => void
  onConfirm: (itemName: string, ringLevel?: number) => void
}

// 랜덤 상자 결과 선택(ADR-038 결정 2). 반지 상자=등급+반지 2축, 칠흑 장신구=1축. 확률 자동추정 없음.
// 이미 지정된 상자는 타일 재탭으로 제거하므로(ADR-040) 이 화면은 항상 새 선택 전용 — 제거 버튼 없음.
function BoxDrillDown(props: BoxDrillDownProps): React.JSX.Element {
  const ring = getRingBoxContents(props.boxName)
  const accessory = ring === null ? getAccessoryBoxContents(props.boxName) : null

  const [level, setLevel] = useState<number | null>(null)
  const [item, setItem] = useState<string | null>(null)

  // 선택한 반지의 레벨 유무(ADR-041). 연마석(hasLevel=false)은 레벨 선택을 비활성하고 레벨 없이 기록.
  const selectedOption = ring?.rings.find((r) => r.name === item) ?? null
  const needsLevel = selectedOption?.hasLevel ?? false
  const levelDisabled = selectedOption !== null && !selectedOption.hasLevel

  const canConfirm = item !== null && (ring === null ? true : needsLevel ? level !== null : true)

  return (
    <div>
      <div className="flex items-center gap-2 px-4 pb-3 pt-1">
        <button type="button" onClick={props.onBack} aria-label="뒤로" className="text-lg text-text">
          ‹
        </button>
        <span className="text-sm font-bold text-text">{props.boxName}</span>
      </div>

      {/* 반지 종류 먼저 선택(ADR-041) */}
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
                <span className="line-clamp-2 h-[2.4em] text-balance break-keep text-center text-[10px] leading-tight text-text">
                  {entry.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* 그다음 레벨(등급) — 항상 보이되 연마석 선택 시에만 비활성(ADR-041) */}
      {ring !== null && (
        <section className="px-4 pb-3">
          <h3 className="mb-2 text-xs font-bold text-text-muted">등급</h3>
          <div className="flex gap-1.5">
            {ring.levels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                disabled={levelDisabled}
                onClick={() => setLevel(lvl)}
                className={`flex-1 rounded-lg border py-2 text-xs font-bold disabled:opacity-40 ${
                  level === lvl && !levelDisabled
                    ? 'border-primary bg-primary/10 text-primary-text'
                    : 'border-border text-text-muted'
                }`}
              >
                {lvl}레벨
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="sticky bottom-0 border-t border-border bg-bg px-4 pt-3 pb-[calc(0.75rem+var(--sa-bottom))]">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => {
            if (item !== null) props.onConfirm(item, needsLevel ? (level ?? undefined) : undefined)
          }}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          이 결과로 기록
        </button>
      </div>
    </div>
  )
}
