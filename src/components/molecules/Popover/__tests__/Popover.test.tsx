/** 팝오버 층과 앵커 팝오버. 닫기 층이 화면 전체를 덮고, 상자는 앵커 위아래를 재서 선다. */
import { fireEvent } from '@testing-library/react-native'
import { Dimensions, Text } from 'react-native'

import { findAllOfType, flattenStyle, renderOverlay } from '../../../__tests__/render-atom'
import { AnchoredPopover, PopoverLayer } from '../Popover'

const ANCHOR = { left: 100, top: 100, width: 120, height: 28 }
const BOX = 'test-popover'

describe('PopoverLayer', () => {
  // 닫기 층을 팝오버를 연 컴포넌트 안에 깔면 그 컴포넌트 영역만 덮는다. 바깥을 눌러도 안 닫혔다(#617).
  it('닫기 층과 내용이 같은 Modal 안에 있고 닫기 층이 화면을 채운다', async () => {
    const onClose = jest.fn()
    const view = await renderOverlay(
      <PopoverLayer closeLabel="설명 닫기" onClose={onClose}>
        <Text>내용</Text>
      </PopoverLayer>,
    )

    const [modal] = findAllOfType(view.toJSON(), 'Modal')
    expect(modal.props.transparent).toBe(true)
    expect(JSON.stringify(modal)).toContain('설명 닫기')
    expect(JSON.stringify(modal)).toContain('내용')

    const close = view.getByLabelText('설명 닫기')
    expect(flattenStyle(close.props.style).flexGrow).toBe(1)
    await fireEvent.press(close)
    expect(onClose).toHaveBeenCalled()
    expect(view.getByText('내용')).toBeTruthy()
  })
})

describe('AnchoredPopover', () => {
  const H = Dimensions.get('window').height

  async function 그리기(props: { anchor?: typeof ANCHOR | null; width?: number } = {}) {
    const onClose = jest.fn()
    const view = await renderOverlay(
      <AnchoredPopover
        testID={BOX}
        ariaLabel="설명"
        closeLabel="설명 닫기"
        anchor={props.anchor === undefined ? ANCHOR : props.anchor}
        width={props.width}
        onClose={onClose}
        className="p-3"
      >
        <Text>내용</Text>
      </AnchoredPopover>,
    )
    return { view, onClose }
  }

  async function 재기(view: Awaited<ReturnType<typeof 그리기>>['view'], width: number, height: number) {
    await fireEvent(view.getByTestId(BOX), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } })
  }

  it('앵커와 상자를 재기 전에는 안 보인다', async () => {
    const { view } = await 그리기({ anchor: null })
    await 재기(view, 248, 120)

    expect(flattenStyle(view.getByTestId(BOX).props.style).opacity).toBe(0)
  })

  it('아래에 들어가면 앵커 아래로 열고 꼬리가 위에 선다', async () => {
    const { view } = await 그리기({ width: 248 })
    await 재기(view, 248, 120)

    const style = flattenStyle(view.getByTestId(BOX).props.style)
    expect(style.top).toBe(100 + 28 + 8)
    expect(style.width).toBe(248)
    expect(style.opacity).toBeUndefined()
    expect(flattenStyle(view.getByTestId(`${BOX}-caret`, { includeHiddenElements: true }).props.style).top).toBe(-4)
  })

  it('아래가 모자라면 앵커 위로 뒤집고 꼬리가 아래로 간다', async () => {
    const anchor = { left: 100, top: H - 34 - 60, width: 120, height: 28 }
    const { view } = await 그리기({ anchor })
    await 재기(view, 180, 120)

    expect(flattenStyle(view.getByTestId(BOX).props.style).top).toBe(anchor.top - 8 - 120)
    expect(flattenStyle(view.getByTestId(`${BOX}-caret`, { includeHiddenElements: true }).props.style).bottom).toBe(-4)
  })

  it('위아래 둘 다 모자라면 가운데로 옮기고 꼬리를 없애고 옅은 스크림을 깐다', async () => {
    const anchor = { left: 100, top: H / 2, width: 120, height: 28 }
    const { view } = await 그리기({ anchor, width: 248 })
    await 재기(view, 248, H / 2 + 40)

    expect(flattenStyle(view.getByTestId(BOX).props.style).top).toBe(59 + (H - 59 - 34 - (H / 2 + 40)) / 2)
    expect(view.queryByTestId(`${BOX}-caret`, { includeHiddenElements: true })).toBeNull()
    expect(flattenStyle(view.getByLabelText('설명 닫기').props.style).opacity).toBeGreaterThan(0)
  })

  // 폭을 안 주면 내용이 정한다. 화면을 넘지 않게 상한만 둔다.
  it('폭을 안 주면 고정 폭이 없고 화면 안쪽이 상한이다', async () => {
    const { view } = await 그리기()
    await 재기(view, 180, 120)

    const style = flattenStyle(view.getByTestId(BOX).props.style)
    expect(style.width).toBeUndefined()
    expect(style.maxWidth).toBe(Dimensions.get('window').width - 24)
  })

  it('꼬리는 잰 폭 안에서 앵커 가운데를 가리킨다', async () => {
    const { view } = await 그리기()
    await 재기(view, 180, 120)

    const left = flattenStyle(view.getByTestId(BOX).props.style).left as number
    const caretLeft = flattenStyle(view.getByTestId(`${BOX}-caret`, { includeHiddenElements: true }).props.style)
      .left as number
    expect(left + caretLeft + 4).toBe(ANCHOR.left + ANCHOR.width / 2)
  })
})
