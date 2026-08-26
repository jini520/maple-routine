/**
 * 시트의 **큰 숫자 한 덩어리**([[ADR-173]] 결정 1·2·9) — 저장 바로 위에 선다.
 *
 * ## 화면에 큰 숫자는 하나뿐이다
 *
 * 그 숫자가 무엇인지는 부르는 자리가 정한다 — **직접 입력이면 「치는 금액」, 목록 갈래면 「합계」**.
 * 어느 쪽이든 하나뿐이라, 친 금액과 합계가 같은 값인데 두 번 적히던 문제가 구조에서 사라진다.
 *
 * ## 힌트는 **값이 갈릴 때만** 뜬다
 *
 * 억/만 환산(`12억`) · 메소 환산(`메소로 −25.42억`) · 막힌 이유(`시세를 넣어야…`). 캐시처럼
 * 환산을 안 하는 자리는 **줄이 통째로 없다** — 자리를 비워 두지 않고 시트가 그만큼 짧아진다
 * ([[ADR-166]] 정정 2 ③ 의 «0 을 안 적는다» 와 같은 태도).
 *
 * ## 자기 윗선을 안 긋는다 (결정 9)
 *
 * 위 라벨–값 줄의 밑줄이 경계를 **겸한다**. 여기서 또 그으면 선이 두 줄로 보인다(사용자 지적).
 *
 * ## `MesoPad/MesoAmountField` 와 갈라 둔 이유
 *
 * 그쪽은 드롭 판매가(`DropPricePad`)의 것이고 **앱 키패드가 값을 넣는다**([[ADR-124]] 결정 5).
 * 그 화면은 글자 칸이 없어 키보드를 한 번도 안 부르므로 그 규칙이 살아 있다([[ADR-170]] 정정 4).
 * 여기서는 칸이 직접 받고 빠른 칩이 폼 밖(키보드 위)에 있어, 한 부품의 분기로 두면 한쪽을 고칠 때
 * 다른 쪽이 딸려 온다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { useCountUp } from '../../../lib/use-count-up'
import { Text, TextInput } from '../../atoms/Text/Text'
import { RotateCcwIcon } from '../../../lib/icons'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import { parseMesoText } from '../MesoPad/meso-pad'

export interface AmountFigureProps {
  value: number
  /** 숫자 옆에 붙는 단위 — 메소 · 메포 · 원. */
  unit: string
  /** 칸과 힌트를 집는 이름의 뿌리 — 힌트는 `${testID}-hint`, 덩어리는 `${testID}-figure` 다. */
  testID: string
  onChangeValue: (next: number) => void
  /** 없으면 그 줄을 **안 그린다**. */
  hint?: string
  /** 힌트가 «왜 저장이 안 되는지» 를 말하는 중인가 — 에러색이 된다. */
  hintBlocked?: boolean
  /**
   * **손을 뗐을 때 보여줄 값** — 없으면 `value` 와 같다([[ADR-173]] 결정 5·6).
   *
   * 관세가 그 자리다: 치는 것은 구입가인데 커서가 빠지면 관세를 더한 합계를 보여야 한다.
   * 그 사이를 **굴러서** 넘어가므로(`useCountUp` — [[ADR-087]] 결정 6) 더해지는 금액을 따로
   * 안 적는다. 숫자 자체가 그만큼 올라가는 것이 곧 그 말이다.
   */
  displayValue?: number
  /**
   * 이 칸에 **커서가 들어오고 나가는 것**을 부르는 자리에 알린다([[ADR-173]] 결정 4).
   *
   * 빠른 칩이 키보드 위에만 떠야 하는데, 그 띠는 시트 껍데기가 그린다(`footer`) — 즉 «지금 치는
   * 중인가» 를 시트가 알아야 한다. 포커스는 이 칸의 사실이므로 여기서 밖으로 낸다.
   */
  onTypingChange?: (typing: boolean) => void
  /**
   * **못 치는 숫자** — 목록 갈래의 합계가 그렇다(단가 × 수량이라 앱이 센다).
   *
   * 칸 대신 글자를 그리고 초기화도 안 세운다 — 지울 것이 없다. 수량이 바뀌면 **굴러간다**.
   */
  readOnly?: boolean
  /**
   * 카운트업의 **정체**([[ADR-087]] 정정 1) — 안 넘기면 `testID` 가 곧 정체다.
   *
   * 이 값이 바뀌면 굴리지 않고 **갈아 끼운다**. «같은 숫자가 변한 것» 과 «다른 숫자를 보게 된 것» 을
   * 가르는 자리라, 부르는 쪽만이 그 답을 안다(지출 시트의 갈래·대표·단계가 그렇다).
   */
  identity?: string
}

export function AmountFigure(props: AmountFigureProps): React.JSX.Element {
  /**
   * **칠 때는 친 값, 손을 떼면 보여 줄 값**([[ADR-173]] 결정 6).
   *
   * 치는 동안 굴리면 한 자를 칠 때마다 숫자가 움직여 무엇을 치는지 안 읽힌다. 그래서 커서가
   * 있는 동안에는 카운트업의 결과를 안 쓰고 친 값을 그대로 그린다.
   */
  const [focused, setFocused] = useState(false)
  const settled = props.displayValue ?? props.value
  const rolled = useCountUp(props.identity ?? props.testID, focused ? props.value : settled)
  const shown = focused ? props.value : rolled

  const empty = shown === 0
  const digits = `text-[30px] font-bold leading-none tracking-[-.03em] ${
    empty ? 'text-text-disabled' : 'text-text'
  }`

  return (
    <View testID={`${props.testID}-figure`} className="gap-1">
      <View className="flex-row items-baseline gap-1.5">
        {/* 초기화는 **큰 숫자와 같은 줄**이다(결정 1 이 세로를 줄인 자리). 값이 0 이면 지울 것이
            없으므로 자리만 지킨다 — 없애면 숫자가 좌우로 흔들린다. 못 치는 숫자에는 아예 없다. */}
        {props.readOnly !== true && (
        <Pressable
          role="button"
          aria-label="금액 초기화"
          onPress={() => props.onChangeValue(0)}
          pointerEvents={props.value === 0 ? 'none' : 'auto'}
          className={`mr-auto h-7 flex-row items-center gap-1 self-center rounded-full border border-border px-2.5 active:bg-surface-2${
            props.value === 0 ? ' opacity-0' : ''
          }`}
        >
          <RotateCcwIcon className="h-3 w-3 text-text-muted" strokeWidth={2.5} aria-hidden />
          <Text className="text-[11px] font-semibold text-text-muted">초기화</Text>
        </Pressable>
        )}

        {props.readOnly === true ? (
          <Text testID={props.testID} className={`ml-auto ${digits}`} style={TABULAR_NUMS}>
            {shown.toLocaleString()}
          </Text>
        ) : (
        <TextInput
          testID={props.testID}
          aria-label="금액"
          // 0 일 때 비우는 이유: 「0」 을 값으로 두면 그 뒤에 친 숫자가 붙어 자릿수가 하나 는다.
          value={empty ? '' : shown.toLocaleString()}
          onChangeText={(text) => props.onChangeValue(parseMesoText(props.value, text))}
          onFocus={() => {
            setFocused(true)
            props.onTypingChange?.(true)
          }}
          onBlur={() => {
            setFocused(false)
            props.onTypingChange?.(false)
          }}
          keyboardType="number-pad"
          placeholder="0"
          className={`flex-1 text-right ${digits}`}
          style={TABULAR_NUMS}
        />
        )}

        <Text className="shrink-0 text-xs font-semibold text-text-muted">{props.unit}</Text>
      </View>

      {props.hint !== undefined && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <Text
          testID={`${props.testID}-hint`}
          className={`text-right text-[11px] ${
            props.hintBlocked === true ? 'text-error-ink' : 'text-text-muted'
          }`}
          style={TABULAR_NUMS}
        >
          {props.hint}
        </Text>
      )}
    </View>
  )
}
