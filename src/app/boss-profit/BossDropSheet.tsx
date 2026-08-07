import { useState } from 'react'
import { ChevronLeft, FlaskConical, PackageOpen, Pin, Sword, type LucideIcon } from 'lucide-react'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { DifficultyBadge } from '../../components/atoms/DifficultyBadge/DifficultyBadge'
import { DropEffectOverlay } from '../../components/organisms/DropEffectOverlay/DropEffectOverlay'
import { useDropEffectStore } from '../../features/drop-effect/store'
import {
  getAccessoryBoxContents,
  getBossDifficulties,
  getBossDropCandidates,
  getBossFixedDrops,
  getObtainableTileNames,
  getRingBoxContents,
  isBoxItem,
} from '../../lib/boss-drops'
import { getFixedDropIcons, type FixedDropIconSpec } from '../../lib/fixed-drops'
import { getItemIconUrl, getItemIconUrlByFile } from '../../lib/item-icons'
import { isValuableDrop } from '../../lib/valuable-drops'
import { BOSS_DIFFICULTIES, type BossDifficulty } from '../../types'
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

// 고정 난이도 카드 배치(사용자 지시): 1→1열, 2→2열, 3→2열(2줄: 2 + 마지막 1개 full-width),
// 4→2열(2줄). 보스당 고정 난이도는 최대 4개라 그 이상은 없다. Tailwind JIT가 정적 클래스만
// 인식하므로 문자열로 매핑한다.
const FIXED_GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2',
  4: 'grid-cols-2',
}

interface BossDropSheetProps {
  boss: string
  // 수익 리스트 행의 난이도. 미완료면 시트 안 난이도 토글의 기본값, 완료면 유일하게 표시할 난이도.
  difficulty: BossDifficulty
  // 완료 여부(수익 리스트 행 기준). true면 난이도 토글 없이 완료 난이도만 표시, false면 토글 노출.
  isComplete: boolean
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
        <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1 py-px text-[8px] font-bold leading-none text-on-primary ring-1 ring-bg">
          lv{props.level}
        </span>
      )}
    </span>
  )
}

// 고정 드롭 아이콘 하나(일반 아이템 1개 또는 솔 에르다 단위 1개). 읽기 전용 표시라 버튼이 아니다.
// 수량은 이미지 우측 하단 뱃지('N개')로 표시한다(ItemThumb 레벨 뱃지와 동일 스타일).
function FixedDropIcon(props: { icon: FixedDropIconSpec }): React.JSX.Element {
  const { icon } = props
  const url = icon.iconFile !== null ? getItemIconUrlByFile(icon.iconFile) : getItemIconUrl(icon.itemName)
  return (
    <span className="relative inline-block h-8 w-8">
      {url !== null ? (
        <img src={url} alt={icon.itemName} className="h-8 w-8 object-contain" />
      ) : (
        <span className="block h-8 w-8 rounded-md bg-surface-2" role="img" aria-label={icon.itemName} />
      )}
      <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1 py-px text-[8px] font-bold leading-none text-on-primary ring-1 ring-bg tabular-nums">
        {icon.count}개
      </span>
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

// 드롭 연출 토글(ADR-040 결정 6 + 정정 4). 활성(ON) = 연출을 표시(고가 드롭을 추가하면 연출이 뜸).
// 라벨이 긍정형이라 스토어의 positive 모델(enabled)을 반전 없이 그대로 그린다 — 부정형 라벨은
// 토글과 겹쳐 이중 부정이 됐다. 값은 전역 스토어라 시트 밖에서도 공유·영구 저장.
function EffectToggle(props: { on: boolean; onToggle: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label="드롭 연출"
      onClick={props.onToggle}
      className="ml-auto flex shrink-0 items-center gap-1.5"
    >
      <span className="text-[11px] font-semibold text-text-muted">드롭 연출</span>
      <span
        className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          props.on ? 'bg-primary' : 'bg-border-strong'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
            props.on ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

export function BossDropSheet(props: BossDropSheetProps): React.JSX.Element {
  const [selected, setSelected] = useState<RecordedDrop[]>(props.initialDrops)
  // 표시할 난이도. 기본값은 행 난이도(props.difficulty). 완료면 고정, 미완료면 토글로 변경한다.
  // 저장 키는 항상 행 난이도(display-only 필터)라 이 값은 표시·필터에만 쓴다.
  const [selectedDifficulty, setSelectedDifficulty] = useState<BossDifficulty>(props.difficulty)
  const [activeBox, setActiveBox] = useState<{ name: string; category: SelectableDropCategory } | null>(
    null,
  )
  // 고가 아이템을 새로 추가하면 전체화면 연출을 띄운다(ADR-038). 연출 표시 여부는 전역 토글(ADR-040).
  const [effect, setEffect] = useState<{ itemName: string; slot?: string } | null>(null)
  const effectEnabled = useDropEffectStore((state) => state.enabled)
  const setEffectEnabled = useDropEffectStore((state) => state.setEnabled)

  // 난이도별 표시: 장비·소비는 name+slot으로 통합된 후보에서 현재 난이도만 필터, 고정은 현재
  // 난이도 그룹만. 통합 후보는 등장 난이도(difficulties)를 담고 있어 그대로 필터에 쓴다.
  const allCandidates = getBossDropCandidates(props.boss)
  const allFixedGroups = getBossFixedDrops(props.boss)
  // 난이도 토글 후보 = 드롭 테이블에 있는 난이도 + 행 난이도(테이블에 없어도 기본값은 항상 노출).
  const tableDifficulties = getBossDifficulties(props.boss)
  const difficultyOptions = BOSS_DIFFICULTIES.filter(
    (difficulty) => tableDifficulties.includes(difficulty) || difficulty === props.difficulty,
  )

  const candidates = allCandidates.filter((candidate) =>
    candidate.difficulties.includes(selectedDifficulty),
  )
  const fixedGroups = allFixedGroups.filter((group) => group.difficulty === selectedDifficulty)
  const byCategory = new Map<SelectableDropCategory, DropCandidate[]>()
  for (const candidate of candidates) {
    const list = byCategory.get(candidate.category) ?? []
    list.push(candidate)
    byCategory.set(candidate.category, list)
  }
  const isEmpty = candidates.length === 0 && fixedGroups.length === 0

  // 난이도 변경(미완료 전용). 이미 선택된 드롭 중 새 난이도에 존재하는 것만 유지하고 나머지는
  // 초기화한다. 상자 결과는 상자(boxOrigin)가 새 난이도 후보에 있으면 유지(타일 기준이 상자명이라).
  function selectDifficulty(next: BossDifficulty): void {
    if (next === selectedDifficulty) return
    const availableTileNames = getObtainableTileNames(props.boss, next)
    setSelected((prev) =>
      prev.filter((drop) => availableTileNames.has(drop.boxOrigin ?? drop.itemName)),
    )
    setSelectedDifficulty(next)
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
            <EffectToggle on={effectEnabled} onToggle={() => void setEffectEnabled(!effectEnabled)} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pb-3">
            <p className="text-xs text-text-muted">획득한 아이템을 선택하세요</p>
            {props.isComplete ? (
              // 완료: 완료된 난이도만 표시(선택 불가). 미완료 토글과 동일하게 오른쪽 끝 정렬.
              <span className="ml-auto">
                <DifficultyBadge difficulty={props.difficulty} />
              </span>
            ) : (
              // 미완료: 드롭 테이블 난이도를 선택 버튼으로 나열(오른쪽 끝 정렬), 선택 안 된 것은 흐림 처리
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {difficultyOptions.map((difficulty) => {
                  const active = difficulty === selectedDifficulty
                  return (
                    <button
                      key={difficulty}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectDifficulty(difficulty)}
                      className={active ? '' : 'opacity-40'}
                    >
                      <DifficultyBadge difficulty={difficulty} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {isEmpty ? (
            <div className="px-4 pb-4">
              <EmptyState
                icon={PackageOpen}
                title="이 보스의 드롭 데이터가 아직 없습니다"
                description="드롭 목록이 준비되면 여기에서 바로 입력할 수 있습니다"
              />
            </div>
          ) : (
            <>
              {DISPLAY_ORDER.filter((category) => byCategory.has(category)).map((category) => {
                const { label, Icon } = CATEGORY_META[category]
                return (
                  <section key={category} className="px-4 pb-3">
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-text-muted">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-third-tint text-third-ink">
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
                              className={`relative flex w-full flex-col items-center gap-1 rounded-xl border p-2 pt-[1em] ${
                                on ? 'border-primary bg-primary-tint' : 'border-border bg-surface'
                              } ${box ? 'border-dashed' : ''}`}
                            >
                              {on && (
                                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-on-primary">
                                  ✓
                                </span>
                              )}
                              <ItemThumb
                                name={displayName}
                                slot={boxDrop ? undefined : candidate.slot}
                                level={boxDrop?.ringLevel}
                              />
                              <span className="flex h-[2em] w-full items-center justify-center">
                                <span className="line-clamp-2 text-balance break-keep text-center text-[10px] leading-tight text-text">
                                  {displayName}
                                </span>
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
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-third-tint text-third-ink">
                      <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    고정
                  </h3>
                  {/* 고정 드롭은 값이 난이도마다 달라 통합하지 않고 난이도별 카드로 읽기 전용 표시(ADR-040).
                      텍스트 대신 아이콘 + 수량으로 표시, 솔 에르다는 단위별로 분해한다. */}
                  <div className={`grid gap-2 ${FIXED_GRID_COLS[fixedGroups.length] ?? 'grid-cols-2'}`}>
                    {fixedGroups.map((group, index) => (
                      <div
                        key={group.difficulty}
                        className={`rounded-xl border border-border bg-surface px-2 pt-1 pb-3 ${
                          fixedGroups.length === 3 && index === 2 ? 'col-span-2' : ''
                        }`}
                      >
                        <DifficultyBadge difficulty={group.difficulty} />
                        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-2.5">
                          {group.items.flatMap((item) =>
                            getFixedDropIcons(item).map((icon, i) => (
                              <FixedDropIcon
                                key={`${item.name}-${icon.iconFile ?? 'name'}-${i}`}
                                icon={icon}
                              />
                            )),
                          )}
                        </div>
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
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary"
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
        <button type="button" onClick={props.onBack} aria-label="뒤로" className="text-text">
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
        <span className="text-lg font-bold text-text">{props.boxName}</span>
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
                className={`relative flex w-full flex-col items-center gap-1 rounded-xl border p-2 pt-[1em] ${
                  item === entry.name ? 'border-primary bg-primary-tint' : 'border-border bg-surface'
                }`}
              >
                {item === entry.name && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-on-primary">
                    ✓
                  </span>
                )}
                <ItemThumb name={entry.name} />
                <span className="flex h-[2em] w-full items-center justify-center">
                  <span className="line-clamp-2 text-balance break-keep text-center text-[10px] leading-tight text-text">
                    {entry.name}
                  </span>
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
                    ? 'border-primary bg-primary-tint text-primary-ink'
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
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary disabled:opacity-40"
        >
          이 결과로 기록
        </button>
      </div>
    </div>
  )
}
