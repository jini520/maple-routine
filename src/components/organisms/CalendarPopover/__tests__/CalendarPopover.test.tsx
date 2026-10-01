/** 날짜 고르기 달력. 날을 눌러도 안에서만 칠하고 `확인` 을 눌러야 내보낸다. */
import { fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import { CalendarPopover, type CalendarPopoverProps } from '../CalendarPopover'

const ANCHOR = { left: 100, top: 100, width: 120, height: 28 }

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
})
