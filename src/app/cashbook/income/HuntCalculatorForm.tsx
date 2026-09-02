/**
 * 사냥 계산기 폼. **적는 것이 아니라 계산되는 것**이다.
 *
 * 나머지 갈래는 얼마 벌었나를 사람이 알지만 사냥 메소는 **맵이 정해지면 셀 수 있는 값**이라 앱이
 * 낸다. 그래서 이 폼에만 줄이 여럿 서고(지역 · 사냥터 · 효율 · 메획 · 소재 · 조각) 큰 숫자가
 * **못 치는 합계**가 된다.
 *
 * 사냥의 다른 한 모양은 `HuntManualForm` 이다. 그쪽은 계산기가 못 세는 사냥에
 * 쓰고, 어느 폼이 서는지는 기록에 박힌 값이 정한다.
 *
 * 계산은 한 자리에 있다(`lib/cashbook/hunting-meso`). 이 파일은 고른 것을 넘기고 받은 숫자를 그린다.
 * 캐릭터의 메소 획득량은 `features/cashbook/meso-rate` 가 읽어 준다. 폼은 `nexon/` 도
 * `storage/` 도 모른다.
 */
import { useRef, useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoTextOf, mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { Segment } from '../../../components/molecules/Segment/Segment'
import {
  SelectField,
  type SelectOption,
} from '../../../components/organisms/SelectField/SelectField'
import type { MesoRateLoad } from '../../../features/cashbook/meso-rate'
import { FORCE_LABELS, forceIconOf, getItemIconUrlByFile } from '../../../lib/assets/asset-lookup'
import {
  findHuntingGround,
  findHuntingRegion,
  huntingGroundsFor,
  huntingRegionsForLevel,
} from '../../../lib/cashbook/hunting-grounds'
import {
  MESO_BOOSTS,
  MISSED_MOB_OPTIONS,
  appliedMesoRatePercent,
  boostMultiplierOf,
  boostPercentOf,
  efficiencyPercentOf,
  huntingMesoOf,
  huntingTotalOf,
  killedMobsOf,
} from '../../../lib/cashbook/hunting-meso'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { ImageAssetRef } from '../../../types/image-asset'
import type { HuntingGround, HuntingRegion } from '../../../types/hunting-grounds'
import { CheckBox, FieldRow, QuantityStepper } from '../sheet-fields'
import { CharacterField, FragmentFields, SaveRow, type IncomeFormProps } from './form-shared'
import { useSheetSubmit } from './use-sheet-submit'
import { SheetTextInput } from '../../../components/molecules/SheetTextInput/SheetTextInput'

/** lv.294·lv.200-201. 원 자료의 표기를 그대로 되돌린다. */
function levelLabelOf(ground: HuntingGround): string {
  return `lv.${ground.levels.join('-')}`
}

/**
 * 포스 배지. **그림 + 숫자**다.
 *
 * 그림이 없으면 **글자만으로 선다**(`아케인 700`). 비슷한 그림을 갖다 붙이면 틀린 것을 그리는
 * 셈이다(지출 타일에 세운 규칙과 같다). 읽어 주는 이름은 언제나 온전한
 * 말이라 그림이 있든 없든 어센틱 포스 700 으로 들린다.
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
 * 메소 획득률 아이템. **체크박스 + 그림**이다(사용자 지정 2026-08-29).
 *
 * 켜고 끄는 것이라 갈래 칩과 성질이 다르고, 그 사실을 **체크박스가 말한다**. 알약 테두리는
 * 고르는 하나 로 읽혀 여럿이 동시에 켜지는 것과 안 맞았다. 그래서 **그림의 원형 테두리를 걷고**
 * 그 자리를 체크박스가 든다.
 *
 * 증가율(`+50%`·`×1.2`)은 안 적는다. 이미 아는 값이다. 이름도 안 적고
 * **읽어 주는 라벨**로만 남긴다(`aria-label`). 그림만 남기고 이름을 지우면 낭독기에서 버튼
 * 둘이 된다.
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
      {/* 그림이 없으면 **빈 자리로 둔다**. 비슷한 것을 갖다 붙이면 틀린 것을 그리는 셈이다
          . 파일명이 실제로 풀리는지는 `hunting-meso.test` 가 지킨다.

          **끈 것은 흐리다**. 체크박스가 상태를 말하지만, 그림까지 같이 옅어지면 줄을 훑을 때
          켜진 것이 먼저 눈에 든다. 걷어내지 않는 것은 **무엇을 켤 수 있나** 도 함께 보여야 해서다. */}
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

export function HuntCalculatorForm(
  props: IncomeFormProps & {
  /** 캐릭터의 메소 획득량을 읽어 오는 함수. 폼은 `nexon/` 도 `storage/` 도 모른다. */
    loadMesoRate: (ocid: string) => Promise<MesoRateLoad>
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
   * 캐릭터 레벨을 상태로 드는 이유는 **그때의 값**이어야 하기 때문이다:
   * 캐릭터는 레벨업하므로 지금 레벨을 다시 읽으면 옛 기록의 금액이 열 때마다 달라진다. 대신
   * 사용자가 고르개로 캐릭터를 **바꾸면** 그 캐릭터의 지금 레벨로 갈아 끼운다. 그건 사용자가 한 일이다.
   */
  const [huntLevel, setHuntLevel] = useState<number | null>(
    detail?.characterLevel ??
      props.characters.find((each) => each.ocid === props.editing?.ocid)?.level ??
      null,
  )
  /** 고른 사냥터 이름. 지역은 여기서 따라온다(이름이 전역 유일이다). */
  const [groundName, setGroundName] = useState<string | null>(
    detail === null ? null : (props.editing?.item ?? null),
  )
  /** 고른 지역. 사냥터를 아직 안 골랐어도 지역만 골라 둔 상태가 있다. */
  const [regionSlug, setRegionSlug] = useState<string | null>(() => {
    const name = detail === null ? null : (props.editing?.item ?? null)
    return name === null ? null : (findHuntingGround(name)?.region.slug ?? null)
  })
  /**
   * 고르는 것은 **놓치는 마릿수**(0~4)이지 퍼센트가 아니다. 효율 %는 맵이
   * 정하는 라벨이라 맵을 바꾸면 같은 조각의 글자가 달라진다.
   */
  const [missedMobs, setMissedMobs] = useState(detail?.missedMobs ?? 0)
  const [boosts, setBoosts] = useState<readonly string[]>(detail?.boosts ?? [])
  const [sojae, setSojae] = useState(detail?.sojae ?? 1)
  const [fragmentsText, setFragmentsText] = useState(mesoTextOf(detail?.fragments ?? 0))
  const [fragmentPriceText, setFragmentPriceText] = useState(mesoTextOf(detail?.fragmentPrice ?? 0))
  /**
   * 캐릭터의 메소 획득량. **읽었으면 못 치고, 못 읽었으면 치는 칸**이 된다(결정 7).
   *
   * 수정으로 열면 **그때의 값**이 자동값으로 선다(결정 8). 레벨과 같은 이유다.
   */
  const [mesoRate, setMesoRate] = useState<MesoRateLoad | { kind: 'loading' }>(
    detail === null ? { kind: 'fallback', percent: null } : { kind: 'read', percent: detail.mesoRate },
  )
  /** 폴백 칸에 친 글자. 지우는 중간 상태가 있어 숫자가 아니라 글자로 든다. */
  const [mesoRateText, setMesoRateText] = useState('')
  /**
   * **마지막으로 요청한 캐릭터**. 캐릭터를 빠르게 두 번 바꾸면 먼저 부른 응답이 늦게 도착해
   * 남의 메획이 박힐 수 있다. 그 값은 곧 금액이라 조용히 틀리면 안 된다.
   */
  const mesoRateRequest = useRef<string | null>(props.editing?.ocid ?? null)
  const { saving, submit, remove } = useSheetSubmit(props)

  const huntRegions = huntingRegionsForLevel(huntLevel)
  const huntRegion = regionSlug === null ? null : findHuntingRegion(regionSlug)
  /**
   * 목록에 서는 차례. **레벨 차이가 적은 순, 같으면 마릿수가 많은 순**.
   * 거르는 것이 아니라 줄 세우는 것이라 지역 안의 맵은 전부 든다.
   */
  const huntGrounds = huntRegion === null ? [] : huntingGroundsFor(huntRegion, huntLevel)
  const huntGround =
    groundName === null || huntRegion === null
      ? null
      : (huntRegion.grounds.find((each) => each.name === groundName) ?? null)

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
  const boostPercent = boostPercentOf(boosts) + mesoRatePercent
  /** 통 **밖**에서 곱하는 배율. 재획비다. 합산이 끝난 값 전체에 걸린다. */
  const boostMultiplier = boostMultiplierOf(boosts)
  /**
   * 줄에 적히는 수. **켠 아이템까지 반영한 증가량**이고 소수점은 버린다.
   * **이 값으로 돈을 세지 않는다**. 셈은 내림 전의 값으로 돈다.
   */
  const appliedRate = appliedMesoRatePercent(boostPercent, boostMultiplier)

  const huntInput = { characterLevel: huntLevel, missedMobs, boostPercent, boostMultiplier, sojae }
  /** 사냥터를 안 골랐으면 0 이다. 계산기가 반쯤 찬 상태이고, 그때도 조각 값은 선다. */
  const huntMeso = huntGround === null ? 0 : huntingMesoOf({ ...huntInput, ground: huntGround })
  const fragments = mesoValueOf(fragmentsText)
  const fragmentPrice = mesoValueOf(fragmentPriceText)
  const huntTotal = huntingTotalOf({ ...huntInput, ground: huntGround, fragments, fragmentPrice })
  /** 저장 가능 여부. 합계가 0 보다 크면 된다. 사냥터를 안 골라도 조각만 적을 수 있다. */
  const canSave = huntTotal > 0

  /**
   * 캐릭터를 고르면 **레벨이 따라 바뀌고**, 그 레벨의 창 밖으로 나간 지역은 풀린다
   *
   *
   * 안 풀면 고르개가 목록에 없는 값 을 들게 되어 트리거가 첫 칸(선택 안함)을 읽어 준다.
   * 화면에는 다른 지역이 적히는데 계산은 옛 사냥터로 도는 상태가 된다.
   */
  function selectCharacter(next: string | null): void {
    setOcid(next)
    const level =
      next === null ? null : (props.characters.find((each) => each.ocid === next)?.level ?? null)
    setHuntLevel(level)
    if (
      regionSlug !== null &&
      !huntingRegionsForLevel(level).some((each) => each.slug === regionSlug)
    ) {
      setRegionSlug(null)
      setGroundName(null)
    }
    loadMesoRateFor(next)
  }

  /**
   * 캐릭터의 메획을 읽어 온다. **고르는 그 순간**이 계기다(레벨을 갈아 끼우는
   * 자리와 같다). 선택 안함 이면 읽을 대상이 없어 줄이 걷히고 곱이 ×1 로 돌아간다.
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
    setRegionSlug(next)
    setGroundName(null)
  }

  function toggleBoost(id: string): void {
    setBoosts((current) =>
      current.includes(id) ? current.filter((each) => each !== id) : [...current, id],
    )
  }

  return (
    <>
      <CharacterField characters={props.characters} selected={ocid} onSelect={selectCharacter} />

      {/*
        **지역과 사냥터는 각각 자기 줄**이다(사용자 지정 2026-09-01).

        한 줄에 나란히 세워 봤더니(2026-08-29) 이름이 길어 둘 다 잘렸다. 지역은 `츄츄 아일랜드`,
        사냥터는 `풍화된 기쁨과 분노의 땅` 까지 간다. 시트가 한 줄 길어지는 대신 고른 것이 온전히
        읽힌다. 줄어든 높이는 아래에서 소비 아이템과 메소 획득량을 합쳐 되찾는다.
      */}
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
                ...huntGrounds.map((ground) => ({ value: ground.name, label: ground.name })),
              ]
        }
        selected={groundName}
        onSelect={setGroundName}
        testID="income-sheet-ground"
        // 목록 한 줄에 포스 배지·레벨·마릿수가 함께 선다.
        renderOption={(option: SelectOption, isSelected: boolean) => {
          const ground =
            huntRegion === null || option.value === null
              ? null
              : (huntRegion.grounds.find((each) => each.name === option.value) ?? null)
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
        }}
      />

      {huntGround !== null && huntRegion !== null && (
        // 고른 사냥터의 값이 **자기 줄**로 선다. 닫힌 고르개는 이름만 그리므로(결정 11)
        // 여기가 없으면 무엇을 골랐는지의 근거가 화면에서 사라진다.
        <View
          testID="income-sheet-ground-detail"
          className="flex-row items-center justify-end gap-2 pb-1"
        >
          <ForceBadge region={huntRegion} force={huntGround.force} />
          <Text className="text-11 text-text-muted" style={TABULAR_NUMS}>
            {levelLabelOf(huntGround)}
          </Text>
          {/* **감소한 마릿수**를 적는다(사용자 지정 2026-08-28). 사냥터 목록은 맵의 제원
              (40마리)을 적지만 이 줄은 **실제로 잡는 수** 다. 그것이 곧 계산에 드는 값이다. */}
          <Text
            testID="income-sheet-killed-mobs"
            className="text-11 text-text-muted"
            style={TABULAR_NUMS}
          >
            {killedMobsOf(huntGround.mobs, missedMobs)}마리
          </Text>
        </View>
      )}

      {huntGround !== null && (
        // **효율 조각은 맵이 정한다**. 40마리의 −1 은 98%, 22마리의 −1 은 95%
        // 다. 그래서 사냥터를 고르기 전에는 적을 글자가 없어 줄이 아예 안 선다.
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

      {/*
        **켜는 것과 세어진 값이 한 줄**이다(사용자 지정 2026-09-01).

        종전에는 위아래 두 줄이었다. 켜는 자리와 그 결과를 갈라 놓은 것인데,
        둘은 원인과 결과라 **옆에 붙어 있어도 그 관계가 읽힌다**. 지역·사냥터를 각각 자기 줄로
        되돌리면서 늘어난 높이를 여기서 되찾는다.

        `flex` 를 `style` 로 주는 이유는 **비율이 값이기 때문**이다. 클래스에 임의 값을 적으면
        그 수가 두 곳(둘의 합)으로 흩어져 **왜 이 비율인가** 가 안 읽힌다.
      */}
      <View testID="income-sheet-meso-line" className="flex-row items-start gap-3">
        {/*
          **넓은 쪽이 켜는 칸**이다(사용자 지정 2026-09-01). 라벨 다섯 글자와 체크박스 둘이 함께
          서야 해서 값 칸보다 자리가 더 든다. 값 쪽은 라벨과 숫자 하나뿐이라 좁아도 선다.
        */}
        <View
          testID="income-sheet-boosts"
          style={{ flex: 2 }}
          className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2"
        >
          <Text className="shrink-0 text-xs text-text-muted">소비 아이템</Text>
          <View className="flex-1 flex-row items-center justify-end gap-4">
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
          </View>
        </View>

        {/*
          **언제나 선다**(사용자 지정 2026-08-29). 캐릭터를 안 골랐어도 그 자리는 있다. 안 세우면
          캐릭터를 고르는 순간 줄이 생겨 아래가 통째로 밀리고, 무엇보다 **메획이 안 든다** 는 사실을
          화면이 말하지 않는다. 캐릭터가 없으면 캐릭터 메획이 0 이고, 켠 것이 없으면 **0%** 다.

          읽혔으면 **못 친다**(큰 숫자와 같은 논리). **치는 칸이 되는 것은** 캐릭터를 골랐는데
          못 읽었을 때뿐이다. 고르지도 않은 캐릭터의 메획을 물을 수는 없다.
        */}
        <View testID="income-sheet-meso-rate-slot" style={{ flex: 1 }}>
          <FieldRow label="메소 획득량">
            {ocid !== null && mesoRate.kind === 'fallback' ? (
              <>
                <SheetTextInput
                  testID="income-sheet-meso-rate-input"
                  value={mesoRateText}
                  onChangeText={(text) => setMesoRateText(text.replace(/[^\d]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  className="flex-1 text-right text-sm font-semibold text-text"
                  style={TABULAR_NUMS}
                />
                <Text className="ml-1.5 shrink-0 text-xs text-text-muted">%</Text>
                {appliedRate !== typedMesoRate && (
                  // 치는 칸에는 **캐릭터 메획**이 남고(사용자가 아는 값이 그것이다) 켠 것까지 더한
                  // 총합은 그 옆에 선다. 한 칸에 겹치면 무엇을 친 것인지 사라진다.
                  <Text
                    testID="income-sheet-meso-rate-applied"
                    className="ml-1.5 shrink-0 text-xs font-semibold text-text"
                    style={TABULAR_NUMS}
                  >
                    → {appliedRate}%
                  </Text>
                )}
              </>
            ) : (
              <Text
                testID="income-sheet-meso-rate"
                className="text-sm font-semibold text-text"
                style={TABULAR_NUMS}
              >
                {mesoRate.kind === 'loading' ? '…' : `${appliedRate}%`}
              </Text>
            )}
          </FieldRow>
        </View>
      </View>

      {/* `소재`는 사용자가 실제로 세는 단위다. 하나가 30분. */}
      <FieldRow label="시간">
        <QuantityStepper
          value={sojae}
          onChange={setSojae}
          label="소재"
          testID="income-sheet-sojae"
        />
        <Text className="ml-2 shrink-0 text-xs text-text-muted">소재</Text>
      </FieldRow>

      {/* **못 친다**. 앱이 세는 값이다. 큰 숫자(합계)와 다른 값이라 자기 줄을 갖는다.

          **`≈` 를 붙인다**(사용자 지정 2026-08-29). 이 수는 젠 주기·마릿수·레벨로 **미리 세어 둔
          값**이지 실제로 받은 액수가 아니다. 표식이 없으면 정산된 금액처럼
          읽힌다. 0 에는 안 붙인다. 아직 어림할 것이 없다. */}
      <FieldRow label="획득 메소">
        <Text
          testID="income-sheet-hunt-meso"
          className="text-sm font-semibold text-text"
          style={TABULAR_NUMS}
        >
          {huntMeso === 0 ? '' : '≈ '}
          {huntMeso.toLocaleString()}
        </Text>
        <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메소</Text>
      </FieldRow>

      <FragmentFields
        fragments={fragmentsText}
        fragmentPrice={fragmentPriceText}
        onChangeFragments={setFragmentsText}
        onChangeFragmentPrice={setFragmentPriceText}
      />

      <AmountFigure
        // **사냥의 큰 숫자는 합계**다. 획득 메소 + 조각 × 가격. 앱이 세므로 못 친다.
        value={huntTotal}
        unit="메소"
        testID="income-sheet-amount"
        // **합계도 어림이다**. 조각 값만 실제로 받은 값이고 메소 쪽은 센 값이다.
        approximate
      />

      <SaveRow
        editing={editing}
        canSave={canSave}
        saving={saving}
        onSave={() =>
          void submit({
            ocid,
            earnedOn: props.dateKey,
            category: '사냥',
            // **고른 사냥터의 이름**이 그 자리다(전역 유일이라 지역이 따라온다).
            item: groundName,
            // **합계**다(메소 + 조각 × 가격). 큰 숫자에 서는 그 값이다.
            mesoAmount: huntTotal,
            saleFeePercent: null,
            saleFeeMeso: null,
            pointAmount: null,
            pointPer100mMeso: null,
            cashAmount: null,
            // 수량은 `기타`만 쓴다.
            quantity: null,
            // **계산 입력을 함께 남긴다**. 없으면 수정 시트가 빈 계산기로 열려
            // 만지는 순간 금액이 덮인다.
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
            },
            memo: null,
          })
        }
        onDelete={props.onDelete === undefined ? undefined : () => void remove()}
      />
    </>
  )
}
