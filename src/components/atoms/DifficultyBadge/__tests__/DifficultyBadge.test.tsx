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

})

describe('크기 둘 ([[ADR-147]] 정정 40)', () => {
  it('기본은 지금까지와 같다 — 호출부 아홉 곳이 안 바뀐다', async () => {
    const 지정없음 = await renderAtom(<DifficultyBadge difficulty="하드" />)
    const 기본지정 = await renderAtom(<DifficultyBadge difficulty="하드" size="default" />)

    expect(지정없음.toJSON()).toEqual(기본지정.toJSON())
  })

  it('`small` 은 높이와 글자만 줄인다 — **색은 한 값도 안 갈린다**', async () => {
    const 기본 = await renderAtom(<DifficultyBadge difficulty="카오스" />)
    const 작게 = await renderAtom(<DifficultyBadge difficulty="카오스" size="small" />)

    const 상자 = (view: Awaited<ReturnType<typeof renderAtom>>): Record<string, unknown> =>
      flattenStyle(view.getByText('카오스').parent?.props.style) as Record<string, unknown>
    const 글자 = (view: Awaited<ReturnType<typeof renderAtom>>): Record<string, unknown> =>
      flattenStyle(view.getByText('카오스').props.style) as Record<string, unknown>

    expect(Number(상자(작게).height)).toBeLessThan(Number(상자(기본).height))
    expect(Number(글자(작게).fontSize)).toBeLessThan(Number(글자(기본).fontSize))

    // 색·테두리는 같은 값이어야 한다 — 같은 난이도가 화면마다 다른 색이면 같은 값인 줄 모른다.
    expect(글자(작게).color).toBe(글자(기본).color)
    expect(상자(작게).borderColor).toBe(상자(기본).borderColor)
  })
})
