/**
 * 값 하나의 **축**을 고르는 붙은 조각.
 *
 * 갈래 칩과 **모양이 달라야** 한다는 것이 이 부품의 존재 이유다 — 같은 알약이 세 종류 있어
 * 무엇을 고르는 줄인지 가 안 읽히던 것이 다시 짠 이유였다.
 */
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
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

  // 이미 고른 것을 다시 눌러도 아무 일이 없어야 한다 — `DifficultySegment` 와 같은 계약이다.
  it('고른 것을 다시 눌러도 안 부른다', async () => {
    const onSelect = jest.fn()
    const { getByLabelText } = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={onSelect} />,
    )

    fireEvent.press(getByLabelText('메소'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  // **칩이 아니다.** 조각들이 한 상자 안에 붙어 있고, 고른 것만 그 안에서 칠해진다.
  it('한 상자 안에 붙어 있다 — 조각마다 테두리를 두르지 않는다', async () => {
    const view = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    expect(flattenStyle(view.getByTestId('segment').props.style).borderWidth).toBe(1)
    expect(flattenStyle(view.getByLabelText('메포').props.style).borderWidth ?? 0).toBe(0)
  })
})
