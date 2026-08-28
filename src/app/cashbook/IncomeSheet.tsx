/**
 * 수입 기록 시트 — **갈래 셋, 폼은 하나**([[ADR-170]] 결정 1·6).
 *
 * 지출 시트와 폼이 통째로 다르다. 수입은 **통화가 메소 하나뿐**이라(결정 1) 시세도 관세도 수량도
 * 없고, 갈래는 첫 칸의 **라벨만** 바꾼다 — 아이템 판매는 「판 것」, 사냥은 「사냥터」, 기타는 「내용」.
 * 그래서 갈래를 늘려도 폼이 갈라지지 않는다.
 *
 * ## 여기 서는 것은 **손입력 수익**뿐이다
 *
 * 보스 드롭은 이 시트로 안 들어온다([[ADR-170]] 결정 3) — 이미 보스 수익 탭이 기록하고, 두 곳에서
 * 적으면 같은 판매가 두 벌이 된다. 캘린더는 그것을 **읽어서** 같은 목록에 세우되 여기서 못 고친다.
 *
 * ## 뼈대는 **지출 시트와 같다** ([[ADR-173]] 결정 10)
 *
 * 제목 · 갈래 칩 · 라벨–값 줄 · **큰 숫자 + 힌트** · 저장. 통화 줄이 없고(메소 하나뿐) 갈래가
 * 셋일 뿐이다 — 한 곳을 고치면 두 시트가 같이 고쳐진다.
 *
 * **큰 숫자는 화면에 하나**이고 저장 바로 위에 선다(결정 1). 합계 카드가 없으므로 같은 값이 두 번
 * 적히지 않는다. 억/만은 그 밑 **힌트 한 줄**이다(결정 2).
 *
 * ## 「사냥」만 **계산기**다 ([[ADR-175]])
 *
 * 나머지 둘은 «얼마 벌었나» 를 사람이 알지만 사냥 메소는 **맵이 정해지면 셀 수 있는 값**이라
 * 앱이 낸다. 그래서 이 갈래에서만 줄이 여럿 서고(지역 · 사냥터 · 효율 · 버프 · 소재 · 조각)
 * 큰 숫자가 **못 치는 합계**가 된다 — 아이템 판매·「기타」와 같은 모양이다.
 *
 * 계산은 한 자리에 있다(`lib/hunting-meso.ts`) — 이 파일은 고른 것을 넘기고 받은 숫자를 그린다.
 * **[[ADR-175]] 이전에 적힌 사냥 행**은 계산 입력이 없어(`hunt === null`) 계산기가 아니라
 * 종전 모양으로 열린다: 없는 입력을 지어내지 않는다.
 *
 * 금액은 **OS 키보드**로 친다([[ADR-170]] 정정 4) — 이 시트는 이름 칸 때문에 어차피 키보드를
 * 부르므로 앱 키패드를 안 부르는 이득이 없다. 빠른 칩은 폼이 아니라 **키보드 위**에 있다(결정 4).
 *
 * 제목은 **안 바뀐다**(결정 7) — 「수입 추가」·「수입 수정」 둘뿐이고, 갈래를 골라도 그대로다.
 *
 * ## 아이템 판매만 **수수료를 뗀다** ([[ADR-170]] 정정 9)
 *
 * 경매장이 3% 또는 5% 를 떼므로 «판 값» 과 «번 돈» 이 다르다. 그래서 이 갈래에서만 줄이 둘 더
 * 서고(**판매 대금** · **수수료**) 큰 숫자가 **합계**가 된다 — 지출 시트의 「기타」와 같은 모양이라
 * 못 친다([[ADR-173]] 결정 17). 요율은 [[ADR-168]] 의 것을 **그대로 부른다**(`netProceedsMeso`):
 * 여기서 다시 짜면 분배 계산기와 1 메소가 어긋난다.
 */
import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'

// `TextInput` 도 atom 에서 온다 — 시스템 글자 크기 클램프가 거기 있다([[ADR-152]] 결정 4).
import { Text, TextInput } from '../../components/atoms/Text/Text'
import { parseMesoText } from '../../components/molecules/MesoPad/meso-pad'
import { AmountFigure } from '../../components/molecules/AmountFigure/AmountFigure'
import { Segment } from '../../components/molecules/Segment/Segment'
import {
  SelectField,
  type SelectOption,
} from '../../components/organisms/SelectField/SelectField'
import { characterOptions } from './character-options'
import { FieldRow, QuantityStepper } from './sheet-fields'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { formatDayLabel } from '../../lib/calendar-month'
import { formatMesoUnits } from '../../lib/drop-price'
import {
  FREE_CURRENCY_LABELS,
  currencyOfLabel,
  labelOfCurrency,
  unitOfCurrency,
  type FreeCurrency,
} from '../../lib/free-currency'
import { forceIconOf, FORCE_LABELS } from '../../lib/force-icons'
import {
  findHuntingGround,
  findHuntingRegion,
  huntingGroundsFor,
  huntingRegionsForLevel,
} from '../../lib/hunting-grounds'
import {
  MESO_BOOSTS,
  MISSED_MOB_OPTIONS,
  boostPercentOf,
  efficiencyPercentOf,
  huntingMesoOf,
  huntingTotalOf,
  killedMobsOf,
} from '../../lib/hunting-meso'
import { pointToMeso } from '../../lib/spend-catalog'
import { netProceedsMeso, type FeePercent } from '../../lib/item-split'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { INCOME_CATEGORIES, type IncomeCategory, type IncomeRecord } from '../../storage/income'
import type { HuntingGround, HuntingRegion } from '../../types/hunting-grounds'

/** 저장할 값에서 **화면이 아니라 부르는 쪽이 정하는 것 둘**(`id`·`recordedAt`)을 뺀 나머지. */
export type IncomeDraft = Omit<IncomeRecord, 'id' | 'recordedAt'>

/**
 * 첫 칸의 이름 — 갈래가 바꾸는 **유일한** 것이다.
 *
 * 라벨을 갈래별로 두는 이유는 «무엇을 적으라는 것인가» 가 갈래마다 다르기 때문이다. 하나로
 * («내용») 두면 사냥에서 맵 이름을 적어야 하는지 알 수 없다.
 */
const NAME_LABELS: Record<IncomeCategory, string> = {
  '아이템 판매': '판매 아이템',
  사냥: '사냥터',
  기타: '내용',
}

/**
 * 수수료 조각 셋 — **「없음」 이 첫 조각이고 기본값**이다([[ADR-170]] 정정 9 ②).
 *
 * 3%·5% 만 두면 직거래를 못 적고, 무엇보다 **정정 9 이전에 적힌 행**이 거짓이 된다: 수정 시트가
 * 그 행을 열 때 요율 하나를 억지로 세우면 열기만 해도 금액이 달라진다.
 */
const FEE_OPTIONS = ['없음', '3%', '5%'] as const

type FeeOption = (typeof FEE_OPTIONS)[number]

function feeOptionOf(percent: FeePercent | null): FeeOption {
  return percent === null ? '없음' : (`${percent}%` as FeeOption)
}

function feePercentOf(option: FeeOption): FeePercent | null {
  return option === '없음' ? null : (Number(option.replace('%', '')) as FeePercent)
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
        props.selected ? 'border-transparent bg-rise-ink' : 'border-border'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${props.selected ? 'text-bg' : 'text-text-muted'}`}
      >
        {props.label}
      </Text>
    </Pressable>
  )
}

/**
 * 포스 배지 — **그림 + 숫자**다([[ADR-175]] 결정 10).
 *
 * 그림이 없으면 **글자만으로 선다**(`아케인 700`) — 비슷한 그림을 갖다 붙이면 틀린 것을 그리는
 * 셈이다([[ADR-170]] 정정 16 이 지출 타일에 세운 규칙과 같다). 읽어 주는 이름은 언제나 온전한
 * 말이라 그림이 있든 없든 「어센틱 포스 700」 으로 들린다.
 */
function ForceBadge(props: { region: HuntingRegion; force: number }): React.JSX.Element {
  const icon = forceIconOf(props.region.forceType)
  const label = FORCE_LABELS[props.region.forceType]
  return (
    <View
      testID="force-badge"
      aria-label={`${label} ${props.force}`}
      className="flex-row items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5"
    >
      {icon === null ? (
        <Text className="text-[10px] font-semibold text-text-muted">{label.split(' ')[0]}</Text>
      ) : (
        <Image source={icon} className="h-3.5 w-3.5" resizeMode="contain" aria-hidden />
      )}
      <Text className="text-[11px] font-semibold text-text-muted" style={TABULAR_NUMS}>
        {props.force}
      </Text>
    </View>
  )
}

/** 사냥터 목록의 한 줄 — 이름 · 포스 배지 · 레벨 · 마릿수([[ADR-175]] 결정 10). */
function GroundOptionRow(props: {
  region: HuntingRegion
  ground: HuntingGround
  isSelected: boolean
}): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-2">
      <Text
        numberOfLines={1}
        className={`shrink text-sm ${
          props.isSelected ? 'font-semibold text-primary-ink' : 'text-text'
        }`}
      >
        {props.ground.name}
      </Text>
      <View className="ml-auto flex-row shrink-0 items-center gap-2">
        <ForceBadge region={props.region} force={props.ground.force} />
        <Text className="text-[11px] text-text-muted" style={TABULAR_NUMS}>
          {levelLabelOf(props.ground)}
        </Text>
        <Text className="text-[11px] text-text-muted" style={TABULAR_NUMS}>
          {props.ground.mobs}마리
        </Text>
      </View>
    </View>
  )
}

/** 「lv.294」·「lv.200-201」 — 원 자료의 표기를 그대로 되돌린다. */
function levelLabelOf(ground: HuntingGround): string {
  return `lv.${ground.levels.join('-')}`
}

/**
 * 메소 획득률 아이템 칩 — **켜고 끄는** 것이라 갈래 칩과 달리 여럿이 동시에 켜진다.
 *
 * 증가율을 이름 옆에 적는 이유는 합연산이기 때문이다 — 둘을 켰을 때 왜 ×1.7 인지가 칩에 보인다.
 */
function BoostChip(props: {
  label: string
  percent: number
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-selected={props.selected}
      onPress={props.onPress}
      className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 ${
        props.selected ? 'border-transparent bg-primary-tint' : 'border-border'
      }`}
    >
      <Text
        className={`text-xs ${
          props.selected ? 'font-semibold text-primary-ink' : 'text-text-muted'
        }`}
      >
        {props.label}
      </Text>
      <Text
        className={`text-[11px] ${props.selected ? 'text-primary-ink' : 'text-text-disabled'}`}
        style={TABULAR_NUMS}
      >
        +{props.percent}%
      </Text>
    </Pressable>
  )
}

export interface IncomeSheetProps {
  dateKey: string
  /**
   * 고를 수 있는 캐릭터([[ADR-166]] 결정 3) — 화면이 읽어서 넘긴다(시트는 `storage/` 를 모른다).
   * 비어 있으면 고르개에 「선택 안함」 하나만 선다.
   *
   * `level` 은 **사냥 계산기가 쓴다**([[ADR-175]] 결정 6) — 지역 목록을 ±20 으로 거르고 레벨 차이
   * 페널티를 낸다. 캐시에 없으면 `null` 이고, 그때는 페널티 없이 계산하며 그 사실을 화면이 말한다.
   */
  characters: ReadonlyArray<{ ocid: string; name: string; level: number | null }>
  /**
   * 마지막으로 쓴 메소마켓 시세 — 「기타」를 메포로 적을 때의 기본값이다([[ADR-170]] 정정 15).
   * 지출 시트와 **같은 계약**이라 화면이 한 값을 두 시트에 그대로 넘긴다.
   */
  lastPointRate: number | null

  /**
   * 고칠 기록. 있으면 **수정 모드**다([[ADR-171]] 결정 2) — 머리와 버튼 글자가 갈리고 삭제가 선다.
   */
  editing?: IncomeRecord
  onDelete?: () => void | Promise<void>
  /** 던지면 **안 닫는다** — 친 것을 잃지 않는다. 실패를 말하는 것은 화면 몫이다(토스트). */
  onSave: (draft: IncomeDraft) => void | Promise<void>
  onClose: () => void
}

export function IncomeSheet(props: IncomeSheetProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const [category, setCategory] = useState<IncomeCategory>(
    props.editing?.category ?? INCOME_CATEGORIES[0],
  )
  const [name, setName] = useState(props.editing?.item ?? '')
  /** **기본은 「선택 안함」**(사용자 지정 2026-08-26) — 수익은 «내가 번 돈» 이 기본이다. */
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  /**
   * 치는 값은 **판매 대금**이다 — 행에 남는 것은 수수료를 뗀 값이라, 되짚을 때 뗀 몫을 되돌린다
   * ([[ADR-170]] 정정 9 ⑤). 요율만 들고 역산하면 내림 때문에 1 메소가 어긋난다.
   */
  const [gross, setGross] = useState(
    (props.editing?.mesoAmount ?? 0) + (props.editing?.saleFeeMeso ?? 0),
  )
  const [feePercent, setFeePercent] = useState<FeePercent | null>(
    props.editing?.saleFeePercent ?? null,
  )
  /**
   * 「기타」가 고르는 통화([[ADR-170]] 정정 15 결정 2) — 이벤트 보상이 메포·캐시로도 들어온다.
   *
   * 수정으로 열 때는 **찬 칸이 통화를 되짚는다**(지출 시트와 같은 방식) — 캐시 칸이 차 있으면
   * 캐시로 열려야 그 값이 안 사라진다.
   */
  const [freeCurrency, setFreeCurrency] = useState<FreeCurrency>(
    props.editing?.cashAmount !== undefined && props.editing.cashAmount !== null
      ? 'cash'
      : props.editing?.pointAmount !== undefined && props.editing.pointAmount !== null
        ? 'point'
        : 'meso',
  )
  /** 메포로 적을 때만 쓰는 시세 — 글자로 든다(지출 시트와 같다: 지우는 중간 상태가 있다). */
  const [rateText, setRateText] = useState(
    (props.editing?.pointPer100mMeso ?? props.lastPointRate)?.toString() ?? '',
  )

  /**
   * 사냥 계산기의 입력([[ADR-175]]) — 수정으로 열면 **저장해 둔 것이 그대로 선다**(결정 9).
   *
   * 캐릭터 레벨을 상태로 드는 이유는 **그때의 값**이어야 하기 때문이다(결정 9): 캐릭터는
   * 레벨업하므로 지금 레벨을 다시 읽으면 옛 기록의 금액이 열 때마다 달라진다. 대신 사용자가
   * 고르개로 캐릭터를 **바꾸면** 그 캐릭터의 지금 레벨로 갈아 끼운다 — 그건 사용자가 한 일이다.
   */
  const [huntLevel, setHuntLevel] = useState<number | null>(
    props.editing?.hunt?.characterLevel ??
      props.characters.find((each) => each.ocid === props.editing?.ocid)?.level ??
      null,
  )
  /** 고른 사냥터 이름 — 지역은 여기서 따라온다(이름이 전역 유일이다, [[ADR-175]] 결정 2). */
  const [groundName, setGroundName] = useState<string | null>(
    props.editing?.hunt === null || props.editing?.hunt === undefined
      ? null
      : (props.editing.item ?? null),
  )
  /** 고른 지역. 사냥터를 아직 안 골랐어도 지역만 골라 둔 상태가 있다. */
  const [regionSlug, setRegionSlug] = useState<string | null>(
    groundName === null ? null : (findHuntingGround(groundName)?.region.slug ?? null),
  )
  /**
   * 고르는 것은 **놓치는 마릿수**(0~4)이지 퍼센트가 아니다([[ADR-175]] 결정 3) — 효율 %는 맵이
   * 정하는 라벨이라 맵을 바꾸면 같은 조각의 글자가 달라진다(40마리 −1 = 98% · 22마리 −1 = 95%).
   */
  const [missedMobs, setMissedMobs] = useState(props.editing?.hunt?.missedMobs ?? 0)
  const [boosts, setBoosts] = useState<readonly string[]>(props.editing?.hunt?.boosts ?? [])
  const [sojae, setSojae] = useState(props.editing?.hunt?.sojae ?? 1)
  const [fragments, setFragments] = useState(props.editing?.hunt?.fragments ?? 0)
  const [fragmentPrice, setFragmentPrice] = useState(props.editing?.hunt?.fragmentPrice ?? 0)

  /** 저장이 도는 동안 다시 못 누르게 막는다 — 손입력은 두 번 눌리면 행이 둘이 된다. */
  const [saving, setSaving] = useState(false)

  // 판매 대금·수수료 줄은 **아이템 판매에만** 선다(정정 9 ②) — 사냥 메소에는 경매장이 없다.
  const isSale = category === '아이템 판매'
  /**
   * **[[ADR-175]] 이전에 적힌 사냥 행**은 계산 입력이 없다(결정 9). 그때는 계산기가 아니라 종전
   * 모양(자유 입력 + 직접 치는 금액)으로 연다 — 없는 입력을 지어내면 «내가 그렇게 골랐나» 가 된다.
   */
  const isLegacyHunt =
    props.editing !== undefined && props.editing.category === '사냥' && props.editing.hunt === null
  /** 계산기가 서는 자리 — 사냥 갈래이면서 옛 행이 아닐 때. */
  const isHunt = category === '사냥' && !isLegacyHunt

  const huntRegions = huntingRegionsForLevel(huntLevel)
  const huntRegion = regionSlug === null ? null : findHuntingRegion(regionSlug)
  /**
   * 목록에 서는 차례 — **레벨 차이가 적은 순, 같으면 마릿수가 많은 순**([[ADR-175]] 결정 6-1).
   * 거르는 것이 아니라 줄 세우는 것이라 지역 안의 맵은 전부 든다.
   */
  const huntGrounds = huntRegion === null ? [] : huntingGroundsFor(huntRegion, huntLevel)
  const huntGround =
    groundName === null || huntRegion === null
      ? null
      : (huntRegion.grounds.find((each) => each.name === groundName) ?? null)
  const boostPercent = boostPercentOf(boosts)
  const huntInput = {
    characterLevel: huntLevel,
    missedMobs,
    boostPercent,
    sojae,
  }
  /** 사냥터를 안 골랐으면 0 이다 — 계산기가 반쯤 찬 상태이고, 그때도 조각 값은 선다. */
  const huntMeso = huntGround === null ? 0 : huntingMesoOf({ ...huntInput, ground: huntGround })
  const huntTotal = huntingTotalOf({ ...huntInput, ground: huntGround, fragments, fragmentPrice })
  /**
   * **통화가 서는 자리는 「기타」 하나**다([[ADR-170]] 정정 15 결정 2) — 아이템 판매는 경매장이라
   * 메소이고 사냥도 메소다. 갈래가 이미 아는 것을 다시 묻지 않는다.
   */
  const isFree = category === '기타'
  const currency: FreeCurrency = isFree ? freeCurrency : 'meso'
  const usesPoint = currency === 'point'
  const rate = /^\d+$/.test(rateText) && Number(rateText) > 0 ? Number(rateText) : null
  /** [[ADR-168]] 의 계산을 **그대로 부른다** — 수수료 쪽을 내림한다(= 손에 남는 쪽이 커진다). */
  const net = feePercent === null ? gross : netProceedsMeso(gross, feePercent)

  /**
   * 메포로 적으면 **시세가 있어야** 잰다 — 지출 시트와 같은 계약이다([[ADR-166]] 정정 2 ④).
   * 사냥은 **합계가 0 보다 크면** 된다 — 사냥터를 안 골라도 조각만 적을 수 있다.
   */
  const canSave = isHunt ? huntTotal > 0 : gross > 0 && (!usesPoint || rate !== null)
  /** 메포를 메소 축으로 옮긴 값 — 큰 숫자 밑 힌트가 이것을 말한다. */
  const pointMeso = usesPoint && rate !== null ? pointToMeso(gross, rate) : 0
  /**
   * 큰 숫자 밑 한 줄 — **0 일 때도 빈 줄로 자리를 지킨다**(사라지면 첫 타건에 아래가 밀린다).
   */
  const incomeHint = isHunt
    ? huntTotal > 0
      ? formatMesoUnits(huntTotal)
      : ' '
    : currency === 'cash'
      ? '캐시는 메소로 환산하지 않아요'
      : usesPoint
        ? rate === null
          ? '시세를 넣어야 메소로 셀 수 있어요'
          : gross > 0
            ? `${pointMeso.toLocaleString()} 메소`
            : ' '
        : net > 0
          ? formatMesoUnits(net)
          : ' '

  /** 갈래를 옮기면 **골라 둔 요율이 풀린다**(정정 9 ②) — 관세가 갈래를 옮길 때 꺼지는 것과 같다. */
  function selectCategory(next: IncomeCategory): void {
    setCategory(next)
    setFeePercent(null)
  }

  /**
   * 캐릭터를 고르면 **레벨이 따라 바뀌고**, 그 레벨의 창 밖으로 나간 지역은 풀린다
   * ([[ADR-175]] 결정 6).
   *
   * 안 풀면 고르개가 «목록에 없는 값» 을 들게 되어 트리거가 첫 칸(「선택 안함」)을 읽어 준다 —
   * 화면에는 다른 지역이 적히는데 계산은 옛 사냥터로 도는 상태가 된다.
   */
  function selectCharacter(next: string | null): void {
    setOcid(next)
    const level = next === null ? null : (props.characters.find((each) => each.ocid === next)?.level ?? null)
    setHuntLevel(level)
    if (regionSlug !== null && !huntingRegionsForLevel(level).some((each) => each.slug === regionSlug)) {
      setRegionSlug(null)
      setGroundName(null)
    }
  }

  /** 지역을 옮기면 **사냥터가 풀린다** — 그 지역에 없는 맵이 남으면 계산이 남의 맵으로 돈다. */
  function selectRegion(next: string | null): void {
    setRegionSlug(next)
    setGroundName(null)
  }

  function toggleBoost(id: string): void {
    setBoosts((current) =>
      current.includes(id) ? current.filter((each) => each !== id) : [...current, id],
    )
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
        earnedOn: props.dateKey,
        category,
        // 빈 칸은 `null` 이다 — 빈 문자열을 넣으면 «적었는데 비어 있다» 와 «안 적었다» 가 같아진다.
        // 사냥은 **고른 사냥터의 이름**이 그 자리다([[ADR-175]] 결정 9 — 전역 유일이라 지역이 따라온다).
        item: isHunt ? groundName : name.trim() === '' ? null : name.trim(),
        // **수수료를 뗀 값**이다(정정 9 ⑤) — 집계가 보는 칸이 이것 하나다.
        // 통화가 갈리는 갈래에서는 **고른 통화의 칸에만** 담는다([[ADR-170]] 정정 15).
        // 사냥은 **합계**다(메소 + 조각 × 가격) — 큰 숫자에 서는 그 값이다.
        mesoAmount: isHunt ? huntTotal : currency === 'meso' ? net : null,
        saleFeePercent: feePercent,
        saleFeeMeso: feePercent === null ? null : gross - net,
        pointAmount: currency === 'point' ? gross : null,
        pointPer100mMeso: currency === 'point' ? rate : null,
        cashAmount: currency === 'cash' ? gross : null,
        // **계산 입력을 함께 남긴다**([[ADR-175]] 결정 9) — 없으면 수정 시트가 빈 계산기로 열려
        // 만지는 순간 금액이 덮인다. 다른 갈래에서는 `null` 이다.
        hunt: isHunt
          ? {
              characterLevel: huntLevel,
              missedMobs,
              boosts: [...boosts],
              sojae,
              fragments,
              fragmentPrice,
            }
          : null,
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
      testId="income-sheet"
      onClose={props.onClose}
    >
      <View className="gap-3 px-4 pb-2">
        <View className="flex-row items-baseline justify-between gap-2">
          {/* **수정 모드의 머리는 «고른 것»** 이다([[ADR-173]] 결정 15, 사용자 지정) — 수입은
              고를 것이 갈래뿐이라 그것이 곧 제목이다. 제목이 말하므로 아래 칩은 안 선다. */}
          <Text
            testID="income-sheet-title"
            numberOfLines={1}
            className="shrink text-base font-bold text-rise-ink"
          >
            {editing ? category : '수입 추가'}
          </Text>
          <Text
            testID="income-sheet-date"
            className="text-xs text-text-muted"
            style={TABULAR_NUMS}
          >
            {formatDayLabel(props.dateKey)}
          </Text>
        </View>

        {/* **수정 모드에는 칩이 없다**(결정 15) — 갈래를 바꾸면 그 기록은 «다른 것» 이 되고,
            무엇이었는지는 **제목**이 이미 말한다. */}
        {!editing && (
          <View className="flex-row flex-wrap gap-1.5">
            {INCOME_CATEGORIES.map((each) => (
              <CategoryChip
                key={each}
                label={each}
                selected={each === category}
                onPress={() => selectCategory(each)}
              />
            ))}
          </View>
        )}

        <SelectField
          label="캐릭터"
          options={characterOptions(props.characters)}
          selected={ocid}
          // 사냥에서는 캐릭터가 **레벨의 출처**이기도 하다([[ADR-175]] 결정 6).
          onSelect={selectCharacter}
          testID="income-sheet-character"
        />

        {/* 이름 칸은 **계산기가 아닐 때만** 선다 — 사냥터는 고르개 둘이 정한다([[ADR-175]]). */}
        {!isHunt && (
          <View className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2">
            <Text testID="income-sheet-name-label" className="text-xs text-text-muted">
              {NAME_LABELS[category]}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="비워 둬도 됩니다"
              className="flex-1 text-right text-sm text-text"
            />
          </View>
        )}

        {isHunt && (
          // 계산기의 줄들. 차례가 곧 계산 차례다 — 어디서 · 얼마나 오래 · 무슨 버프로 → 얼마.
          // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <>
            <SelectField
              label="지역"
              options={[
                { value: null, label: '선택 안함' },
                ...huntRegions.map((region) => ({ value: region.slug, label: region.name })),
              ]}
              selected={regionSlug}
              onSelect={selectRegion}
              testID="income-sheet-region"
            />

            <SelectField
              label="사냥터"
              options={
                huntRegion === null
                  ? [{ value: null, label: '지역을 먼저 고르세요' }]
                  : [
                      { value: null, label: '선택 안함' },
                      ...huntGrounds.map((ground) => ({
                        value: ground.name,
                        label: ground.name,
                      })),
                    ]
              }
              selected={groundName}
              onSelect={setGroundName}
              testID="income-sheet-ground"
              // 목록 한 줄에 포스 배지·레벨·마릿수가 함께 선다([[ADR-175]] 결정 10·11).
              renderOption={(option: SelectOption, isSelected: boolean) => {
                const ground =
                  huntRegion === null || option.value === null
                    ? null
                    : (huntRegion.grounds.find((each) => each.name === option.value) ?? null)
                return ground === null || huntRegion === null ? (
                  <Text
                    numberOfLines={1}
                    className={`text-sm ${
                      isSelected ? 'font-semibold text-primary-ink' : 'text-text'
                    }`}
                  >
                    {option.label}
                  </Text>
                ) : (
                  <GroundOptionRow region={huntRegion} ground={ground} isSelected={isSelected} />
                )
              }}
            />

            {huntGround !== null && huntRegion !== null && (
              // 고른 사냥터의 값이 **자기 줄**로 선다 — 닫힌 고르개는 이름만 그리므로(결정 11)
              // 여기가 없으면 무엇을 골랐는지의 근거가 화면에서 사라진다.
              <View
                testID="income-sheet-ground-detail"
                className="flex-row items-center justify-end gap-2 pb-1"
              >
                <ForceBadge region={huntRegion} force={huntGround.force} />
                <Text className="text-[11px] text-text-muted" style={TABULAR_NUMS}>
                  {levelLabelOf(huntGround)}
                </Text>
                {/* **감소한 마릿수**를 적는다(사용자 지정 2026-08-28) — 사냥터 목록은 맵의 제원
                    (40마리)을 적지만 이 줄은 «실제로 잡는 수» 다. 그것이 곧 계산에 드는 값이다. */}
                <Text
                  testID="income-sheet-killed-mobs"
                  className="text-[11px] text-text-muted"
                  style={TABULAR_NUMS}
                >
                  {killedMobsOf(huntGround.mobs, missedMobs)}마리
                </Text>
              </View>
            )}

            {huntGround !== null && (
              // **효율 조각은 맵이 정한다**([[ADR-175]] 결정 3) — 40마리의 −1 은 98%, 22마리의
              // −1 은 95% 다. 그래서 사냥터를 고르기 전에는 적을 글자가 없어 줄이 아예 안 선다.
              // 고른 조각(놓치는 마릿수)은 맵이 바뀌어도 그대로다 — 글자만 다시 계산된다.
              <FieldRow label="사냥 효율" testID="income-sheet-efficiency">
                <Segment
                  options={MISSED_MOB_OPTIONS.map(
                    (missed) => `${efficiencyPercentOf(huntGround.mobs, missed)}%`,
                  )}
                  selected={`${efficiencyPercentOf(huntGround.mobs, missedMobs)}%`}
                  onSelect={(option) => {
                    const picked = MISSED_MOB_OPTIONS.find(
                      (missed) => `${efficiencyPercentOf(huntGround.mobs, missed)}%` === option,
                    )
                    if (picked !== undefined) setMissedMobs(picked)
                  }}
                />
              </FieldRow>
            )}

            {/* 켜고 끄는 칩이라 **여럿이 동시에 켜진다** — 갈래 칩과 다른 성질이다. 합연산이므로
                증가율을 칩에 적어 둔다(둘을 켰을 때 왜 ×1.7 인지가 보인다). */}
            <View
              testID="income-sheet-boosts"
              className="flex-row items-center gap-3 border-b border-border pb-2"
            >
              <Text className="shrink-0 text-xs text-text-muted">메소 획득률</Text>
              <View className="flex-1 flex-row flex-wrap items-center justify-end gap-1.5">
                {MESO_BOOSTS.map((boost) => (
                  <BoostChip
                    key={boost.id}
                    label={boost.label}
                    percent={boost.percent}
                    selected={boosts.includes(boost.id)}
                    onPress={() => toggleBoost(boost.id)}
                  />
                ))}
              </View>
            </View>

            {/* 「소재」는 사용자가 실제로 세는 단위다([[ADR-175]] 결정 7) — 하나가 30분. */}
            <FieldRow label="시간">
              <QuantityStepper
                value={sojae}
                onChange={setSojae}
                label="소재"
                testID="income-sheet-sojae"
              />
              <Text className="ml-2 shrink-0 text-xs text-text-muted">소재</Text>
            </FieldRow>

            {/* **못 친다** — 앱이 세는 값이다. 큰 숫자(합계)와 다른 값이라 자기 줄을 갖는다. */}
            <FieldRow label="획득 메소">
              <Text
                testID="income-sheet-hunt-meso"
                className="text-sm font-semibold text-text"
                style={TABULAR_NUMS}
              >
                {huntMeso.toLocaleString()}
              </Text>
              <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메소</Text>
            </FieldRow>

            {huntLevel === null && (
              // **조용히 후한 숫자를 내지 않는다**([[ADR-175]] 결정 6) — 캐릭터를 안 고르면
              // 레벨을 모르므로 페널티가 0 이고, 그 사실을 여기서 말한다.
              <Text
                testID="income-sheet-hunt-level-notice"
                className="-mt-1 text-right text-[11px] text-text-muted"
              >
                캐릭터를 고르면 레벨 차이가 반영돼요
              </Text>
            )}

            {/* **직접 입력**이다([[ADR-175]] 결정 8) — 앱이 추정하면 틀린 값을 확신 있게 적는 셈이다.
                스테퍼가 아니라 **치는 칸**인 이유는 30분에 10개 내외라 8소재면 80개가 넘어서다
                (사용자 지적 2026-08-28) — 스테퍼로는 여든 번을 눌러야 한다. */}
            <FieldRow label="솔 에르다 조각">
              <TextInput
                testID="income-sheet-fragments"
                value={fragments === 0 ? '' : fragments.toLocaleString()}
                onChangeText={(text) => setFragments(parseMesoText(fragments, text))}
                keyboardType="number-pad"
                placeholder="0"
                className="flex-1 text-right text-sm font-semibold text-text"
                style={TABULAR_NUMS}
              />
              <Text className="ml-1.5 shrink-0 text-xs text-text-muted">개</Text>
            </FieldRow>

            <FieldRow label="조각 가격">
              <TextInput
                testID="income-sheet-fragment-price"
                value={fragmentPrice === 0 ? '' : fragmentPrice.toLocaleString()}
                onChangeText={(text) => setFragmentPrice(parseMesoText(fragmentPrice, text))}
                keyboardType="number-pad"
                placeholder="0"
                className="flex-1 text-right text-sm font-semibold text-text"
                style={TABULAR_NUMS}
              />
              <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메소</Text>
            </FieldRow>
          </>
        )}

        {isFree && (
          // 통화는 **갈래가 아니라 금액의 축**이라 세그먼트다([[ADR-173]] 결정 3) — 지출 시트의
          // 그 줄과 같은 모양·같은 자리다([[ADR-170]] 정정 15 결정 2).
          // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <View
            testID="income-sheet-currency"
            className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2"
          >
            <Text className="shrink-0 text-xs text-text-muted">통화</Text>
            <View className="flex-1 flex-row items-center justify-end">
              <Segment
                options={FREE_CURRENCY_LABELS}
                selected={labelOfCurrency(freeCurrency)}
                onSelect={(label) => setFreeCurrency(currencyOfLabel(label))}
              />
            </View>
          </View>
        )}

        {usesPoint && (
          // 메포를 메소 축으로 옮기는 값 — **1억 메소당 메포**다([[ADR-166]] 정정 2 ④).
          <View className="min-h-7 flex-row items-center gap-2 border-b border-border pb-2">
            <Text className="shrink-0 text-xs text-text-muted">
              시세 · 1억당
              <Text testID="income-sheet-required" className="text-error-ink">
                {' *'}
              </Text>
            </Text>
            <View className="flex-1 flex-row items-center justify-end">
              <TextInput
                testID="income-sheet-rate"
                value={rateText}
                onChangeText={setRateText}
                keyboardType="number-pad"
                placeholder="메소마켓 시세"
                className={`flex-1 text-right text-sm font-semibold ${
                  rate !== null ? 'text-text' : 'text-error-ink'
                }`}
                style={TABULAR_NUMS}
              />
              <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메포</Text>
            </View>
          </View>
        )}

        {/* 큰 숫자는 **저장 바로 위**이고 자기 윗선을 안 긋는다 — 위 줄의 밑줄이 경계를 겸한다
            ([[ADR-173]] 결정 1·9). 힌트는 억/만이고, 0 일 때는 빈 줄로 자리만 지킨다: 사라지면
            첫 타건에 아래가 통째로 밀린다. */}
        {isSale && (
          // **치는 자리는 여기**다([[ADR-170]] 정정 9 ④) — 큰 숫자는 합계라 못 친다. 이름 아래에
          // 서는 이유는 계산 차례 그대로이기 때문이다: 무엇을 · 얼마에 · 몇 % 떼고 → 합계.
          <View className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2">
            <Text className="shrink-0 text-xs text-text-muted">판매 대금</Text>
            <View className="flex-1 flex-row items-center justify-end">
              <TextInput
                testID="income-sheet-gross"
                value={gross === 0 ? '' : gross.toLocaleString()}
                onChangeText={(text) => setGross(parseMesoText(gross, text))}
                keyboardType="number-pad"
                placeholder="0"
                className="flex-1 text-right text-sm font-semibold text-text"
                style={TABULAR_NUMS}
              />
              {/* 큰 숫자는 **수수료를 뗀 합계**라(정정 9 ④) 이 줄과 축이 같은지 헷갈린다 —
                  둘 다 메소라는 것을 여기서 말한다([[ADR-170]] 정정 14 ④). */}
              <Text
                testID="income-sheet-gross-unit"
                className="ml-1.5 shrink-0 text-xs font-semibold text-text-muted"
              >
                메소
              </Text>
            </View>
          </View>
        )}

        {isSale && (
          <View
            testID="income-sheet-fee"
            className="flex-row items-center gap-3 border-b border-border pb-2"
          >
            <Text className="text-xs text-text-muted">수수료</Text>
            <View className="ml-auto">
              <Segment
                options={FEE_OPTIONS}
                selected={feeOptionOf(feePercent)}
                onSelect={(option) => setFeePercent(feePercentOf(option))}
              />
            </View>
          </View>
        )}

        <AmountFigure
          // **아이템 판매의 큰 숫자는 합계**다([[ADR-170]] 정정 9 ④) — 수수료를 뗀 값이고, 앱이
          // 세므로 못 친다. 다른 갈래는 이 자리가 곧 치는 칸이다(정정 9 이전과 같다).
          // **사냥도 합계**다([[ADR-175]] 결정 1) — 획득 메소 + 조각 × 가격.
          value={isHunt ? huntTotal : isSale ? net : gross}
          /*
           * **단위는 고른 통화**다([[ADR-170]] 정정 15) — 캐시는 「원」이다(실제로 내는 돈이 원이라
           * 지출 시트가 그렇게 적고, 같은 값을 두 시트가 다르게 적을 이유가 없다).
           */
          unit={isSale || isHunt ? '메소' : unitOfCurrency(currency)}
          testID="income-sheet-amount"
          /*
           * 힌트가 말하는 것도 통화를 따른다: 메소는 억/만, 메포는 **메소로 얼마인가**(그 값이
           * 합계에 드는 값이다), 캐시는 **안 든다**는 사실 자체다([[ADR-166]] 정정 2 ①).
           */
          hint={incomeHint}
          hintBlocked={usesPoint && rate === null}
          readOnly={isSale || isHunt}
          onChangeValue={setGross}
        />

        <Pressable
          role="button"
          aria-label={editing ? '수정' : '저장'}
          disabled={!canSave || saving}
          onPress={() => void save()}
          className={`items-center rounded-xl py-3 ${canSave ? 'bg-rise-ink' : 'bg-surface-2'}`}
        >
          <Text className={`text-sm font-bold ${canSave ? 'text-bg' : 'text-text-disabled'}`}>
            {editing ? '수정' : '저장'}
          </Text>
        </Pressable>

        {editing && props.onDelete !== undefined && (
          // **버튼처럼 안 생겼다**([[ADR-171]] 결정 3) — `SpendSheet` 와 같은 자리·같은 무게다.
          <Pressable
            role="button"
            aria-label="삭제"
            testID="income-sheet-delete"
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
