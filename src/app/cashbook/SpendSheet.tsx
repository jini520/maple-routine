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
import { Pressable, View } from 'react-native'

// `TextInput` 도 atom 에서 온다 — 시스템 글자 크기 클램프가 거기 있다([[ADR-152]] 결정 4).
import { Text, TextInput } from '../../components/atoms/Text/Text'
import { MesoAmountField } from '../../components/molecules/MesoPad/MesoAmountField'
import { MesoKeypad } from '../../components/molecules/MesoPad/MesoKeypad'
import { applyMesoKey } from '../../components/molecules/MesoPad/meso-pad'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { formatDayLabel } from '../../lib/calendar-month'
import { CheckIcon, ChevronLeftIcon, MinusIcon, PlusIcon } from '../../lib/icons'
import { formatMesoCompact } from '../../lib/meso-compact'
import {
  SPEND_TARIFF_PERCENT,
  pointToMeso,
  spendGroupsOf,
  withTariffMeso,
  type SpendCatalogChoice,
  type SpendCatalogItem,
} from '../../lib/spend-catalog'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { SPEND_CATEGORIES, type SpendCategory, type SpendRecord } from '../../storage/spend'

/** 저장할 값에서 **어댑터가 아니라 화면이 정하는 것 둘**(`id`·`recordedAt`)을 뺀 나머지. */
export type SpendDraft = Omit<SpendRecord, 'id' | 'recordedAt'>

/** 「기타」가 고르는 통화 셋([[ADR-166]] 결정 1 · 정정 1 ④) — **캐시가 사는 유일한 자리**다. */
const FREE_CURRENCIES = [
  { id: 'meso', label: '메소', unit: '메소' },
  { id: 'point', label: '메포', unit: '메포' },
  { id: 'cash', label: '캐시', unit: '원' },
] as const

type FreeCurrency = (typeof FREE_CURRENCIES)[number]['id']

/** 고를 목록이 없는 갈래 — 금액을 **친다**([[ADR-166]] 정정 1 ②). */
function isDirectInput(category: SpendCategory): boolean {
  return spendGroupsOf(category).length === 0
}

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

/**
 * 타일에 적는 값 — **단위를 붙이고, 단계가 여럿이면 나란히 적는다.**
 *
 * 단위를 붙이는 이유는 갈래 하나 안에서 통화가 갈리는 곳이 있어서다(「버프」의 영약은 메소,
 * 보약은 메포 — [[ADR-166]] 정정 1 ②). 숫자만 적으면 «2,000,000» 이 메소인지 메포인지 모른다.
 *
 * **메소만 줄여 적는다**(`formatMesoCompact`). 메포는 200~50,000 이라 그대로가 읽히지만 메소는
 * 백만 단위라 1/3 폭 타일에서 잘린다 — 그 좁은 칸을 위해 있는 함수가 그것이다.
 *
 * 단계가 여럿이면 **`7,500 | 30,000 메포`** 로 붙여 적는다(사용자 지정 2026-08-25). 한 대표 안의
 * 단계는 통화가 같으므로 단위는 **한 번만** 적는다.
 *
 * 1/3 폭 칸에 안 들어가면 **줄을 바꾸지 않고 글자를 줄인다**(`numberOfLines` + `adjustsFontSizeToFit`)
 * — 줄이 바뀌면 그 타일만 키가 커지고 `items-stretch` 라 같은 줄이 통째로 따라 커진다.
 */
function tilePriceLabel(items: readonly SpendCatalogItem[]): string {
  const first = items[0]
  if (first === undefined) return ''
  const numbers = items.map((item) =>
    item.currency === 'point'
      ? item.unitPrice.toLocaleString()
      : formatMesoCompact(item.unitPrice),
  )
  return `${numbers.join(' | ')} ${first.currency === 'point' ? '메포' : '메소'}`
}

function ItemTile(props: {
  label: string
  /** 값이 하나로 정해지는 칸만 가격을 적는다 — 단계가 여럿이면 단계마다 값이 달라 못 적는다. */
  price: string | null
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-selected={props.selected}
      onPress={props.onPress}
      className="w-1/3 p-1"
    >
      {/*
        **`h-full` 을 안 쓴다.** 부모(`Pressable`)의 높이가 내용에서 나오는데 거기에 백분율 높이를
        걸면 그 값이 위쪽의 늘어난 상자에서 풀려, 타일 하나가 목록 높이를 통째로 먹는다
        (iOS 실측 2026-08-25 — 여섯 중 셋만 보였다). 한 줄 안의 높이는 `flex-1` 이 맞춘다:
        줄이 `items-stretch`(기본)로 부모를 늘리고 이 상자가 그만큼 채운다.
      */}
      <View
        className={`flex-1 items-center gap-1 rounded-xl border px-2 py-2.5 ${
          props.selected ? 'border-primary bg-primary-tint' : 'border-border bg-surface'
        }`}
      >
        <Text numberOfLines={2} className="text-center text-[11px] leading-4 text-text">
          {props.label}
        </Text>
        {props.price !== null && (
          // **한 줄로 못박는다.** 두 줄이 되면 그 타일만 키가 커지고, `items-stretch` 라 같은 줄의
          // 타일이 통째로 따라 커진다. 좁으면 글자를 줄여 맞춘다.
          // (JSX 주석 `{/* */}` 은 **children 자리에서만** 쓴다 — `&& ( … )` 안은 JS 표현식이라
          //  `//` 여야 한다. 이 파일에서 세 번째로 밟았다.)
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            className={`text-[11px] ${props.selected ? 'text-primary-ink' : 'text-text-muted'}`}
            style={TABULAR_NUMS}
          >
            {props.price}
          </Text>
        )}
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
  /** 상한 — 사용자가 준 한도에서 온다. 없는 항목은 안 막는다([[ADR-006]]). */
  max?: number
  onChange: (next: number) => void
}): React.JSX.Element {
  const canDecrease = props.value > 1
  const canIncrease = props.max === undefined || props.value < props.max
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
        disabled={!canIncrease}
        onPress={() => props.onChange(props.value + 1)}
        hitSlop={8}
      >
        <PlusIcon
          className={`h-4 w-4 ${canIncrease ? 'text-text' : 'text-text-disabled'}`}
          strokeWidth={2}
          aria-hidden
        />
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
  /** 던지면 **안 닫는다** — 친 것을 잃지 않는다. 실패를 말하는 것은 화면 몫이다(토스트). */
  onSave: (draft: SpendDraft) => void | Promise<void>
  onClose: () => void
}

export function SpendSheet(props: SpendSheetProps): React.JSX.Element {
  const [category, setCategory] = useState<SpendCategory>(SPEND_CATEGORIES[0])
  /**
   * 두 단계다(사용자 지정 2026-08-25).
   *
   * ① 묶음별 **대표**를 고른다(하이마운틴 · 몬스터 파크 …).
   * ② 대표가 여러 갈래를 품으면 그 안에서 고른다 — **단계**(1·2단계)와 **형태**(경험치·솔 에르다).
   *
   * `choice` 가 «지금 어느 단계인가» 를 든다: `null` 이면 목록이 서고, 있으면 그 안이 선다.
   * 한 갈래뿐인 대표(몬스터 파크)는 고르는 즉시 `item` 까지 정해져 ②가 비어 있다.
   */
  const [choice, setChoice] = useState<SpendCatalogChoice | null>(null)
  const [item, setItem] = useState<SpendCatalogItem | null>(null)
  const [form, setForm] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  // 직접 입력 갈래의 칸들. 갈래를 오갈 때 **비우지 않는다** — 잘못 눌러 돌아왔을 때 친 것이
  // 사라지면 다시 쳐야 한다. 저장에 무엇이 쓰이는지는 아래 `direct` 가 가른다.
  const [name, setName] = useState('')
  const [typed, setTyped] = useState(0)
  const [hasTariff, setHasTariff] = useState(false)
  const [freeCurrency, setFreeCurrency] = useState<FreeCurrency>('meso')
  // 마지막으로 쓴 값으로 시작한다([[ADR-166]] 결정 5). 사용자가 고치면 그 값이 저장되고, 다음에
  // 이 시트를 열 때 다시 채워진다 — 필수 칸이 매번 비어 있으면 입력이 막힌다.
  const [rateText, setRateText] = useState(
    props.lastPointRate === null ? '' : String(props.lastPointRate),
  )
  /** 저장이 도는 동안 다시 못 누르게 막는다 — 손입력은 두 번 눌리면 행이 둘이 된다. */
  const [saving, setSaving] = useState(false)

  const groups = spendGroupsOf(category)
  const direct = isDirectInput(category)
  const forms = choice?.items[0]?.forms ?? []
  /** 단계가 여럿일 때만 ②에 단계 줄이 선다 — 하나뿐이면 고를 것이 없다. */
  const tiers = choice !== null && choice.items.length > 1 ? choice.items : []
  // 형태가 있으면 **고르기 전에는 저장할 수 없다** — 안 고르고 저장하면 그 행은 «어느 쪽인지
  // 모르는 행» 이 되고, 그것은 칸을 더한 뜻을 없앤다.
  const formMissing = forms.length > 0 && form === null
  /**
   * 통화가 어디서 오나 — 갈래마다 다르다.
   *
   * | 갈래 | 통화 |
   * |---|---|
   * | 「기타」 | **사용자가 고른다** — 캐시가 사는 유일한 자리다([[ADR-166]] 정정 1 ④) |
   * | 아이템 구매 | 언제나 **메소**다(관세는 메소로 재므로 메포 칸이 없다 — 정정 2 ②) |
   * | 목록 셋 | **항목이 안다**(`spend-catalog.json` 의 `currency`) — 「버프」는 그 안에서도 갈린다 |
   */
  const currency: FreeCurrency =
    category === '기타' ? freeCurrency : direct ? 'meso' : (item?.currency ?? 'meso')
  const usesPoint = currency === 'point'
  // 시세는 메포 항목에만 뜻이 있다 — 메소 항목에서 물어보면 «왜 묻나» 가 된다.
  const typedRate = Number(rateText)
  const rate = usesPoint && rateText !== '' && Number.isFinite(typedRate) ? typedRate : null
  // 관세는 **친 숫자를 안 바꾼다** — 아래에 한 줄로 더한다. 금액 자체를 고치면 껐다 켰다 할 때
  // 8.5억 → 9.35억 → 10.28억 으로 부푼다([[ADR-166]] 정정 2 ②).
  const tariffed = withTariffMeso(typed)
  const directAmount = currency === 'meso' && hasTariff ? tariffed.mesoAmount : typed
  const amount = direct ? directAmount : (item?.unitPrice ?? 0) * quantity

  // 캐시는 **환산하지 않는다**([[ADR-166]] 정정 2 ①) — 그래서 메소 축 합계에 안 든다.
  const totalMeso = currency === 'cash' ? 0 : usesPoint ? pointToMeso(amount, rate ?? 0) : amount
  // 메포를 쓰는데 시세가 없으면 **막는다** — 저장하면 영영 메소로 표시할 수 없는 행이 된다
  // ([[ADR-166]] 정정 2 ③). 어댑터도 같은 것을 막지만 화면이 먼저 알려 주는 편이 낫다.
  const hasSubject = direct ? typed > 0 : item !== null && !formMissing
  // **메소로 셀 수 없는 상태.** 메포를 쓰는데 시세가 없으면 환산이 성립하지 않는다 — 저장을 막는
  // 것만으로는 부족하고(사용자는 왜 막혔는지 모른다) 합계 자리가 그 사실을 말해야 한다.
  const blocked = usesPoint && (rate === null || rate <= 0)
  const canSave = hasSubject && !blocked

  function selectCategory(next: SpendCategory): void {
    setCategory(next)
    // 고르던 것을 **푼다** — 남겨 두면 «컨텐츠를 골랐는데 버프 항목이 저장되는» 일이 생긴다.
    setChoice(null)
    setItem(null)
    setForm(null)
    setQuantity(1)
    // 관세는 아이템 구매에만 있다 — 다른 갈래로 갔다가 돌아오면 켜져 있던 것이 남으면 안 된다.
    if (next !== '아이템 구매') setHasTariff(false)
  }

  /** ① 대표를 고른다. 갈래가 하나뿐이면 **그 자리에서 항목까지 정해진다.** */
  function selectChoice(next: SpendCatalogChoice): void {
    setChoice(next)
    setItem(next.items.length === 1 ? next.items[0] : null)
    // 형태는 있어도 **기본값을 안 고른다** — 앱이 «경험치였겠지» 라고 정하면 그것이 추정이 된다.
    setForm(null)
    // 대상이 바뀌면 수량을 되돌린다 — `DropPricePad` 가 금액을 되돌리는 것과 같은 이유다.
    setQuantity(1)
  }

  /** ② 그 안의 단계를 고른다. */
  function selectItem(next: SpendCatalogItem): void {
    setItem(next)
    setQuantity(1)
  }

  /** 목록으로 돌아간다. */
  function clearChoice(): void {
    setChoice(null)
    setItem(null)
    setForm(null)
    setQuantity(1)
  }


  async function save(): Promise<void> {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await props.onSave({
        ocid: null,
        spentOn: props.dateKey,
        category,
        // 빈 칸은 `null` 이다 — 빈 문자열을 넣으면 «적었는데 비어 있다» 와 «안 적었다» 가 같아진다.
        item: direct ? (name.trim() === '' ? null : name.trim()) : (item?.name ?? null),
        form: direct ? null : form,
        // 직접 입력에는 단가가 없어 곱할 것도 없다([[ADR-166]] 정정 1 ③).
        quantity: direct ? null : quantity,
        mesoAmount: currency === 'meso' ? amount : null,
        // 총액과 그 몫을 **둘 다** 박는다(정정 2 ②) — 집계는 총액 한 칸만 본다.
        tariffMeso: direct && hasTariff && currency === 'meso' ? tariffed.tariffMeso : null,
        pointAmount: currency === 'point' ? amount : null,
        pointPer100mMeso: currency === 'point' ? rate : null,
        cashAmount: currency === 'cash' ? amount : null,
        memo: null,
      })
    } catch {
      // 자리를 지킨다 — 무엇이 잘못됐는지는 화면이 띄운 토스트가 말한다.
      setSaving(false)
      return
    }
    props.onClose()
  }

  return (
    <BottomSheet
      testId="spend-sheet"
      onClose={props.onClose}
      // 갈래를 바꾸거나 단계를 오가면 내용이 통째로 갈린다 — 밀린 자리에서 시작하면 안 된다.
      resetScrollKey={`${category}|${choice?.label ?? ''}`}
    >
      <View className="gap-3 px-4 pb-2">
        {/*
          **머리줄이 지금 어디인지를 말한다**(사용자 지정 2026-08-25).

          ①에서는 「지출 추가」다. ②로 들어가면 그 자리가 **고른 것의 이름**으로 바뀌고 왼쪽에
          돌아가는 자리가 선다 — `BoxDrillDown` 이 쓰는 것과 같은 화살촉이다. 제목을 바꾸지 않고
          본문에 돌아가는 줄을 따로 두면, 같은 것(지금 무엇을 고르는 중인가)을 말하는 자리가
          둘이 되고 시트 위쪽 한 줄이 통째로 낭비된다.

          `items-baseline` 이 아니라 `items-center` 다 — 화살촉은 글자가 아니라 밑줄이 없다.
        */}
        <View className="flex-row items-center justify-between gap-2">
          {choice === null ? (
            <Text className="text-base font-bold text-text">지출 추가</Text>
          ) : (
            <Pressable
              role="button"
              aria-label="다시 고르기"
              testID="spend-sheet-back"
              onPress={clearChoice}
              hitSlop={8}
              className="-ml-1 shrink flex-row items-center gap-1"
            >
              <ChevronLeftIcon className="h-5 w-5 text-text" strokeWidth={2} aria-hidden />
              <Text
                testID="spend-sheet-choice"
                numberOfLines={1}
                className="shrink text-base font-bold text-text"
              >
                {choice.label}
              </Text>
            </Pressable>
          )}
          <Text
            testID="spend-sheet-date"
            className="shrink-0 text-xs text-text-muted"
            style={TABULAR_NUMS}
          >
            {formatDayLabel(props.dateKey)}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-1.5">
          {SPEND_CATEGORIES.map((each) => (
            <CategoryChip
              key={each}
              label={each}
              selected={each === category}
              onPress={() => selectCategory(each)}
            />
          ))}
        </View>

        {direct ? (
          <View className="gap-3">
            <View className="flex-row items-center gap-3 border-b border-border pb-2">
              <Text className="shrink-0 text-xs text-text-muted">사용처</Text>
              <TextInput
                testID="spend-sheet-name"
                value={name}
                onChangeText={setName}
                placeholder="비워 둬도 됩니다"
                className="flex-1 text-right text-sm text-text"
              />
            </View>

            {category === '기타' && (
              <View className="flex-row flex-wrap gap-1.5">
                {FREE_CURRENCIES.map((each) => (
                  <CategoryChip
                    key={each.id}
                    label={each.label}
                    selected={each.id === freeCurrency}
                    onPress={() => setFreeCurrency(each.id)}
                  />
                ))}
              </View>
            )}

            <MesoAmountField
              meso={typed}
              onChange={setTyped}
              resetLabel="금액 초기화"
              amountTestID="spend-sheet-amount"
              unit={FREE_CURRENCIES.find((each) => each.id === currency)?.unit}
              // 메포·캐시는 자릿수가 작아 메소 칩이 쓸모없다([[ADR-166]] 결정 8 열린 질문).
              mesoHelpers={currency === 'meso'}
            />

            <View className="-mx-1">
              <MesoKeypad onKey={(key) => setTyped((prev) => applyMesoKey(prev, key))} />
            </View>
          </View>
        ) : (
          // **여기에 스크롤을 두지 않는다.** 시트 껍데기가 이미 `BottomSheetScrollView` 이고
          // 높이도 «내용만큼, 82% 를 상한으로» 다(`BottomSheet`). 안쪽에 또 두면 중첩 스크롤이
          // 되어 손가락이 어느 쪽을 미는지 갈리고, 무엇보다 **목록이 상한선에서 잘려** 「더
          // 있는지」가 안 보였다(iOS 실측 2026-08-25). 걷어내면 목록이 제 높이로 서고, 그래도
          // 넘치는 기기에서는 **껍데기의 스크롤**이 받는다 — 스크롤이 한 겹만 남는다.
          // (`) : (` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다 — 이 파일에서 두 번째다.)
          <View className="gap-1">
            {choice === null ? (
              groups.map((group) => (
                <View key={group.group} className="gap-1 pb-2">
                  <Text className="text-[11px] text-text-disabled">{group.group}</Text>
                  {/* 퍼센트 폭과 `gap` 을 섞으면 마지막 칸이 밀린다 — 간격은 자식 패딩이 만든다
                      (`BossDropSheet` ①과 같은 처방). */}
                  <View className="-mx-1 flex-row flex-wrap">
                    {group.choices.map((each) => (
                      <ItemTile
                        key={each.label}
                        label={each.label}
                        // 단계가 여럿이면 **나란히** 적는다 — `7,500 | 30,000 메포`.
                        price={tilePriceLabel(each.items)}
                        selected={false}
                        onPress={() => selectChoice(each)}
                      />
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <View className="gap-3 pb-1">
                {forms.length > 0 && (
                  <View className="gap-1">
                    <Text className="text-[11px] text-text-disabled">형태</Text>
                    <View className="-mx-1 flex-row flex-wrap">
                      {forms.map((each) => (
                        <ItemTile
                          key={each}
                          label={each}
                          price={null}
                          selected={each === form}
                          onPress={() => setForm(each)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {tiers.length > 0 && (
                  <View className="gap-1">
                    <Text className="text-[11px] text-text-disabled">단계</Text>
                    <View className="-mx-1 flex-row flex-wrap">
                      {tiers.map((each) => (
                        <ItemTile
                          key={each.name}
                          label={each.tier ?? each.name}
                          price={tilePriceLabel([each])}
                          selected={each.name === item?.name}
                          onPress={() => selectItem(each)}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {category === '아이템 구매' && (
          <Pressable
            // 다중 선택이 아니라 켬/끔 하나라 역할이 checkbox 다(`CacheClearConfirm` ②와 같은 판단).
            role="checkbox"
            aria-checked={hasTariff}
            aria-label={`관세 ${SPEND_TARIFF_PERCENT}%`}
            onPress={() => setHasTariff((on) => !on)}
            className="flex-row items-center gap-2"
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded-md border ${
                hasTariff ? 'border-transparent bg-primary' : 'border-border-strong'
              }`}
            >
              {hasTariff && (
                <CheckIcon className="h-3 w-3 text-on-primary" strokeWidth={3} aria-hidden />
              )}
            </View>
            <Text className="text-xs text-text">관세 {SPEND_TARIFF_PERCENT}% — 월드 간 거래</Text>
            <Text className="ml-auto text-xs text-fall-ink" style={TABULAR_NUMS}>
              {hasTariff ? `+${tariffed.tariffMeso.toLocaleString()}` : ' '}
            </Text>
          </Pressable>
        )}

        {(hasSubject || usesPoint) && (
          <View className="gap-2 rounded-xl border border-border bg-surface p-3">
            {item !== null && !direct && (
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-text-muted">수량</Text>
                  <QuantityStepper
                    value={quantity}
                    unit={item.unit}
                    max={item.maxQuantity}
                    onChange={setQuantity}
                  />
                </View>

                {item.limit !== undefined && (
                  // **적어만 두고 세지 않는다**([[ADR-166]] 정정 1 ⑤). 몬스터 파크 한도는 축이
                  // 셋(월드당 14 · 캐릭터당 7 · 무료 2)인데 앱은 지금 어느 월드·어느 캐릭터인지
                  // 모른다 — 하나를 골라 수량을 막으면 그 고름이 곧 추정이 된다([[ADR-006]]).
                  // 대신 사용자가 준 문장을 **그대로** 옆에 둔다: 세는 것은 사람이 한다.
                  // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
                  <Text
                    testID="spend-sheet-limit"
                    className="text-[11px] leading-4 text-text-disabled"
                  >
                    한도 · {item.limit}
                  </Text>
                )}
              </View>
            )}

            {usesPoint && (
              // 시세는 네 자리라 **OS 숫자 키패드로 충분하다** — [[ADR-124]] 가 앞 키패드를 세운
              // 것은 «메소는 자릿수가 커서 0 을 세게 된다» 때문이고, 그 문제가 여기엔 없다.
              // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
              <View className="flex-row items-center justify-between gap-2 border-t border-border pt-2">
                <Text className="shrink-0 text-xs text-text-muted">
                  시세 · 1억당
                  {/* **필수 칸**이라는 표시([[ADR-166]] 정정 2 ③) — 시세 없이 저장한 행은 영영
                      메소로 표시할 수 없다. 채워도 사라지지 않는다: «지금 비었다» 가 아니라
                      «이 칸은 반드시 있어야 한다» 를 말하는 자리다. */}
                  <Text testID="spend-sheet-required" className="text-error-ink">
                    {' *'}
                  </Text>
                </Text>
                <TextInput
                  testID="spend-sheet-rate"
                  value={rateText}
                  onChangeText={setRateText}
                  keyboardType="number-pad"
                  placeholder="메소마켓 시세"
                  className={`flex-1 text-right text-sm font-semibold ${
                    rate === null ? 'text-error-ink' : 'text-text'
                  }`}
                  style={TABULAR_NUMS}
                />
                <Text className="shrink-0 text-xs text-text-muted">메포</Text>
              </View>
            )}

            <View className="flex-row items-baseline justify-between border-t border-border pt-2">
              <Text className="text-xs font-semibold text-text">합계</Text>
              {/*
                셋으로 갈린다.
                · 캐시 — 메소로 **환산하지 않으므로** 캐시 그대로 적는다(정정 2 ①).
                · 시세가 없는 메포 — **0 을 적지 않는다.** 「−0」 은 «0 원짜리 지출» 로 읽히는데
                  사실은 «아직 못 센다» 다. 대신 **아는 것**(메포 원금)을 적고 아래 줄이 무엇이
                  없는지 말한다.
                · 그 밖 — 메소 축 합계.
              */}
              <Text
                testID="spend-sheet-total"
                className={`text-lg font-bold ${blocked ? 'text-text-muted' : 'text-fall-ink'}`}
                style={TABULAR_NUMS}
              >
                {currency === 'cash'
                  ? `−${amount.toLocaleString()}원`
                  : blocked
                    ? `${amount.toLocaleString()} 메포`
                    : `−${formatMesoCompact(totalMeso)}`}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          role="button"
          aria-label="저장"
          disabled={!canSave || saving}
          onPress={() => void save()}
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
