/**
 * 시트의 **큰 숫자 한 덩어리**([[ADR-173]] 결정 1·2·9) — 저장 바로 위에 선다.
 *
 * ## 언제나 합계이고 **못 친다** ([[ADR-202]] 결정 1)
 *
 * 부르는 자리가 일곱인데 한때는 그중 둘이 치는 칸이었다. 같은 자리가 어떤 때는 사람이 친 값이고
 * 어떤 때는 앱이 센 값이면, 화면을 보는 사람이 **그 수를 자기가 고칠 수 있는지를 매번 다시
 * 판단해야 한다.** 그래서 금액은 폼의 라벨–값 줄에서만 받고 여기는 그린 것만 보여 준다.
 *
 * ## 숫자가 **한국어 단위로 접혀서** 선다 (결정 9)
 *
 * `850,000,000` 이 아니라 `8억 5천만` 이다. 콤마 세 자리는 억·만으로 세는 금액과 안 맞아 자릿수를
 * 눈으로 다시 세게 만든다. **값은 하나도 안 깎는다** — 이 자리가 곧 저장될 총액이다.
 *
 * 밑에 있던 힌트 한 줄이 그 환산을 하던 자리라 **함께 사라졌다**. 막힌 이유를 말하던 몫은 필수
 * 칸의 빨간 `*` 와 꺼진 저장 버튼이 받는다(사용자 지정 2026-09-02).
 *
 * ## 자기 윗선을 안 긋는다 (결정 9)
 *
 * 위 라벨–값 줄의 밑줄이 경계를 **겸한다**. 여기서 또 그으면 선이 두 줄로 보인다(사용자 지적).
 */
import { View, type TextStyle } from 'react-native'

import { Text } from '../../atoms'
import { formatMesoUnits } from '../../../lib/drop-price'
import { TABULAR_NUMS } from '../../../lib/text-styles'

export interface AmountFigureProps {
  value: number
  /** 숫자 옆에 붙는 단위 — 메소 · 메포 · 원. */
  unit: string
  /** 숫자와 덩어리를 집는 이름의 뿌리 — 덩어리는 `${testID}-figure`, 단위는 `${testID}-unit` 이다. */
  testID: string
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
 * 큰 숫자의 **글자 크기와 줄 상자**([[ADR-178]] 정정 2·3 · [[ADR-202]] 결정 10).
 *
 * `text-2xl`(24px)과 그 줄 높이(31px)를 손으로 적어 둔 것이다. 클래스 문자열에는 보간을 못 하므로
 * (NativeWind 가 빌드 때 읽는다) 같은 수를 두 곳에 적고 그 일치를 테스트가 지킨다.
 *
 * 줄 높이가 글자보다 커야 한다 — 같으면 아톰이 지워 둔 글꼴 여백 탓에 ascent 가 잘린다
 * ([[ADR-170]] 정정 13). 계단표([[ADR-196]])의 31px 이 그 자리를 이미 준다.
 */
const FIGURE_FONT_SIZE = 24
const FIGURE_LINE_HEIGHT = 31

/**
 * 단위 글자(`조`·`억`·`만`·`천`)는 숫자보다 **한 단계 작다**([[ADR-202]] 결정 10).
 *
 * **줄 높이는 안 준다.** 인라인 크기만 얹어야 숫자가 잡은 줄 상자를 흔들지 않는다 — 안드로이드는
 * 안긴 `Text` 의 줄 높이도 줄 상자 계산에 넣는다.
 */
const FIGURE_UNIT_FONT_SIZE = 20

/**
 * 단위가 숫자 바로 뒤에 올 때만 **살짝** 띄운다(사용자 지정 2026-09-02).
 *
 * `5천만` 처럼 단위끼리 붙은 자리는 한 낱말이라 안 띄운다 — 벌리면 `5천 만` 으로 읽힌다.
 *
 * 띄우는 것은 **폭만 있는 `View`** 다. 나머지 셋은 실측으로 떨어졌다(2026-09-02 · 안드로이드).
 *
 * - `marginLeft`: 안긴 `Text` 에 **안 먹는다**. 14 를 줘도 화면이 그대로였다.
 * - `letterSpacing`: 먹지만 안드로이드가 글자 **양옆에** 균등하게 넣어 `850 0 만` 이 됐다.
 * - 공백 글자: 먹지만 **읽어 주는 글에 섞인다**. `8억 5천만` 이 `8 억 5 천만` 이 되어 화면을
 *   집는 모든 자리가 그 공백을 알아야 한다.
 *
 * 인라인 `View` 는 폭만 차지하고 글자에는 안 섞인다.
 */
const FIGURE_UNIT_GAP = 2

const UNIT_STYLE = { fontSize: FIGURE_UNIT_FONT_SIZE }
const GAP_STYLE = { width: FIGURE_UNIT_GAP }

/** 숫자와 단위를 가르는 자리 — 잡는 괄호라 `split` 이 단위 글자도 함께 돌려준다. */
const AMOUNT_UNIT = /([조억만천])/

/**
 * 접힌 금액을 그릴 토막으로 가른다(결정 10) — 단위 글자만 한 단계 작게 그린다.
 *
 * 단위가 숫자 뒤에 올 때 그 사이에 **빈 토막**(`text === ''`)을 끼운다. 그리는 쪽이 그것을
 * 폭만 있는 `View` 로 낸다.
 */
function amountPieces(text: string): { text: string; style?: TextStyle }[] {
  const parts = text.split(AMOUNT_UNIT).filter((part) => part !== '')
  const pieces: { text: string; style?: TextStyle }[] = []
  parts.forEach((part, index) => {
    if (AMOUNT_UNIT.test(part)) {
      pieces.push({ text: part, style: UNIT_STYLE })
      return
    }
    // 뒤가 단위가 아니면 틈을 만들 이유가 없다(만 미만 나머지가 그렇다).
    if (index + 1 >= parts.length || !AMOUNT_UNIT.test(parts[index + 1])) {
      pieces.push({ text: part })
      return
    }
    pieces.push({ text: part })
    pieces.push({ text: '', style: GAP_STYLE })
  })
  return pieces
}

export function AmountFigure(props: AmountFigureProps): React.JSX.Element {
  /** 어림 표식 — 0 에는 안 붙는다(어림할 것이 없다). */
  const approximateMark = props.approximate === true && props.value !== 0 ? '≈ ' : ''
  /**
   * 큰 숫자의 **줄 상자를 못 박는다**([[ADR-178]] 결정 1 · 정정 2).
   *
   * 줄높이가 글자 크기와 같으면(`leading-none`) 아톰이 두 플랫폼을 맞추려고 패딩과 글꼴 여백을
   * 지워 둔 터라([[ADR-170]] 정정 13) 그 상자에 ascent 가 안 들어가 **글자 위가 잘린다**.
   * `text-2xl` 은 계단표에서 31px 을 함께 들고 오므로 그 자리가 이미 있다([[ADR-196]]).
   */
  // NativeWind 는 클래스 문자열을 **빌드 때** 읽으므로 여기에 상수를 보간하면 안 된다 —
  // 위 상수와 **같은 수**를 손으로 적고 `AmountFigure.test` 가 그 일치를 붙든다.
  const digits = `text-right text-2xl font-bold tracking-[-.03em] ${
    props.value === 0 ? 'text-text-disabled' : 'text-text'
  }`

  return (
    <View testID={`${props.testID}-figure`}>
      {/*
        **기준선에 기대지 않는다**([[ADR-178]] 정정 3).

        `items-baseline` 은 못 믿는다 — Yoga 가 노드마다 기준선을 어떻게 잡는지가 갈리고,
        실기에서 단위가 숫자 기준선 **위로 떠** 보였다(사용자 화면 2026-08-29, 두 번). 그래서
        **정렬을 위에서 맞추고**(`items-start`) 두 상자에 **같은 줄높이**를 준다. 같은 줄높이에
        **같은 크기의 글자**가 들어 있으면 기준선은 정의상 같은 자리다 — 단위 상자에 폭 0 짜리
        큰 글자를 심어 그 조건을 만든다(아래 `unit` 줄).
      */}
      <View className="flex-row items-start gap-1.5">
        <View className="flex-1">
          <Text testID={props.testID} className={digits} style={TABULAR_NUMS}>
            {approximateMark}
            {/* 단위 글자만 한 단계 작게 얹는다 — `8억 5천만` 에서 숫자가 먼저 읽힌다(결정 10). */}
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
    </View>
  )
}
