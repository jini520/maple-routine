/**
 * 시트의 칸 하나를 키보드 위에서 받는 카드.
 *
 * 시트는 키보드에 반응하지 않는다. 칸을 누르면 시트를 한 겹 더 덮고 이 카드가 떠서 그 칸만
 * 받는다. 시트의 칸은 값을 보여 주는 누르개가 되고 실제 입력은 여기에만 있다.
 *
 * **칸 하나를 받고 닫힌다.** 다음 칸으로 넘기는 버튼이 없어서 이전 버튼도 없다. 다음 칸은 시트의
 * 그 줄을 다시 눌러 새 카드를 연다. 그래서 폼이 치는 칸의 차례를 들 일이 없다. 조건에 따라
 * 섰다 말았다 하는 줄이 여럿이라 그 목록은 고정으로 둘 수 없는 것이었다.
 *
 * **셈한 결과를 안 그린다.** 합계는 확인을 누르고 시트로 돌아가면 큰 숫자 자리에 이미 서 있다.
 *
 * 정리(앞자리 0 걷기 · 빈 칸과 0 가르기)는 **호출부가 한다**. 폼마다 규칙이 갈려서다. 사냥의
 * 조각 가격은 빈 칸이 보관이고 0 은 0 메소에 판 것이다.

 *
 * @example
 * <InputCard
 *   label="조각 가격"
 *   context="솔 에르다 조각 · 개당"
 *   icon="meso"
 *   unit="메소"
 *   reading
 *   chips={MESO_QUICK_ADDS}
 *   value={fragmentPriceText}
 *   onConfirm={(next) => setFragmentPriceText(optionalMesoTextOf(optionalMesoValueOf(next)))}
 *   onCancel={() => setEditing(null)}
 * />
 */
import { useState } from 'react'
import {
  Image,
  Keyboard,
  Pressable,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'

import { getItemIconUrlByFile } from '../../../lib/assets/asset-lookup'
import type { ImageAssetRef } from '../../../types/image-asset'
import { formatMesoUnits } from '../../../lib/drop/drop-price'
import { Text, TextInput, XIcon } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { MAX_MESO, acceptMesoText, mesoTextOf, mesoValueOf } from '../MesoPad/meso-pad'
import { ShareField } from '../../molecules/ShareField/ShareField'
import { PartySizeStepper } from '../../molecules/PartySizeStepper/PartySizeStepper'
import { Segment } from '../../molecules/Segment/Segment'
import { Badge } from '../../atoms/Badge/Badge'
import { DEFAULT_MAX_PARTY_SIZE } from '../../../lib/boss/boss-crystal-prices'
import { FeeRow } from '../FeeRow/FeeRow'
import { NumberPad } from '../../molecules/NumberPad/NumberPad'
import { defaultKeyboardPx, resolveNumberPadUse } from '../../../lib/number-pad-metrics'
import type { MvpGradeKey } from '../../../lib/mvp/grades'

/**
 * 머리에 서는 표식. 메소를 받는 칸은 주머니, 조각 개수는 조각이다.
 *
 * 그림을 **직접 넘겨도 된다**. 드롭 판매가는 그 아이템 그림을 세운다. 이름 둘을 여기 더하지
 * 않는 것은, 부품이 아는 그림이 늘수록 어느 화면이 무엇을 쓰는지가 이 파일로 새기 때문이다.
 */
export type InputCardIcon = 'meso' | 'fragment' | ImageAssetRef

/**
 * 값 칸 아래 수 고르개. 라벨도 접미사도 호출부가 준다.
 *
 * `value` 는 **씨앗**이다. 그 뒤의 수는 카드가 들고, 확인이 친 값과 함께 내보낸다. 친 값과 같은
 * 자리에 두는 것이 요점이다. 호출부가 들면 한 번 누를 때마다 카드를 다시 열어야 한다.
 */
export interface ShareSpec {
  label: string
  /**
   * 어떻게 나눴나. **카드가 어느 쪽으로 열릴지를 이 값이 정한다.**
   *
   * 숫자로 되짚지 않는다. 비율 `1 : 3` 과 균등 `3인` 은 두 수가 같아, 되짚으면 비율로 고른
   * 33.3% 가 `기본 3인` 으로 열린다. 안 주면 아직 안 나눈 새 기록이라 `기본` 이다.
   */
  mode?: 'even' | 'ratio'
  /**
   * `기본` 의 분배 인원. **비율 합과 칸이 다르다.**
   *
   * 한 값을 나눠 쓰면 비율에서 합을 고친 것이 기본의 인원을 덮는다. 안 주면 1 이다.
   */
  partySize?: number
  /** `비율` 의 내 몫. */
  myShare: number
  /** `비율` 의 합. **기본의 인원이 아니다.** */
  sharesTotal: number
  /** `기본` 의 인원 상한. 그 보스 · 난이도의 최대 파티 인원이다 */
  maxPartySize?: number
}

/** 카드가 돌려주는 비율. 내 몫이 `내 비율 ÷ 합` 이고, **어느 쪽으로 골랐는지를 함께 싣는다.** */
export interface ShareValue {
  mode: 'even' | 'ratio'
  /** `기본` 의 인원. **방식과 무관하게 늘 싣는다** - 갈아타도 반대쪽 값이 안 사라진다. */
  partySize: number
  /** `비율` 의 내 몫. 방식과 무관하게 늘 싣는다. */
  myShare: number
  /** `비율` 의 합. 방식과 무관하게 늘 싣는다. */
  sharesTotal: number
}

/** 수수료 줄 하나의 씨앗. 손으로 고른 요율은 `percent`(`null` 은 없음) */
export interface FeeSeed {
  auto: boolean
  percent: number | null
}

/**
 * 비율 아래 판매 · 분배 수수료 줄 둘. 드롭 판매가가 쓴다.
 *
 * `autoFee` 는 자동의 명패와 요율이고, 그 기록 캐릭터 · 날짜의 등급에서 호출부가 찾는다.
 */
export interface FeesSpec {
  autoFee: { grade: MvpGradeKey; percent: number } | null
  sale: FeeSeed
  split: FeeSeed
}

/** 카드가 돌려주는 수수료. 자동이면 요율은 그 등급 요율이다 */
export interface FeesValue {
  saleFeePercent: number | null
  saleFeeAuto: boolean
  splitFeePercent: number | null
  splitFeeAuto: boolean
}

/** 칩이 작아진 만큼 누를 자리를 위아래로 넓힌다. 시각 크기는 24 이고 실제 타깃은 40 이다. */
const CHIP_HIT_SLOP = { top: 8, bottom: 8, left: 2, right: 2 }

const FEE_OPTIONS = ['없음', '3%', '5%'] as const

/** 분배 방식. `기본` 은 인원으로 균등하게 나누고 `비율` 은 내 비율과 합으로 나눈다. */
const SPLIT_OPTIONS = ['기본', '비율'] as const

/** 비율을 아직 안 정한 기록이 `비율` 로 갈아탈 때 놓이는 값. 파티 모달과 같은 `2 : 1`(66.7%)이다. */
const SEED_RATIO = { myShare: 2, sharesTotal: 3 }

/**
 * `비율` 칸의 씨앗. 내 비율이 1 이면 인원으로 균등하게 나눈 기록이라 비율을 정한 적이 없고,
 * 그 자리에는 `SEED_RATIO` 가 놓인다. 저장된 합을 그대로 쓰면 첫 화면이 `1/N`(33.3% 등)로 서서
 * 이미 고른 값처럼 읽힌다.
 */
function ratioSeedOf(share: ShareSpec | undefined): { myShare: number; sharesTotal: number } {
  if (share === undefined || share.mode !== 'ratio') return SEED_RATIO
  return { myShare: share.myShare, sharesTotal: share.sharesTotal }
}

function feeOptionOf(percent: number | null): (typeof FEE_OPTIONS)[number] {
  return percent === 3 ? '3%' : percent === 5 ? '5%' : '없음'
}

function feePercentOf(option: (typeof FEE_OPTIONS)[number]): number | null {
  return option === '없음' ? null : Number(option.replace('%', ''))
}


export interface InputCardProps {
  /** 칸 이름. 머리의 큰 글자. */
  label: string
  /** 칸 이름 아래 한 줄. 어느 아이템의 값인지처럼 시트에서만 알 수 있는 맥락. */
  context?: string
  /**
   * 반드시 있어야 하는 칸. 별표가 채워도 안 사라진다. `지금 비었다` 가 아니라 `이 칸은 반드시
   * 있어야 한다` 를 말하기 때문이다.
   */
  required?: boolean
  icon?: InputCardIcon
  /** 값 오른쪽 단위. `메소` · `개` · `%` · `메포`. */
  unit?: string
  placeholder?: string
  /** 시트가 든 지금 글자. 카드는 이것을 씨앗으로만 받는다. */
  value: string
  /**
   * 한국어 단위 읽기(`1200만`)를 값 왼쪽에 적을지. 메소 금액에만 뜻이 있다. 개수 · 비율 · 시세는
   * 자릿수가 작아 읽어 줄 것이 없고, 그 자리는 맥락 줄이 대신 진다.
   */
  reading?: boolean
  /** 글자 칸. 글자판이 뜨고 값이 왼쪽 정렬이며 칩이 안 선다. */
  text?: boolean
  /** 값에 더하는 눈금. 글자 칸에서는 무시된다. */
  chips?: readonly { label: string; value: number }[]
  /**
   * 값 칸 아래에 서는 **분배 비율 고르개**. 넘기면 카드가 칸 둘을 받는 모양이 된다.
   *
   * 라벨은 호출부가 준다. 부품은 그 비율이 무엇의 몫인지 모른다. 드롭 판매가가 쓴다.
   */
  share?: ShareSpec
  /** 비율 아래 판매 · 분배 수수료 줄. 넘기면 확인이 셋째 인자로 수수료를 준다 */
  fees?: FeesSpec
  /**
   * 확인 버튼의 글자. 기본은 `입력`.
   *
   * **판의 확인 키와 다른 말이어야 한다.** 판의 `확인` 은 친 숫자를 칸에 넣고 판을 내리는
   * 일이고, 이 버튼은 그 값을 기록에 넣고 카드를 닫는 일이다. 둘 다 `확인` 이면 판이 떠
   * 있는 동안 같은 말이 두 자리에 서서 무엇이 일어날지가 안 읽힌다.
   */
  confirmLabel?: string
  /**
   * **칸이 비었을 때**의 확인 글자. 안 주면 `confirmLabel` 을 그대로 쓴다.
   *
   * 저장할 것이 있나 없나로 버튼이 하는 일이 갈리는 자리가 있다. 드롭 판매가는 빈 칸에서
   * `다음(3/3)` 이고 값을 치면 `저장 후 다음(3/3)` 이다. 버튼을 둘로 두었더니 어느 쪽이 값을
   * 쓰는지가 안 읽혔다(사용자 지적).
   */
  confirmEmptyLabel?: string
  /**
   * 확인 왼쪽 끝에 서는 작은 곁들이. 값을 안 쓰고 **다른 상태로 끝내는** 길이다. 드롭 판매가의
   * `기록 안함` 이 쓴다.
   */
  exclude?: { label: string; onPress: () => void }
  /**
   * 확인 바로 왼쪽에 서는 **뒤로**. 확인과 같은 것을 넘기고, 쓸지 말지는 받는 쪽이 정한다.
   *
   * 앞뒤로 오가는 동안 친 값이 안 날아가야 해서 값을 함께 준다(사용자 지정).
   */
  prev?: { label: string; onPress: (next: string, share?: ShareValue, fees?: FeesValue) => void }
  /**
   * 확인. 친 글자를 그대로 준다. 정리는 받는 쪽이 한다.
   *
   * 둘째 인자는 **스테퍼를 넘겼을 때만** 온다. 안 넘긴 카드는 인자 하나로 부른다. 없는 수를
   * `0` 으로 채워 보내면 받는 쪽이 그것을 값으로 읽을 수 있다.
   */
  onConfirm: (next: string, share?: ShareValue, fees?: FeesValue) => void
  /**
   * 버리고 닫기. **닫기 버튼(✕)과 안드로이드 뒤로가기**가 부른다.
   *
   * 스크림 탭은 안 부른다(사용자 지정). 실수로 판 밖을 눌러 치던 값이 날아가는 것을 막는다.
   */
  onCancel: () => void
  /**
   * 카드 판을 띄우는 자리. `InputCardLayer` 가 키보드 높이를 여기로 준다.
   *
   * **스크림이 아니라 판만 띄운다.** 바깥 상자에 여백을 주면 그 안에 사는 스크림이 여백 위에서
   * 끊겨 키보드와 카드 사이에 안 덮인 띠가 남는다(사용자가 실기 화면에서 잡았다).
   */
  panelStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>
  /**
   * 부탁을 세는 수. **바뀌면 씨앗을 다시 심는다**.
   *
   * 잇따라 여는 흐름(드롭 판매가)이 쓴다. 카드를 다시 세워도 같은 일이 되지만, 그러면 칸이
   * `autoFocus` 를 다시 걸어 키보드가 닫혔다 열린다.
   */
  seed?: number
}

/** 표식 이름에서 그림으로. 그림을 그대로 넘겼으면 그것이 답이다. 없는 그림은 없는 채로 둔다. */
function iconSourceOf(icon: InputCardIcon | undefined): ImageAssetRef | null {
  if (icon === undefined) return null
  if (icon === 'meso') return getItemIconUrlByFile('meso_pouch.webp')
  if (icon === 'fragment') return getItemIconUrlByFile('sol_erda_fragment.webp')
  return icon
}

export function InputCard(props: InputCardProps): React.JSX.Element {
  const [draft, setDraft] = useState(props.value)
  /**
   * **인원과 비율 합을 따로 든다**(사용자 지정). 둘은 같은 자리에 같은 모양으로 서지만 세는 것이
   * 다르다. 인원은 몇 명이 나누나이고 합은 내 몫의 분모다. 한 값을 나눠 쓰면 `비율` 에서 합을
   * 고친 것이 `기본` 의 인원을 덮는다.
   */
  const [partySize, setPartySize] = useState(props.share?.partySize ?? 1)
  const [ratio, setRatio] = useState(() => ratioSeedOf(props.share))
  /**
   * 씨앗을 다시 심는다. **그리는 중에** 바꾼다.
   *
   * 효과로 미루면 한 프레임 동안 앞 아이템의 값이 보인다. React 는 그리는 중의 자기 상태 갱신을
   * 받아들이고 그 자리에서 다시 그린다.
   */
  /** 비율로 나누나. **기록에 적힌 방식**으로 연다. 숫자로 되짚지 않는다. */
  const [usesRatio, setUsesRatio] = useState(props.share?.mode === 'ratio')
  const [saleFee, setSaleFee] = useState<FeeSeed>(props.fees?.sale ?? { auto: false, percent: null })
  const [splitFee, setSplitFee] = useState<FeeSeed>(props.fees?.split ?? { auto: false, percent: null })
  const [seed, setSeed] = useState(props.seed)
  if (props.seed !== seed) {
    setSeed(props.seed)
    setDraft(props.value)
    setPartySize(props.share?.partySize ?? 1)
    setRatio(ratioSeedOf(props.share))
    setUsesRatio(props.share?.mode === 'ratio')
    setSaleFee(props.fees?.sale ?? { auto: false, percent: null })
    setSplitFee(props.fees?.split ?? { auto: false, percent: null })
  }
  const autoFee = props.fees?.autoFee ?? null
  /** 지금 선 쪽의 값. 확인이 내보내는 것도 수수료 줄이 보는 것도 이것 하나다. */
  /**
   * 지금 선 쪽의 값. **넷을 다 싣는다** - 방식을 갈아타도 반대쪽 값이 안 사라진다.
   *
   * 아래 `earns`·`splits` 는 **선 쪽의 수**로 판정해야 하므로 그 둘만 따로 센다.
   */
  const share: ShareValue = { mode: usesRatio ? 'ratio' : 'even', partySize, ...ratio }
  const mine = usesRatio ? ratio.myShare : 1
  const total = usesRatio ? ratio.sharesTotal : partySize
  /** 받는 돈이 있나. 내 몫이 0 이면 경매장에 떼일 것도 파티원에게 보낼 것도 없다. */
  const earns = mine > 0
  // 내 비율이 합과 같으면 혼자 다 갖는 것이라 보낼 곳이 없다.
  const splits = total > mine

  const isText = props.text === true

  const { height: windowHeightPx } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  /**
   * OS 키보드 대신 앱이 그린 판으로 받는가. `null` 은 아직 카드를 못 잰 것이다.
   *
   * **카드를 열 때 한 번 정하고, 정해진 뒤에는 판 쪽으로만 넘어간다.** 치는 중에 입력 방식이
   * 오락가락하면 손이 가던 자리가 사라진다. 창이 작아지는 쪽(접기 · 분할)으로 바뀌면 다시
   * 판정되고, 커지는 쪽으로는 안 돌아간다.
   */
  const [usesPad, setUsesPad] = useState<boolean | null>(null)

  /** 판이 지금 떠 있나. 판 바깥을 누르면 내려가고 값 칸을 누르면 올라온다. */
  const [padOpen, setPadOpen] = useState(true)

  function measure(event: LayoutChangeEvent): void {
    const 잰_높이 = event.nativeEvent.layout.height
    const 판정 = resolveNumberPadUse({
      windowHeightPx,
      topInsetPx: insets.top,
      keyboardHeightPx: defaultKeyboardPx(),
      cardHeightPx: 잰_높이,
    })
    setUsesPad((prev) => prev === true || 판정)
  }

  /** 글자 칸은 IME 가 조합을 해야 해서 언제나 OS 키보드다. 판은 숫자 칸만 받는다. */
  const padVisible = !isText && usesPad === true && padOpen

  /**
   * 판 바깥을 누르면 내려간다. **카드는 안 닫힌다.**
   *
   * OS 키보드를 쓰던 시절의 규칙을 자체 판이 그대로 물려받는다. 닫는 것은 `✕` 와 안드로이드
   * 뒤로가기뿐이고, 바깥 탭으로 치던 값이 날아가지 않는다.
   */
  function dismissInput(): void {
    if (padVisible) {
      setPadOpen(false)
      return
    }
    Keyboard.dismiss()
  }

  /**
   * OS 키보드를 띄울 칸인가. 판이 받는 칸에서는 안 띄운다. 커서와 물리 키보드 타건은 살아 있다.
   *
   * **아직 안 정했으면(`null`) 안 띄운다.** 모르면 판 쪽으로 기울이는 규칙이 판정 함수에만
   * 있고 여기에 없으면, 첫 프레임의 `autoFocus` 가 키보드를 올려 버린다. 그 뒤에 판정이
   * 판으로 나도 **이미 뜬 키보드는 이 프롭으로 안 닫히고**, 키보드가 카드를 밀어 올려
   * 값 칸과 판이 함께 화면 위로 나간다(실기기에서 그렇게 났다).
   */
  const showsSystemKeyboard = isText || usesPad === false

  const chips = isText ? [] : (props.chips ?? [])
  const iconSource = iconSourceOf(props.icon)

  /**
   * 칸에 보이는 글자. **숫자는 콤마로 끊는다**(사용자 지정). 자릿수가 커서 안 끊으면 억인지
   * 조인지 눈으로 세야 한다.
   *
   * 들고 있는 값(`draft`)은 숫자만이다. 콤마는 보이는 자리에서만 붙이고, 돌아올 때 `acceptMesoText`
   * 가 걷는다. `0` 을 빈 칸으로 접지 않는 것은 사냥의 조각 가격에서 **빈 칸은 보관이고 0 은 0 메소에
   * 판 것**이라 뜻이 갈리기 때문이다.
   */
  const shown = isText || draft === '' ? draft : mesoValueOf(draft).toLocaleString()

  function change(next: string): void {
    setDraft(isText ? next : acceptMesoText(draft, next))
  }

  function add(step: number): void {
    setDraft(mesoTextOf(Math.min(MAX_MESO, mesoValueOf(draft) + step)))
  }

  /**
   * 지금 든 것을 넘긴다. 확인과 이전이 **같은 것을 준다**.
   *
   * 비율을 안 넘긴 카드는 인자 하나로 부른다. 없는 비율을 채워 보내면 받는 쪽이 그것을 값으로
   * 읽을 수 있다.
   */
  function give(to: ((next: string, share?: ShareValue, fees?: FeesValue) => void) | undefined): void {
    if (to === undefined) return
    if (props.fees !== undefined) {
      const percentOf = (fee: FeeSeed) => (fee.auto ? (autoFee?.percent ?? null) : fee.percent)
      to(draft, share, {
        saleFeePercent: percentOf(saleFee),
        saleFeeAuto: saleFee.auto,
        splitFeePercent: percentOf(splitFee),
        splitFeeAuto: splitFee.auto,
      })
    } else if (props.share === undefined) to(draft)
    else to(draft, share)
  }

  /** 수수료 줄 하나. 끄는 순간 방금까지 자동이던 요율을 고른 채 선다. */
  function feeRow(
    label: string,
    testID: string,
    fee: FeeSeed,
    setFee: (next: FeeSeed) => void,
    disabled: boolean,
  ): React.JSX.Element {
    return (
      <FeeRow
        testID={testID}
        variant="stacked"
        disabled={disabled}
        label={label}
        auto={fee.auto}
        onAutoChange={(auto) => setFee({ auto, percent: !auto && autoFee !== null ? autoFee.percent : fee.percent })}
        autoFee={autoFee}
        options={FEE_OPTIONS}
        selected={feeOptionOf(fee.percent)}
        onSelect={(option) => setFee({ auto: false, percent: feePercentOf(option) })}
      />
    )
  }

  return (
    // 자리는 `InputCardLayer` 가 준다. 카드는 자기가 키보드 위 어디에 앉는지 모른다.
    <View className="flex-1 justify-end" testID="input-card">
      {/*
        시트 위에 한 겹 더. **누르면 키보드만 내린다**(사용자 지정). 카드는 안 닫힌다. 닫는 것은
        ✕ 뿐이다. 판의 빈 자리와 같은 일을 하므로 카드 안팎이 같은 규칙이 된다.

        터치는 여기서 멈춘다. 카드가 열려 있는 동안 뒤의 시트는 안 눌린다.
      */}
      <Pressable
        testID="input-card-scrim"
        onPress={dismissInput}
        className="absolute inset-0 bg-scrim"
      />

      {/*
        띄우는 상자와 그리는 상자를 **가른다**. 한 상자에 `style` 과 `className` 을 함께 주면
        NativeWind 가 클래스를 `style` 로 푸는 바람에 한쪽이 덮여, 판의 바탕·모서리·여백이
        통째로 사라진다(시뮬레이터에서 두 번 그렇게 났다).
      */}
      <Animated.View style={props.panelStyle}>
        {/*
          판의 **빈 자리를 누르면 키보드만 내린다**(사용자 지정). 카드는 제자리에 남는다. 자리는
          마지막으로 잰 키보드 높이를 붙들고 있어 안 흔들린다.

          누르개가 아니면 아무 일도 안 일어난다. RN 은 터치가 닿은 가장 위 뷰에서 멈추고 뒤의
          스크림으로 흘려보내지 않는다. 그래서 손에 익은 **입력 칸 밖을 누르면 키보드가 내려간다**
          가 저절로는 성립하지 않았다.
        */}
        <Pressable
          testID="input-card-panel"
          onLayout={measure}
          onPress={dismissInput}
          className="mx-3 mb-3 rounded-2xl border border-border-strong bg-surface p-4"
        >
          <View className="flex-row items-center gap-2.5">
            {iconSource !== null && (
              // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
              <Image source={iconSource} resizeMode="contain" className="h-7 w-7 shrink-0" aria-hidden />
            )}
            <View className="min-w-0 flex-1">
              <Text testID="input-card-label" numberOfLines={1} className="text-sm font-bold text-text">
                {props.label}
                {props.required === true && (
                  <Text testID="input-card-required" className="text-error-ink">
                    {' *'}
                  </Text>
                )}
              </Text>
              {props.context !== undefined && (
                <Text testID="input-card-context" numberOfLines={1} className="text-11 text-text-muted">
                  {props.context}
                </Text>
              )}
            </View>
            <Pressable
              testID="input-card-close"
              role="button"
              aria-label="닫기"
              onPress={props.onCancel}
              className="-mr-2.5 h-11 w-11 items-center justify-center"
            >
              <XIcon className="h-5 w-5 text-text-muted" aria-hidden />
            </Pressable>
          </View>

          {/*
            읽기 칸은 값이 비어도 자리를 지킨다. 사라지면 첫 타건에 값이 왼쪽으로 밀린다.
            글자 칸에는 읽어 줄 단위가 없어 그 자리를 아예 안 세운다.
          */}
          {/*
          **높이를 못박지 않고 여백으로 만든다.** 상자에 `h-14`, 안쪽 칸에 `h-9` 를 주면 둘의
          가운데가 서로 어긋나 글자가 위로 붙었다(사용자 지적). 위아래 여백을 같은 값으로 주고
          줄 높이가 상자를 정하면 대칭이 구조로 보장된다. `min-h-14` 는 값이 짧아도 상자가
          작아지지 않게 하는 바닥이다.
        */}
        <View className="mt-3 min-h-14 flex-row items-center gap-2 rounded-xl border-[1.5px] border-primary bg-bg px-3.5 py-2.5">
            {props.reading === true && (
              <Text testID="input-card-reading" className="shrink-0 text-xs text-text-muted" style={TABULAR_NUMS}>
                {draft === '' ? '' : formatMesoUnits(mesoValueOf(draft))}
              </Text>
            )}
            <TextInput
              /*
                **글자 칸만 다시 세운다.** 아톰이 글자 칸을 `defaultValue` 로 심는데(그래야 한글
                조합이 안 깨진다) 그 값은 이미 선 칸에서는 안 갈린다. 씨앗이 바뀌었는데 안 갈리면
                잇따라 여는 흐름에서 **안 친 글자가 저장된다**.

                숫자 칸은 통제된 값이라 다시 세울 것이 없다. 다시 세우면 `autoFocus` 가 키보드를
                닫았다 여는데, 잇따라 받는 흐름은 숫자 칸뿐이라 그 깜빡임이 사라진다.
              */
              /*
                숫자 칸은 **판정이 정해질 때 한 번 다시 선다.** 칸을 안 다시 세우면
                `showSoftInputOnFocus` 가 늦게 `true` 가 되어도 `autoFocus` 는 이미 지나가
                OS 키보드가 안 올라온다. 카드가 열리는 순간이라 사용자가 치기 전이고,
                값은 통제된 프롭이라 다시 세워도 안 날아간다.
              */
              key={isText ? props.seed : `pad-${String(usesPad)}`}
              testID="input-card-value"
              aria-label={props.label}
              value={shown}
              onChangeText={change}
              keyboardType={isText ? undefined : 'number-pad'}
              placeholder={props.placeholder ?? (isText ? '' : '0')}
              autoFocus
              showSoftInputOnFocus={showsSystemKeyboard}
              onPressIn={() => setPadOpen(true)}
              /*
                **글자와 숫자의 크기가 다르다.** 숫자는 자릿수를 세는 값이라 크게 두고, 글자는
                한 줄에 이름이 다 들어가야 해서 한 단계 작다. 둘을 같은 크기로 두면 글자 칸에서
                자리표시자까지 카드를 꽉 채운다.
              */
              /*
                **줄 높이를 아예 안 준다.** `text-*` 가 함께 넣는 `lineHeight` 가 iOS 에서 줄 상자를
                아래로 밀어 위아래 여백이 어긋났고(위 18 · 아래 14.7 로 쟀다), `leading-none` 으로
                글자 크기와 같게 맞췄더니 이번엔 숫자 윗부분이 잘렸다(사용자 지적). 크기만 주고
                줄 높이는 글꼴이 정하게 두면 둘 다 안 난다.

                **높이 `h-9` 는 못박는 값이다.** 안 주면 iOS 가 담은 글자의 종류대로 칸 키를 재서
                한글을 칠 때와 숫자를 칠 때 상자가 다른 높이가 된다. 36 + 위아래 여백 20 이 상자의
                바닥 `min-h-14`(56)와 같아서 지금 보이는 모양은 안 바뀐다. 글자는 이 36 안에서
                가운데 선다.
              */
              className={`h-9 flex-1 text-text ${isText ? 'text-left font-semibold' : 'text-right font-bold'}`}
              style={[isText ? null : TABULAR_NUMS, { fontSize: isText ? 16 : 20 }]}
            />
            {props.unit !== undefined && (
              <Text className="shrink-0 text-xs font-semibold text-text-muted">{props.unit}</Text>
            )}
          </View>

          {/*
            값 칸 아래 전부. **판이 이 위에 덮인다.**

            상자를 따로 두는 것은 판이 절대 배치로 이 자리 맨 위에 앉기 때문이다. 흐름에 끼워
            넣으면 아래가 밀려 카드가 104dp 만큼 길어지고, 길어지면 애초에 판을 띄운 이유
            (화면이 낮다)가 사라진다. 덮인 줄은 판 바깥을 한 번 눌러 돌아온다.
          */}
          <View className="relative">
          {chips.length > 0 && (
            <View className="mt-2 flex-row flex-wrap justify-end gap-1.5">
              {chips.map((chip) => (
                <Pressable
                  key={chip.label}
                  role="button"
                  onPress={() => add(chip.value)}
                  // 24px 이 권장 타깃(44)보다 작지만, 칩은 값을 더하는 곁들이라 잘못 눌러도
                  // 되돌리기가 한 번 더 누르는 것이다. 줄이 넘치지 않게 작게 둔다(사용자 지정).
                  hitSlop={CHIP_HIT_SLOP}
                  className="h-6 justify-center rounded-full border border-border px-2 active:bg-surface-2"
                >
                  <Text className="text-11 font-semibold text-text-muted" style={TABULAR_NUMS}>
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {props.share !== undefined && (
            <View className="mt-3 gap-2.5">
              <View className="flex-row items-center justify-between gap-2.5">
                <Text className="text-13 font-bold text-text">분배 방식</Text>
                <Segment
                  options={SPLIT_OPTIONS}
                  selected={usesRatio ? '비율' : '기본'}
                  size="md"
                  fixed
                  // 어느 쪽 수도 안 옮긴다. 둘이 각자 제 값을 들고 있어 돌아오면 그대로다.
                  onSelect={(option) => setUsesRatio(option === '비율')}
                />
              </View>

              {/*
                왼쪽이 그 드롭의 분배, 오른쪽이 수수료 둘이다. 위아래로 쌓으면 줄이 넷이라
                카드가 키보드를 밀어낸다.
              */}
              <View testID="input-card-split-fees" className="flex-row items-stretch gap-3">
                {usesRatio ? (
                  // 파티 모달의 비율 카드와 같은 바탕이다. 드롭 하나의 값이라 카드가 한 장이다.
                  <View className="flex-1 rounded-[12px] bg-bg px-3 pb-3 pt-[11px]">
                    <ShareField
                      label={props.share.label}
                      value={ratio}
                      // `ShareField` 는 방식을 모르는 부품이다. 여기는 늘 비율 쪽이다.
                      onChange={setRatio}
                      layout="stacked"
                    />
                  </View>
                ) : (
                  // 상한은 (보스 · 난이도)마다 다르다. 스테퍼는 그 수를 못 말하므로 배지가 옆에서 말한다.
                  //
                  // **높이 112 를 못박는다.** 112 는 `비율` 칸이 제 내용으로 서는 높이다(여백 11 +
                  // 머리 23 + 간격 8 + 트랙 24 + 간격 8 + 합 26 + 여백 12). 안 못박으면 이 칸이
                  // 84 라, 세그먼트를 누를 때마다 아래 버튼 줄이 그 차이만큼 뛴다. `비율` 칸은 안
                  // 못박는다. 제 내용대로 서게 두어야 글꼴 크기가 커져도 안이 안 잘린다.
                  //
                  // 오른쪽 수수료 칸이 110 이라 줄 높이는 두 칸이 거의 같이 정한다(실측).
                  <View
                    testID="input-card-party"
                    className="h-[112px] flex-1 gap-2.5 rounded-[12px] bg-bg px-3 pb-3 pt-[11px]"
                  >
                    <View className="flex-row items-center justify-between gap-1.5">
                      <Text className="text-11 font-semibold leading-[14px] tracking-[.04em] text-text-muted">
                        파티 인원
                      </Text>
                      <Badge variant="primary" size="mini" style={TABULAR_NUMS}>
                        최대 {props.share.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE}명
                      </Badge>
                    </View>
                    {/* 스테퍼는 머리 줄 아래 남는 자리 가운데다(사용자 지정). */}
                    <View testID="input-card-party-body" className="flex-1 items-center justify-center">
                      <PartySizeStepper
                        size="bare"
                        label={props.share.label}
                        value={partySize}
                        max={props.share.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE}
                        onChange={setPartySize}
                      />
                    </View>
                  </View>
                )}

                {props.fees !== undefined && (
                  // 줄 둘이 **항상 선다**(사용자 지정). 쓸 수 없는 줄은 없애지 않고 잠근다.
                  // 없애면 이 칸의 높이가 바뀌고, 그 줄이 원래 있다는 것도 안 보인다.
                  <View className="flex-1 justify-center gap-3.5">
                    {feeRow('판매 수수료', 'input-card-sale-fee', saleFee, setSaleFee, !earns)}
                    {feeRow('분배 수수료', 'input-card-split-fee', splitFee, setSplitFee, !earns || !splits)}
                  </View>
                )}
              </View>
            </View>
          )}

          {/*
            버튼 줄. 왼쪽부터 기록 안함 · 이전 · 확인이고 **확인이 가장 넓다**. 앞뒤로 오가는
            동안 손이 가는 자리가 안 흔들린다. 셋 다 지금 것을 처리하고 넘어가는 길이라 층을
            안 나누고 한 줄에 둔다.
          */}
          <View className="mt-3 h-11 flex-row items-center gap-2">
            {props.exclude !== undefined && (
              <Pressable
                testID="input-card-exclude"
                role="button"
                onPress={props.exclude.onPress}
                className="h-11 shrink-0 justify-center rounded-xl border border-border px-3 active:bg-surface-2"
              >
                <Text className="text-11 font-semibold text-text-muted">{props.exclude.label}</Text>
              </Pressable>
            )}
            {props.prev !== undefined && (
              <Pressable
                testID="input-card-prev"
                role="button"
                onPress={() => give(props.prev?.onPress)}
                className="h-11 flex-1 items-center justify-center rounded-xl border border-border active:bg-surface-2"
              >
                <Text className="text-xs font-semibold text-text-muted" style={TABULAR_NUMS}>
                  {props.prev.label}
                </Text>
              </Pressable>
            )}
            <Pressable
              testID="input-card-confirm"
              role="button"
              onPress={() => give(props.onConfirm)}
              className="h-11 flex-[2] items-center justify-center rounded-xl bg-primary"
            >
              <Text numberOfLines={1} className="text-sm font-bold text-on-primary" style={TABULAR_NUMS}>
                {draft === '' ? (props.confirmEmptyLabel ?? props.confirmLabel ?? '입력') : (props.confirmLabel ?? '입력')}
              </Text>
            </Pressable>
          </View>

            {padVisible && (
              // 값 칸과의 사이는 칩 줄의 `mt-2` 와 같은 8 이다. 판이 그 자리에서 시작한다.
              <View testID="input-card-pad" className="absolute inset-x-0 top-2">
                <NumberPad
                  onDigit={(digit) => change(`${draft}${digit}`)}
                  onBackspace={() => setDraft(draft.slice(0, -1))}
                  onConfirm={() => setPadOpen(false)}
                />
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  )
}
