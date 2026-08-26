/**
 * 지출 기록 시트 — **고르면 채워진다**([[ADR-166]] · [[ADR-170]] 결정 6).
 *
 * ## 자기가 어느 갈래인지 모른다
 *
 * 수입/지출 세그먼트가 없다. 갈래는 **펼침판이 시트 밖에서** 갈랐고([[ADR-170]] 결정 6) 이 시트는
 * 「지출」이라는 사실조차 프롭으로 받지 않는다 — 애초에 지출만 그리는 컴포넌트다. 나중에 진입점을
 * 바꿔도 여기가 안 바뀌는 것이 그 결정이 산 값이다.
 *
 * ## 고르는 갈래는 금액을 안 친다
 *
 * 사용자가 준 24항목에 **전부 가격이 붙어 있다**([[ADR-166]] 정정 1 ①). 그래서 그 셋에는 금액
 * 칸이 없고, 고르면 단가가 그대로 금액이 되며 수량만 조절한다. 곱셈은 **앱이 한다** —
 * 사용자가 대신하면 «몇 포인트 썼나» 를 나중에 되물을 수 없다(정정 1 ③).
 *
 * ## 직접 입력 둘은 **OS 숫자 키보드**로 친다 ([[ADR-170]] 정정 4)
 *
 * 아이템 구매·기타는 고를 목록이 없어 금액을 친다. 그 자리에 앱 키패드를 두지 않는 이유는 **이
 * 시트가 어차피 키보드를 부르기 때문**이다 — 사용처(글자)와 시세(숫자 넉 자)가 이미 부른다.
 * [[ADR-124]] 결정 5 의 «안 부르면 보정할 것이 없다» 는 이 시트에서 성립하지 않는다.
 *
 * 걷은 것은 12칸 그리드뿐이고 **초기화·억/만 줄·빠른 칩은 그대로다** — OS 키패드엔 `00` 이 없어
 * 억 단위를 치려면 0 을 여덟 번 눌러야 한다.
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
import { AmountFigure } from '../../components/molecules/AmountFigure/AmountFigure'
import { Segment } from '../../components/molecules/Segment/Segment'
import { SelectField } from '../../components/organisms/SelectField/SelectField'
import { characterOptions } from './character-options'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { formatDayLabel } from '../../lib/calendar-month'
import { formatMesoUnits } from '../../lib/drop-price'
import { CheckIcon, ChevronLeftIcon, MinusIcon, PlusIcon } from '../../lib/icons'
import { formatMesoCompact } from '../../lib/meso-compact'
import {
  SPEND_TARIFF_PERCENT,
  findSpendChoice,
  pointToMeso,
  spendGroupsOf,
  withTariffMeso,
  type SpendCatalogChoice,
  type SpendCatalogItem,
} from '../../lib/spend-catalog'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { SPEND_CATEGORIES, type SpendCategory, type SpendRecord } from '../../storage/spend'

/**
 * 적어 둔 기록에서 **시트의 첫 상태를 되짚는다**([[ADR-171]] 결정 2).
 *
 * 되짚는 것이 이름 하나뿐인 이유는, 나머지가 전부 행에 그대로 있기 때문이다(수량·형태·시세·관세).
 * 이름만 카탈로그를 한 번 거친다 — 「하이마운틴 2단계」 는 행에서 한 글자지만 시트에서는 **대표와
 * 단계 둘**이다.
 *
 * 못 찾으면 `choice`·`item` 이 `null` 이고 목록이 선다 — **시트가 안 열리는 것보다 낫다.**
 * 통화를 되짚는 자리이기도 하다: 캐시 칸이 찼으면 「기타」의 캐시로 열려야 그 값이 안 사라진다.
 */
function initialStateOf(record: SpendRecord | undefined): {
  category: SpendCategory
  choice: SpendCatalogChoice | null
  item: SpendCatalogItem | null
  form: string | null
  quantity: number
  name: string
  typed: number
  hasTariff: boolean
  freeCurrency: FreeCurrency
} {
  if (record === undefined) {
    return {
      category: SPEND_CATEGORIES[0],
      choice: null,
      item: null,
      form: null,
      quantity: 1,
      name: '',
      typed: 0,
      hasTariff: false,
      freeCurrency: 'meso',
    }
  }

  const found = findSpendChoice(record.category, record.item)
  const direct = isDirectInput(record.category)
  return {
    category: record.category,
    choice: found?.choice ?? null,
    item: found?.item ?? null,
    form: record.form,
    quantity: record.quantity ?? 1,
    // 직접 입력에서만 이름이 «친 것» 이다 — 목록 항목의 이름을 여기 넣으면 수정 후 저장할 때
    // 사용처로 다시 적힌다.
    name: direct ? (record.item ?? '') : '',
    typed: direct ? (record.mesoAmount ?? record.pointAmount ?? record.cashAmount ?? 0) : 0,
    hasTariff: record.tariffMeso !== null,
    freeCurrency:
      record.cashAmount !== null ? 'cash' : record.pointAmount !== null ? 'point' : 'meso',
  }
}

/** 저장할 값에서 **어댑터가 아니라 화면이 정하는 것 둘**(`id`·`recordedAt`)을 뺀 나머지. */
export type SpendDraft = Omit<SpendRecord, 'id' | 'recordedAt'>

/** 「기타」가 고르는 통화 셋([[ADR-166]] 결정 1 · 정정 1 ④) — **캐시가 사는 유일한 자리**다. */
const FREE_CURRENCIES = [
  { id: 'meso', label: '메소', unit: '메소' },
  { id: 'point', label: '메포', unit: '메포' },
  { id: 'cash', label: '캐시', unit: '원' },
] as const

type FreeCurrency = (typeof FREE_CURRENCIES)[number]['id']

/** 세그먼트는 **글자**를 고른다 — 아이디와 라벨 사이를 여기서 옮긴다. */
const FREE_CURRENCY_LABELS = FREE_CURRENCIES.map((each) => each.label)

function labelOfCurrency(id: FreeCurrency): string {
  return FREE_CURRENCIES.find((each) => each.id === id)?.label ?? '메소'
}

function currencyOfLabel(label: string): FreeCurrency {
  return FREE_CURRENCIES.find((each) => each.label === label)?.id ?? 'meso'
}

/**
 * 라벨–값 한 줄([[ADR-173]] 결정 1) — 큰 숫자 위는 **전부 이 모양**이다.
 *
 * 축이 하나로 정리되는 것이 이 줄의 일이다. 전에는 라벨–값, 오른쪽 큰 숫자, 오른쪽 칩이 번갈아
 * 나와 눈이 좌우로 튀었다.
 */
function FieldRow(props: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-3 border-b border-border pb-2">
      <Text className="shrink-0 text-xs text-text-muted">{props.label}</Text>
      <View className="ml-auto flex-row items-center">{props.children}</View>
    </View>
  )
}

/**
 * 캐릭터 줄 — **기본은 「선택 안함」**([[ADR-166]] 결정 3, 사용자 지정 2026-08-26).
 *
 * 두 가지(직접 입력 · 목록 갈래를 고른 뒤)가 같은 줄을 쓰므로 한 자리에 둔다. **고를 것을 고르는
 * 화면(타일 격자)에는 안 선다** — 거기엔 아직 적을 기록이 없다.
 */
function CharacterRow(props: {
  characters: ReadonlyArray<{ ocid: string; name: string }>
  selected: string | null
  onSelect: (value: string | null) => void
}): React.JSX.Element {
  return (
    <SelectField
      label="캐릭터"
      options={characterOptions(props.characters)}
      selected={props.selected}
      onSelect={props.onSelect}
      testID="spend-sheet-character"
    />
  )
}

/**
 * 시세 줄 — 메포를 쓸 때만 선다([[ADR-166]] 정정 2 ③).
 *
 * 시세는 네 자리라 **OS 숫자 키패드로 충분하다**. `*` 는 «지금 비었다» 가 아니라 «이 칸은 반드시
 * 있어야 한다» 를 말하므로 채워도 안 사라진다.
 */
function RateRow(props: {
  value: string
  onChange: (next: string) => void
  valid: boolean
}): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-2 border-b border-border pb-2">
      <Text className="shrink-0 text-xs text-text-muted">
        시세 · 1억당
        <Text testID="spend-sheet-required" className="text-error-ink">
          {' *'}
        </Text>
      </Text>
      <TextInput
        testID="spend-sheet-rate"
        value={props.value}
        onChangeText={props.onChange}
        keyboardType="number-pad"
        placeholder="메소마켓 시세"
        className={`flex-1 text-right text-sm font-semibold ${
          props.valid ? 'text-text' : 'text-error-ink'
        }`}
        style={TABULAR_NUMS}
      />
      <Text className="shrink-0 text-xs text-text-muted">메포</Text>
    </View>
  )
}

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
   * 고를 수 있는 캐릭터([[ADR-166]] 결정 3) — 화면이 읽어서 넘긴다(시트는 `storage/` 를 모른다).
   * 비어 있으면 고르개에 「선택 안함」 하나만 선다.
   */
  characters: ReadonlyArray<{ ocid: string; name: string }>
  /**
   * 고칠 기록. 있으면 **수정 모드**다([[ADR-171]] 결정 2) — 머리와 버튼 글자가 갈리고 삭제가 선다.
   * 없으면 새로 적는다. 화면을 따로 만들지 않는 이유는 **입력 규칙이 한 벌이어야** 하기 때문이다.
   */
  editing?: SpendRecord
  onDelete?: () => void | Promise<void>
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
  // **한 번만 되짚는다.** `useState` 의 초기값이라 이후 프롭이 바뀌어도 안 덮어쓴다 — 고치는
  // 도중에 값이 되돌아가면 친 것이 사라진다.
  const [initial] = useState(() => initialStateOf(props.editing))
  const editing = props.editing !== undefined

  const [category, setCategory] = useState<SpendCategory>(initial.category)
  /**
   * 두 단계다(사용자 지정 2026-08-25).
   *
   * ① 묶음별 **대표**를 고른다(하이마운틴 · 몬스터 파크 …).
   * ② 대표가 여러 갈래를 품으면 그 안에서 고른다 — **단계**(1·2단계)와 **형태**(경험치·솔 에르다).
   *
   * `choice` 가 «지금 어느 단계인가» 를 든다: `null` 이면 목록이 서고, 있으면 그 안이 선다.
   * 한 갈래뿐인 대표(몬스터 파크)는 고르는 즉시 `item` 까지 정해져 ②가 비어 있다.
   */
  const [choice, setChoice] = useState<SpendCatalogChoice | null>(initial.choice)
  const [item, setItem] = useState<SpendCatalogItem | null>(initial.item)
  const [form, setForm] = useState<string | null>(initial.form)
  const [quantity, setQuantity] = useState(initial.quantity)
  // 직접 입력 갈래의 칸들. 갈래를 오갈 때 **비우지 않는다** — 잘못 눌러 돌아왔을 때 친 것이
  // 사라지면 다시 쳐야 한다. 저장에 무엇이 쓰이는지는 아래 `direct` 가 가른다.
  const [name, setName] = useState(initial.name)
  /** **기본은 「선택 안함」**(사용자 지정 2026-08-26) — 지출은 «내가 쓴 돈» 이 기본이다([[ADR-166]] 결정 3). */
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  const [typed, setTyped] = useState(initial.typed)
  const [hasTariff, setHasTariff] = useState(initial.hasTariff)
  const [freeCurrency, setFreeCurrency] = useState<FreeCurrency>(initial.freeCurrency)
  // 마지막으로 쓴 값으로 시작한다([[ADR-166]] 결정 5). 사용자가 고치면 그 값이 저장되고, 다음에
  // 이 시트를 열 때 다시 채워진다 — 필수 칸이 매번 비어 있으면 입력이 막힌다.
  // 고칠 때는 **그 행의 시세**가 먼저다 — 「마지막으로 쓴 값」 으로 덮으면 옛 기록의 환산이
  // 조용히 달라진다.
  const [rateText, setRateText] = useState(() => {
    const rate = props.editing?.pointPer100mMeso ?? props.lastPointRate
    return rate === null || rate === undefined ? '' : String(rate)
  })
  /** 저장이 도는 동안 다시 못 누르게 막는다 — 손입력은 두 번 눌리면 행이 둘이 된다. */
  const [saving, setSaving] = useState(false)
  /**
   * 큰 숫자의 **세대**([[ADR-087]] 정정 1 의 «정체») — 올리면 굴리지 않고 **갈아 끼운다**.
   *
   * 갈래·대표·단계를 바꾸는 것은 «같은 숫자가 변한 것» 이 아니라 **«다른 숫자를 보게 된 것»** 이다.
   * 굴리면 치지도 않은 금액이 **줄어드는 애니메이션**이 나고, 그것은 «내가 뭘 지웠나» 로 읽힌다
   * (사용자 지적 2026-08-26).
   *
   * 세는 값을 정체에 넣는 대신 **세대를 올린다** — 같은 갈래로 되돌아왔을 때 정체 문자열이 같으면
   * 그 정체의 기억에서 다시 굴러 내려오기 때문이다(기억이 모듈 수준이다 — [[ADR-087]] 결정 8).
   */
  const [amountEpoch, setAmountEpoch] = useState(0)

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
  /**
   * 단계를 고르기 전에도 **대표가 아는 것**([[ADR-173]] 결정 8, 사용자 지정 2026-08-26).
   *
   * 한 대표 안의 단계들은 **단위도 통화도 같다**(하이마운틴 1·2단계는 둘 다 「회」·메포). 그래서
   * 수량과 시세는 «무엇을 골랐나» 를 안 기다려도 되고, 고른 뒤에야 뜨면 시세를 미리 채워 둘 수
   * 없는 데다 줄이 나중에 나타나 화면이 밀린다.
   */
  const scope = item ?? choice?.items[0] ?? null

  const currency: FreeCurrency =
    category === '기타' ? freeCurrency : direct ? 'meso' : (scope?.currency ?? 'meso')
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

  /**
   * 큰 숫자 밑의 **힌트 한 줄**([[ADR-173]] 결정 2) — 값이 갈릴 때만 뜻이 있다.
   *
   * 캐시는 `undefined` 라 **줄이 통째로 없다**: 환산을 안 하므로 적을 것이 없고([[ADR-166]] 정정
   * 2 ①), 자리를 비워 두는 대신 시트가 그만큼 짧아진다.
   */
  const conversionHint = blocked
    ? '시세를 넣어야 메소로 셀 수 있어요'
    : `메소로 −${formatMesoCompact(totalMeso)}`
  const directHint =
    currency === 'cash' ? undefined : usesPoint ? conversionHint : formatMesoUnits(directAmount)
  /**
   * 목록 갈래의 힌트 — **큰 숫자가 메소이므로 원래 단위를 여기서 든다**(사용자 지정 2026-08-26).
   *
   * | 상태 | 힌트 |
   * |---|---|
   * | 아직 안 고름 | 빈 줄 — **자리만 지킨다**(고른 뒤에 줄이 생기면 아래가 밀린다) |
   * | 메포 · 시세 있음 | `30,000 메포` — 실제로 내는 것 |
   * | 메포 · 시세 없음 | `시세를 넣어야…`(에러색) — **왜 0 인지를 화면이 말한다** |
   * | 메소 | 억/만 환산 — 자릿수 읽기 도우미 |
   */
  const listHint =
    item === null
      ? ' '
      : usesPoint
        ? blocked
          ? '시세를 넣어야 메소로 셀 수 있어요'
          : `${amount.toLocaleString()} 메포`
        : formatMesoUnits(totalMeso)

  function selectCategory(next: SpendCategory): void {
    setCategory(next)
    // 고르던 것을 **푼다** — 남겨 두면 «컨텐츠를 골랐는데 버프 항목이 저장되는» 일이 생긴다.
    setChoice(null)
    setItem(null)
    setForm(null)
    setQuantity(1)
    // **친 금액도 안 들고 간다**(사용자 지정 2026-08-26) — 갈래마다 0 에서 시작한다.
    setTyped(0)
    setAmountEpoch((epoch) => epoch + 1)
    // 관세는 아이템 구매에만 있다 — 다른 갈래로 갔다가 돌아오면 켜져 있던 것이 남으면 안 된다.
    if (next !== '아이템 구매') setHasTariff(false)
  }

  /** ① 대표를 고른다. 갈래가 하나뿐이면 **그 자리에서 항목까지 정해진다.** */
  function selectChoice(next: SpendCatalogChoice): void {
    setAmountEpoch((epoch) => epoch + 1)
    setChoice(next)
    setItem(next.items.length === 1 ? next.items[0] : null)
    // 형태는 있어도 **기본값을 안 고른다** — 앱이 «경험치였겠지» 라고 정하면 그것이 추정이 된다.
    setForm(null)
    // 대상이 바뀌면 수량을 되돌린다 — `DropPricePad` 가 금액을 되돌리는 것과 같은 이유다.
    setQuantity(1)
  }

  /** ② 그 안의 단계를 고른다. */
  function selectItem(next: SpendCatalogItem): void {
    setAmountEpoch((epoch) => epoch + 1)
    setItem(next)
    setQuantity(1)
  }

  /** 목록으로 돌아간다. */
  function clearChoice(): void {
    setAmountEpoch((epoch) => epoch + 1)
    setChoice(null)
    setItem(null)
    setForm(null)
    setQuantity(1)
  }


  /** 지우기 — 실패하면 시트를 지킨다(저장과 같은 계약). */
  async function remove(): Promise<void> {
    if (saving || props.onDelete === undefined) return
    setSaving(true)
    try {
      await props.onDelete()
    } catch {
      setSaving(false)
      return
    }
    props.onClose()
  }

  async function save(): Promise<void> {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await props.onSave({
        ocid,
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
            <Text className="text-base font-bold text-text">
              {editing ? '지출 수정' : '지출 추가'}
            </Text>
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
          <>
            <CharacterRow characters={props.characters} selected={ocid} onSelect={setOcid} />

            <FieldRow label="사용처">
              <TextInput
                testID="spend-sheet-name"
                value={name}
                onChangeText={setName}
                placeholder="비워 둬도 됩니다"
                className="flex-1 text-right text-sm text-text"
              />
            </FieldRow>

            {category === '기타' && (
              // 통화는 **갈래가 아니라 금액의 축**이라 세그먼트다([[ADR-173]] 결정 3) — 칩으로
              // 두면 갈래 칩과 한 무리로 읽힌다. 캐시가 사는 유일한 자리다([[ADR-166]] 정정 1 ④).
              // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
              <FieldRow label="통화">
                <Segment
                  options={FREE_CURRENCY_LABELS}
                  selected={labelOfCurrency(freeCurrency)}
                  onSelect={(label) => setFreeCurrency(currencyOfLabel(label))}
                />
              </FieldRow>
            )}

            {usesPoint && <RateRow value={rateText} onChange={setRateText} valid={rate !== null} />}

            <AmountFigure
              value={typed}
              // **칠 때는 구입가, 손을 떼면 합계**([[ADR-173]] 결정 6) — 관세를 켜면 그 사이를 굴러
              // 넘어간다. 그래서 더해지는 금액을 따로 안 적는다(결정 5).
              displayValue={hasTariff && currency === 'meso' ? tariffed.mesoAmount : undefined}
              unit={FREE_CURRENCIES.find((each) => each.id === currency)?.unit ?? '메소'}
              testID="spend-sheet-amount"
              identity={`spend-amount-${amountEpoch}`}
              hint={directHint}
              hintBlocked={blocked}
              onChangeValue={setTyped}
            />

            {category === '아이템 구매' && (
              // **큰 숫자 밑**에 산다([[ADR-173]] 결정 5, 사용자 지정) — 더해지는 금액을 안 적는
              // 이유는 위의 숫자가 그만큼 올라가기 때문이다. 다중 선택이 아니라 켬/끔 하나라
              // 역할이 checkbox 다(`CacheClearConfirm` ②와 같은 판단).
              <Pressable
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
                <Text className="text-xs text-text">관세 {SPEND_TARIFF_PERCENT}%</Text>
              </Pressable>
            )}
          </>
        ) : choice === null ? (
          // **여기에 스크롤을 두지 않는다.** 시트 껍데기가 이미 `BottomSheetScrollView` 이고
          // 높이도 «내용만큼, 82% 를 상한으로» 다(`BottomSheet`). 안쪽에 또 두면 중첩 스크롤이
          // 되어 손가락이 어느 쪽을 미는지 갈리고, 무엇보다 **목록이 상한선에서 잘려** 「더
          // 있는지」가 안 보였다(iOS 실측 2026-08-25).
          // (`) : (` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <View className="gap-1">
            {groups.map((group) => (
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
            ))}
          </View>
        ) : (
          // 고른 뒤 — 라벨–값 줄들이 서고 **합계가 저장 바로 위**에 선다([[ADR-173]] 결정 1).
          <>
            <CharacterRow characters={props.characters} selected={ocid} onSelect={setOcid} />

            {forms.length > 0 && (
              // 형태는 **기본값을 안 고른다** — 앱이 «경험치였겠지» 라고 정하면 그것이 추정이 된다.
              <FieldRow label="형태">
                <Segment options={forms} selected={form} onSelect={setForm} />
              </FieldRow>
            )}

            {tiers.length > 0 && (
              <FieldRow label="단계">
                <Segment
                  options={tiers.map((each) => each.tier ?? each.name)}
                  selected={item === null ? null : (item.tier ?? item.name)}
                  onSelect={(label) => {
                    const next = tiers.find((each) => (each.tier ?? each.name) === label)
                    if (next !== undefined) selectItem(next)
                  }}
                />
              </FieldRow>
            )}

            {scope !== null && (
              // 단위·상한은 **대표가 안다** — 단계를 고르기 전에도 선다.
              <FieldRow label="수량">
                <QuantityStepper
                  value={quantity}
                  unit={scope.unit}
                  max={scope.maxQuantity}
                  onChange={setQuantity}
                />
              </FieldRow>
            )}

            {item?.limit !== undefined && (
              // **적어만 두고 세지 않는다**([[ADR-166]] 정정 1 ⑤). 몬스터 파크 한도는 축이 셋이라
              // 앱이 하나를 골라 수량을 막으면 그 고름이 곧 추정이 된다([[ADR-006]]).
              <Text testID="spend-sheet-limit" className="-mt-1 text-[11px] leading-4 text-text-disabled">
                한도 · {item.limit}
              </Text>
            )}

            {usesPoint && <RateRow value={rateText} onChange={setRateText} valid={rate !== null} />}

            {scope !== null && (
              /*
               * 목록 갈래의 큰 숫자는 **못 친다** — 단가 × 수량이라 앱이 센다. 단계를 고르기 전에도
               * **0 으로 선다**(사용자 지정): 단가를 아직 모를 뿐 셀 자리는 이미 있고, 나중에
               * 생기면 그때 아래가 밀린다.
               *
               * **합계는 언제나 메소다**(사용자 지정 2026-08-26). 가계부의 축이 메소이므로
               * ([[ADR-166]] 정정 2) 「이 지출이 메소로 얼마인가」 가 곧 합계다 — 메포로 사는
               * 항목이어도 그렇다. 실제로 내는 메포는 밑의 힌트가 든다.
               */
              <AmountFigure
                value={totalMeso}
                unit="메소"
                testID="spend-sheet-amount"
                identity={`spend-amount-${amountEpoch}`}
                hint={listHint}
                hintBlocked={blocked && item !== null}
                readOnly
                onChangeValue={() => undefined}
              />
            )}
          </>
        )}

        {/* **타일 격자에만 저장이 없다**([[ADR-173]] 결정 1) — 거기엔 셀 자리 자체가 없다. 둘째
            화면에는 큰 숫자가 서 있으므로 저장도 함께 서고, 다 안 골랐으면 **안 눌린다**. */}
        {(direct || choice !== null) && (
          <Pressable
            role="button"
            // **보이는 글자와 같아야 한다** — 화면은 「수정」인데 읽어 주는 것이 「저장」이면
            // 그 둘은 다른 버튼이 된다.
            aria-label={editing ? '수정' : '저장'}
            disabled={!canSave || saving}
            onPress={() => void save()}
            className={`items-center rounded-xl py-3 ${canSave ? 'bg-primary' : 'bg-surface-2'}`}
          >
            <Text className={`text-sm font-bold ${canSave ? 'text-on-primary' : 'text-text-disabled'}`}>
              {editing ? '수정' : '저장'}
            </Text>
          </Pressable>
        )}

        {editing && props.onDelete !== undefined && (
          // **버튼처럼 안 생겼다**([[ADR-171]] 결정 3) — 이미 두 번 눌러야 여기까지 온다.
          <Pressable
            role="button"
            aria-label="삭제"
            testID="spend-sheet-delete"
            disabled={saving}
            onPress={() => void remove()}
            className="items-center py-2"
          >
            <Text className="text-xs font-semibold text-error-ink">삭제</Text>
          </Pressable>
        )}

      </View>
    </BottomSheet>
  )
}
