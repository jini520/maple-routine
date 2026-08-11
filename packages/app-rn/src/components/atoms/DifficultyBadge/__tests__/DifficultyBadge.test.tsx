// 난이도 색은 테마 토큰이 아니라 **게임 안의 색**이라 파일에 그대로 박혀 있다. 그래서 여기서는
// 웹 원본과 같은 값이 실제로 그려지는지를 본다 — 특히 CSS 축약(`background: linear-gradient` ·
// `border` · `textShadow`)이 RN 프롭으로 갈라지며 빠뜨리기 쉬운 자리들이다.
import { processColor } from 'react-native'

import { type AtomElement, flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { DifficultyBadge } from '../DifficultyBadge'

/** 그라디언트 상자는 글자의 부모다 — 웹에서 둘이 한 `<span>` 이던 자리(컴포넌트 주석 참고). */
function boxOf(label: AtomElement): AtomElement {
  const parent = label.parent
  if (parent === null) throw new Error('그라디언트 상자를 찾지 못했습니다')
  return parent
}

describe('DifficultyBadge', () => {
  it('난이도 문자열을 그대로 뱃지 텍스트로 렌더링한다', async () => {
    const { getByText } = await renderAtom(<DifficultyBadge difficulty="카오스" />)

    expect(getByText('카오스')).toBeTruthy()
  })

  it('난이도마다 서로 다른 세로 그라디언트를 깐다 (웹 `linear-gradient(180deg, …)`)', async () => {
    const { getByText } = await renderAtom(<DifficultyBadge difficulty="익스트림" />)

    const box = boxOf(getByText('익스트림'))
    // `expo-linear-gradient` 는 색을 네이티브 정수로 바꿔 넘긴다 — 기대값도 같은 변환을 거친다.
    expect(box.props.colors).toEqual(['#3c3c3c', '#1c1414'].map(processColor))
    // 방향을 기본값에 기대지 않는다 — 뒤집히면 그림이 조용히 달라진다(웹의 `180deg` = 위→아래).
    expect(box.props.startPoint).toEqual([0.5, 0])
    expect(box.props.endPoint).toEqual([0.5, 1])
  })

  it('익스트림만 테두리가 1.5px 다 — 축약 `border` 를 프롭으로 가르며 잃기 쉬운 값', async () => {
    const extreme = await renderAtom(<DifficultyBadge difficulty="익스트림" />)
    expect(flattenStyle(boxOf(extreme.getByText('익스트림')).props.style)).toMatchObject({
      borderWidth: 1.5,
      borderColor: '#ef5d78',
    })

    const chaos = await renderAtom(<DifficultyBadge difficulty="카오스" />)
    expect(flattenStyle(boxOf(chaos.getByText('카오스')).props.style)).toMatchObject({
      borderWidth: 1,
      borderColor: '#caa87f',
    })
  })

  it('글자 그림자는 있는 난이도에만 있다 (웹 `textShadow` 세 곳)', async () => {
    const easy = await renderAtom(<DifficultyBadge difficulty="이지" />)
    expect(flattenStyle(easy.getByText('이지').props.style)).toMatchObject({
      color: '#f5f6f7',
      textShadowColor: 'rgba(0,0,0,0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    })

    const chaos = await renderAtom(<DifficultyBadge difficulty="카오스" />)
    expect(flattenStyle(chaos.getByText('카오스').props.style).textShadowColor).toBeUndefined()
  })

  it('캡슐 규격 — 높이 20 · 좌우 여백 10 · pill', async () => {
    const { getByText } = await renderAtom(<DifficultyBadge difficulty="노멀" />)

    expect(flattenStyle(boxOf(getByText('노멀')).props.style)).toMatchObject({
      height: 20,
      paddingLeft: 10,
      paddingRight: 10,
      borderRadius: 9999,
    })
  })

  it('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', async () => {
    expect((await renderAtom(<DifficultyBadge difficulty="하드" />)).toJSON()).toMatchSnapshot()
  })
})
