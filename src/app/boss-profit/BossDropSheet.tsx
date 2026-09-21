/**
 * 보스 드롭 기록 시트.
 *
 * 시트 껍데기는 `components/organisms/BottomSheet` 가 이미 소유한다. 이 파일이 갖는 것은
 * 무엇을 고르게 할 것인가다. 난이도 필터, 장비·소비 타일, 읽기 전용 고정 드롭, 상자 드릴다운,
 * 그리고 기록 직후의 가격 물음.
 */
import type { ShareValue } from '../../components/organisms/InputCard/InputCard'
import { useState } from 'react'
import { Image, Pressable, ScrollView, View } from 'react-native'

import {
  dropTileKey,
  getAccessoryBoxContents,
  getBossDifficulties,
  getBossDropCandidates,
  getBossFixedDrops,
  getObtainableTileKeys,
  getRingBoxContents,
  isBoxItem,
} from '../../lib/boss/boss-drops'
import { useDropEffectStore } from '../../features/drop-effect/store'
import { getFixedDropIcons, type FixedDropIconSpec } from '../../lib/drop/fixed-drops'
import { dropItemIconOf, getItemIconUrlByFile } from '../../lib/assets/asset-lookup'
import { dropItemNameOf } from '../../lib/drop/drop-items'
import { dropPromptOf } from '../../lib/drop/drop-prompt'
import { confirmLabels } from '../../lib/drop/price-card-labels'
import { formatMesoCompact } from '../../lib/drop/drop-price'
import { bossNameOf } from '../../lib/boss/bosses'
import { isValuableDropItem } from '../../lib/drop/valuable-drops'
import { BOSS_DIFFICULTIES, type BossDifficulty } from '../../types'
import type { DropCandidate, DropCategory, RecordedDrop, SelectableDropCategory } from '../../types/drops'

import {
  Badge,
  ChevronLeftIcon,
  FlaskConicalIcon,
  PackageOpenIcon,
  PinIcon,
  SwordIcon,
  Switch,
  Text,
} from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { DropEffectOverlay } from '../../components/organisms/DropEffectOverlay/DropEffectOverlay'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { MESO_QUICK_ADDS } from '../../constants/domain/meso-quick-adds'
import { closeInputCard, openInputCard } from '../../features/input-card/store'
import { mesoTextOf, mesoValueOf } from '../../components/organisms/MesoPad/meso-pad'

// 선택 가능한 카테고리(장비·소비)의 라벨과 아이콘(노란 점 대신 아이콘). 고정은
// 읽기 전용 별도 섹션이라 여기 없다.
const CATEGORY_META: Record<
  SelectableDropCategory,
  { label: string; Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }> }
> = {
  equipment: { label: '장비', Icon: SwordIcon },
  consumable: { label: '소비', Icon: FlaskConicalIcon },
}
// 값나가는 장비를 소비보다 먼저 노출한다.
const DISPLAY_ORDER: SelectableDropCategory[] = ['equipment', 'consumable']

interface BossDropSheetProps {
  /** 보스 key. 드롭 표를 찾고, 머리의 이름은 보스 표에서 찾는다. */
  bossKey: string
  // 수익 리스트 행의 난이도. 미완료면 시트 안 난이도 토글의 기본값, 완료면 그 난이도만 표시한다.
  difficulty: BossDifficulty
  /** 그 행의 기간. 그 기간에 나오는 아이템과 고정 보상만 선다. */
  periodKey: string
  // 완료 여부(수익 리스트 행 기준). true면 난이도 토글 없이 완료 난이도만 표시, false면 토글 노출.
  isComplete: boolean
  initialDrops: RecordedDrop[]
  onSave: (drops: RecordedDrop[]) => void
  onClose: () => void
  /**
   * 이 시트 안에서 가격까지 매길 수 있게 할지. 넘기지 않으면 기록 직후의 확인 줄도 타일의
   * 수익 배지도 뜨지 않는다. 가격 개념이 없는 호출부에 누를 수 없는 표식을 만들지 않는다.
   */
  pricing?: { defaultShare: ShareValue; characterName: string }
}

/**
 * 타일이 자기 상태를 말하는 알약. 그림 아래를 덮는다.
 *
 * 정한 것에만 붙는다. 값을 매겼으면 **얼마인지**, 기록 안함이면 **그 결정**을 적는다. 아직 안
 * 정한 것은 비어 있고, 그 빈 자리가 곧 `남았다` 는 말이다.
 *
 * 그림 위에 겹치는 것은 게임 인벤토리가 수량을 얹는 자리와 같아서 낯익다. 폭은 글자만큼이다.
 * 못박으면 `1억` 에는 빈자리가 남고 긴 금액은 넘친다.
 */
function TileLabel(props: { drop: RecordedDrop | undefined }): React.JSX.Element | null {
  const state = props.drop?.priceState
  if (state === undefined) return null

  const 값 = state === 'entered'
  return (
    <View
      role="img"
      aria-label={값 ? '가격 입력됨' : '기록 안함'}
      /*
        기록 안함은 **강조색을 안 쓴다**. 둘 다 강조색이면 어두운 테마에서 두 알약이 같은 얼굴이
        된다(실기 화면에서 잡았다). 값을 매긴 것만 색을 갖고, 안 매기기로 한 것은 조용한 칩이다.
      */
      className={`absolute -bottom-1.5 h-[15px] max-w-full justify-center rounded-full px-1.5 ${
        값 ? 'bg-primary' : 'border border-border bg-surface-2'
      }`}
    >
      <Text
        numberOfLines={1}
        className={`text-9 font-bold leading-none ${값 ? 'text-on-primary' : 'text-text-muted'}`}
        style={값 ? TABULAR_NUMS : undefined}
      >
        {값 ? formatMesoCompact(props.drop?.priceMeso ?? 0) : '기록 안함'}
      </Text>
    </View>
  )
}

/** 한 연쇄 안에서 매긴 값. 상태가 갈아 끼워져도 이전으로 돌아가면 이 값이 보인다. */
interface PriceEdit {
  meso: number
  share: ShareValue
}

function ItemThumb(props: { itemKey: string | null; level?: number }): React.JSX.Element {
  const url = dropItemIconOf(props.itemKey)
  return (
    <View className="h-9 w-9">
      {url !== null ? (
        <Image source={url} resizeMode="contain" className="h-9 w-9" />
      ) : (
        <View className="h-9 w-9 rounded-lg bg-surface-2" aria-hidden />
      )}
      {/* 그림 **위쪽**이다. 아래는 금액 띠가 덮는다. */}
      {props.level !== undefined && (
        <View className="absolute -right-1 -top-1 rounded-full bg-primary px-1 py-px">
          <Text className="text-8 font-bold leading-none text-on-primary">lv{props.level}</Text>
        </View>
      )}
    </View>
  )
}

// 고정 드롭 아이콘 하나(일반 아이템 1개 또는 솔 에르다 단위 1개). 읽기 전용 표시라 버튼이
// 아니다. 수량은 이미지 우측 하단 배지(`N개`)로 표시한다.
function FixedDropIcon(props: { icon: FixedDropIconSpec }): React.JSX.Element {
  const { icon } = props
  const url = icon.iconFile !== null ? getItemIconUrlByFile(icon.iconFile) : dropItemIconOf(icon.itemKey)
  const name = dropItemNameOf(icon.itemKey, icon.itemKey)
  return (
    <View className="h-8 w-8">
      {url !== null ? (
        <Image source={url} accessibilityLabel={name} resizeMode="contain" className="h-8 w-8" />
      ) : (
        <View className="h-8 w-8 rounded-md bg-surface-2" role="img" aria-label={name} />
      )}
      <View className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1 py-px">
        <Text className="text-8 font-bold leading-none text-on-primary" style={TABULAR_NUMS}>
          {icon.count}개
        </Text>
      </View>
    </View>
  )
}

// 드롭 연출 토글. 활성(ON) = 연출을 표시한다. 라벨이 긍정형이라 스토어의 positive 모델
// (enabled)을 반전 없이 그대로 그린다. 부정형 라벨은 토글과 겹쳐 이중 부정이 된다. 값은 전역
// 스토어라 시트 밖에서도 공유·영구 저장된다.
//
// 크기가 `sm` 인 것은 여기가 시트 머리의 작은 줄이라 그 줄의 글자와 키가 맞아야 해서다.
function EffectToggle(props: { on: boolean; onToggle: () => void }): React.JSX.Element {
  return (
    <Switch
      on={props.on}
      label="드롭 연출"
      onToggle={props.onToggle}
      className="ml-auto gap-1.5"
    >
      <Text className="text-11 font-semibold text-text-muted">드롭 연출</Text>
    </Switch>
  )
}

export function BossDropSheet(props: BossDropSheetProps): React.JSX.Element {
  const [selected, setSelected] = useState<RecordedDrop[]>(props.initialDrops)
  // 표시할 난이도. 기본값은 행 난이도(props.difficulty). 완료면 고정, 미완료면 토글로 변경한다.
  // 저장 키는 항상 행 난이도(display-only 필터)라 이 값은 표시·필터에만 쓴다.
  const [selectedDifficulty, setSelectedDifficulty] = useState<BossDifficulty>(props.difficulty)
  const [activeBox, setActiveBox] = useState<{ key: string; name: string; category: SelectableDropCategory } | null>(
    null,
  )
  // 고가 아이템을 새로 추가하면 전체화면 연출을 띄운다. 표시 여부는 전역 토글.
  const [effect, setEffect] = useState<{ itemKey: string } | null>(null)
  const effectEnabled = useDropEffectStore((state) => state.enabled)
  const setEffectEnabled = useDropEffectStore((state) => state.setEnabled)

  // 난이도별 표시: 장비·소비는 name+slot으로 통합된 후보에서 현재 난이도만 필터, 고정은 현재
  // 난이도 그룹만. 통합 후보는 등장 난이도(difficulties)를 담고 있어 그대로 필터에 쓴다.
  // 패치가 기간 첫날 안에서 적용되는 날이 있어 시계를 넘긴다. 09-17 패치는 오전 10시다.
  const now = new Date()
  const allCandidates = getBossDropCandidates(props.bossKey, props.periodKey, now)
  const allFixedGroups = getBossFixedDrops(props.bossKey, props.periodKey, now)
  // 난이도 토글 후보 = 드롭 테이블에 있는 난이도 + 행 난이도(테이블에 없어도 기본값은 항상 노출).
  const tableDifficulties = getBossDifficulties(props.bossKey)
  const difficultyOptions = BOSS_DIFFICULTIES.filter(
    (difficulty) => tableDifficulties.includes(difficulty) || difficulty === props.difficulty,
  )

  const candidates = allCandidates.filter((candidate) => candidate.difficulties.includes(selectedDifficulty))
  const fixedGroups = allFixedGroups.filter((group) => group.difficulty === selectedDifficulty)
  const byCategory = new Map<SelectableDropCategory, DropCandidate[]>()
  for (const candidate of candidates) {
    const list = byCategory.get(candidate.category) ?? []
    list.push(candidate)
    byCategory.set(candidate.category, list)
  }
  const isEmpty = candidates.length === 0 && fixedGroups.length === 0

  // 드롭 결과 하나가 이 후보(일반 아이템/상자)와 일치하는지. 아이템 key 로 맞춘다.
  function isNormalDropOf(drop: RecordedDrop, key: string): boolean {
    return drop.itemKey === key && drop.boxOrigin === undefined
  }
  function findNormalDrop(key: string): RecordedDrop | undefined {
    return selected.find((drop) => isNormalDropOf(drop, key))
  }
  function findBoxDrop(boxKey: string): RecordedDrop | undefined {
    return selected.find((drop) => drop.boxOrigin !== undefined && drop.boxOriginKey === boxKey)
  }

  // 난이도 변경(미완료 전용). 이미 선택된 드롭 중 새 난이도에 존재하는 것만 유지하고 나머지는
  // 초기화한다. 상자 결과는 상자가 새 난이도 후보에 있으면 유지(타일 기준이 상자 key 라).
  // 타일 key 가 없는 옛 기록은 판정하지 않고 남긴다. 못 찾은 것이 못 먹은 것은 아니다.
  function selectDifficulty(next: BossDifficulty): void {
    if (next === selectedDifficulty) return
    const availableTileKeys = getObtainableTileKeys(props.bossKey, next, props.periodKey)
    setSelected((prev) =>
      prev.filter((drop) => {
        const tileKey = dropTileKey(drop)
        return tileKey === null || availableTileKeys.has(tileKey)
      }),
    )
    setSelectedDifficulty(next)
  }

  function toggleNormal(candidate: DropCandidate): void {
    const isAdding = findNormalDrop(candidate.key) === undefined
    const added: RecordedDrop = {
      category: candidate.category,
      itemKey: candidate.key,
      itemName: candidate.name,
      slot: candidate.slot,
      quantity: 1,
    }
    setSelected((prev) => {
      if (!isAdding) {
        return prev.filter((drop) => !isNormalDropOf(drop, candidate.key))
      }
      return [...prev, added]
    })
    if (isAdding && effectEnabled && isValuableDropItem(candidate.key)) {
      setEffect({ itemKey: candidate.key })
    }
  }

  function applyBoxResult(
    box: { key: string; name: string },
    category: DropCategory,
    itemKey: string,
    ringLevel?: number,
  ): void {
    const added: RecordedDrop = {
      category,
      itemKey,
      itemName: dropItemNameOf(itemKey, itemKey),
      boxOriginKey: box.key,
      boxOrigin: box.name,
      ringLevel,
      quantity: 1,
    }
    setSelected((prev) => [...prev.filter((drop) => !(drop.boxOrigin !== undefined && drop.boxOriginKey === box.key)), added])
    setActiveBox(null)
    if (effectEnabled && isValuableDropItem(itemKey)) {
      setEffect({ itemKey })
    }
  }
  function removeBoxResult(boxKey: string): void {
    setSelected((prev) => prev.filter((drop) => !(drop.boxOrigin !== undefined && drop.boxOriginKey === boxKey)))
  }

  /**
   * 가격 필드만 갈아 끼우는 수정. 객체 정체(===)로 찾는다. 같은 보스에 같은 아이템을 두 개 먹은
   * 경우를 기록이 구분하지 않으므로 이름으로 찾으면 둘 다 바뀐다.
   */
  function applyPrice(target: RecordedDrop, patch: Partial<RecordedDrop>): void {
    setSelected((prev) => prev.map((drop) => (drop === target ? { ...drop, ...patch } : drop)))
  }

  /**
   * 가격 카드를 연다. `items` 는 이 연쇄가 도는 전부이고 `index` 는 지금 자리다.
   *
   * 앞뒤로 오갈 수 있어야 해서 남은 것을 잘라 나가지 않고 **자리 번호**로 돈다. `edits` 는 이
   * 연쇄 안에서 매긴 값이다. `applyPrice` 는 상태를 갈아 끼우지만 `items` 가 든 것은 열 때의
   * 모습이라, 이것이 없으면 이전으로 돌아갔을 때 방금 매긴 값이 안 보인다.
   *
   * 자리를 벗어나면 닫는다. 확인은 카드가 스스로 닫지만 기록 안함은 안 닫아서, 마지막 건을
   * 그것으로 끝내면 빈 카드가 남는다.
   */
  function openPriceCard(items: RecordedDrop[], index: number, edits = new Map<number, PriceEdit>()): void {
    const target = items[index]
    if (target === undefined || props.pricing === undefined) {
      closeInputCard()
      return
    }
    const { defaultShare, characterName } = props.pricing
    const edit = edits.get(index)
    const 마지막 = index === items.length - 1
    /** 값이 매겨질 개수. 지금 칸이 빈 채로 끝나는 경우와 채워 끝나는 경우가 다르다. */
    const 매긴것 = items.filter(
      (drop, at) => at !== index && (edits.has(at) || drop.priceState === 'entered'),
    ).length
    const 지금매김 = edit !== undefined || target.priceState === 'entered'

    /** 값을 쓰고 자리를 옮긴다. 빈 칸이면 아무것도 안 쓴다. */
    function move(to: number, next: string, share?: ShareValue): void {
      const 다음편집 = new Map(edits)
      if (next !== '') {
        const meso = mesoValueOf(next)
        const 비율 = share ?? defaultShare
        applyPrice(target, {
          priceState: 'entered',
          priceMeso: meso,
          priceShare: 비율.sharesTotal,
          priceMyShare: 비율.myShare,
        })
        다음편집.set(index, { meso, share: 비율 })
      }
      openPriceCard(items, to, 다음편집)
    }

    openInputCard({
      // 머리가 그 아이템을 말한다. `판매 가격` 이라는 말은 이미 누른 버튼이 했다.
      label: dropItemNameOf(target.itemKey, target.itemName),
      context: `${characterName} · ${bossNameOf(props.bossKey, props.bossKey)}`,
      icon: dropItemIconOf(target.itemKey) ?? 'meso',
      unit: '메소',
      reading: true,
      chips: MESO_QUICK_ADDS,
      value: mesoTextOf(edit?.meso ?? target.priceMeso ?? 0),
      share: {
        label: '분배 비율',
        myShare: edit?.share.myShare ?? target.priceMyShare ?? defaultShare.myShare,
        sharesTotal: edit?.share.sharesTotal ?? target.priceShare ?? defaultShare.sharesTotal,
      },
      // 버튼 글자가 **지금 누르면 무슨 일이 나는가**를 말한다. 저장과 다음을 두 버튼으로
      // 두었더니 어느 쪽이 값을 쓰는지가 안 읽혔다(사용자 지적).
      ...confirmLabels({ 하나: items.length === 1, 마지막, 자리: index, 전체: items.length, 매긴것, 지금매김 }),
      exclude: {
        label: '기록 안함',
        onPress: () => {
          applyPrice(target, {
            priceState: 'excluded',
            priceMeso: undefined,
            priceShare: undefined,
            priceMyShare: undefined,
          })
          const 다음편집 = new Map(edits)
          다음편집.delete(index)
          openPriceCard(items, index + 1, 다음편집)
        },
      },
      prev:
        index > 0
          ? { label: `이전(${index}/${items.length})`, onPress: (next, share) => move(index - 1, next, share) }
          : undefined,
      onConfirm: (next, share) => move(index + 1, next, share),
    })
  }

  /** 아직 값도 기록 안함도 안 정한 것. `가격 입력` 이 여는 차례이고 카드의 확인이 잇는다. */
  const unpriced = selected.filter((drop) => drop.priceState === undefined)
  /** 확인 줄이 할 말. 갈래가 다섯이라 `lib/drop/drop-prompt` 가 정한다. */
  const prompt = dropPromptOf(selected)

  function handleTileTap(candidate: DropCandidate): void {
    if (isBoxItem(candidate.key)) {
      // 이미 결과가 지정된 상자를 다시 탭하면 드릴다운을 열지 않고 선택을 제거한다(일반 아이템 토글과 동일).
      if (findBoxDrop(candidate.key) !== undefined) {
        removeBoxResult(candidate.key)
      } else {
        setActiveBox({ key: candidate.key, name: candidate.name, category: candidate.category })
      }
    } else {
      toggleNormal(candidate)
    }
  }

  return (
    <>
      <BottomSheet onClose={props.onClose} testId="boss-drop-sheet" label="드롭 아이템 기록">
        {activeBox === null ? (
          <View>
            <View className="flex-row items-center gap-2 px-4 pb-1 pt-1">
              <Text className="text-lg font-bold text-text">{bossNameOf(props.bossKey, props.bossKey)}</Text>
              <EffectToggle on={effectEnabled} onToggle={() => void setEffectEnabled(!effectEnabled)} />
            </View>
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pb-3">
              <Text className="text-xs text-text-muted">획득한 아이템을 선택하세요</Text>
              {props.isComplete ? (
                // 완료: 완료된 난이도만 표시(선택 불가). 미완료 토글과 동일하게 오른쪽 끝 정렬.
                <View className="ml-auto">
                  <Badge variant={props.difficulty}>
                    {DIFFICULTY_NAME[props.difficulty]}
                  </Badge>
                </View>
              ) : (
                // 미완료: 드롭 테이블 난이도를 선택 버튼으로 나열(오른쪽 끝 정렬), 선택 안 된 것은 흐림 처리
                <View className="ml-auto flex-row flex-wrap items-center gap-1.5">
                  {difficultyOptions.map((difficulty) => {
                    const active = difficulty === selectedDifficulty
                    return (
                      <Pressable
                        key={difficulty}
                        role="button"
                        aria-label={DIFFICULTY_NAME[difficulty]}
                        aria-selected={active}
                        onPress={() => selectDifficulty(difficulty)}
                        className={active ? '' : 'opacity-40'}
                      >
                        <Badge variant={difficulty}>
                          {DIFFICULTY_NAME[difficulty]}
                        </Badge>
                      </Pressable>
                    )
                  })}
                </View>
              )}
            </View>

            {isEmpty ? (
              <View className="px-4 pb-4">
                <EmptyState
                  icon={PackageOpenIcon}
                  title="이 보스의 드롭 데이터가 아직 없습니다"
                  description="드롭 목록이 준비되면 여기에서 바로 입력할 수 있습니다"
                />
              </View>
            ) : (
              <>
                {DISPLAY_ORDER.filter((category) => byCategory.has(category)).map((category) => {
                  const { label, Icon } = CATEGORY_META[category]
                  return (
                    <View key={category} className="px-4 pb-3">
                      <View className="mb-2 flex-row items-center gap-2">
                        <View className="h-6 w-6 items-center justify-center rounded-lg bg-third-tint">
                          <Icon className="h-3.5 w-3.5 text-third-ink" aria-hidden />
                        </View>
                        <Text className="text-xs font-bold text-text-muted">{label}</Text>
                      </View>
                      {/*
                        **한 줄로 굴린다.** 계열마다 몇 개인지가 시트 높이를 안 정하게 하려는
                        것이다. 390 폭에 다섯이 보이고 여섯째가 반쯤 걸치는데, 그 걸친 타일이
                        곧 더 있다는 신호라 화살표나 점을 안 그린다.

                        가로 여백을 `contentContainer` 가 아니라 바깥에서 지운다(`-mx-4 px-4`).
                        그래야 굴러 나간 타일이 시트 가장자리까지 간다.
                      */}
                      <ScrollView
                        testID={`drop-tile-row-${category}`}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="-mx-4"
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                      >
                        {(byCategory.get(category) ?? []).map((candidate) => {
                          const box = isBoxItem(candidate.key)
                          const boxDrop = box ? findBoxDrop(candidate.key) : undefined
                          const normalDrop = box ? undefined : findNormalDrop(candidate.key)
                          const on = box ? boxDrop !== undefined : normalDrop !== undefined
                          // 상자 타일에는 나온 내용물이 선다.
                          const displayName =
                            boxDrop === undefined ? candidate.name : dropItemNameOf(boxDrop.itemKey, boxDrop.itemName)
                          const thumbKey = boxDrop === undefined ? candidate.key : boxDrop.itemKey
                          return (
                            <Pressable
                                key={candidate.key}
                                role="button"
                                aria-label={displayName}
                                aria-selected={on}
                                onPress={() => handleTileTap(candidate)}
                                className={`w-[72px] items-center gap-1 rounded-xl border p-2 pt-4 ${
                                  on ? 'border-primary bg-primary-tint' : 'border-border bg-surface'
                                } ${box ? 'border-dashed' : ''}`}
                              >
                                {/*
                                  **고른 것에는 표식을 안 단다**(사용자 지정). 테두리와 바탕이
                                  이미 그 말을 한다.

                                  값을 매긴 타일은 **얼마인지를 말한다**(사용자 지정). 그림
                                  아래를 덮는 띠에 금액이 선다. 표식만 달면 카드를 열어야 얼마인지
                                  알 수 있었다. 띠가 그림 위에 겹치는 것은 게임 인벤토리가 수량을
                                  얹는 자리와 같아서 낯익다.

                                  **알약은 글자만큼만 넓다**(사용자 지정). 폭을 못박으면 `1억` 에는
                                  빈자리가 남고 긴 금액은 넘친다. 자리는 그림 아래 가운데다.

                                  금액은 **축약 표기**다(`formatMesoCompact`). 단위를 이어 붙인
                                  `32억 5천만` 은 72 폭에 안 들어가서 `32.5억` 으로 접는다(사용자
                                  지정). 바깥 상자가 `-mx-1.5` 로 타일 여백을 되먹어 68 을 쓴다.

                                  스킵은 기록된 가격이 아니므로 표식이 없다. 그 구분은 아이템
                                  가격 입력 화면이 맡는다.
                                */}
                                <View className="-mx-1.5 items-center">
                                  <ItemThumb itemKey={thumbKey} level={boxDrop?.ringLevel} />
                                  <TileLabel drop={boxDrop ?? normalDrop} />
                                </View>
                                <View className="h-8 w-full items-center justify-center">
                                  <Text numberOfLines={2} className="text-center text-10 leading-tight text-text">
                                    {displayName}
                                  </Text>
                                </View>
                              </Pressable>
                          )
                        })}
                      </ScrollView>
                    </View>
                  )
                })}

                {fixedGroups.length > 0 && (
                  <View className="px-4 pb-3">
                    <View className="mb-2 flex-row items-center gap-2">
                      <View className="h-6 w-6 items-center justify-center rounded-lg bg-third-tint">
                        <PinIcon className="h-3.5 w-3.5 text-third-ink" aria-hidden />
                      </View>
                      <Text className="text-xs font-bold text-text-muted">고정</Text>
                    </View>
                    {/* 고정 드롭은 값이 난이도마다 달라 통합하지 않고 난이도별 카드로 읽기 전용
                        표시한다. 텍스트 대신 아이콘 + 수량, 솔 에르다는 단위별로 분해한다.
                        배치는 1→1열, 2·4→2열, 3→2열 + 마지막 1개 전폭. */}
                    <View className="-mx-1 -mb-2 flex-row flex-wrap">
                      {fixedGroups.map((group, index) => (
                        <View
                          key={group.difficulty}
                          className={
                            fixedGroups.length === 1 || (fixedGroups.length === 3 && index === 2)
                              ? 'w-full px-1 pb-2'
                              : 'w-1/2 px-1 pb-2'
                          }
                        >
                          {/*
                            **배지는 자리를 안 먹는다**(사용자 지정). 처음엔 자기 줄을 먹었고,
                            같은 줄로 합쳤더니 이번엔 가로를 먹어 드롭 목록이 오른쪽으로 밀렸다.
                            띄워서 좌상단에 얹는다.

                            그래서 드롭 목록은 **상자 전체 폭**에서 가운데로 선다. 위아래 여백은
                            아이템 기준으로 같고, 배지가 얹히는 자리를 벌어야 해서 예전보다 넓다.
                          */}
                          <View
                            testID={`fixed-drop-row-${group.difficulty}`}
                            className="rounded-xl border border-border bg-surface px-2 py-4"
                          >
                            <View testID={`fixed-drop-badge-${group.difficulty}`} className="absolute left-2 top-2">
                              <Badge variant={group.difficulty}>
                                {DIFFICULTY_NAME[group.difficulty]}
                              </Badge>
                            </View>
                            <View
                              testID={`fixed-drop-items-${group.difficulty}`}
                              className="flex-row flex-wrap items-center justify-center gap-x-2 gap-y-2.5"
                            >
                              {group.items.flatMap((item) =>
                                getFixedDropIcons(item).map((icon, i) => (
                                  <FixedDropIcon key={`${item.key}-${icon.iconFile ?? 'item'}-${i}`} icon={icon} />
                                )),
                              )}
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

            <View className="border-t border-border bg-bg px-4 pb-3 pt-3">
              {/* 기록 직후 그 아이템 하나에 대해 값을 매길지 묻는다. 흐름은 기록 → 확인 →
                  (입력 →) 복귀 이고 어느 갈래든 타일 그리드로 돌아온다. 차단하지 않는다.
                  일반 아이템은 확인창 없이 탭 즉시 기록된다. 기록은 이미 끝났고 이 줄은 그 옆에
                  설 뿐이라 무시하고 다음 아이템을 계속 골라도 된다. */}
              {prompt !== null && props.pricing !== undefined && (
                // **평평하다**(사용자 지정). 시트 바닥에 붙어 있는데 그림자가 있으면 시트 위에 뜬
                // 또 하나의 판으로 읽힌다. 실제로는 아래 저장 줄과 같은 층이다.
                //
                // **고른 것이 있는 한 선다**(사용자 지정). 치우는 버튼을 안 둔다. 치우면 남은
                // 미입력 건으로 돌아갈 길이 시트 안에 없어진다.
                <View
                  testID="drop-price-prompt"
                  className="mb-2.5 flex-row items-center gap-2 rounded-[14px] bg-surface-2 px-3 py-2"
                >
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-[12.5px] font-semibold leading-tight text-text">
                      {prompt.title}
                    </Text>
                    {prompt.detail !== '' && (
                      <Text numberOfLines={1} className="text-[12.5px] font-medium leading-tight text-text-muted">
                        {prompt.detail}
                      </Text>
                    )}
                  </View>
                  {/* 다 정했으면 여는 차례가 고른 것 전체다. 남은 것이 없으니 고치러 들어간다. */}
                  <Pressable
                    role="button"
                    onPress={() => openPriceCard(unpriced.length > 0 ? unpriced : selected, 0)}
                    className="shrink-0 rounded-full bg-primary px-3 py-1.5"
                  >
                    <Text className="text-[12.5px] font-bold text-on-primary">
                      {unpriced.length > 0 ? '가격 입력' : '가격 수정'}
                    </Text>
                  </Pressable>
                </View>
              )}
              <Pressable
                role="button"
                onPress={() => {
                  props.onSave(selected)
                  props.onClose()
                }}
                className="w-full items-center rounded-xl bg-primary py-3"
              >
                <Text className="text-sm font-bold text-on-primary">
                  추가 완료{selected.length > 0 ? ` · ${selected.length}개` : ''}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <BoxDrillDown
            boxKey={activeBox.key}
            boxName={activeBox.name}
            category={activeBox.category}
            onBack={() => setActiveBox(null)}
            onConfirm={(itemKey, ringLevel) => applyBoxResult(activeBox, activeBox.category, itemKey, ringLevel)}
          />
        )}
      </BottomSheet>

      {effect !== null && (
        <DropEffectOverlay itemKey={effect.itemKey} onClose={() => setEffect(null)} />
      )}
    </>
  )
}

interface BoxDrillDownProps {
  boxKey: string
  boxName: string
  category: DropCategory
  onBack: () => void
  onConfirm: (itemKey: string, ringLevel?: number) => void
}

// 랜덤 상자 결과 선택. 반지 상자=등급+반지 2축, 칠흑 장신구=1축. 확률 자동추정 없음.
// 이미 지정된 상자는 타일 재탭으로 제거하므로 이 화면은 항상 새 선택 전용. 제거 버튼 없음.
function BoxDrillDown(props: BoxDrillDownProps): React.JSX.Element {
  const ring = getRingBoxContents(props.boxKey)
  const accessory = ring === null ? getAccessoryBoxContents(props.boxKey) : null

  const [level, setLevel] = useState<number | null>(null)
  const [item, setItem] = useState<string | null>(null)

  // 선택한 반지의 레벨 유무. 연마석(hasLevel=false)은 레벨 선택을 비활성하고 레벨 없이 기록.
  const selectedOption = ring?.rings.find((r) => r.key === item) ?? null
  const needsLevel = selectedOption?.hasLevel ?? false
  const levelDisabled = selectedOption !== null && !selectedOption.hasLevel

  const canConfirm = item !== null && (ring === null ? true : needsLevel ? level !== null : true)

  return (
    <View>
      <View className="flex-row items-center gap-2 px-4 pb-3 pt-1">
        <Pressable role="button" onPress={props.onBack} aria-label="뒤로">
          <ChevronLeftIcon className="h-6 w-6 text-text" aria-hidden />
        </Pressable>
        <Text className="text-lg font-bold text-text">{props.boxName}</Text>
      </View>

      {/* 반지 종류 먼저 선택 */}
      <View className="px-4 pb-3">
        <Text className="mb-2 text-xs font-bold text-text-muted">{ring !== null ? '반지' : '장신구'}</Text>
        <View className="-mx-1 -mb-2 flex-row flex-wrap">
          {(ring?.rings ?? accessory ?? []).map((entry) => (
            <View key={entry.key} className="w-1/4 px-1 pb-2">
              <Pressable
                role="button"
                aria-label={entry.name}
                aria-selected={item === entry.key}
                onPress={() => setItem(entry.key)}
                className={`w-full items-center gap-1 rounded-xl border p-2 pt-4 ${
                  item === entry.key ? 'border-primary bg-primary-tint' : 'border-border bg-surface'
                }`}
              >
                {item === entry.key && (
                  <View className="absolute right-1 top-1 h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <Text className="text-10 text-on-primary">✓</Text>
                  </View>
                )}
                <ItemThumb itemKey={entry.key} />
                <View className="h-8 w-full items-center justify-center">
                  <Text numberOfLines={2} className="text-center text-10 leading-tight text-text">
                    {entry.name}
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      {/* 그다음 레벨(등급). 항상 보이되 연마석 선택 시에만 비활성 */}
      {ring !== null && (
        <View className="px-4 pb-3">
          <Text className="mb-2 text-xs font-bold text-text-muted">등급</Text>
          <View className="flex-row gap-1.5">
            {ring.levels.map((lvl) => (
              <Pressable
                key={lvl}
                role="button"
                aria-label={`${lvl}레벨`}
                disabled={levelDisabled}
                onPress={() => setLevel(lvl)}
                className={`flex-1 items-center rounded-lg border py-2 ${
                  level === lvl && !levelDisabled ? 'border-primary bg-primary-tint' : 'border-border'
                }${levelDisabled ? ' opacity-40' : ''}`}
              >
                <Text
                  className={`text-xs font-bold ${
                    level === lvl && !levelDisabled ? 'text-primary-ink' : 'text-text-muted'
                  }`}
                >
                  {lvl}레벨
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View className="border-t border-border bg-bg px-4 pb-3 pt-3">
        <Pressable
          role="button"
          disabled={!canConfirm}
          onPress={() => {
            if (item !== null) props.onConfirm(item, needsLevel ? (level ?? undefined) : undefined)
          }}
          className={`w-full items-center rounded-xl bg-primary py-3${canConfirm ? '' : ' opacity-40'}`}
        >
          <Text className="text-sm font-bold text-on-primary">이 결과로 기록</Text>
        </Pressable>
      </View>
    </View>
  )
}
