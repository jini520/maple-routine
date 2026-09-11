/**
 * 값 하나의 **축**을 고르는 붙은 조각.
 *
 * 갈래 칩과 **모양이 달라야** 한다는 것이 이 부품의 존재 이유다. 같은 알약이 세 종류 있어
 * 무엇을 고르는 줄인지 가 안 읽히던 것이 다시 짠 이유였다.
 */
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { __resetNativePortsForTest, setHapticsPort } from '../../../../native/ports'
import { Segment } from '../Segment'

describe('Segment', () => {
  it('고른 것 하나만 선택으로 읽힌다', async () => {
    const { getByLabelText } = await renderAtom(
      <Segment options={['메소', '메포', '캐시']} selected="메포" onSelect={jest.fn()} />,
    )

    expect(getByLabelText('메포').props.accessibilityState?.selected).toBe(true)
    expect(getByLabelText('메소').props.accessibilityState?.selected).toBe(false)
  })

  it('누르면 그 값을 준다', async () => {
    const onSelect = jest.fn()
    const { getByLabelText } = await renderAtom(
      <Segment options={['메소', '메포', '캐시']} selected="메소" onSelect={onSelect} />,
    )

    fireEvent.press(getByLabelText('캐시'))

    expect(onSelect).toHaveBeenCalledWith('캐시')
  })

  // 이미 고른 것을 다시 눌러도 아무 일이 없어야 한다. `DifficultySegment` 와 같은 계약이다.
  it('고른 것을 다시 눌러도 안 부른다', async () => {
    const onSelect = jest.fn()
    const { getByLabelText } = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={onSelect} />,
    )

    fireEvent.press(getByLabelText('메소'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  // 이 부품은 상자가 자리마다 갈린다. 폼 안에서는 글자를 따라 커지고, 높이가 못박힌 today
  // 타일 안에서는 못 커진다. 그래서 무시할지를 호출부가 정한다.
  it('시스템 글자 크기를 기본으로 따른다', async () => {
    const { getByText } = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    expect(getByText('메소').props.allowFontScaling).toBe(true)
  })

  it('`fixed` 를 주면 안 따른다', async () => {
    const { getByText } = await renderAtom(
      <Segment fixed options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    expect(getByText('메소').props.allowFontScaling).toBe(false)
  })

  // **칩이 아니다.** 조각들이 한 상자 안에 붙어 있고, 고른 것만 그 안에서 칠해진다.
  it('한 상자 안에 붙어 있다. 조각마다 테두리를 두르지 않는다', async () => {
    const view = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    expect(flattenStyle(view.getByTestId('segment').props.style).borderWidth).toBe(1)
    expect(flattenStyle(view.getByLabelText('메포').props.style).borderWidth ?? 0).toBe(0)
  })

  // 배경이 조각마다 켜졌다 꺼지는 대신 **상자 하나가 옮겨 간다**. 조각이 자기 배경을 들고
  // 있으면 옮겨 갈 것이 없다.
  it('칠하는 것은 조각이 아니라 옮겨 다니는 상자다', async () => {
    const view = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    expect(flattenStyle(view.getByLabelText('메소').props.style).backgroundColor).toBeUndefined()
    expect(flattenStyle(view.getByTestId('segment-thumb').props.style).backgroundColor).toBe(
      기본테마.primaryTint,
    )
  })

  // 상자가 도착하기를 기다리면 누른 조각이 200ms 동안 안 눌린 것처럼 보인다.
  it('글자색은 상자를 안 기다린다', async () => {
    const view = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    expect(flattenStyle(view.getByText('메소').props.style).color).toBe(기본테마.primaryInk)
    expect(flattenStyle(view.getByText('메포').props.style).color).toBe(기본테마.textMuted)
  })

  // 상자는 그림일 뿐이라 손가락을 먹으면 안 된다. 고른 조각을 다시 누르는 일이 막힌다.
  it('상자는 터치를 안 먹는다', async () => {
    const view = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    expect(view.getByTestId('segment-thumb').props.pointerEvents).toBe('none')
  })
})

// 선택이 실제로 바뀔 때만 손끝이 답한다. 이미 고른 칸을 다시 누르는 것은 바뀌는 것이 없다.
describe('Segment 의 촉각', () => {
  const select = jest.fn(async () => undefined)

  beforeEach(() => {
    select.mockClear()
    setHapticsPort({ tap: async () => {}, select })
  })

  afterEach(__resetNativePortsForTest)

  it('다른 칸을 누르면 한 번 난다', async () => {
    const { getByLabelText } = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    fireEvent.press(getByLabelText('메포'))

    expect(select).toHaveBeenCalledTimes(1)
  })

  it('고른 칸을 다시 눌러도 안 난다', async () => {
    const { getByLabelText } = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    fireEvent.press(getByLabelText('메소'))

    expect(select).not.toHaveBeenCalled()
  })
})
