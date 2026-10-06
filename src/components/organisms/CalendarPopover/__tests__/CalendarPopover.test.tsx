/** 날짜 고르기 달력. 날을 눌러도 안에서만 칠하고 `확인` 을 눌러야 내보낸다. */
import { fireEvent } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import { flattenStyle, renderOverlay } from '../../../__tests__/render-atom'
import { CalendarPopover, type CalendarPopoverProps } from '../CalendarPopover'

const ANCHOR = { left: 100, top: 100, width: 120, height: 28 }

const BOX = 'calendar-popover'

async function 그리기(props: Partial<CalendarPopoverProps> = {}) {
  const onConfirm = jest.fn()
  const onClose = jest.fn()
  const view = await renderOverlay(
    <CalendarPopover
      selected="2026-09-17"
      min="2026-09-01"
      max="2026-09-30"
      monthKey="2026-09"
      onChangeMonth={jest.fn()}
      onConfirm={onConfirm}
      anchor={ANCHOR}
      onClose={onClose}
      {...props}
    />,
  )
  return { view, onConfirm, onClose }
}

describe('CalendarPopover', () => {
  it('날을 누르면 안에서만 고르고 내보내지 않는다', async () => {
    const { view, onConfirm } = await 그리기()

    await fireEvent.press(view.getByLabelText('2026-09-20'))

    expect(view.getByLabelText('2026-09-20').props.accessibilityState?.selected).toBe(true)
    expect(view.getByLabelText('2026-09-17').props.accessibilityState?.selected).toBe(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('확인을 누르면 고른 날을 내보낸다', async () => {
    const { view, onConfirm } = await 그리기()

    await fireEvent.press(view.getByLabelText('2026-09-20'))
    await fireEvent.press(view.getByRole('button', { name: '확인' }))

    expect(onConfirm).toHaveBeenCalledWith('2026-09-20')
  })

  it('바깥을 누르면 고른 것을 버리고 닫는다', async () => {
    const { view, onConfirm, onClose } = await 그리기()

    await fireEvent.press(view.getByLabelText('2026-09-20'))
    await fireEvent.press(view.getByLabelText('날짜 고르기 닫기'))

    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  // 짧은 화면에서 낮은 앵커의 달력이 아래로만 열려 확인 버튼째 화면 밖으로 나갔다(#530).
  describe('짧은 화면의 자리', () => {
    /** iOS 테스트 창 높이. 안전영역은 상 59 · 하 34. */
    const H = Dimensions.get('window').height

    async function 재기(view: Awaited<ReturnType<typeof 그리기>>['view'], height: number): Promise<void> {
      await fireEvent(view.getByTestId(BOX), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 248, height } },
      })
    }

    it('높이를 재기 전에는 안 보인다', async () => {
      const { view } = await 그리기()

      expect(flattenStyle(view.getByTestId(BOX).props.style).opacity).toBe(0)
    })

    it('아래에 들어가면 앵커 아래로 열고 꼬리가 위에 선다', async () => {
      const { view } = await 그리기()
      await 재기(view, 268)

      const style = flattenStyle(view.getByTestId(BOX).props.style)
      expect(style.top).toBe(100 + 28 + 8)
      expect(style.opacity).toBeUndefined()
      expect(flattenStyle(view.getByTestId(`${BOX}-caret`, { includeHiddenElements: true }).props.style).top).toBe(-4)
    })

    it('아래가 모자라면 앵커 위로 뒤집고 꼬리가 아래로 간다', async () => {
      const anchor = { left: 100, top: H - 34 - 100, width: 120, height: 28 }
      const { view } = await 그리기({ anchor })
      await 재기(view, 268)

      expect(flattenStyle(view.getByTestId(BOX).props.style).top).toBe(anchor.top - 8 - 268)
      expect(flattenStyle(view.getByTestId(`${BOX}-caret`, { includeHiddenElements: true }).props.style).bottom).toBe(-4)
    })

    it('위아래 둘 다 모자라면 가운데로 옮기고 꼬리를 없애고 옅은 스크림을 깐다', async () => {
      const anchor = { left: 100, top: H / 2, width: 120, height: 28 }
      const { view } = await 그리기({ anchor })
      await 재기(view, H / 2 + 40)

      expect(flattenStyle(view.getByTestId(BOX).props.style).top).toBe(59 + (H - 59 - 34 - (H / 2 + 40)) / 2)
      expect(view.queryByTestId(`${BOX}-caret`, { includeHiddenElements: true })).toBeNull()
      expect(flattenStyle(view.getByTestId(`${BOX}-scrim`).props.style).opacity).toBeGreaterThan(0)
    })
  })
})
