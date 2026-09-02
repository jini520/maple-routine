/**
 * 시트의 큰 숫자 한 덩어리. 저장 바로 위에 서고 **못 친다**.
 *
 * 금액은 `props.value` 로 받은 것만 그린다. 한국어 단위로 접어(`8억 5천만`) 단위 글자만 한 단계
 * 작게 얹고, 오른쪽에 통화를 세운다.
 *
 * @see — 못 치는 이유 · 단위 서식 · 크기 · 앞 틈 · 카운트업 제거
 * @see — 화면에 하나뿐이고 자기 윗선을 안 긋는다
 */
import { View } from 'react-native'

import { Text } from '../../atoms'
import { formatMesoUnits } from '../../../lib/drop/drop-price'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'

export interface AmountFigureProps {
  value: number
  /** 숫자 옆에 서는 통화 — `메소` · `메포` · `원`. */
  unit: string
  /** 이름의 뿌리. 덩어리는 `${testID}-figure`, 통화는 `${testID}-unit` 이다. */
  testID: string
  /** 앞에 `≈` 를 붙인다. 0 에는 안 붙는다. */
  approximate?: boolean
}

const OPAQUE_ZERO = { opacity: 0 }

/** 단위 왼쪽 틈(dp). 폭만 있는 `View` 로 낸다. 방법 넷의 실측은 에 있다. */
const FIGURE_UNIT_GAP = 2

const GAP_STYLE = { width: FIGURE_UNIT_GAP }

/** 잡는 괄호라 `split` 이 단위 글자도 함께 돌려준다. */
const AMOUNT_UNIT = /([조억만천])/

/**
 * 접힌 금액(`8억 5천만`)을 그릴 토막으로 가른다.
 *
 * 단위 글자에는 `UNIT_STYLE` 이 붙고, 숫자 뒤에 오는 단위 앞에는 **빈 토막**(`text === ''`)이
 * 하나 끼워진다. 그리는 쪽이 그것을 폭만 있는 `View` 로 낸다.
 *
 * 단위끼리 붙은 자리(`5천만`)에는 안 끼운다. 한 낱말이라 벌리면 `5천 만` 으로 읽힌다.
 */
type Piece = { text: string; kind: 'digits' | 'unit' | 'gap' }

function amountPieces(text: string): Piece[] {
  const parts = text.split(AMOUNT_UNIT).filter((part) => part !== '')
  const pieces: Piece[] = []
  parts.forEach((part, index) => {
    if (AMOUNT_UNIT.test(part)) {
      pieces.push({ text: part, kind: 'unit' })
      return
    }
    pieces.push({ text: part, kind: 'digits' })
    // 만 미만 나머지는 뒤에 단위가 없다. 틈을 만들 자리가 아니다.
    if (index + 1 < parts.length && AMOUNT_UNIT.test(parts[index + 1])) {
      pieces.push({ text: '', kind: 'gap' })
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
      {/* 기준선이 아니라 **같은 줄 상자**로 맞춘다. */}
      <View className="flex-row items-start gap-1.5">
        <View className="flex-1">
          <Text testID={props.testID} className={digits} style={TABULAR_NUMS}>
            {approximateMark}
            {amountPieces(formatMesoUnits(props.value)).map(({ text, kind }, index) =>
              kind === 'digits' ? (
                text
              ) : kind === 'gap' ? (
                <View key={index} style={GAP_STYLE} />
              ) : (
                <Text key={index} className="text-xl">
                  {text}
                </Text>
              ),
            )}
          </Text>
        </View>

        {/* 앞의 폭 0 짜리 큰 글자가 이 줄의 ascent·descent 를 정해 숫자와 기준선이 맞는다. */}
        <Text testID={`${props.testID}-unit`} className="shrink-0 text-2xl">
          <Text className="text-2xl" style={OPAQUE_ZERO}>{'\u200B'}</Text>
          <Text className="text-xs font-semibold text-text-muted">{props.unit}</Text>
        </Text>
      </View>
    </View>
  )
}
