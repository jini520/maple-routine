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

import { useCountUp } from '../../../hooks/useCountUp'
import { Text } from '../../atoms/Text/Text'
import { SheetTextInput } from '../SheetTextInput/SheetTextInput'
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
  /**
   * **센 값이 어림이면 `≈` 를 앞에 붙인다**(사용자 지정 2026-08-29).
   *
   * 사냥 메소가 그렇다 — 젠 주기·마릿수·레벨로 **미리 세어 둔 값**이지 실제로 받은 액수가 아니다
   * ([[ADR-175]] 결정 3). 표식이 없으면 그 수가 정산된 금액처럼 읽힌다.
   *
   * **0 에는 안 붙인다** — 아직 아무것도 안 고른 상태라 어림할 것 자체가 없다.
   */
  approximate?: boolean
}

/**
 * 큰 숫자의 **글자 크기와 줄 상자**([[ADR-178]] 정정 2·3).
 *
 * 줄높이를 글자보다 크게 잡는 이유는 ascent 다 — 30px 글자에 30px 상자면 초점에서 위가 잘린다.
 *
 * 단위 상자가 **같은 두 수**를 쓴다(`unit` 줄) — 그래야 두 줄의 기준선이 같은 자리에 선다.
 * 클래스 문자열에는 보간을 못 하므로(NativeWind 가 빌드 때 읽는다) 같은 수를 두 곳에 적고
 * 그 일치를 테스트가 지킨다.
 */
const FIGURE_FONT_SIZE = 30
const FIGURE_LINE_HEIGHT = 38

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
  /** 어림 표식 — 0 에는 안 붙는다(어림할 것이 없다). */
  const approximateMark = props.approximate === true && !empty ? '≈ ' : ''
  /**
   * 큰 숫자의 **줄 상자를 못 박는다**([[ADR-178]] 결정 1 · 정정 2).
   *
   * `leading-none` 은 줄높이를 글자 크기와 같게 만든다 — 30px 글자에 30px 상자다. 아톰이 두
   * 플랫폼을 맞추려고 패딩과 글꼴 여백을 지워 둔 터라([[ADR-170]] 정정 13) 그 상자에 ascent 가
   * 안 들어가 **초점을 받으면 글자 위가 잘렸다**. 줄높이를 **글자보다 크게** 잡아 그 자리를 만든다.
   */
  // NativeWind 는 클래스 문자열을 **빌드 때** 읽으므로 여기에 상수를 보간하면 안 된다 —
  // 아래 두 상수와 **같은 수**를 손으로 적고, 그 사실을 `AmountFigure.test` 가 붙든다.
  const digits = `text-30 font-bold leading-[38px] tracking-[-.03em] ${
    empty ? 'text-text-disabled' : 'text-text'
  }`

  return (
    <View testID={`${props.testID}-figure`} className="gap-1">
      {/*
        **기준선에 기대지 않는다**([[ADR-178]] 정정 3).

        `items-baseline` 은 `TextInput` 이 섞인 줄에서 못 믿는다 — Yoga 가 노드마다 기준선을 어떻게
        잡는지가 갈리고, 실기에서 단위가 숫자 기준선 **위로 떠** 보였다(사용자 화면 2026-08-29,
        두 번). 그래서 **정렬을 위에서 맞추고**(`items-start`) 두 상자에 **같은 줄높이**를 준다.
        같은 줄높이에 **같은 크기의 글자**가 들어 있으면 기준선은 정의상 같은 자리다 — 단위 상자에
        폭 0 짜리 큰 글자를 심어 그 조건을 만든다(아래 `unitLine`).
      */}
      <View className="flex-row items-start gap-1.5">
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
          <Text className="text-11 font-semibold text-text-muted">초기화</Text>
        </Pressable>
        )}

        {/*
          **보이는 글자는 언제나 `Text` 다**([[ADR-178]] 정정 2·4).

          단위(「메소」)는 숫자와 **기준선을 맞춰야** 하는데, `items-baseline` 은 `TextInput` 에는
          안 먹는다 — Yoga 는 글자 노드에만 기준선을 주고 그 밖에는 **상자 밑변**으로 떨어진다.
          그래서 치는 칸 옆의 단위가 숫자 기준선 위로 떠 보였다(사용자 보고 2026-08-29).

          그래서 **상자와 기준선은 `Text` 가 만들고**, 치는 칸은 그 위에 얹는다. 글꼴·크기·줄높이가
          같으므로 둘의 기준선은 글꼴 지표와 무관하게 **정의상 같다** — 이 자리에서 픽셀을 손으로
          맞추지 않는 이유가 그것이다. 못 치는 자리에서는 그 글자가 곧 보이는 숫자다.
        */}
        <View className="flex-1">
          <Text
            testID={props.readOnly === true ? props.testID : undefined}
            aria-hidden={props.readOnly !== true}
            className={`text-right ${digits}`}
            style={TABULAR_NUMS}
          >
            {approximateMark}
            {shown.toLocaleString()}
          </Text>
          {props.readOnly !== true && (
            <SheetTextInput
              testID={props.testID}
              aria-label="금액"
              // 0 일 때 비우는 이유: 「0」 을 값으로 두면 그 뒤에 친 숫자가 붙어 자릿수가 하나 는다.
              value={empty ? '' : shown.toLocaleString()}
              onChangeText={(text) => props.onChangeValue(parseMesoText(props.value, text))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="number-pad"
              placeholder="0"
              className={`text-right ${digits}`}
              style={[
                TABULAR_NUMS,
                { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
                // **그리지 않는다** — 입력과 커서만 맡는다([[ADR-178]] 정정 4).
                { color: 'transparent' },
              ]}
            />
          )}
        </View>

        {/*
          단위 상자 — 줄높이는 숫자와 같고, 그 줄의 **글자 크기도 숫자와 같다**.

          앞의 폭 0 짜리 글자(`\u200B`)가 숫자와 같은 크기라 이 줄의 ascent·descent 를 그것이
          정한다. 그래서 단위의 기준선이 숫자의 기준선과 **같은 자리**에 선다 — 두 글꼴 크기의
          차이를 픽셀로 적어 맞추지 않는 이유가 그것이다(글꼴이 바뀌면 그 상수가 조용히 어긋난다).
        */}
        <Text
          testID={`${props.testID}-unit`}
          className="shrink-0"
          style={{ lineHeight: FIGURE_LINE_HEIGHT }}
        >
          <Text style={{ fontSize: FIGURE_FONT_SIZE, opacity: 0 }}>{'\u200B'}</Text>
          <Text className="text-xs font-semibold text-text-muted">{props.unit}</Text>
        </Text>
      </View>

      {props.hint !== undefined && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <Text
          testID={`${props.testID}-hint`}
          className={`text-right text-11 ${
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
