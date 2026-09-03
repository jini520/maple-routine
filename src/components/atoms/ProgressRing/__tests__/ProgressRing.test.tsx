// 링을 채우는 셈이 네 자리에서 두 벌로 베껴져 있던 것을 여기로 모았다.
import { processColor } from 'react-native'

import { flattenStyle, renderAtom, type AtomElement } from '../../../__tests__/render-atom'
import { ProgressRing } from '../ProgressRing'

const 색 = { track: '#111111', fill: '#eeeeee' }
/** `react-native-svg` 가 색 문자열을 미리 파싱해 `{ type, payload }` 로 바꾼다. */
const strokeOf = (node: AtomElement): unknown => (node.props.stroke as { payload: unknown }).payload

describe('ProgressRing · 연속', () => {
  it('반지름이 stroke 를 뺀 지름의 절반이다', async () => {
    const { getByTestId } = await renderAtom(
      <ProgressRing size={56} stroke={4} direction="cw" {...색} progress={{ kind: 'continuous', ratio: 0.5 }} />,
    )

    // 26 = (56 − 4) / 2. stroke 는 경로의 **가운데**에 그려지므로 이만큼 안으로 들어와야 상자를 안 넘는다.
    expect(Number(getByTestId('progress-ring-track').props.r)).toBe(26)
  })

  it('찬 만큼만 dash 로 그리고 나머지는 비운다', async () => {
    const { getByTestId } = await renderAtom(
      <ProgressRing size={56} stroke={4} direction="cw" {...색} progress={{ kind: 'continuous', ratio: 0.25 }} />,
    )

    // `react-native-svg` 가 dash 문자열을 **문자열 배열**로 파싱해 들고 있다.
    const 둘레 = 2 * Math.PI * 26
    expect(getByTestId('progress-ring-fill').props.strokeDasharray).toEqual([
      String(둘레 * 0.25),
      String(둘레 * 0.75),
    ])
  })

  // `strokeLinecap="round"` 가 길이 0 인 호에 점 하나를 찍어 **아직 아무것도 안 했다** 가
  // **조금 했다** 로 보인다.
  it('0 이면 채운 호를 아예 안 그린다', async () => {
    const { getByTestId, queryByTestId } = await renderAtom(
      <ProgressRing size={56} stroke={4} direction="cw" {...색} progress={{ kind: 'continuous', ratio: 0 }} />,
    )

    expect(getByTestId('progress-ring-track')).toBeTruthy()
    expect(queryByTestId('progress-ring-fill')).toBeNull()
  })

  it('넘겨받은 색을 그대로 쓴다. 테마를 안 읽는다', async () => {
    const { getByTestId } = await renderAtom(
      <ProgressRing size={56} stroke={4} direction="cw" {...색} progress={{ kind: 'continuous', ratio: 1 }} />,
    )

    expect(strokeOf(getByTestId('progress-ring-track'))).toBe(processColor(색.track))
    expect(strokeOf(getByTestId('progress-ring-fill'))).toBe(processColor(색.fill))
  })

  // SVG 의 `fill` 기본값은 **검정**이다. 이 속성이 빠지면 링 안이 통째로 칠해진다. 이 부품에서
  // `fill` 프롭은 **찬 자리의 색** 이라 이름이 겹치므로 실제로 덮인 적이 있다.
  it.each(['progress-ring-track', 'progress-ring-fill'])('%s 은 속을 안 채운다', async (testID) => {
    const { getByTestId } = await renderAtom(
      <ProgressRing size={56} stroke={4} direction="cw" {...색} progress={{ kind: 'continuous', ratio: 0.5 }} />,
    )

    // `react-native-svg` 가 `none` 을 **`null`** 로 파싱한다. 색이 들어왔다면 `{type, payload}` 다.
    expect(getByTestId(testID).props.fill).toBeNull()
  })
})

describe('ProgressRing · 쪼갠 것', () => {
  it('칸 수만큼 그리고 찬 칸까지만 채움색이다', async () => {
    const { getAllByTestId } = await renderAtom(
      <ProgressRing
        size={40}
        stroke={2.5}
        direction="ccw"
        {...색}
        progress={{ kind: 'segments', cleared: 2, total: 4, gap: 2.4 }}
      />,
    )

    expect(getAllByTestId('progress-ring-segment').map(strokeOf)).toEqual([
      processColor(색.fill),
      processColor(색.fill),
      processColor(색.track),
      processColor(색.track),
    ])
  })

  // `round` 캡이 칸 양끝을 stroke 의 절반씩 더 그린다. 그만큼 dash 를 미리
  // 줄여야 보이는 칸 길이와 간격이 butt 일 때와 같다. 안 빼면 간격이 2.4 에서 0.4 로 뭉개진다.
  it('round 캡이 더 그리는 만큼 dash 를 미리 줄인다', async () => {
    const { getAllByTestId } = await renderAtom(
      <ProgressRing
        size={40}
        stroke={2.5}
        direction="ccw"
        {...색}
        progress={{ kind: 'segments', cleared: 0, total: 12, gap: 2.4 }}
      />,
    )

    const 둘레 = 2 * Math.PI * ((40 - 2.5) / 2)
    const 칸 = 둘레 / 12
    const dash = 칸 - 2.4 - 2.5
    const [첫칸] = getAllByTestId('progress-ring-segment')
    expect(첫칸.props.strokeDasharray).toEqual([String(dash), String(둘레 - dash)])
  })

  // 캡이 시작점 뒤로 stroke 의 절반만큼 튀어나오므로 그만큼 밀어야 칸이 제자리에 앉는다.
  it('칸을 캡이 튀어나온 만큼 밀어 앉힌다', async () => {
    const { getAllByTestId } = await renderAtom(
      <ProgressRing
        size={40}
        stroke={2.5}
        direction="ccw"
        {...색}
        progress={{ kind: 'segments', cleared: 0, total: 4, gap: 2.4 }}
      />,
    )

    const 칸 = (2 * Math.PI * ((40 - 2.5) / 2)) / 4
    const offsets = getAllByTestId('progress-ring-segment').map((n) => n.props.strokeDashoffset)
    expect(offsets).toEqual([0, 1, 2, 3].map((i) => -(i * 칸 + 2.5 / 2)))
  })

  // 나눌 상대가 없는 링에서 간격은 나눔이 아니라 결손으로 읽힌다. 값을 0 으로
  // 두는 대신 속성을 통째로 빼는 것은 dash 양끝의 둥근 캡이 정확히 겹쳐 이음매가 비치기 때문이다.
  it('칸도 속을 안 채운다', async () => {
    const { getAllByTestId } = await renderAtom(
      <ProgressRing
        size={40}
        stroke={2.5}
        direction="ccw"
        {...색}
        progress={{ kind: 'segments', cleared: 1, total: 3, gap: 2.4 }}
      />,
    )

    for (const 칸 of getAllByTestId('progress-ring-segment')) {
      expect(칸.props.fill).toBeNull()
    }
  })

  it('칸이 하나면 dash 를 아예 안 건다', async () => {
    const { getAllByTestId } = await renderAtom(
      <ProgressRing
        size={40}
        stroke={2.5}
        direction="ccw"
        {...색}
        progress={{ kind: 'segments', cleared: 1, total: 1, gap: 2.4 }}
      />,
    )

    const [원] = getAllByTestId('progress-ring-segment')
    expect(원.props.strokeDasharray).toBeUndefined()
    expect(원.props.strokeDashoffset).toBeUndefined()
  })
})

describe('ProgressRing · 방향', () => {
  // SVG 원의 경로는 3시에서 시작해 시계방향으로 돈다. 두 갈래 다 12시에서 시작해야 한다.
  it.each([
    ['cw', [{ rotate: '270deg' }]],
    ['ccw', [{ rotate: '90deg' }, { scaleX: -1 }]],
  ] as const)('%s 는 12시에서 시작한다', async (direction, transform) => {
    const { getByTestId } = await renderAtom(
      <ProgressRing
        testID="링"
        size={40}
        stroke={4}
        direction={direction}
        {...색}
        progress={{ kind: 'continuous', ratio: 0.5 }}
      />,
    )

    expect(flattenStyle(getByTestId('링').props.style).transform).toEqual(transform)
  })
})
