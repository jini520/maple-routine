import { Pressable, View } from 'react-native'

import { MinusIcon, PlusIcon, UsersIcon } from '../../../lib/icons'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { Text } from '../../atoms'

// 파티원 수 스테퍼 — 보스 관리 페이지 행과 파티 인원 모달이 공유한다(ADR-121 결정 7).
//
// 크기 두 벌만 있고 레시피(보더 pill + Users + −/값/+)는 같다.
//   compact  목록 행 우상단. 좁아서 단위 없이 숫자만.
//   default  모달. 전폭으로 벌어지고 −/+ 가 양 끝에 앉는다.
//
// **−/+ 에 채움을 두지 않는다** — `surface-2` 는 표면과 대비 1.14~1.30 이라(등록 테마 6종 실측)
// 어느 테마에서도 원이 안 보인다. 경계는 pill 의 `border-border` 가 이미 그린다.
//
// ── RN 으로 옮기며 바뀐 것 다섯 ─────────────────────────────────────────────────────
//
// ① **`disabled:opacity-40` 을 JS 조건으로 옮겼다.** NativeWind 의 `disabled:` 변형은 웹 CSS 의
//    `:disabled` 의사 클래스라 RN 의 `Pressable disabled` 프롭과 이어져 있지 않다 — 남겨 두면
//    비활성 버튼이 **멀쩡한 색으로 보인다**(에러 없이). 같은 이유로 `disabled:hover:bg-transparent`
//    는 사라진다(짝이 되는 hover 자체가 없다).
// ② `hover:bg-surface-2` 제거(터치 기기에 hover 가 없다 — atoms 와 같은 규칙).
// ③ 히트 영역을 넓히던 `-m-1 p-1` 대신 **`hitSlop`** 을 쓴다. 웹은 음수 마진으로 레이아웃을 되돌려
//    시각 크기를 유지했는데, RN 에는 그 목적에 맞는 프롭(`hitSlop`)이 따로 있어 **레이아웃을 아예
//    건드리지 않고** 같은 결과를 낸다(32px·24px 는 권장 타깃 44px 보다 작다).
// ④ 아이콘 색이 버튼에서 아이콘으로 내려왔다(`text-text`). 웹은 버튼의 `color` 를 `currentColor`
//    가 물려받았지만 RN 에는 그 상속이 없다 — atoms 의 "상자/글자 두 벌"과 같은 성질이다.
// ⑤ `tabular-nums` 는 **클래스로 안 나온다** — NativeWind 가 그 클래스를 스타일 없이 통과시킨다
//    (`lib/text-styles.ts`). 값이 1↔6 을 오갈 때 −/+ 가 흔들리지 않게 하는 것이 이 속성의 일이라,
//    빠지면 이 컴포넌트가 지키려던 것이 그대로 무너진다.
const SIZES = {
  compact: {
    root: 'flex-row shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface py-0.5 pl-2 pr-1',
    button: 'h-6 w-6',
    icon: 'h-3.5 w-3.5',
    valueSlot: 'w-5 justify-center',
    value: 'text-sm font-semibold',
    marker: 'h-3.5 w-3.5',
  },
  default: {
    root: 'flex-row h-10 items-center justify-between rounded-full border border-border bg-surface p-1',
    button: 'h-8 w-8',
    icon: 'h-4 w-4',
    // min-w 고정 + tabular-nums 라 1↔6 을 오가도 −/+ 가 제자리에 있다.
    valueSlot: 'min-w-[66px] justify-center gap-0.5',
    value: 'text-19 font-extrabold leading-none tracking-[-.03em]',
    marker: null,
  },
} as const

/** 시각 크기(24·32px)와 권장 타깃(44px)의 차이를 사방으로 나눠 채운다. */
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 }

export function PartySizeStepper(props: {
  /** aria-label 접두 — 목록에서 어느 행의 스테퍼인지 구분한다(보스명). */
  label: string
  value: number
  max: number
  onChange: (next: number) => void
  size?: keyof typeof SIZES
}): React.JSX.Element {
  const size = SIZES[props.size ?? 'default']
  const buttonClass = `${size.button} items-center justify-center rounded-full`

  const canDecrease = props.value > 1
  const canIncrease = props.value < props.max

  return (
    <View className={size.root}>
      {/* default 는 라벨 줄에 Users 가 따로 서므로 안에 두지 않는다 — 한 화면에 두 번 나오면 중복이다. */}
      {size.marker !== null && (
        <UsersIcon className={`${size.marker} text-text-muted`} strokeWidth={2} aria-hidden />
      )}
      <Pressable
        role="button"
        onPress={() => props.onChange(props.value - 1)}
        disabled={!canDecrease}
        hitSlop={HIT_SLOP}
        aria-label={`${props.label} 파티원 수 감소`}
        className={`${buttonClass}${canDecrease ? '' : ' opacity-40'}`}
      >
        <MinusIcon className={`${size.icon} text-text`} strokeWidth={2} aria-hidden />
      </Pressable>

      {/* **단위를 안 적는다**([[ADR-173]] 결정 18, 사용자 지정 2026-08-27) — 이 앱의 스테퍼는
          숫자만 오르내린다. 무엇을 세는지는 곁의 라벨과 `Users` 표식이 말한다. */}
      <View className={`flex-row items-baseline ${size.valueSlot}`}>
        <Text className={`text-text ${size.value}`} style={TABULAR_NUMS}>
          {props.value}
        </Text>
      </View>

      <Pressable
        role="button"
        onPress={() => props.onChange(props.value + 1)}
        disabled={!canIncrease}
        hitSlop={HIT_SLOP}
        aria-label={`${props.label} 파티원 수 증가`}
        className={`${buttonClass}${canIncrease ? '' : ' opacity-40'}`}
      >
        <PlusIcon className={`${size.icon} text-text`} strokeWidth={2} aria-hidden />
      </Pressable>
    </View>
  )
}
