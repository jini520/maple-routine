/**
 * 시트의 큰 숫자 한 덩어리. 저장 바로 위에 서고 **못 친다**.
 *
 * 금액은 `props.value` 로 받은 것만 그린다. 한국어 단위로 접어(`8억 5천만`) 단위 글자만 한 단계
 * 작게 얹고, 오른쪽에 통화를 세운다.
 *
 * @see [[ADR-202]] 결정 1·9·10·11·12 — 못 치는 이유 · 단위 서식 · 크기 · 단위 앞 틈 · 카운트업 제거
 * @see [[ADR-173]] 결정 1·9 — 화면에 하나뿐이고 자기 윗선을 안 긋는다
 */
import { View, type TextStyle } from 'react-native'

import { Text } from '../../atoms'
import { formatMesoUnits } from '../../../lib/drop-price'
import { TABULAR_NUMS } from '../../../lib/text-styles'

export interface AmountFigureProps {
  value: number
  /** 숫자 옆에 서는 통화 — `메소` · `메포` · `원`. */
  unit: string
  /** 이름의 뿌리. 덩어리는 `${testID}-figure`, 통화는 `${testID}-unit` 이다. */
  testID: string
  /** 앞에 `≈` 를 붙인다. 0 에는 안 붙는다([[ADR-175]] 결정 3). */
  approximate?: boolean
}

/**
 * 아래 `text-2xl` 이 주는 24px·31px 을 손으로 옮겨 적은 것.
 *
 * NativeWind 가 클래스 문자열을 **빌드 때** 읽어 보간을 못 한다. 두 수가 갈리면 통화가 숫자와
 * 다른 줄 상자에 서므로 `AmountFigure.test` 가 일치를 붙든다.
 */
const FIGURE_FONT_SIZE = 24
const FIGURE_LINE_HEIGHT = 31

/** 단위 글자 크기. **줄 높이는 안 준다** — 안긴 `Text` 의 줄 높이가 숫자의 줄 상자를 흔든다. */
const FIGURE_UNIT_FONT_SIZE = 20

/** 단위 왼쪽 틈(dp). 폭만 있는 `View` 로 낸다 — 방법 넷의 실측은 [[ADR-202]] 결정 11 에 있다. */
const FIGURE_UNIT_GAP = 2

const UNIT_STYLE = { fontSize: FIGURE_UNIT_FONT_SIZE }
const GAP_STYLE = { width: FIGURE_UNIT_GAP }

/** 잡는 괄호라 `split` 이 단위 글자도 함께 돌려준다. */
const AMOUNT_UNIT = /([조억만천])/

/**
 * 접힌 금액(`8억 5천만`)을 그릴 토막으로 가른다.
 *
 * 단위 글자에는 `UNIT_STYLE` 이 붙고, 숫자 뒤에 오는 단위 앞에는 **빈 토막**(`text === ''`)이
 * 하나 끼워진다. 그리는 쪽이 그것을 폭만 있는 `View` 로 낸다.
 *
 * 단위끼리 붙은 자리(`5천만`)에는 안 끼운다 — 한 낱말이라 벌리면 `5천 만` 으로 읽힌다.
 */
function amountPieces(text: string): { text: string; style?: TextStyle }[] {
  const parts = text.split(AMOUNT_UNIT).filter((part) => part !== '')
  const pieces: { text: string; style?: TextStyle }[] = []
  parts.forEach((part, index) => {
    if (AMOUNT_UNIT.test(part)) {
      pieces.push({ text: part, style: UNIT_STYLE })
      return
    }
    pieces.push({ text: part })
    // 만 미만 나머지는 뒤에 단위가 없다 — 틈을 만들 자리가 아니다.
    if (index + 1 < parts.length && AMOUNT_UNIT.test(parts[index + 1])) {
      pieces.push({ text: '', style: GAP_STYLE })
    }
  })
  return pieces
}

export function AmountFigure(props: AmountFigureProps): React.JSX.Element {
  const approximateMark = props.approximate === true && props.value !== 0 ? '≈ ' : ''
  // `text-2xl` 의 24px·31px 은 위 두 상수와 같은 수여야 한다(보간 불가).
  const digits = `text-right text-2xl font-bold tracking-[-.03em] ${
    props.value === 0 ? 'text-text-disabled' : 'text-text'
  }`

  return (
    <View testID={`${props.testID}-figure`}>
      {/* 기준선이 아니라 **같은 줄 상자**로 맞춘다([[ADR-178]] 정정 3). */}
      <View className="flex-row items-start gap-1.5">
        <View className="flex-1">
          <Text testID={props.testID} className={digits} style={TABULAR_NUMS}>
            {approximateMark}
            {amountPieces(formatMesoUnits(props.value)).map(({ text, style }, index) =>
              style === undefined ? (
                text
              ) : text === '' ? (
                <View key={index} style={GAP_STYLE} />
              ) : (
                <Text key={index} style={style}>
                  {text}
                </Text>
              ),
            )}
          </Text>
        </View>

        {/* 앞의 폭 0 짜리 큰 글자가 이 줄의 ascent·descent 를 정해 숫자와 기준선이 맞는다. */}
        <Text
          testID={`${props.testID}-unit`}
          className="shrink-0"
          style={{ lineHeight: FIGURE_LINE_HEIGHT }}
        >
          <Text style={{ fontSize: FIGURE_FONT_SIZE, opacity: 0 }}>{'\u200B'}</Text>
          <Text className="text-xs font-semibold text-text-muted">{props.unit}</Text>
        </Text>
      </View>
    </View>
  )
}
