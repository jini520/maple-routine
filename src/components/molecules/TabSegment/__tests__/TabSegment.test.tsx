/**
 * 화면 위쪽에서 **목록 전체를 가르는** 탭 알약.
 *
 * 폼 안의 `Segment` 와 하는 일이 같고 크기와 색이 다르다. 부품이 둘인 이유는 지금 생김새가
 * 갈려 있어서이고, 색이 굳으면 합칠지 다시 본다.
 *
 * **미끄러지는 상자 자체는 여기서 안 본다.** 값은 `hooks/useSlidingThumb` 가 들고 그쪽
 * 테스트가 붙든다.
 */
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { __resetNativePortsForTest, setHapticsPort } from '../../../../native/ports'
import { TabSegment } from '../TabSegment'

const 주기 = ['weekly', 'monthly'] as const
const 주기라벨: Record<(typeof 주기)[number], string> = { weekly: '주간', monthly: '월간' }

describe('고르기', () => {
  it('고른 것 하나만 선택으로 읽힌다', async () => {
    const view = await renderAtom(
      <TabSegment options={주기} selected="weekly" onSelect={jest.fn()} labelOf={(v) => 주기라벨[v]} />,
    )

    expect(view.getByLabelText('주간').props.accessibilityState?.selected).toBe(true)
    expect(view.getByLabelText('월간').props.accessibilityState?.selected).toBe(false)
  })

  // 화면이 받는 것은 라벨이 아니라 **값**이다. 라벨을 돌려주면 호출부마다 되짚는 함수가 생긴다.
  it('누르면 라벨이 아니라 값을 준다', async () => {
    const onSelect = jest.fn()
    const view = await renderAtom(
      <TabSegment options={주기} selected="weekly" onSelect={onSelect} labelOf={(v) => 주기라벨[v]} />,
    )

    fireEvent.press(view.getByLabelText('월간'))

    expect(onSelect).toHaveBeenCalledWith('monthly')
  })

  // `Segment` 와 같은 계약이다. 같은 것을 다시 고르는 일은 아무 일도 아니어야 한다.
  it('고른 것을 다시 눌러도 안 부른다', async () => {
    const onSelect = jest.fn()
    const view = await renderAtom(
      <TabSegment options={주기} selected="weekly" onSelect={onSelect} labelOf={(v) => 주기라벨[v]} />,
    )

    fireEvent.press(view.getByLabelText('주간'))

    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('라벨', () => {
  // 테마 고르개는 상태가 곧 보이는 글자라 이 프롭을 안 준다.
  it('`labelOf` 를 안 주면 값을 그대로 적는다', async () => {
    const view = await renderAtom(
      <TabSegment options={['전체', '라이트', '다크']} selected="전체" onSelect={jest.fn()} />,
    )

    expect(view.getByText('라이트')).toBeTruthy()
  })

  // 스크린리더가 듣는 이름도 눈으로 보는 글자와 같아야 한다. 값을 읽으면 `weekly` 가 들린다.
  it('접근성 이름도 라벨이다', async () => {
    const view = await renderAtom(
      <TabSegment options={주기} selected="weekly" onSelect={jest.fn()} labelOf={(v) => 주기라벨[v]} />,
    )

    expect(view.queryByLabelText('weekly')).toBeNull()
    expect(view.getByLabelText('주간')).toBeTruthy()
  })
})

describe('생김새', () => {
  async function 그리기() {
    return renderAtom(
      <TabSegment options={주기} selected="weekly" onSelect={jest.fn()} labelOf={(v) => 주기라벨[v]} />,
    )
  }

  // 조각이 자기 배경을 들고 있으면 옮겨 갈 것이 없다. 칠하는 것은 미끄러지는 상자 하나다.
  it('칠하는 것은 조각이 아니라 옮겨 다니는 상자다', async () => {
    const view = await 그리기()

    expect(flattenStyle(view.getByLabelText('주간').props.style).backgroundColor).toBeUndefined()
    expect(flattenStyle(view.getByTestId('tab-segment-thumb').props.style).backgroundColor).toBe(
      기본테마.surface,
    )
  })

  // 트랙이 파인 홈이라야 썸이 그 안에서 떠 보인다. 배경과 같은 색이면 상자가 아니라 알약만 뜬다.
  it('트랙은 한 칸 파여 있다', async () => {
    const view = await 그리기()

    expect(flattenStyle(view.getByTestId('tab-segment').props.style).backgroundColor).toBe(
      기본테마.surface2,
    )
  })

  // 상자가 도착하기를 기다리면 누른 조각이 그동안 안 눌린 것처럼 보인다.
  it('글자색은 상자를 안 기다린다', async () => {
    const view = await 그리기()

    expect(flattenStyle(view.getByText('주간').props.style).color).toBe(기본테마.text)
    expect(flattenStyle(view.getByText('월간').props.style).color).toBe(기본테마.textMuted)
  })

  it('상자는 터치를 안 먹는다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('tab-segment-thumb').props.pointerEvents).toBe('none')
  })
})

// 선택이 실제로 바뀔 때만 손끝이 답한다. 이미 고른 칸을 다시 누르는 것은 바뀌는 것이 없다.
describe('TabSegment 의 촉각', () => {
  const select = jest.fn(async () => undefined)

  beforeEach(() => {
    select.mockClear()
    setHapticsPort({ tap: async () => {}, select })
  })

  afterEach(__resetNativePortsForTest)

  it('다른 칸을 누르면 한 번 난다', async () => {
    const { getByLabelText } = await renderAtom(
      <TabSegment options={['주간', '월간']} selected="주간" onSelect={jest.fn()} />,
    )

    fireEvent.press(getByLabelText('월간'))

    expect(select).toHaveBeenCalledTimes(1)
  })

  it('고른 칸을 다시 눌러도 안 난다', async () => {
    const { getByLabelText } = await renderAtom(
      <TabSegment options={['주간', '월간']} selected="주간" onSelect={jest.fn()} />,
    )

    fireEvent.press(getByLabelText('주간'))

    expect(select).not.toHaveBeenCalled()
  })
})
