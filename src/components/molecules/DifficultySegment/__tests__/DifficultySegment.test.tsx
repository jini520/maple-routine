// 난이도 세그먼트. 형태가 갈리는 것 하나. `aria-pressed` 단언이 **`aria-selected`** 가 됐다
// (RN 의 접근성 상태에는 *pressed* 가 없다, 컴포넌트 주석 ①).
import { fireEvent } from '@testing-library/react-native'

import { findAllOfType, flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { DifficultySegment } from '../DifficultySegment'

describe('DifficultySegment', () => {
  it('난이도를 받은 순서대로 버튼으로 그린다', async () => {
    const rendered = await renderAtom(
      <DifficultySegment difficulties={['노멀', '하드', '익스트림']} selected="하드" onSelect={jest.fn()} />,
    )

    expect(rendered.getAllByRole('button')).toHaveLength(3)
    expect(findAllOfType(rendered.toJSON(), 'Text').map((node) => node.children?.[0])).toEqual([
      '노멀',
      '하드',
      '익스트림',
    ])
  })

  it('선택된 난이도만 선택 상태로 알린다', async () => {
    const { getAllByRole } = await renderAtom(
      <DifficultySegment difficulties={['노멀', '하드']} selected="하드" onSelect={jest.fn()} />,
    )

// RN 이 `aria-selected` 를 `accessibilityState.selected` 로 정규화한다(실측).
    // `aria-pressed` 가 담던 사실이 그대로 여기 들어온다.
    const [normal, hard] = getAllByRole('button')
    expect(normal.props.accessibilityState.selected).toBe(false)
    expect(hard.props.accessibilityState.selected).toBe(true)
  })

  // : 미선택도 풀컬러 뱃지 그대로 두고 흐림만 건다. 색이 안 죽는다.
  // 고스트 칩(색 없는 아웃라인)으로 대체했던 2026-07-24 결정을 되돌린 것이다.
  it('미선택 난이도는 같은 뱃지에 opacity-40 만 걸어 그린다', async () => {
    const { getAllByRole } = await renderAtom(
      <DifficultySegment difficulties={['노멀', '하드']} selected="하드" onSelect={jest.fn()} />,
    )

    // `toBeCloseTo` 인 이유는 값이 float32 를 거쳐 0.4000000059604645 로 돌아오기 때문이다(실측).
    const [normal, hard] = getAllByRole('button')
    expect(flattenStyle(normal.props.style).opacity as number).toBeCloseTo(0.4, 5)
    expect(flattenStyle(hard.props.style).opacity).toBeUndefined()
  })

  // 흐림은 **버튼**에 걸린다. 뱃지 자체는 게임 UI 고정 색을 그대로 그린다. 뱃지에 걸면 그라디언트가
  // 아니라 뱃지 안 글자까지 함께 죽어 "무슨 난이도인지" 실루엣이 흐려진다.
  it('미선택 뱃지도 선택 뱃지와 같은 그라디언트를 갖는다 (색을 잃지 않는다)', async () => {
    const selected = await renderAtom(
      <DifficultySegment difficulties={['카오스']} selected="카오스" onSelect={jest.fn()} />,
    )
    const unselected = await renderAtom(
      <DifficultySegment difficulties={['카오스']} selected={null} onSelect={jest.fn()} />,
    )

    const colorsOf = (rendered: typeof selected): unknown =>
      rendered.getByText('카오스').parent?.props.colors

    expect(colorsOf(unselected)).toEqual(colorsOf(selected))
    expect(colorsOf(selected)).toBeDefined()
  })

  it('탭하면 그 난이도로 onSelect 를 부른다', async () => {
    const onSelect = jest.fn()
    const { getByText } = await renderAtom(
      <DifficultySegment difficulties={['노멀', '하드']} selected="노멀" onSelect={onSelect} />,
    )

    await fireEvent.press(getByText('하드'))

    expect(onSelect).toHaveBeenCalledWith('하드')
  })

  it('이미 선택된 난이도를 다시 눌러도 onSelect 를 부르지 않는다', async () => {
    const onSelect = jest.fn()
    const { getByText } = await renderAtom(
      <DifficultySegment difficulties={['노멀', '하드']} selected="하드" onSelect={onSelect} />,
    )

    await fireEvent.press(getByText('하드'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('disabled 면 버튼을 눌러도 onSelect 를 부르지 않는다', async () => {
    const onSelect = jest.fn()
    const { getByText } = await renderAtom(
      <DifficultySegment difficulties={['노멀', '하드']} selected="노멀" onSelect={onSelect} disabled />,
    )

    await fireEvent.press(getByText('하드'))

    expect(onSelect).not.toHaveBeenCalled()
  })

})
