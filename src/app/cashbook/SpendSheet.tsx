/**
 * 지출 기록 시트 — **고르면 채워진다**([[ADR-166]] · [[ADR-170]] 결정 6).
 *
 * ## 자기가 어느 갈래인지 모른다
 *
 * 수입/지출 세그먼트가 없다. 갈래는 **펼침판이 시트 밖에서** 갈랐고([[ADR-170]] 결정 6) 이 시트는
 * 「지출」이라는 사실조차 프롭으로 받지 않는다 — 애초에 지출만 그리는 컴포넌트다. 나중에 진입점을
 * 바꿔도 여기가 안 바뀌는 것이 그 결정이 산 값이다.
 *
 * ## 금액을 안 친다
 *
 * 사용자가 준 24항목에 **전부 가격이 붙어 있다**([[ADR-166]] 정정 1 ①). 그래서 이 시트에는
 * 앞 키패드가 없고, 고르면 단가가 그대로 금액이 되며 수량만 조절한다. 곱셈은 **앱이 한다** —
 * 사용자가 대신하면 «몇 포인트 썼나» 를 나중에 되물을 수 없다(정정 1 ③).
 *
 * ## 지금은 목록 갈래 셋뿐이다
 *
 * 직접 입력 둘(아이템 구매 · 기타)은 **앞 키패드가 서야 성립한다.** 그때까지 **누를 수 없는 칩을
 * 세우지 않는다** — [[ADR-132]] 결정 12 의 껍데기를 되풀이하지 않는다. 칩 목록은 하드코딩이 아니라
 * **«목록이 있는 갈래»로 파생**하므로, 키패드가 서면 이 파일에서 지울 것이 없다.
 *
 * ## 날짜는 고르지 않는다
 *
 * 머리에 **어느 날에 적히는지**를 적되 여기서 바꾸지는 않는다 — 날짜는 캘린더에서 칸을 눌러
 * 고르는 것이고, 그것이 이 시트를 여는 경로다. 시트에 날짜 고르개를 또 두면 같은 값을 정하는
 * 자리가 둘이 된다.
 */
import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'

import { Text } from '../../components/atoms/Text/Text'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { formatDayLabel } from '../../lib/calendar-month'
import { MinusIcon, PlusIcon } from '../../lib/icons'
import { formatMesoCompact } from '../../lib/meso-compact'
import {
  pointToMeso,
  spendGroupsOf,
  type SpendCatalogItem,
} from '../../lib/spend-catalog'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { SPEND_CATEGORIES, type SpendCategory, type SpendRecord } from '../../storage/spend'

/** 저장할 값에서 **어댑터가 아니라 화면이 정하는 것 둘**(`id`·`recordedAt`)을 뺀 나머지. */
export type SpendDraft = Omit<SpendRecord, 'id' | 'recordedAt'>

/**
 * 칩에 세울 갈래 — **목록이 있는 것만**이다. 하드코딩이 아니라 파생이라, 직접 입력 둘이 설 수
 * 있게 되는 날(앞 키패드) 이 줄이 저절로 다섯이 된다.
 */
const LIST_CATEGORIES = SPEND_CATEGORIES.filter((category) => spendGroupsOf(category).length > 0)

function CategoryChip(props: {
  label: string
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-selected={props.selected}
      onPress={props.onPress}
      className={`rounded-full border px-3 py-1.5 ${
        props.selected ? 'border-transparent bg-primary' : 'border-border'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          props.selected ? 'text-on-primary' : 'text-text-muted'
        }`}
      >
        {props.label}
      </Text>
    </Pressable>
  )
}

function ItemTile(props: {
  item: SpendCatalogItem
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  const { item } = props
  return (
    <Pressable
      role="button"
      aria-label={item.name}
      aria-selected={props.selected}
      onPress={props.onPress}
      className={`w-1/3 shrink-0 p-1`}
    >
      <View
        className={`h-full items-center gap-1 rounded-xl border px-2 py-2.5 ${
          props.selected ? 'border-primary bg-primary-tint' : 'border-border bg-surface'
        }`}
      >
        <Text numberOfLines={2} className="text-center text-[11px] leading-4 text-text">
          {item.name}
        </Text>
        <Text
          className={`text-[11px] ${props.selected ? 'text-primary-ink' : 'text-text-muted'}`}
          style={TABULAR_NUMS}
        >
          {item.unitPrice.toLocaleString()}
        </Text>
      </View>
    </Pressable>
  )
}

/**
 * 수량 스테퍼 — `PartySizeStepper` 로 접지 않는다.
 *
 * 그 molecule 은 `Users` 표식과 「명」이 박혀 있어 **파티 인원 전용**이다. 단위가 항목마다 다른
 * (회 · 개 · 포인트 · 시간) 이 자리에 그것을 끌어오면 프롭이 둘 늘고 그림이 흐려진다 —
 * `DropPricePad` 가 «넷째 모양을 만들지 않고 자체 마크업으로» 둔 것과 같은 판단이다.
 */
function QuantityStepper(props: {
  value: number
  unit: string
  onChange: (next: number) => void
}): React.JSX.Element {
  const canDecrease = props.value > 1
  return (
    <View className="h-9 flex-row items-center gap-3 rounded-full border border-border px-2">
      <Pressable
        role="button"
        aria-label="수량 줄이기"
        disabled={!canDecrease}
        onPress={() => props.onChange(props.value - 1)}
        hitSlop={8}
      >
        {/* NativeWind 의 `disabled:` 는 RN 의 `disabled` 프롭과 안 이어져 있다 — JS 조건으로 쓴다
            (`PartySizeStepper` ① 과 같은 함정). */}
        <MinusIcon
          className={`h-4 w-4 ${canDecrease ? 'text-text' : 'text-text-disabled'}`}
          strokeWidth={2}
          aria-hidden
        />
      </Pressable>
      <Text className="min-w-6 text-center text-sm font-bold text-text" style={TABULAR_NUMS}>
        {props.value}
      </Text>
      <Pressable
        role="button"
        aria-label="수량 늘리기"
        onPress={() => props.onChange(props.value + 1)}
        hitSlop={8}
      >
        <PlusIcon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
      </Pressable>
      <Text testID="spend-sheet-quantity-unit" className="text-[11px] text-text-muted">
        {props.unit}
      </Text>
    </View>
  )
}

export interface SpendSheetProps {
  /** 어느 날에 적히나 — 캘린더에서 고른 날이다. */
  dateKey: string
  /**
   * 마지막으로 쓴 메소마켓 시세([[ADR-166]] 결정 5). 필수 칸이 매번 비어 있으면 입력이 막히므로
   * «기억한다» 가 여기서 결정적이다. `null` 이면 아직 한 번도 안 넣었다는 뜻이다.
   */
  lastPointRate: number | null
  onSave: (draft: SpendDraft) => void
  onClose: () => void
}

export function SpendSheet(props: SpendSheetProps): React.JSX.Element {
  const [category, setCategory] = useState<SpendCategory>(LIST_CATEGORIES[0])
  const [item, setItem] = useState<SpendCatalogItem | null>(null)
  const [quantity, setQuantity] = useState(1)

  const groups = spendGroupsOf(category)
  const usesPoint = item?.currency === 'point'
  // 시세는 메포 항목에만 뜻이 있다 — 메소 항목에서 물어보면 «왜 묻나» 가 된다.
  const rate = usesPoint ? props.lastPointRate : null
  const amount = item === null ? 0 : item.unitPrice * quantity
  const totalMeso = usesPoint ? pointToMeso(amount, rate ?? 0) : amount
  // 메포를 쓰는데 시세가 없으면 **막는다** — 저장하면 영영 메소로 표시할 수 없는 행이 된다
  // ([[ADR-166]] 정정 2 ③). 어댑터도 같은 것을 막지만 화면이 먼저 알려 주는 편이 낫다.
  const canSave = item !== null && (!usesPoint || (rate !== null && rate > 0))

  function selectCategory(next: SpendCategory): void {
    setCategory(next)
    // 고르던 항목을 **푼다** — 남겨 두면 «컨텐츠를 골랐는데 버프 항목이 저장되는» 일이 생긴다.
    setItem(null)
    setQuantity(1)
  }

  function selectItem(next: SpendCatalogItem): void {
    setItem(next)
    // 대상이 바뀌면 수량을 되돌린다 — `DropPricePad` 가 금액을 되돌리는 것과 같은 이유다.
    setQuantity(1)
  }

  function save(): void {
    if (item === null) return
    props.onSave({
      ocid: null,
      spentOn: props.dateKey,
      category,
      item: item.name,
      quantity,
      mesoAmount: usesPoint ? null : amount,
      tariffMeso: null,
      pointAmount: usesPoint ? amount : null,
      pointPer100mMeso: usesPoint ? rate : null,
      cashAmount: null,
      memo: null,
    })
    props.onClose()
  }

  return (
    <BottomSheet testId="spend-sheet" onClose={props.onClose}>
      <View className="gap-3 px-4 pb-2">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="text-base font-bold text-text">지출 추가</Text>
          <Text
            testID="spend-sheet-date"
            className="text-xs text-text-muted"
            style={TABULAR_NUMS}
          >
            {formatDayLabel(props.dateKey)}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-1.5">
          {LIST_CATEGORIES.map((each) => (
            <CategoryChip
              key={each}
              label={each}
              selected={each === category}
              onPress={() => selectCategory(each)}
            />
          ))}
        </View>

        <ScrollView className="max-h-72">
          {groups.map((group) => (
            <View key={group.group} className="gap-1 pb-2">
              <Text className="text-[11px] text-text-disabled">{group.group}</Text>
              {/* 퍼센트 폭과 `gap` 을 섞으면 마지막 칸이 밀린다 — 간격은 자식 패딩이 만든다
                  (`BossDropSheet` ①과 같은 처방). */}
              <View className="-mx-1 flex-row flex-wrap">
                {group.items.map((each) => (
                  <ItemTile
                    key={each.name}
                    item={each}
                    selected={each.name === item?.name}
                    onPress={() => selectItem(each)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {item !== null && (
          <View className="gap-2 rounded-xl border border-border bg-surface p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-text-muted">수량</Text>
              <QuantityStepper value={quantity} unit={item.unit} onChange={setQuantity} />
            </View>

            {usesPoint && (
              <View className="flex-row items-center justify-between border-t border-border pt-2">
                <Text className="text-xs text-text-muted">시세 · 1억당</Text>
                <Text
                  testID="spend-sheet-rate"
                  className={`text-sm font-semibold ${rate === null ? 'text-error-ink' : 'text-text'}`}
                  style={TABULAR_NUMS}
                >
                  {rate === null ? '시세를 넣어야 저장할 수 있어요' : `${rate.toLocaleString()} 메포`}
                </Text>
              </View>
            )}

            <View className="flex-row items-baseline justify-between border-t border-border pt-2">
              <Text className="text-xs font-semibold text-text">합계</Text>
              <Text
                testID="spend-sheet-total"
                className="text-lg font-bold text-fall-ink"
                style={TABULAR_NUMS}
              >
                −{formatMesoCompact(totalMeso)}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          role="button"
          aria-label="저장"
          disabled={!canSave}
          onPress={save}
          className={`items-center rounded-xl py-3 ${canSave ? 'bg-primary' : 'bg-surface-2'}`}
        >
          <Text
            className={`text-sm font-bold ${canSave ? 'text-on-primary' : 'text-text-disabled'}`}
          >
            저장
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  )
}
