/**
 * 사냥 계산기 폼. 적는 것이 아니라 계산되는 것이다.
 *
 * 나머지 갈래는 얼마 벌었나를 사람이 알지만 사냥 메소는 맵이 정해지면 셀 수 있는 값이라 앱이
 * 낸다. 그래서 이 폼에만 줄이 여럿 서고(지역 · 사냥터 · 효율 · 메획 · 소재 · 조각) 큰 숫자가
 * 못 치는 합계가 된다.
 *
 * 사냥의 다른 한 모양은 `HuntManualForm` 이다. 그쪽은 계산기가 못 세는 사냥에 쓰고, 어느 폼이
 * 서는지는 기록에 박힌 값이 정한다.
 *
 * 계산은 한 자리에 있다(`lib/cashbook/hunting-meso`). 이 파일은 고른 것을 넘기고 받은 숫자를
 * 그린다. 캐릭터의 메소 획득량은 `features/cashbook/meso-rate` 가 읽어 준다.
 */
import { useRef, useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { CheckBox, Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoTextOf, mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { Segment } from '../../../components/molecules/Segment/Segment'
import type { SelectOption } from '../../../components/organisms/SelectField/SelectField'
import type { MesoRateLoad } from '../../../features/cashbook/meso-rate'
import { FORCE_LABELS, forceIconOf, getItemIconUrlByFile } from '../../../lib/assets/asset-lookup'
import {
  optionalMesoTextOf,
  optionalMesoValueOf,
  settleMesoText,
} from '../../../components/organisms/MesoPad/meso-pad'
import {
  findHuntingGround,
  findHuntingRegion,
  huntingGroundsFor,
  huntingRegionsForLevel,
} from '../../../lib/cashbook/hunting-grounds'
import {
  MESO_BOOSTS,
  MISSED_MOB_OPTIONS,
  UNION_TIERS,
  type UnionTier,
  appliedMesoRatePercent,
  boostMultiplierOf,
  boostPercentOf,
  efficiencyPercentOf,
  fragmentSaleFeeOf,
  huntingMesoOf,
  huntingTotalOf,
  killedMobsOf,
} from '../../../lib/cashbook/hunting-meso'
import { FeeRow } from '../../../components/organisms/FeeRow/FeeRow'
import { useSaleFeeChoice } from './sale-fee'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { ImageAssetRef } from '../../../types/image-asset'
import type { HuntingGround, HuntingRegion } from '../../../types/hunting-grounds'
import type { LastHunt, LastHunts } from '../../../storage/last-hunts'
import { FieldRow } from '../sheet-fields'
import { ChainSelect } from '../../../components/organisms/ChainSelect/ChainSelect'
import { requiredCharacterOptions } from '../character-options'
import { useSaveSlot, type IncomeFormProps } from './form-shared'
import { useSheetSubmit } from '../../../hooks/useSheetSubmit'
import type { InputCardProps } from '../../../components/organisms/InputCard/InputCard'
import { openInputCard } from '../../../features/input-card/store'
import { COUNT_QUICK_ADDS } from '../../../constants/domain/quick-adds'
import { FRAGMENT_PRICE_QUICK_ADDS } from '../../../constants/domain/meso-quick-adds'

/** 입력 카드가 받는 칸 넷. 나머지 줄은 누르는 칸이라 카드가 안 선다. */
type EditingField = 'mesoRate' | 'sojae' | 'fragments' | 'fragmentPrice'

/**
 * 칸마다 카드에 넘기는 것. 값과 확인 뒤 처리는 폼이 따로 준다.
 *
 * 메소 획득량은 표식이 없다. 메소를 받는 칸이 아니라 배수라 주머니를 달면 틀린 말이 되고,
 * 읽기(`1200만`)도 세 자리에는 읽어 줄 것이 없다.
 */
const CARD_FIELDS: Record<EditingField, Omit<InputCardProps, 'value' | 'onConfirm' | 'onCancel' | 'panelStyle'>> = {
  mesoRate: {
    label: '메소 획득량',
    context: '캐릭터에서 못 읽어 직접 입력',
    unit: '%',
    chips: COUNT_QUICK_ADDS,
  },
  sojae: {
    label: '소재',
    context: '하나가 30분',
    chips: [],
  },
  fragments: {
    label: '조각 개수',
    context: '솔 에르다 조각',
    icon: 'fragment',
    unit: '개',
    chips: COUNT_QUICK_ADDS,
  },
  fragmentPrice: {
    label: '조각 가격',
    context: '솔 에르다 조각 · 개당',
    icon: 'meso',
    unit: '메소',
    reading: true,
    chips: FRAGMENT_PRICE_QUICK_ADDS,
    placeholder: '미입력 시 보관',
  },
}

/** lv.294·lv.200-201. 원 자료의 표기를 그대로 되돌린다. */
function levelLabelOf(ground: HuntingGround): string {
  return `lv.${ground.levels.join('-')}`
}

/**
 * 포스 그림 + 수치.
 *
 * 그림이 없으면 글자만으로 선다(`아케인 700`). 비슷한 그림을 갖다 붙이면 틀린 것을 그리는
 * 셈이다. 읽어 주는 이름은 언제나 온전한 말이라 그림이 있든 없든 어센틱 포스 700 으로 들린다.
 */
function ForceMark(props: { region: HuntingRegion; force: number }): React.JSX.Element {
  const icon = forceIconOf(props.region.forceType)
  const label = FORCE_LABELS[props.region.forceType]
  return (
    <View aria-label={`${label} ${props.force}`} className="flex-row items-center gap-1.5">
      {icon === null ? (
        <Text className="text-10 font-semibold text-text-muted">{label.split(' ')[0]}</Text>
      ) : (
        <Image source={icon} className="h-3.5 w-3.5" resizeMode="contain" aria-hidden />
      )}
      <Text className="text-11 font-semibold text-text-muted" style={TABULAR_NUMS}>
        {props.force}
      </Text>
    </View>
  )
}

/** 포스 배지. 사냥터 목록의 한 줄에 선다. */
function ForceBadge(props: { region: HuntingRegion; force: number }): React.JSX.Element {
  return (
    <View testID="force-badge" className="rounded-full bg-surface-2 px-2 py-0.5">
      <ForceMark region={props.region} force={props.force} />
    </View>
  )
}

/**
 * 고른 사냥터의 포스 · 레벨 · 마릿수. 사냥터 줄 왼쪽에 서는 캡슐 하나다.
 *
 * 칸을 세로 선으로 나눈다. 셋이 한 사냥터의 정보라는 것을 모양이 말한다. 마릿수는 **잡는**
 * 마릿수라 사냥 효율에서 놓친 만큼 준다.
 */
function GroundSummary(props: {
  region: HuntingRegion
  ground: HuntingGround
  killedMobs: number
}): React.JSX.Element {
  return (
    <View
      testID="income-sheet-ground-summary"
      className="shrink-0 flex-row items-center rounded-full bg-surface-2 px-1 py-0.5"
    >
      <View className="px-1.5">
        <ForceMark region={props.region} force={props.ground.force} />
      </View>
      <View className="border-l border-border px-1.5">
        <Text className="text-11 text-text-muted" style={TABULAR_NUMS}>
          {levelLabelOf(props.ground)}
        </Text>
      </View>
      <View className="border-l border-border px-1.5">
        <Text className="text-11 text-text-muted" style={TABULAR_NUMS}>
          <Text testID="income-sheet-killed-mobs">{props.killedMobs}</Text>마리
        </Text>
      </View>
    </View>
  )
}

/** 참조표에 있는 아이템 id 만. 지우거나 바꾼 id 를 세우면 화면에 없는 체크가 기록에 박힌다. */
function knownBoostsOf(ids: readonly string[]): string[] {
  return ids.filter((id) => MESO_BOOSTS.some((each) => each.id === id))
}

/**
 * 그 캐릭터의 기억을 되살릴 수 있으면 그 사냥터. 없으면 `null` 이다.
 *
 * 참조표에서 사라진 사냥터와 그 레벨로 못 가는 지역은 되살리지 않는다. 목록에 없는 값을 고르개에
 * 세우면 알약도 자리표시자도 안 서는 줄이 된다.
 */
function restorableGroundOf(
  remembered: LastHunt | undefined,
  level: number | null,
): { region: HuntingRegion; ground: HuntingGround } | null {
  if (remembered === undefined) return null
  const found = findHuntingGround(remembered.groundKey)
  if (found === null) return null
  return huntingRegionsForLevel(level).some((each) => each.key === found.region.key) ? found : null
}

/** 사냥터 목록의 한 줄. 이름 · 포스 배지 · 레벨 · 마릿수. */
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
        <Text className="text-11 text-text-muted" style={TABULAR_NUMS}>
          {levelLabelOf(props.ground)}
        </Text>
        <Text className="text-11 text-text-muted" style={TABULAR_NUMS}>
          {props.ground.mobs}마리
        </Text>
      </View>
    </View>
  )
}

/**
 * 메소 획득률 아이템. 체크박스 + 그림이다.
 *
 * 켜고 끄는 것이라 갈래 칩과 성질이 다르고 그 사실을 체크박스가 말한다. 알약 테두리는 고르는
 * 하나로 읽혀 여럿이 동시에 켜지는 것과 안 맞는다. 그래서 그림의 원형 테두리를 걷고 그 자리를
 * 체크박스가 든다.
 *
 * 증가율(`+50%`·`×1.2`)은 안 적는다. 이미 아는 값이다. 이름도 안 적고 읽어 주는 라벨로만
 * 남긴다. 그림만 남기고 이름을 지우면 낭독기에서 버튼 둘이 된다.
 */
function BoostToggle(props: {
  label: string
  icon: ImageAssetRef | null
  testID: string
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      role="checkbox"
      aria-label={props.label}
      aria-checked={props.selected}
      onPress={props.onPress}
      hitSlop={8}
      className="flex-row items-center gap-2"
    >
      <CheckBox checked={props.selected} />
      {/* 그림이 없으면 빈 자리로 둔다. 비슷한 것을 갖다 붙이면 틀린 것을 그리는 셈이다.
          파일명이 실제로 풀리는지는 `hunting-meso.test` 가 지킨다.

          끈 것은 흐리다. 체크박스가 상태를 말하지만 그림까지 같이 옅어지면 줄을 훑을 때
          켜진 것이 먼저 눈에 든다. 걷어내지 않는 것은 무엇을 켤 수 있나 도 함께 보여야
          해서다. */}
      {props.icon === null ? (
        <View className="h-6 w-6" />
      ) : (
        <Image
          testID={props.testID}
          source={props.icon}
          className={`h-6 w-6${props.selected ? '' : ' opacity-50'}`}
          resizeMode="contain"
          aria-hidden
        />
      )}
    </Pressable>
  )
}

/** 사냥터를 고르기 전 효율 줄의 글자를 셀 마릿수(사용자 지정). */
const EFFICIENCY_PLACEHOLDER_MOBS = 40

/** 메소 획득량 값 자리의 바닥 폭. `0%` 와 `258%` 의 글자 폭 차이가 줄을 밀지 않게. */
const MESO_RATE_SLOT = { minWidth: 56 }

export function HuntCalculatorForm(
  props: IncomeFormProps & {
  /** 캐릭터의 메소 획득량을 읽어 오는 함수. 폼은 `nexon/` 도 `storage/` 도 모른다. */
    loadMesoRate: (ocid: string) => Promise<MesoRateLoad>
    /** 캐릭터별 마지막 사냥. 캐릭터를 고르면 그 몫이 선다. 화면이 읽어서 넘긴다. */
    lastHunts: LastHunts
  },
): React.JSX.Element {
  const editing = props.editing !== undefined
  /**
   * 이 폼이 되살릴 수 있는 입력. **계산기로 적힌 행일 때만** 값이 있다.
   *
   * 수동으로 적힌 행은 이 폼으로 안 열리지만(`IncomeSheet` 가 갈라 준다) 타입이 그 사실을 모르므로
   * 여기서 한 번 좁힌다. 아래 상태들은 이 값 하나만 본다.
   */
  const detail = props.editing?.hunt?.mode === 'calculator' ? props.editing.hunt : null
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  /**
   * 캐릭터 레벨을 상태로 드는 것은 그때의 값이어야 하기 때문이다. 캐릭터는 레벨업하므로 지금
   * 레벨을 다시 읽으면 옛 기록의 금액이 열 때마다 달라진다. 대신 사용자가 고르개로 캐릭터를
   * 바꾸면 그 캐릭터의 지금 레벨로 갈아 끼운다.
   */
  const [huntLevel, setHuntLevel] = useState<number | null>(
    detail?.characterLevel ??
      props.characters.find((each) => each.ocid === props.editing?.ocid)?.level ??
      null,
  )
  /** 고른 사냥터 key. 지역은 여기서 따라온다. */
  const [groundKey, setGroundKey] = useState<string | null>(
    detail === null ? null : (props.editing?.itemKey ?? null),
  )
  /** 고른 지역 key. 사냥터를 아직 안 골랐어도 지역만 골라 둔 상태가 있다. */
  const [regionKey, setRegionKey] = useState<string | null>(() => {
    const key = detail === null ? null : (props.editing?.itemKey ?? null)
    return key === null ? null : (findHuntingGround(key)?.region.key ?? null)
  })
  /**
   * 고르는 것은 놓치는 마릿수(0~4)이지 퍼센트가 아니다. 효율 % 는 맵이 정하는 라벨이라 맵을
   * 바꾸면 같은 조각의 글자가 달라진다.
   */
  const [missedMobs, setMissedMobs] = useState(detail?.missedMobs ?? 0)
  /** 켠 메소 획득률 아이템. 수정으로 열면 기록이 정하고, 캐릭터를 고르면 그 캐릭터의 기억이 선다. */
  const [boosts, setBoosts] = useState<readonly string[]>(detail?.boosts ?? [])
  /** 유니온의 부 단계. 안 켰어도 고른 단계를 들고 있다가 켜면 그대로 선다. */
  const [unionTier, setUnionTier] = useState<UnionTier>(detail?.unionTier ?? 3)
  const [sojaeText, setSojaeText] = useState(mesoTextOf(detail?.sojae ?? 1))
  const sojae = mesoValueOf(sojaeText)
  const [fragmentsText, setFragmentsText] = useState(mesoTextOf(detail?.fragments ?? 0))
  /** 빈 칸은 가격을 안 적은 것이라 0 과 따로 든다. */
  const [fragmentPriceText, setFragmentPriceText] = useState(optionalMesoTextOf(detail?.fragmentPrice ?? null))
  /**
   * 캐릭터의 메소 획득량. 읽었으면 못 치고, 못 읽었으면 치는 칸이 된다.
   *
   * 수정으로 열면 그때의 값이 자동값으로 선다. 레벨과 같은 이유다.
   */
  const [mesoRate, setMesoRate] = useState<MesoRateLoad | { kind: 'loading' }>(
    detail === null ? { kind: 'fallback', percent: null } : { kind: 'read', percent: detail.mesoRate },
  )
  /** 폴백 칸에 친 글자. 지우는 중간 상태가 있어 숫자가 아니라 글자로 든다. */
  const [mesoRateText, setMesoRateText] = useState('')
  /** 카드에 넘길 씨앗. 칸마다 폼이 든 글자가 다르다. */
  function cardValueOf(field: EditingField): string {
    if (field === 'mesoRate') return mesoRateText
    if (field === 'sojae') return sojaeText
    return field === 'fragments' ? fragmentsText : fragmentPriceText
  }

  /**
   * 그 칸을 카드에 맡긴다. 카드는 앱 셸이 시트 뒤에 세운 자리에 선다.
   *
   * 차례를 안 든다. 카드가 칸 하나를 받고 닫히기 때문이다. 다음 칸은 그 줄을 다시 누른다.
   */
  function editField(field: EditingField): void {
    openInputCard({
      ...CARD_FIELDS[field],
      value: cardValueOf(field),
      onConfirm: (next) => confirmCard(field, next),
    })
  }

  /**
   * 확인을 누른 값을 폼에 넣는다. **정리 규칙이 칸마다 다르다.**
   *
   * 조각 가격만 빈 칸과 0 을 가른다. 빈 칸은 안 판 조각이라 보관에 들고 0 은 0 메소에 판 것이다.
   */
  function confirmCard(field: EditingField, next: string): void {
    if (field === 'mesoRate') {
      setMesoRateText(next)
      return
    }
    if (field === 'sojae') {
      setSojaeText(settleMesoText(next))
      return
    }
    if (field === 'fragments') {
      setFragmentsText(settleMesoText(next))
      return
    }
    setFragmentPriceText(optionalMesoTextOf(optionalMesoValueOf(next)))
  }
  /**
   * 마지막으로 요청한 캐릭터. 캐릭터를 빠르게 두 번 바꾸면 먼저 부른 응답이 늦게 도착해 남의
   * 메획이 박힐 수 있다. 그 값은 곧 금액이라 조용히 틀리면 안 된다.
   */
  const mesoRateRequest = useRef<string | null>(props.editing?.ocid ?? null)
  const { saving, submit, remove } = useSheetSubmit(props)

  const huntRegions = huntingRegionsForLevel(huntLevel)
  const huntRegion = regionKey === null ? null : findHuntingRegion(regionKey)
  /**
   * 목록에 서는 차례. **레벨 차이가 적은 순, 같으면 마릿수가 많은 순**.
   * 거르는 것이 아니라 줄 세우는 것이라 지역 안의 맵은 전부 든다.
   */
  const huntGrounds = huntRegion === null ? [] : huntingGroundsFor(huntRegion, huntLevel)
  const huntGround =
    groundKey === null || huntRegion === null
      ? null
      : (huntRegion.grounds.find((each) => each.key === groundKey) ?? null)

  /** 효율 글자를 셀 마릿수. 사냥터 전에는 40마리 기준으로 흐리게 적는다. */
  const efficiencyMobs = huntGround?.mobs ?? EFFICIENCY_PLACEHOLDER_MOBS

  /** 폴백 칸의 값. 못 읽었을 때만 쓰인다. 비어 있으면 0 이고, 그때 곱은 ×1 이다. */
  const typedMesoRate = /^\d+$/.test(mesoRateText) ? Number(mesoRateText) : 0
  /**
   * 계산에 드는 메획(%). **읽은 값이면 그것, 못 읽었으면 친 값**이다. 읽는 중(`loading`)에는 0 이라
   * 값이 잠깐 낮게 섰다가 올라간다: 없는 숫자를 미리 확신 있게 적는 것보다 낫다.
   */
  const mesoRatePercent =
    mesoRate.kind === 'read' ? mesoRate.percent : mesoRate.kind === 'fallback' ? typedMesoRate : 0
  /**
   * **캐릭터 메획과 가산 아이템이 한 통**이다. 더해서 한 번 곱한다.
   */
  const boostPercent = boostPercentOf(boosts, unionTier) + mesoRatePercent
  /** 통 **밖**에서 곱하는 배율. 재획비다. 합산이 끝난 값 전체에 걸린다. */
  const boostMultiplier = boostMultiplierOf(boosts)
  /**
   * 줄에 적히는 수. 켠 아이템까지 반영한 증가량이고 소수점은 버린다. 이 값으로 돈을 세지
   * 않는다. 셈은 내림 전의 값으로 돈다.
   */
  const appliedRate = appliedMesoRatePercent(boostPercent, boostMultiplier)

  /** 조각 줄의 그림. 이름을 그림이 지므로 못 찾으면 그 자리를 비운다. */
  const fragmentIcon = getItemIconUrlByFile('sol_erda_fragment.webp')

  const huntInput = { characterLevel: huntLevel, missedMobs, boostPercent, boostMultiplier, sojae }
  /** 사냥터를 안 골랐으면 0 이다. 계산기가 반쯤 찬 상태이고, 그때도 조각 값은 선다. */
  const huntMeso = huntGround === null ? 0 : huntingMesoOf({ ...huntInput, ground: huntGround })
  const fragments = mesoValueOf(fragmentsText)
  const fragmentPrice = optionalMesoValueOf(fragmentPriceText)
  const fee = useSaleFeeChoice(props.editing, ocid, props.dateKey)
  /** 조각을 그 자리에서 판 몫에만 붙는 판매 수수료. 가격을 안 적었으면 0 이다. */
  const fragmentFee = fragmentSaleFeeOf({ fragments, fragmentPrice }, fee.percent)
  const huntTotal = huntingTotalOf({ ...huntInput, ground: huntGround, fragments, fragmentPrice }) - fragmentFee
  /**
   * 저장 가능 여부. **사냥터가 세는 메소와 캐릭터가 있어야 한다.**
   *
   * 이 기록의 본체는 획득 메소이고 계산기에서 그것은 사냥터가 정한다. 조각은 곁다리라
   * 그것만 적힌 행은 사냥 기록이 아니다(사용자 지시). 캐릭터는 조각 보관이 캐릭터별이라 필요하다.
   */
  const canSave = huntMeso > 0 && ocid !== null && (fragmentPrice === null || fee.ready)

  /**
   * 캐릭터를 고르면 레벨이 따라 바뀌고 **그 캐릭터의 마지막 사냥이 선다**. 수정으로 연 기록도 같다.
   *
   * 기억이 있으면 고른 지역 · 사냥터 · 아이템을 덮어쓰고, 없거나 되살릴 수 없으면 셋을 비운다
   * (사용자 결정). 같은 캐릭터를 다시 고르면 손으로 고친 것이 덮이지 않게 아무것도 안 한다.
   */
  function selectCharacter(next: string | null): void {
    if (next === ocid) return
    setOcid(next)
    const level =
      next === null ? null : (props.characters.find((each) => each.ocid === next)?.level ?? null)
    setHuntLevel(level)
    const remembered = next === null ? undefined : props.lastHunts[next]
    const restored = restorableGroundOf(remembered, level)
    setRegionKey(restored?.region.key ?? null)
    setGroundKey(restored?.ground.key ?? null)
    setBoosts(restored === null || remembered === undefined ? [] : knownBoostsOf(remembered.boosts))
    setUnionTier(restored === null || remembered === undefined ? 3 : remembered.unionTier)
    loadMesoRateFor(next)
  }

  /**
   * 캐릭터의 메획을 읽어 오는 조회. 고르는 그 순간이 계기다. 선택 안함 이면 읽을 대상이 없어
   * 줄이 걷히고 곱이 ×1 로 돌아간다.
   */
  function loadMesoRateFor(next: string | null): void {
    mesoRateRequest.current = next
    setMesoRateText('')
    if (next === null) {
      setMesoRate({ kind: 'fallback', percent: null })
      return
    }
    setMesoRate({ kind: 'loading' })
    void props.loadMesoRate(next).then(
      (loaded) => {
        // 늦게 온 남의 응답은 버린다. 그 값은 곧 금액이다.
        if (mesoRateRequest.current !== next) return
        setMesoRate(loaded)
        if (loaded.kind === 'fallback') {
          setMesoRateText(loaded.percent === null ? '' : String(loaded.percent))
        }
      },
      () => {
        if (mesoRateRequest.current !== next) return
        setMesoRate({ kind: 'fallback', percent: null })
      },
    )
  }

  /** 지역을 옮기면 **사냥터가 풀린다**. 그 지역에 없는 맵이 남으면 계산이 남의 맵으로 돈다. */
  function selectRegion(next: string | null): void {
    setRegionKey(next)
    setGroundKey(null)
  }

  function toggleBoost(id: string): void {
    setBoosts((current) =>
      current.includes(id) ? current.filter((each) => each !== id) : [...current, id],
    )
  }

  useSaveSlot(props.setSave, {
    editing,
    canSave,
    saving,
    onSave: () =>
      void submit({
        ocid,
        earnedOn: props.dateKey,
        category: 'hunting',
        // 고른 사냥터의 key 가 그 자리다(지역이 따라온다). 이름 칸에는 그때 이름을 함께 남긴다.
        item: huntGround?.name ?? null,
        itemKey: huntGround?.key ?? null,
        // **합계**다(메소 + 조각 × 가격). 큰 숫자에 서는 그 값이다.
        mesoAmount: huntTotal,
        // 조각 가격을 안 적었으면 판 것이 없어 수수료 칸이 빈다.
        saleFeePercent: fragmentPrice === null ? null : fee.percent,
        saleFeeMeso: fragmentPrice === null || fee.percent === null ? null : fragmentFee,
        saleFeeAuto: fee.auto,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        // 수량은 `기타`만 쓴다.
        quantity: null,
        // 계산 입력을 함께 남긴다. 없으면 수정 시트가 빈 계산기로 열려 만지는 순간 금액이
        // 덮인다.
        hunt: {
          mode: 'calculator',
          characterLevel: huntLevel,
          missedMobs,
          boosts: [...boosts],
          sojae,
          fragments,
          fragmentPrice,
          // **그때의** 메획이다. 장비를 갈아입어도 이 기록은 안 흔들린다.
          mesoRate: mesoRatePercent,
          unionTier,
        },
        itemKind: null,
        memo: null,
      }),
    onDelete: props.onDelete === undefined ? undefined : () => void remove(),
  })

  return (
    <>
      {/*
        캐릭터 · 지역 · 사냥터가 한 줄씩이다. 한 단계짜리 사슬 셋이라 색이 단계 차례로 안 갈려
        `toneOffset` 으로 줄마다 다음 색을 입힌다.
      */}
      <ChainSelect
        testID="income-sheet-chain"
        steps={[
          {
            name: '캐릭터',
            options: requiredCharacterOptions(props.characters),
            selected: ocid,
            onSelect: selectCharacter,
          },
        ]}
      />
      <ChainSelect
        testID="income-sheet-region"
        toneOffset={1}
        steps={[
          {
            name: '지역',
            // 캐릭터가 없으면 고를 지역을 안 준다. 캐릭터 없이 적힌 옛 기록의 지역만 알약으로 남긴다.
            options:
              ocid === null
                ? [
                    { value: null, label: '캐릭터를 먼저 고르세요' },
                    ...(huntRegion === null ? [] : [{ value: huntRegion.key, label: huntRegion.name }]),
                  ]
                : [
                    { value: null, label: '선택 안함' },
                    ...huntRegions.map((region) => ({ value: region.key, label: region.name })),
                  ],
            selected: regionKey,
            onSelect: selectRegion,
          },
        ]}
      />
      <ChainSelect
        testID="income-sheet-ground"
        toneOffset={2}
        leading={
          huntRegion === null || huntGround === null ? null : (
            <GroundSummary
              region={huntRegion}
              ground={huntGround}
              killedMobs={killedMobsOf(huntGround.mobs, missedMobs)}
            />
          )
        }
        steps={[
          {
            name: '사냥터',
            options:
              huntRegion === null
                ? [{ value: null, label: '지역을 먼저 고르세요' }]
                : [
                    { value: null, label: '선택 안함' },
                    ...huntGrounds.map((ground) => ({ value: ground.key, label: ground.name })),
                  ],
            selected: groundKey,
            onSelect: setGroundKey,
            // 목록 한 줄에 포스 배지·레벨·마릿수가 함께 선다.
            renderOption: (option: SelectOption, isSelected: boolean) => {
              const ground =
                huntRegion === null || option.value === null
                  ? null
                  : (huntRegion.grounds.find((each) => each.key === option.value) ?? null)
              return ground === null || huntRegion === null ? (
                <Text
                  numberOfLines={1}
                  className={`text-sm ${isSelected ? 'font-semibold text-primary-ink' : 'text-text'}`}
                >
                  {option.label}
                </Text>
              ) : (
                <GroundOptionRow region={huntRegion} ground={ground} isSelected={isSelected} />
              )
            },
          },
        ]}
      />

      {/*
        효율 조각은 맵이 정한다. 40마리의 −1 은 98%, 22마리의 −1 은 95% 다. 줄은 늘 선다. 사냥터를
        고를 때 생기면 아래가 밀린다. 사냥터 전에는 40마리 기준 글자를 흐리게 적고 못 누른다.
      */}
      <FieldRow label="사냥 효율" testID="income-sheet-efficiency">
        <Segment
          options={MISSED_MOB_OPTIONS.map((missed) => `${efficiencyPercentOf(efficiencyMobs, missed)}%`)}
          selected={`${efficiencyPercentOf(efficiencyMobs, missedMobs)}%`}
          disabled={huntGround === null}
          onSelect={(option) => {
            const picked = MISSED_MOB_OPTIONS.find(
              (missed) => `${efficiencyPercentOf(efficiencyMobs, missed)}%` === option,
            )
            if (picked !== undefined) setMissedMobs(picked)
          }}
        />
      </FieldRow>

      {/* 켜는 아이템. 켜면 아래 줄의 메소 획득량이 오른다. */}
      <View
        testID="income-sheet-boost-line"
        className="min-h-8 flex-row items-center justify-between border-b border-border pb-2"
      >
        <Text className="shrink-0 text-xs text-text-muted">소비</Text>
        <View testID="income-sheet-boosts" className="flex-row items-center gap-3.5">
          {MESO_BOOSTS.map((boost) => (
            <BoostToggle
              key={boost.id}
              label={boost.label}
              icon={getItemIconUrlByFile(boost.icon)}
              testID={`income-sheet-boost-icon-${boost.id}`}
              selected={boosts.includes(boost.id)}
              onPress={() => toggleBoost(boost.id)}
            />
          ))}
          {/* 유니온의 부가 배열 끝이라 이 자리가 곧 그 체크박스 옆이다. 안 켜면 흐리고 못 누른다. */}
          <View testID="income-sheet-union-tier">
            <Segment
              options={UNION_TIERS.map((tier) => `${tier}단계`)}
              selected={`${unionTier}단계`}
              disabled={!boosts.includes('union')}
              onSelect={(option) => {
                const picked = UNION_TIERS.find((tier) => `${tier}단계` === option)
                if (picked !== undefined) setUnionTier(picked)
              }}
            />
          </View>
        </View>
      </View>

      {/*
        메소 획득량과 소재가 한 줄이다(사용자 지정). 라벨 · 값 · 스테퍼가 `space-between` 으로 벌어진다.
        `소재`는 사용자가 실제로 세는 단위다. 하나가 30분.
      */}
      <View
        testID="income-sheet-meso-line"
        className="min-h-8 flex-row items-center justify-between border-b border-border pb-2"
      >
        <Text className="shrink-0 text-xs text-text-muted">메소 획득량</Text>
        {/* 값 자리의 폭을 못박는다. `0%` 와 `258%` 의 글자 폭이 달라 안 박으면 캐릭터를 고르는 순간 스테퍼가 밀린다. */}
        <View
          testID="income-sheet-meso-rate-slot"
          style={MESO_RATE_SLOT}
          className="flex-row items-center justify-end"
        >
            {ocid !== null && mesoRate.kind === 'fallback' ? (
              /*
                누르면 입력 카드가 캐릭터 메획을 받는다. 줄에 보이는 것은 결과(`appliedRate`)다.
                치는 값은 캐릭터 메획이라 결과를 고치게 두면 친 수에 아이템이 한 번 더 붙는다.
              */
              <Pressable
                testID="income-sheet-meso-rate-input"
                role="button"
                aria-label="메소 획득량"
                onPress={() => editField('mesoRate')}
                className="flex-row items-baseline"
              >
                <Text className="text-sm font-semibold text-text" style={TABULAR_NUMS}>
                  {appliedRate}
                </Text>
                <Text className="ml-1.5 shrink-0 text-xs text-text-muted">%</Text>
              </Pressable>
            ) : (
              <Text
                testID="income-sheet-meso-rate"
                className="text-sm font-semibold text-text"
                style={TABULAR_NUMS}
              >
                {mesoRate.kind === 'loading' ? '…' : `${appliedRate}%`}
              </Text>
            )}
        </View>
        <View className="flex-row items-center">
          {/* 0 · 빈 칸은 메소가 0 이라 저장이 꺼진다. 0 소재를 돌았다는 말은 성립하지 않는다. */}
          <Pressable
            testID="income-sheet-sojae"
            role="button"
            aria-label="소재"
            onPress={() => editField('sojae')}
            className="flex-row items-baseline"
          >
            <Text
              className={`text-sm font-semibold ${sojae === 0 ? 'text-text-disabled' : 'text-text'}`}
              style={TABULAR_NUMS}
            >
              {sojae.toLocaleString()}
            </Text>
          </Pressable>
          <Text className="ml-1.5 shrink-0 text-xs text-text-muted">소재</Text>
        </View>
      </View>

      {/*
        조각은 개수와 가격을 한 줄에서 받는다. 이름은 그림이 진다. `솔 에르다 조각` 여섯 글자가
        빠지고 그 폭이 두 칸에 간다. 치는 칸에 자기 테두리를 안 준다. 밑줄 하나가 줄의 경계다.
      */}
      <View className="min-h-8 flex-row items-center gap-2.5 border-b border-border pb-2">
        {fragmentIcon !== null && (
          // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <Image
            source={fragmentIcon}
            className="h-6 w-6 shrink-0"
            resizeMode="contain"
            aria-label="솔 에르다 조각"
          />
        )}
        {/*
          누르면 입력 카드가 그 칸 하나를 받는다. 값이 비면 자리표시자가 그 자리에 선다.
          폭을 못박는 것은 자릿수가 늘어도 줄이 안 움직이게 하기 위해서다.
        */}
        <Pressable
          testID="income-sheet-fragments"
          role="button"
          aria-label="솔 에르다 조각"
          onPress={() => editField('fragments')}
          className="shrink-0 flex-row items-baseline gap-1"
        >
          <Text
            className={`w-[52px] text-right text-sm font-semibold ${
              fragmentsText === '' ? 'text-text-disabled' : 'text-text'
            }`}
            style={TABULAR_NUMS}
          >
            {fragmentsText === '' ? '0' : mesoValueOf(fragmentsText).toLocaleString()}
          </Text>
          <Text className="text-xs text-text-muted">개</Text>
        </Pressable>
        <Pressable
          testID="income-sheet-fragment-price"
          role="button"
          aria-label="조각 가격"
          onPress={() => editField('fragmentPrice')}
          className="ml-auto min-w-0 flex-1 flex-row items-baseline justify-end gap-1.5"
        >
          <Text
            numberOfLines={1}
            className={`shrink text-right text-sm font-semibold ${
              fragmentPriceText === '' ? 'text-text-disabled' : 'text-text'
            }`}
            style={TABULAR_NUMS}
          >
            {fragmentPriceText === '' ? '미입력 시 보관' : mesoValueOf(fragmentPriceText).toLocaleString()}
          </Text>
          <Text className="shrink-0 text-xs text-text-muted">메소</Text>
        </Pressable>
      </View>

      {/* 조각 가격을 안 적어도 선다. 비면 판 것이 없어 떼는 돈이 0 이다. */}
      <FeeRow testID="income-sheet-fee" label="수수료" {...fee.row} />

      {/*
        못 치는 값이 총액 덩어리로 들어왔다. 자기 줄을 쓰면 줄 28 에 갭 12 를 지는데 여기서는
        16 이다. 총액의 근거라 총액 바로 위가 제자리다.

        `≈` 를 붙인다. 젠 주기·마릿수·레벨로 미리 세어 둔 값이지 실제로 받은 액수가 아니다.
      */}
      <View className="-mb-1.5 flex-row items-baseline justify-end gap-1.5">
        <Text className="text-11 text-text-muted">획득 메소</Text>
        <Text
          testID="income-sheet-hunt-meso"
          className="text-11 text-text-muted"
          style={TABULAR_NUMS}
        >
          {huntMeso === 0 ? '' : '≈ '}
          {huntMeso.toLocaleString()}
        </Text>
      </View>

      <AmountFigure
        // **사냥의 큰 숫자는 합계**다. 획득 메소 + 조각 × 가격. 앱이 세므로 못 친다.
        value={huntTotal}
        unit="메소"
        testID="income-sheet-amount"
        // **합계도 어림이다**. 조각 값만 실제로 받은 값이고 메소 쪽은 센 값이다.
        approximate
      />
    </>
  )
}
