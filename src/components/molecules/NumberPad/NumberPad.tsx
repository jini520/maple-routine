/**
 * 값 칸 아래에 뜨는 숫자 판. 6열 두 줄이다.
 *
 * ```
 * 1  2  3  4  5  ⌫
 * 6  7  8  9  0  확인
 * ```
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
import { Pressable, StyleSheet, View } from 'react-native'

import {
  NUMBER_PAD_DARK_EDGE,
  NUMBER_PAD_GAP_PX,
  NUMBER_PAD_HEIGHT_PX,
  NUMBER_PAD_PADDING_PX,
  NUMBER_PAD_SHADOW,
} from '../../../lib/number-pad-metrics'
import { boxShadowOf } from '../../../lib/shadow'
import { useThemeAppearance } from '../../../theme/context'
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
      style={{
        height: NUMBER_PAD_HEIGHT_PX,
        padding: NUMBER_PAD_PADDING_PX,
        gap: NUMBER_PAD_GAP_PX,
        // 판이 카드 위에 떠 있다는 것을 낸다. 둘이 같은 계열 바탕이라 테두리만으로는 경계가 안 선다.
        boxShadow: boxShadowOf(definition.shadowColor, NUMBER_PAD_SHADOW),
        ...(definition.mode === 'dark'
          ? { borderWidth: StyleSheet.hairlineWidth, borderColor: NUMBER_PAD_DARK_EDGE }
          : null),
      }}
      className="rounded-xl border border-border bg-bg"
    >
      <View
        testID="number-pad-row-1"
        style={{ flexGrow: 1, flexBasis: 0, gap: NUMBER_PAD_GAP_PX }}
        className="flex-row"
      >
        {윗줄.map((digit) => (
          <DigitKey key={digit} digit={digit} onPress={props.onDigit} />
        ))}
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
          style={{ flexGrow: 마지막_열_배수, flexBasis: 0 }}
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
