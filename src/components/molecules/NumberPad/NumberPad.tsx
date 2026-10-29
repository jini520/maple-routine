/**
 * 값 칸 아래에 뜨는 숫자 판. 6열 두 줄이다.
 *
 * ```
 * 1  2  3  4  5  ⌫
 * 6  7  8  9  0  확인
 * ```
 *
 * 소수점을 받는 카드는 윗줄 `⌫` 왼쪽에 `.` 이 더 선다. 줄을 늘리면 판이 높아져 짧은 화면에서
 * 판을 띄우는 뜻이 없어지므로 열을 늘린다.
 *
 * **OS 키보드가 아니라 값 칸에 딸린 판으로 읽혀야 한다.** 그래서 화면 전체 폭이 아니라 호출부가
 * 주는 폭에 맞춰 서고, 바탕과 테두리가 카드 안쪽 재질이다. 화면 바닥에 눕는 키보드 모양을 흉내
 * 내면 사용자가 OS 키보드로 착각해 시스템 동작(길게 눌러 기호 등)을 기대한다.
 *
 * 4행 3열(전화기 관습)을 안 쓴다. 키 44 를 지키면 200 이 넘어 짧은 화면에서 판을 띄우는 뜻이
 * 없어진다. 치수는 `lib/number-pad-metrics` 가 갖는다 - 판정하는 쪽과 같은 수를 봐야 한다.
 *
 * @example
 * <NumberPad onDigit={(d) => setDraft(draft + d)} onBackspace={drop} onConfirm={commit} />
 */
import { Pressable, View } from 'react-native'
import { vars } from 'nativewind'

import {
  NUMBER_PAD_GAP_PX,
  NUMBER_PAD_HEIGHT_PX,
  NUMBER_PAD_PADDING_PX,
  NUMBER_PAD_SHADOW,
} from '../../../lib/number-pad-metrics'
import { boxShadowOf } from '../../../lib/shadow'
import { useThemeAppearance } from '../../../theme/context'
import { buildPopoverScopeVariables } from '../../../theme/theme-vars'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { DeleteIcon, Text } from '../../atoms'

export interface NumberPadProps {
  /** 숫자 키 하나. `'0'`~`'9'` 한 글자로 온다. */
  onDigit: (digit: string) => void
  onBackspace: () => void
  onConfirm: () => void
  /**
   * 확인 키의 글자. 안 주면 `확인`.
   *
   * 카드의 버튼과 **다른 말이어야 한다**. 판의 확인은 친 숫자를 칸에 넣고 판을 내리는 일이고,
   * 카드의 버튼은 그 값을 기록에 넣는 일이다.
   */
  confirmLabel?: string
  /** 소수점 키. 넘긴 판에만 선다. */
  onDecimal?: () => void
  /** 소수점 키를 잠근다. **없애지 않는다** - 단위를 바꿀 때마다 키 자리가 움직이면 손이 헛간다. */
  decimalDisabled?: boolean
}

const 윗줄 = ['1', '2', '3', '4', '5'] as const
const 아랫줄 = ['6', '7', '8', '9', '0'] as const

/**
 * 마지막 열이 넓다. `⌫` 와 `확인` 은 글자가 숫자 한 자보다 길다.
 *
 * 숫자 다섯 칸과 같은 폭을 주면 `확인` 이 줄바꿈되거나 글자가 잘린다.
 */
const 마지막_열_배수 = 1.35

function DigitKey(props: { digit: string; onPress: (digit: string) => void }): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={props.digit}
      onPress={() => props.onPress(props.digit)}
      style={{ flexGrow: 1, flexBasis: 0 }}
      className="items-center justify-center rounded-[10px] bg-surface active:bg-surface-2"
    >
      <Text className="text-xl font-medium text-text" style={TABULAR_NUMS}>
        {props.digit}
      </Text>
    </Pressable>
  )
}

export function NumberPad(props: NumberPadProps): React.JSX.Element {
  const { definition } = useThemeAppearance()

  return (
    <View
      testID="number-pad"
      style={[
        // 다크에서는 팝오버처럼 시트보다 한 단 더 올린다. 판도 키도 카드와 같은 계열이라 그대로면 카드에 붙는다.
        vars(buildPopoverScopeVariables(definition)),
        {
          height: NUMBER_PAD_HEIGHT_PX,
          padding: NUMBER_PAD_PADDING_PX,
          gap: NUMBER_PAD_GAP_PX,
          // 판이 카드 위에 떠 있다는 것을 테두리 없이 그림자가 낸다.
          boxShadow: boxShadowOf(definition.shadowColor, NUMBER_PAD_SHADOW),
        },
      ]}
      className="rounded-xl bg-bg"
    >
      <View
        testID="number-pad-row-1"
        style={{ flexGrow: 1, flexBasis: 0, gap: NUMBER_PAD_GAP_PX }}
        className="flex-row"
      >
        {윗줄.map((digit) => (
          <DigitKey key={digit} digit={digit} onPress={props.onDigit} />
        ))}
        {props.onDecimal !== undefined && (
          <Pressable
            testID="number-pad-decimal"
            role="button"
            aria-label="소수점"
            aria-disabled={props.decimalDisabled === true}
            /*
              잠가도 **터치는 받는다.** \`disabled\` 로 두면 터치가 판 뒤의 카드로 넘어가, 카드의 빈 곳을
              누른 것처럼 판이 내려간다.
            */
            onPress={() => {
              if (props.decimalDisabled !== true) props.onDecimal?.()
            }}
            style={{ flexGrow: 1, flexBasis: 0 }}
            className={`items-center justify-center rounded-[10px] bg-surface active:bg-surface-2${
              props.decimalDisabled === true ? ' opacity-40' : ''
            }`}
          >
            <Text className="text-xl font-bold text-text">.</Text>
          </Pressable>
        )}
        <Pressable
          testID="number-pad-backspace"
          role="button"
          aria-label="한 자리 지우기"
          onPress={props.onBackspace}
          style={{ flexGrow: 마지막_열_배수, flexBasis: 0 }}
          className="items-center justify-center rounded-[10px] bg-surface-2 active:bg-track"
        >
          <DeleteIcon className="h-5 w-5 text-text" aria-hidden />
        </Pressable>
      </View>

      <View
        testID="number-pad-row-2"
        style={{ flexGrow: 1, flexBasis: 0, gap: NUMBER_PAD_GAP_PX }}
        className="flex-row"
      >
        {아랫줄.map((digit) => (
          <DigitKey key={digit} digit={digit} onPress={props.onDigit} />
        ))}
        <Pressable
          testID="number-pad-confirm"
          role="button"
          aria-label={props.confirmLabel ?? '확인'}
          onPress={props.onConfirm}
          // 윗줄에 소수점이 서면 그 한 칸 몫까지 넓어진다. 두 줄의 오른쪽 끝이 맞아야 판이 격자로 읽힌다.
          style={{ flexGrow: props.onDecimal === undefined ? 마지막_열_배수 : 마지막_열_배수 + 1, flexBasis: 0 }}
          className="items-center justify-center rounded-[10px] bg-primary active:opacity-90"
        >
          <Text numberOfLines={1} className="text-13 font-bold text-on-primary">
            {props.confirmLabel ?? '확인'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
