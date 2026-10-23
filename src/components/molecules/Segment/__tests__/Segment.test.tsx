/**
 * 값 하나의 **축**을 고르는 붙은 조각.
 *
 * 갈래 칩과 **모양이 달라야** 한다는 것이 이 부품의 존재 이유다. 같은 알약이 세 종류 있어
 * 무엇을 고르는 줄인지 가 안 읽히던 것이 다시 짠 이유였다.
 */
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { __resetNativePortsForTest, setHapticsPort } from '../../../../native/ports'
import { resolveControlColors } from '../../../../theme/theme-vars'
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

  // 잠긴 줄. 고를 값이 남은 항목에 없는 자리다(지출의 주문서).
  it('`disabled` 면 조각이 안 눌리고 그렇게 읽힌다', async () => {
    const onSelect = jest.fn()
    const { getByLabelText } = await renderAtom(
      <Segment disabled options={['힘', '민첩']} selected={null} onSelect={onSelect} />,
    )

    fireEvent.press(getByLabelText('힘'))

    expect(onSelect).not.toHaveBeenCalled()
    expect(getByLabelText('힘').props.accessibilityState?.disabled).toBe(true)
  })

  it('`disabled` 면 상자째 흐려진다', async () => {
    const { getByTestId } = await renderAtom(
      <Segment disabled options={['힘', '민첩']} selected={null} onSelect={jest.fn()} />,
    )

    expect(flattenStyle(getByTestId('segment').props.style).opacity).toBeCloseTo(0.4)
  })

  // 배경이 조각마다 켜졌다 꺼지는 대신 **상자 하나가 옮겨 간다**. 조각이 자기 배경을 들고
  // 있으면 옮겨 갈 것이 없다.
  it('칠하는 것은 조각이 아니라 옮겨 다니는 상자다', async () => {
    const view = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    expect(flattenStyle(view.getByLabelText('메소').props.style).backgroundColor).toBeUndefined()
    expect(flattenStyle(view.getByTestId('segment-thumb-fill').props.style).backgroundColor).toBe(
      resolveControlColors(기본테마).thumb,
    )
  })

  // 상자가 도착하기를 기다리면 누른 조각이 200ms 동안 안 눌린 것처럼 보인다.
  it('글자색은 상자를 안 기다린다', async () => {
    const view = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    expect(flattenStyle(view.getByText('메소').props.style).color).toBe(기본테마.text)
    expect(flattenStyle(view.getByText('메포').props.style).color).toBe(resolveControlColors(기본테마).inkOff)
  })

  // 상자는 그림일 뿐이라 손가락을 먹으면 안 된다. 고른 조각을 다시 누르는 일이 막힌다.
  it('상자는 터치를 안 먹는다', async () => {
    const view = await renderAtom(
      <Segment options={['메소', '메포']} selected="메소" onSelect={jest.fn()} />,
    )

    expect(view.getByTestId('segment-thumb').props.pointerEvents).toBe('none')
  })
})

describe('Segment 의 라벨', () => {
  const 주기 = ['weekly', 'monthly'] as const
  const 주기라벨: Record<(typeof 주기)[number], string> = { weekly: '주간', monthly: '월간' }

  // 화면이 받는 것은 라벨이 아니라 **값**이다. 라벨을 돌려주면 호출부마다 되짚는 함수가 생긴다.
  it('누르면 라벨이 아니라 값을 준다', async () => {
    const onSelect = jest.fn()
    const view = await renderAtom(
      <Segment options={주기} selected="weekly" onSelect={onSelect} labelOf={(v) => 주기라벨[v]} />,
    )

    fireEvent.press(view.getByLabelText('월간'))

    expect(onSelect).toHaveBeenCalledWith('monthly')
  })

  // 스크린리더가 듣는 이름도 눈으로 보는 글자와 같아야 한다. 값을 읽으면 `weekly` 가 들린다.
  it('접근성 이름도 라벨이다', async () => {
    const view = await renderAtom(
      <Segment options={주기} selected="weekly" onSelect={jest.fn()} labelOf={(v) => 주기라벨[v]} />,
    )

    expect(view.queryByLabelText('weekly')).toBeNull()
    expect(view.getByText('주간')).toBeTruthy()
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
