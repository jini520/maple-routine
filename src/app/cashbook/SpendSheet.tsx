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
import { Image, Pressable, View } from 'react-native'

// `TextInput` 도 atom 에서 온다 — 시스템 글자 크기 클램프가 거기 있다([[ADR-152]] 결정 4).
import { Text, TextInput } from '../../components/atoms/Text/Text'
import { AmountFigure } from '../../components/molecules/AmountFigure/AmountFigure'
import { Segment } from '../../components/molecules/Segment/Segment'
import { parseMesoText } from '../../components/molecules/MesoPad/meso-pad'
import { SelectField } from '../../components/organisms/SelectField/SelectField'
import { nextAmountIdentity } from './amount-identity'
import { characterOptions } from './character-options'
import { FieldRow, QuantityStepper } from './sheet-fields'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { formatDayLabel } from '../../lib/calendar-month'
import { formatMesoUnits } from '../../lib/drop-price'
import { spendIconOf } from '../../lib/spend-icons'
import {
  FREE_CURRENCIES,
  FREE_CURRENCY_LABELS,
  currencyOfLabel,
  labelOfCurrency,
  type FreeCurrency,
} from '../../lib/free-currency'
import { ChevronLeftIcon } from '../../lib/icons'
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
import {
  SPEND_CATEGORIES,
  SPEND_ITEM_KINDS,
  countsQuantity,
  type SpendCategory,
  type SpendItemKind,
  type SpendRecord,
} from '../../storage/spend'

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
  itemKind: SpendItemKind
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
      itemKind: SPEND_ITEM_KINDS[0],
      quantity: 1,
      name: '',
      typed: 0,
      hasTariff: false,
      freeCurrency: 'meso',
    }
  }

  const found = findSpendChoice(record.category, record.item)
  const direct = isDirectInput(record.category)
  const quantity = record.quantity ?? 1
  return {
    category: record.category,
    choice: found?.choice ?? null,
    item: found?.item ?? null,
    form: record.form,
    // **`null` 은 정정 1 이전 행이고 장비다**([[ADR-173]] 정정 1 결정 4) — 그때의 아이템 구매는
    // «치는 금액 + 관세» 하나뿐이었고, 그것이 정확히 장비의 모양이다.
    itemKind: record.itemKind ?? SPEND_ITEM_KINDS[0],
    quantity,
    // 직접 입력에서만 이름이 «친 것» 이다 — 목록 항목의 이름을 여기 넣으면 수정 후 저장할 때
    // 사용처로 다시 적힌다.
    name: direct ? (record.item ?? '') : '',
    typed: direct ? typedOf(record, quantity) : 0,
    hasTariff: record.tariffMeso !== null,
    freeCurrency:
      record.cashAmount !== null ? 'cash' : record.pointAmount !== null ? 'point' : 'meso',
  }
}

/**
 * 친 값을 **되짚는다** — `단가 = (저장된 총액 − 관세분) ÷ 수량`([[ADR-173]] 정정 1).
 *
 * 총액을 그대로 친 값으로 삼으면 시트가 그 위에 **관세를 또 물리고**(935,000,000 짜리 기록이
 * 1,028,500,000 으로 열렸다) 「기타」는 수량이 함께 살아나 합계가 «총액 × 수량» 이 된다
 * (30,000 이 90,000 으로 열렸다). 셋을 한 식이 다 맞춘다.
 *
 * 나눗셈은 **언제나 나누어떨어진다** — 저장된 총액이 `단가 × 수량 (+ 관세분)` 으로 만들어진
 * 값이라서다. `Math.round` 는 부동소수점이 남길 꼬리만 턴다.
 */
function typedOf(record: SpendRecord, quantity: number): number {
  const total = record.mesoAmount ?? record.pointAmount ?? record.cashAmount ?? 0
  return Math.round((total - (record.tariffMeso ?? 0)) / quantity)
}

/** 저장할 값에서 **어댑터가 아니라 화면이 정하는 것 둘**(`id`·`recordedAt`)을 뺀 나머지. */
export type SpendDraft = Omit<SpendRecord, 'id' | 'recordedAt'>

/**
 * 직접 입력 칸의 **이름은 갈래가 정한다**([[ADR-170]] 정정 14 ②).
 *
 * 아이템 구매에서 그 칸이 묻는 것은 «무엇을 샀나» 이지 어디에 썼나가 아니다. 수입 시트가 이미
 * `NAME_LABELS` 로 하는 그 일이고, 여기서도 **갈래 하나에 이름 하나**다.
 */
const NAME_LABELS: Record<SpendCategory, string> = {
  컨텐츠: '사용처',
  '이벤트·BM': '사용처',
  버프: '사용처',
  '아이템 구매': '구매 아이템',
  기타: '사용처',
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
    <View className="min-h-7 flex-row items-center gap-2 border-b border-border pb-2">
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

/**
 * 관세 조각 둘 — **「없음」 이 첫 조각이고 기본값**이다([[ADR-173]] 정정 1 결정 6).
 *
 * 수입 시트의 수수료(`FEE_OPTIONS` — 「없음·3%·5%」)와 **같은 모양**이다([[ADR-170]] 정정 9 ②):
 * 두 시트가 한 뼈대라는 결정 10 이 관세 자리에서만 안 지켜지고 있었다.
 *
 * 요율은 `SPEND_TARIFF_PERCENT` **하나에서 나온다** — 여기 숫자를 적으면 참조표가 바뀌는 날
 * 글자와 셈이 갈린다([[ADR-006]]).
 */
const TARIFF_OPTIONS = ['없음', `${SPEND_TARIFF_PERCENT}%`] as const

type TariffOption = (typeof TARIFF_OPTIONS)[number]

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

/**
 * 타일 그림의 한 변 — 자리마다 다르다([[ADR-170]] 정정 16 ③).
 *
 * **타일 왼쪽**(기본)은 이름 두 줄(≈32)보다 낮으면 높이를 안 건드린다. **이름 옆**(에픽던전 셋)은
 * 이름 한 줄(≈16)과 나란히 서므로 더 작아야 그 줄이 안 두꺼워진다.
 */
const TILE_ICON_SIZE = 24
const TITLE_ICON_SIZE = 18

function ItemTile(props: {
  label: string
  /** 값이 하나로 정해지는 칸만 가격을 적는다 — 단계가 여럿이면 단계마다 값이 달라 못 적는다. */
  price: string | null
  selected: boolean
  /** 안 열린 묶음의 타일 — 흐리고 **안 눌린다**([[ADR-166]] 정정 5). */
  disabled?: boolean
  onPress: () => void
}): React.JSX.Element {
  const icon = spendIconOf(props.label)
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-selected={props.selected}
      disabled={props.disabled}
      onPress={props.onPress}
      className={`w-1/3 p-1 ${props.disabled === true ? 'opacity-40' : ''}`}
    >
      {/*
        **`h-full` 을 안 쓴다.** 부모(`Pressable`)의 높이가 내용에서 나오는데 거기에 백분율 높이를
        걸면 그 값이 위쪽의 늘어난 상자에서 풀려, 타일 하나가 목록 높이를 통째로 먹는다
        (iOS 실측 2026-08-25 — 여섯 중 셋만 보였다). 한 줄 안의 높이는 `flex-1` 이 맞춘다:
        줄이 `items-stretch`(기본)로 부모를 늘리고 이 상자가 그만큼 채운다.
      */}
      {/*
        **그림 자리는 둘이다**([[ADR-170]] 정정 16 ③, 사용자 지정 2026-08-27·28).

        기본은 **타일 왼쪽 끝**이다 — 위에 얹으면 그림 있는 타일만 한 층 커지고 `items-stretch` 라
        같은 줄이 통째로 따라 커진다. 옆에 세우면 높이를 글자가 정한다.

        **에픽던전 셋만 이름 바로 옆**이다(사용자 지정) — 이름이 짧아 타일 끝에 붙이면 그림과 글자가
        따로 놀고, 붙여 두면 둘이 한 이름처럼 읽힌다. 어느 쪽인지는 `spendIconOf` 가 든다.
      */}
      <View
        className={`flex-1 flex-row items-center gap-1.5 rounded-xl border px-2 py-2.5 ${
          props.selected ? 'border-primary bg-primary-tint' : 'border-border bg-surface'
        }`}
      >
        {icon !== null && !icon.beside && (
          // 아이템 아이콘은 **원본 비율 그대로** 둔다 — 상자에 맞춰 늘리면 도트가 뭉갠다.
          // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <Image
            testID={`spend-tile-icon-${props.label}`}
            source={icon.ref}
            resizeMode="contain"
            style={{ width: TILE_ICON_SIZE, height: TILE_ICON_SIZE }}
          />
        )}
        {/* 글자가 남은 폭을 갖는다 — `min-w-0` 이 없으면 긴 이름이 그림을 밀어낸다. */}
        <View className="min-w-0 flex-1 items-center gap-1">
        <View className="w-full flex-row items-center justify-center gap-1">
          {icon !== null && icon.beside && (
            <Image
              testID={`spend-tile-icon-${props.label}`}
              source={icon.ref}
              resizeMode="contain"
              style={{ width: TITLE_ICON_SIZE, height: TITLE_ICON_SIZE }}
            />
          )}
          {/* `shrink` 가 없으면 긴 이름이 그림을 타일 밖으로 밀어낸다. */}
          <Text numberOfLines={2} className="shrink text-center text-[11px] leading-4 text-text">
            {props.label}
          </Text>
        </View>
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
      </View>
    </Pressable>
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
  /** 「아이템 구매」의 종류([[ADR-173]] 정정 1) — 다른 갈래에서는 안 쓰이고 저장에도 안 실린다. */
  const [itemKind, setItemKind] = useState(initial.itemKind)
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
   * 큰 숫자의 **정체**([[ADR-087]] 정정 1) — 갈면 굴리지 않고 **갈아 끼운다**.
   *
   * 갈래·대표·단계를 바꾸는 것은 «같은 숫자가 변한 것» 이 아니라 **«다른 숫자를 보게 된 것»** 이다.
   * 굴리면 치지도 않은 금액이 **줄어드는 애니메이션**이 나고, 그것은 «내가 뭘 지웠나» 로 읽힌다
   * (사용자 지적 2026-08-26).
   *
   * **한 번도 안 쓴 문자열이어야 한다.** 카운트업의 기억은 모듈 수준이라 시트를 닫아도 남으므로
   * ([[ADR-087]] 결정 8), 마운트마다 0 부터 세면 그 문자열이 되풀이되어 **다음에 열었을 때 지난번
   * 값에서 굴러 내려온다.** 그래서 세대가 아니라 **한 방향으로만 늘어나는 이름표**를 쓴다.
   */
  const [amountIdentity, setAmountIdentity] = useState(nextAmountIdentity)

  /** 세는 대상이 바뀌었다 — 다음 값은 굴리지 않고 갈아 끼운다. */
  function resetAmountRoll(): void {
    setAmountIdentity(nextAmountIdentity())
  }

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
  const isFree = category === '기타'
  /**
   * **곱할 것이 있는가** — 수량이 서는 자리 셋이다.
   *
   * | 어디 | 곱하나 |
   * |---|---|
   * | 목록 갈래 | **언제나** — 카탈로그의 `unitPrice` × 수량([[ADR-166]] 정정 1 ③) |
   * | 「기타」 | **언제나** — 지출액 × 수량([[ADR-173]] 결정 17) |
   * | 「아이템 구매」 | **장비가 아닐 때만**([[ADR-173]] 정정 1 결정 1·2) |
   *
   * 장비는 하나를 사므로 곱할 것이 없고, 그래서 큰 숫자가 여전히 «치는 칸» 이며 관세가 그 위에서
   * 굴러 오른다. 소비·기타는 **월드 간 거래가 안 되어 관세가 아예 없으므로**, 결정 17 이 이 자리를
   * 미뤄 뒀던 질문(«관세를 단가에 물리나 총액에 물리나»)이 **성립하지 않는다.**
   */
  const counts = !direct || isFree || (category === '아이템 구매' && countsQuantity(itemKind))
  /** 관세를 얹기 **전**의 값 — 곱할 것이 없으면 친 값 그대로다. */
  const directSubtotal = counts ? typed * quantity : typed
  // 관세는 **친 숫자를 안 바꾼다** — 아래에 한 줄로 더한다. 금액 자체를 고치면 껐다 켰다 할 때
  // 8.5억 → 9.35억 → 10.28억 으로 부푼다([[ADR-166]] 정정 2 ②).
  const tariffed = withTariffMeso(directSubtotal)
  const directAmount =
    !isFree && currency === 'meso' && hasTariff ? tariffed.mesoAmount : directSubtotal
  const amount = direct ? directAmount : (item?.unitPrice ?? 0) * quantity

  // 캐시는 **환산하지 않는다**([[ADR-166]] 정정 2 ①) — 그래서 메소 축 합계에 안 든다.
  const totalMeso = currency === 'cash' ? 0 : usesPoint ? pointToMeso(amount, rate ?? 0) : amount
  // 메포를 쓰는데 시세가 없으면 **막는다** — 저장하면 영영 메소로 표시할 수 없는 행이 된다
  // ([[ADR-166]] 정정 2 ③). 어댑터도 같은 것을 막지만 화면이 먼저 알려 주는 편이 낫다.
  // 수량이 **치는 칸**이 되면서 0 이 닿을 수 있게 됐다([[ADR-173]] 정정 1 결정 3) — 스테퍼는
  // 바닥이 1 이라 이 자리가 없었다. `directSubtotal` 하나로 «단가도 수량도 0 이 아니다» 를 잰다.
  const hasSubject = direct ? directSubtotal > 0 : item !== null && !formMissing
  // **메소로 셀 수 없는 상태.** 메포를 쓰는데 시세가 없으면 환산이 성립하지 않는다 — 저장을 막는
  // 것만으로는 부족하고(사용자는 왜 막혔는지 모른다) 합계 자리가 그 사실을 말해야 한다.
  const blocked = usesPoint && (rate === null || rate <= 0)
  const canSave = hasSubject && !blocked

  /**
   * 수정 모드의 머리([[ADR-173]] 결정 15, 사용자 지정) — **고른 것**을 적는다.
   *
   * 목록 갈래면 그 항목(「악몽선경」), 직접 입력이면 갈래(「아이템 구매」)다. 카탈로그가 그 항목을
   * 못 찾으면(참조표가 갈렸다) 기록에 적힌 이름을 그대로 쓴다 — 「지출 수정」 으로 돌아가면 그 줄이
   * «무엇을 고치는 중인가» 를 말하지 못한다.
   */
  const editingTitle = direct ? category : (choice?.label ?? props.editing?.item ?? category)

  /**
   * 큰 숫자 밑의 **힌트 한 줄**([[ADR-173]] 결정 2) — 값이 갈릴 때만 뜻이 있다.
   *
   * 캐시는 `undefined` 라 **줄이 통째로 없다**: 환산을 안 하므로 적을 것이 없고([[ADR-166]] 정정
   * 2 ①), 자리를 비워 두는 대신 시트가 그만큼 짧아진다.
   */
  const conversionHint = blocked
    ? '시세를 넣어야 메소로 셀 수 있어요'
    : `메소로 −${formatMesoCompact(totalMeso)}`
  /**
   * 직접 입력의 큰 숫자 — 「기타」는 **합계**이고 아이템 구매는 **치는 값**이다(결정 17).
   *
   * 합계는 [[ADR-173]] 결정 11 대로 **메소 축**이다. 캐시만 예외다 — 환산을 안 하므로([[ADR-166]]
   * 정정 2 ①) 그 축에 얹을 값이 없고, 그대로 「원」 으로 적는다.
   */
  const freeTotal = isFree && currency !== 'cash' ? totalMeso : directSubtotal
  const freeUnit = isFree
    ? currency === 'cash'
      ? '원'
      : '메소'
    : (FREE_CURRENCIES.find((each) => each.id === currency)?.unit ?? '메소')
  /**
   * 지출액 줄 뒤에 적는 **통화 이름**([[ADR-170]] 정정 14 ④).
   *
   * 큰 숫자의 단위(`freeUnit`)와 갈리는 자리가 하나 있다 — 캐시는 큰 숫자가 「원」 이지만
   * (실제로 내는 돈이 원이다) 이 줄은 **고른 통화**를 말하므로 「캐시」다. 같은 값을 두 자리가
   * 다른 뜻으로 쓰는 것이 아니라, 묻는 것이 다르다: 저기는 «얼마인가», 여기는 «무엇으로 내나».
   */
  const typedUnit = labelOfCurrency(currency)

  /** 켬/끔이 **조각 이름**이 된다([[ADR-173]] 정정 1 결정 6) — 저장에 실리는 것은 그대로 `hasTariff` 다. */
  const tariffOption: TariffOption = hasTariff ? TARIFF_OPTIONS[1] : TARIFF_OPTIONS[0]

  const directHint =
    currency === 'cash'
      ? undefined
      : usesPoint
        ? blocked
          ? '시세를 넣어야 메소로 셀 수 있어요'
          : isFree
            ? `${directAmount.toLocaleString()} 메포`
            : conversionHint
        : formatMesoUnits(isFree ? totalMeso : directAmount)
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
    resetAmountRoll()
    // 관세는 아이템 구매에만 있다 — 다른 갈래로 갔다가 돌아오면 켜져 있던 것이 남으면 안 된다.
    if (next !== '아이템 구매') setHasTariff(false)
  }

  /**
   * 종류를 바꾼다([[ADR-173]] 정정 1 결정 5) — **수량은 1 로, 관세는 꺼진다.**
   *
   * 관세를 안 끄면 **화면에 없는 값이 저장된다**(소비·기타에는 그 체크가 아예 없다). 수량을
   * 되돌리는 것은 세는 대상이 바뀌기 때문이고, **친 금액은 남긴다** — 수량이 1 이면 장비의
   * «금액» 과 소비의 «단가» 가 같은 값이라 거짓이 되지 않는다.
   */
  function selectItemKind(next: SpendItemKind): void {
    setItemKind(next)
    setQuantity(1)
    setHasTariff(false)
    // 큰 숫자가 **무엇을 세는지가 바뀐다**(치는 금액 ↔ 합계 — 결정 12) — 굴리지 않고 갈아 끼운다.
    resetAmountRoll()
  }

  /** ① 대표를 고른다. 갈래가 하나뿐이면 **그 자리에서 항목까지 정해진다.** */
  function selectChoice(next: SpendCatalogChoice): void {
    resetAmountRoll()
    setChoice(next)
    setItem(next.items.length === 1 ? next.items[0] : null)
    // 형태는 있어도 **기본값을 안 고른다** — 앱이 «경험치였겠지» 라고 정하면 그것이 추정이 된다.
    setForm(null)
    // 대상이 바뀌면 수량을 되돌린다 — `DropPricePad` 가 금액을 되돌리는 것과 같은 이유다.
    setQuantity(1)
  }

  /** ② 그 안의 단계를 고른다. */
  function selectItem(next: SpendCatalogItem): void {
    resetAmountRoll()
    setItem(next)
    setQuantity(1)
  }

  /** 목록으로 돌아간다. */
  function clearChoice(): void {
    resetAmountRoll()
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
        // 종류는 「아이템 구매」의 것이다([[ADR-173]] 정정 1 결정 4) — 다른 갈래에서는 `null` 이라
        // «장비를 산 컨텐츠 지출» 같은 행이 생기지 않는다.
        itemKind: category === '아이템 구매' ? itemKind : null,
        // 수량은 **곱할 것이 있을 때만** 실린다([[ADR-173]] 결정 17 · 정정 1 결정 1 — [[ADR-166]]
        // 정정 1 ③ 의 «직접 입력에는 단가가 없다» 를 두 번에 걸쳐 좁힌 결과다). 장비는 하나를
        // 사므로 여기가 `null` 이고, 그 `null` 이 곧 «곱하지 않은 행» 이라는 사실이다.
        quantity: counts ? quantity : null,
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
          {/*
            **수정 모드의 머리는 «고른 것» 이다**([[ADR-173]] 결정 15, 사용자 지정 2026-08-26).
            목록 갈래면 그 항목(「악몽선경」), 직접 입력이면 갈래(「아이템 구매」)다. 되돌아갈 곳이
            없으므로(고른 것을 못 바꾼다) 화살촉도 없다.

            제목이 그것을 말하므로 **갈래 줄도 항목 줄도 안 세운다** — 같은 사실을 두 번 적는 일이다.
          */}
          {choice === null || editing ? (
            <Text
              testID="spend-sheet-title"
              numberOfLines={1}
              className="shrink text-base font-bold text-text"
            >
              {editing ? editingTitle : '지출 추가'}
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

        {/*
          **갈래 칩은 고르는 화면에만 선다**([[ADR-173]] 결정 8, 사용자 지정 2026-08-27).

          둘째 화면(고른 뒤)에서는 머리의 `‹` 가 이미 되돌아가는 길이다 — 칩까지 두면 «되돌아가는
          길이 둘» 이 되고, 그 화면이 답하는 질문(«얼마인가»)에 «무엇을» 이 섞인다. 직접 입력은
          고를 목록이 없어 `choice` 가 언제나 `null` 이라 칩이 그대로 선다.

          **수정 모드에도 없다**(결정 15) — 갈래를 바꾸면 그 기록은 «다른 것» 이 되고, 무엇이었는지는
          제목이 이미 말한다.
        */}
        {!editing && choice === null && (
          // **테스트가 이 줄을 지목할 수 있어야 한다** — 「기타」가 갈래 이름이자 「아이템 구매」의
          // 종류 이름이라([[ADR-173]] 정정 1) 라벨만으로는 둘이 안 갈린다.
          <View testID="spend-sheet-categories" className="flex-row flex-wrap gap-1.5">
            {SPEND_CATEGORIES.map((each) => (
              <CategoryChip
                key={each}
                label={each}
                selected={each === category}
                onPress={() => selectCategory(each)}
              />
            ))}
          </View>
        )}
        {direct ? (
          <>
            <CharacterRow characters={props.characters} selected={ocid} onSelect={setOcid} />

            <FieldRow label={NAME_LABELS[category]} labelTestID="spend-sheet-name-label">
              <TextInput
                testID="spend-sheet-name"
                value={name}
                onChangeText={setName}
                placeholder="비워 둬도 됩니다"
                className="flex-1 text-right text-sm text-text"
              />
            </FieldRow>

            {category === '아이템 구매' && (
              // **종류가 나머지 둘을 정한다**([[ADR-173]] 정정 1 결정 1) — 수량이 서는지, 관세가
              // 있는지. 세그먼트인 이유는 통화와 같다(결정 3): 갈래가 아니라 **값의 축**이다.
              // 게임의 인벤토리 탭 이름이라 「기타」가 갈래 칩과 겹치지만, 부르는 말을 나눈다.
              <FieldRow label="종류" testID="spend-sheet-item-kind">
                <Segment
                  options={SPEND_ITEM_KINDS}
                  selected={itemKind}
                  onSelect={selectItemKind}
                />
              </FieldRow>
            )}

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

            {counts && (
              // **통화 밑**이다(사용자 지정) — 무엇으로 내는지를 정한 다음에 얼마인지를 친다.
              // 이름이 갈린다: 「기타」는 «얼마를 썼나»(지출액), 아이템 구매는 **한 개 값**(단가)이다.
              <FieldRow label={isFree ? '지출액' : '단가'}>
                <TextInput
                  testID="spend-sheet-unit-price"
                  value={typed === 0 ? '' : typed.toLocaleString()}
                  onChangeText={(text) => setTyped(parseMesoText(typed, text))}
                  keyboardType="number-pad"
                  placeholder="0"
                  className="flex-1 text-right text-sm font-semibold text-text"
                  style={TABULAR_NUMS}
                />
                {/* 통화를 고르는 자리라 숫자만 있으면 무엇으로 낸 것인지 줄에서 사라진다
                    ([[ADR-170]] 정정 14 ④) — 큰 숫자가 이미 하는 일을 이 줄도 한다. */}
                <Text
                  testID="spend-sheet-unit-price-unit"
                  className="ml-1.5 shrink-0 text-xs font-semibold text-text-muted"
                >
                  {typedUnit}
                </Text>
              </FieldRow>
            )}

            {isFree && (
              // 「기타」가 세는 것은 «몇 회» 라 **스테퍼 그대로**다([[ADR-173]] 결정 18) — 자릿수가
              // 아래 칸과 다르고, 둘이 한 화면에 함께 서지 않는다(갈래가 시트 밖에서 갈렸다).
              <FieldRow label="수량">
                <QuantityStepper value={quantity} onChange={setQuantity} testID="spend-sheet-quantity" />
              </FieldRow>
            )}

            {category === '아이템 구매' && !counts && (
              /*
                **관세도 라벨–값 줄이다**([[ADR-173]] 정정 1 결정 6, 사용자 지정) — 시트에서 고르는
                것은 전부 이 모양인데(결정 1) 관세만 큰 숫자 밑의 **맨몸 체크박스**였다. 자리가
                밑에서 위로 온 것은 모양을 따라온 결과다: 라벨–값 줄은 큰 숫자 **위**에 사는
                물건이고, 그래도 **큰 숫자와 붙어 있어** «누르면 저것이 움직인다» 가 안 끊긴다.

                **장비에만 선다**(정정 1 결정 1) — 소비·기타는 **월드 간 거래가 안 되므로** 그 줄을
                두면 있을 수 없는 것을 물을 수 있게 된다. 끄는 것이 아니라 **줄 자체가 없다**:
                있는데 못 누르면 «왜 못 누르나» 를 새로 묻게 된다.

                **더해지는 금액을 안 적는 것**은 결정 5 그대로다 — 큰 숫자가 그만큼 올라간다.
              */
              <FieldRow label="관세" testID="spend-sheet-tariff">
                <Segment
                  options={TARIFF_OPTIONS}
                  selected={tariffOption}
                  onSelect={(option) => setHasTariff(option !== '없음')}
                />
              </FieldRow>
            )}

            {counts && !isFree && (
              // **스테퍼가 아니라 치는 칸**이다([[ADR-173]] 정정 1 결정 3, 사용자 지정) — 주문서
              // 300장을 스테퍼로 세면 300번을 누른다([[ADR-175]] 결정 8 이 솔 에르다 조각에서 온
              // 그 결론). **단위를 안 적는다**(결정 17) — 자유 입력이라 앱이 무엇을 세는지 모른다.
              <FieldRow label="수량">
                <TextInput
                  testID="spend-sheet-quantity"
                  value={quantity === 0 ? '' : quantity.toLocaleString()}
                  onChangeText={(text) => setQuantity(parseMesoText(quantity, text))}
                  keyboardType="number-pad"
                  placeholder="0"
                  className="flex-1 text-right text-sm font-semibold text-text"
                  style={TABULAR_NUMS}
                />
              </FieldRow>
            )}

            {usesPoint && <RateRow value={rateText} onChange={setRateText} valid={rate !== null} />}

            <AmountFigure
              value={freeTotal}
              // **칠 때는 구입가, 손을 떼면 합계**([[ADR-173]] 결정 6) — 관세를 켜면 그 사이를 굴러
              // 넘어간다. 그래서 더해지는 금액을 따로 안 적는다(결정 5).
              displayValue={hasTariff && currency === 'meso' ? tariffed.mesoAmount : undefined}
              unit={freeUnit}
              testID="spend-sheet-amount"
              identity={amountIdentity}
              hint={directHint}
              hintBlocked={blocked}
              // **곱할 것이 있으면 못 친다**(결정 17 · 정정 1 결정 2) — 앱이 세는 값을 사람이
              // 덮어쓰면 어느 쪽이 참인지 사라진다. 장비는 곱할 것이 없어 여전히 친다.
              readOnly={counts}
              onChangeValue={setTyped}
            />

          </>
        ) : choice === null && !editing ? (
          // **여기에 스크롤을 두지 않는다.** 시트 껍데기가 이미 `BottomSheetScrollView` 이고
          // 높이도 «내용만큼, 82% 를 상한으로» 다(`BottomSheet`). 안쪽에 또 두면 중첩 스크롤이
          // 되어 손가락이 어느 쪽을 미는지 갈리고, 무엇보다 **목록이 상한선에서 잘려** 「더
          // 있는지」가 안 보였다(iOS 실측 2026-08-25).
          // (`) : (` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <View className="gap-1">
            {groups.map((group) => (
              <View key={group.group} className="gap-1 pb-2">
                {/*
                  **안 열린 묶음은 지우지 않고 흐리게 둔다**([[ADR-166]] 정정 5, 사용자 선택).

                  기간제 이벤트(메이플 포인트 샵)는 열릴 때만 있는 것이라 숨기면 «그런 것이
                  있었지» 를 기억할 자리가 사라진다. 자리는 남기고 **못 고르게** 한다 — 그리고
                  이미 적어 둔 기록에는 영향이 없다(`active` 는 «지금 새로 고를 수 있나» 다).
                */}
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[11px] text-text-disabled">{group.group}</Text>
                  {!group.active && (
                    <Text
                      testID={`spend-sheet-closed-${group.group}`}
                      className="text-[11px] text-text-disabled"
                    >
                      · 이벤트 기간이 아닙니다
                    </Text>
                  )}
                </View>
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
                      disabled={!group.active}
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

            {scope !== null && scope.maxQuantity !== 1 && (
              /*
               * 단위·상한은 **대표가 안다** — 단계를 고르기 전에도 선다.
               *
               * **상한이 1이면 안 세운다**([[ADR-170]] 정정 14 ①). 오르내릴 자리가 없는 스테퍼는
               * «조절할 수 있다» 는 거짓말이다. 에픽던전 추가 리워드(메이플 ID 당 주 1회)와
               * 미호로이드가 거기 든다 — 특별 취급이 아니라 규칙 하나다.
               */
              <FieldRow label="수량">
                <QuantityStepper
                  value={quantity}
                  max={scope.maxQuantity}
                  onChange={setQuantity}
                  testID="spend-sheet-quantity"
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
                identity={amountIdentity}
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
