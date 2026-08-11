import { useState } from 'react'
import { ChevronLeft, FlaskConical, PackageOpen, Pin, Sword, type LucideIcon } from 'lucide-react'
import { ProfitIcon } from '../../components/atoms/ProfitIcon/ProfitIcon'
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
import { DropPricePadContent } from './DropPricePad'
import { getItemIconUrl, getItemIconUrlByFile } from '../../lib/item-icons'
import { isValuableDrop } from '../../lib/valuable-drops'
import { BOSS_DIFFICULTIES, type BossDifficulty } from '@core/types'
import type {
  DropCandidate,
  DropCategory,
  RecordedDrop,
  SelectableDropCategory,
} from '@core/types/drops'

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
  /**
   * 이 시트 안에서 가격까지 매길 수 있게 할지(#185). 넘기지 않으면 기록 직후의 확인 줄도 타일의
   * 수익 배지도 뜨지 않는다 — 가격 개념이 없는 호출부에 누를 수 없는 표식을 만들지 않기 위해서다.
   */
  pricing?: { defaultShare: number; maxShare: number; characterName: string }
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

/** 타일 좌상단 수익 배지가 읽는 값. 선택 안 된 후보는 `undefined` 라 배지 자체가 없다. */
function priceStateOf(drop: RecordedDrop | undefined): RecordedDrop['priceState'] {
  return drop?.priceState
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
  // 가격을 입력하는 중인 드롭(#185). null 이면 평소의 타일 그리드다.
  //
  // **상자 드릴다운과 같은 자리다** — 시트를 닫고 새 시트를 여는 대신 시트 내용을 갈아 끼운다.
  // 첫 설계(기록 직후 뜨는 확인 바)는 세 가지로 반려됐다(2026-08-10): ① 두 개를 찍으면 마지막
  // 것의 가격밖에 못 넣고 ② 입력하면 시트가 닫혀 고르던 작업이 끊기고 ③ 어느 타일이 값을 가졌는지
  // 알 수 없었다.
  //
  // 진입점은 그 뒤 두 번 더 갈렸다(2026-08-10). '선택한 드롭' 목록을 뒀다가 → 금액 뱃지가 타일
  // 배지와 같은 말을 두 번 해서 뱃지를 떼고 → 목록 자체를 지웠다. 지금은 **기록 직후의 확인 줄**
  // 하나이고, 셋은 이렇게 갈린다: ① 물음이 그 기록 하나에 붙어 여러 개를 찍어도 섞이지 않고
  // ② 드릴다운이라 입력 후 시트가 살아서 그리드로 돌아오며 ③ 상태는 타일의 수익 배지가 말한다.
  const [pricing, setPricing] = useState<RecordedDrop | null>(null)
  // 방금 기록한 드롭 — 아래 확인 줄의 대상이다. 새로 기록하면 갈아타고, 그 기록을 취소하면 사라진다.
  const [justAdded, setJustAdded] = useState<RecordedDrop | null>(null)
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
    const added: RecordedDrop = {
      category: candidate.category,
      itemName: candidate.name,
      slot: candidate.slot,
      quantity: 1,
    }
    setSelected((prev) => {
      if (!isAdding) {
        return prev.filter((drop) => !(drop.itemName === candidate.name && drop.boxOrigin === undefined))
      }
      return [...prev, added]
    })
    // 해제한 아이템의 물음이 남아 있으면 없는 기록의 가격을 묻게 된다.
    setJustAdded(isAdding ? added : null)
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
    const added: RecordedDrop = { category, itemName, boxOrigin: boxName, ringLevel, quantity: 1 }
    setSelected((prev) => [...prev.filter((drop) => drop.boxOrigin !== boxName), added])
    setActiveBox(null)
    setJustAdded(added)
    if (effectEnabled && isValuableDrop(itemName)) {
      setEffect({ itemName })
    }
  }
  function removeBoxResult(boxName: string): void {
    setSelected((prev) => prev.filter((drop) => drop.boxOrigin !== boxName))
    setJustAdded(null)
  }

  /**
   * 가격 필드만 갈아 끼운다. **객체 정체(===)로 찾는다** — 같은 보스에 같은 아이템을 두 개 먹은
   * 경우를 기록이 구분하지 않으므로([[ADR-069]] 결정 4) 이름으로 찾으면 둘 다 바뀐다.
   */
  function applyPrice(target: RecordedDrop, patch: Partial<RecordedDrop>): void {
    setSelected((prev) => prev.map((drop) => (drop === target ? { ...drop, ...patch } : drop)))
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
      {pricing !== null && props.pricing !== undefined ? (
        // 가격 드릴다운 — 시트는 열린 채다. 저장·스킵 후 목록으로 돌아와 고르던 작업을 잇는다.
        <DropPricePadContent
          drop={pricing}
          boss={props.boss}
          difficulty={selectedDifficulty}
          characterName={props.pricing.characterName}
          defaultShare={props.pricing.defaultShare}
          maxShare={props.pricing.maxShare}
          onBack={() => setPricing(null)}
          onSave={(priceMeso, share) => {
            applyPrice(pricing, { priceState: 'entered', priceMeso, priceShare: share })
            setPricing(null)
          }}
          onExclude={() => {
            applyPrice(pricing, { priceState: 'excluded', priceMeso: undefined, priceShare: undefined })
            setPricing(null)
          }}
        />
      ) : activeBox === null ? (
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
                              {/* 가격이 **입력된** 타일에만 수익 배지가 붙는다(사용자 지정
                                  2026-08-10). 자리는 좌상단 — 우상단은 선택 체크가 이미 쓴다 —
                                  이고 크기·모양을 그 체크와 맞춰 두 배지가 한 쌍으로 읽힌다.
                                  스킵은 "기록된 가격"이 아니므로 표식이 없다(= 미입력과 같은
                                  얼굴). 그 구분은 가격 기록 화면이 맡는다. */}
                              {priceStateOf(box ? boxDrop : findNormalDrop(selected, candidate.name)) ===
                                'entered' && (
                                <span
                                  role="img"
                                  aria-label="가격 입력됨"
                                  className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-on-primary"
                                >
                                  <ProfitIcon className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
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
            {/* 기록 직후 **그 아이템 하나에 대해** 값을 매길지 묻는다(사용자 지정 2026-08-10).
                흐름은 `기록 → 확인 → (입력 →) 복귀` 이고, 어느 갈래든 타일 그리드로 돌아온다.
                **차단하지 않는다** — 일반 아이템은 확인창 없이 탭 즉시 기록된다는 [[ADR-040]] 를
                지키려는 것이다. 기록은 이미 끝났고 이 줄은 그 옆에 설 뿐이라, 무시하고 다음
                아이템을 계속 골라도 된다(그러면 그 아이템의 물음으로 갈아탄다). */}
            {justAdded !== null && props.pricing !== undefined && (
              <div
                data-testid="drop-price-prompt"
                className="mb-2.5 flex items-center gap-2 rounded-[14px] border border-border bg-surface px-3 py-2 shadow-lg"
              >
                <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-tight text-text">
                  <span className="block truncate">
                    {justAdded.itemName}
                    {justAdded.ringLevel !== undefined && ` ${justAdded.ringLevel}레벨`} 기록됨
                  </span>
                  <span className="block font-medium text-text-muted">판매 가격을 입력할까요?</span>
                </p>
                <button
                  type="button"
                  onClick={() => setJustAdded(null)}
                  className="flex-none px-1 text-[12.5px] font-semibold text-text-muted"
                >
                  나중에
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPricing(justAdded)
                    setJustAdded(null)
                  }}
                  className="flex-none rounded-full bg-primary px-3 py-1.5 text-[12.5px] font-bold text-on-primary"
                >
                  가격 입력
                </button>
              </div>
            )}
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
