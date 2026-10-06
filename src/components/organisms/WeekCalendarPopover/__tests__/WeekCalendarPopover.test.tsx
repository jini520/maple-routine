/** 주 고르기 달력. MVP 등급은 매주 목요일에 바뀌어 날이 아니라 주(목~수)를 고른다. */
import { fireEvent } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import { flattenStyle, renderOverlay } from '../../../__tests__/render-atom'
import { WeekCalendarPopover, type WeekCalendarPopoverProps } from '../WeekCalendarPopover'

const ANCHOR = { left: 100, top: 100, width: 120, height: 28 }

const BOX = 'week-calendar-popover'

async function 그리기(props: Partial<WeekCalendarPopoverProps> = {}) {
  const onSelect = jest.fn()
  const onConfirm = jest.fn()
  const view = await renderOverlay(
    <WeekCalendarPopover
      selection={{ start: '2026-09-17', end: '2026-09-17' }}
      isSelectable={(week) => week <= '2026-09-17'}
      min="2025-02-27"
      max="2026-09-23"
      monthKey="2026-09"
      onChangeMonth={jest.fn()}
      onSelect={onSelect}
      onConfirm={onConfirm}
      caption="선택한 주"
      anchor={ANCHOR}
      onClose={jest.fn()}
      {...props}
    />,
  )
  return { view, onSelect, onConfirm }
}

describe('WeekCalendarPopover', () => {
  it('날을 눌러도 확인 전에는 내보내지 않고, 확인을 누르면 내보낸다', async () => {
    const { view, onConfirm } = await 그리기()

    await fireEvent.press(view.getByLabelText('2026-09-08'))
    expect(onConfirm).not.toHaveBeenCalled()

    await fireEvent.press(view.getByRole('button', { name: '확인' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('confirmDisabled 면 확인이 꺼진다', async () => {
    const { view } = await 그리기({ confirmDisabled: true })

    expect(view.getByRole('button', { name: '확인' }).props.accessibilityState?.disabled).toBe(true)
  })

  it('어느 날을 눌러도 그 날이 든 주의 목요일을 준다', async () => {
    const { view, onSelect } = await 그리기()

    fireEvent.press(view.getByLabelText('2026-09-08'))

    expect(onSelect).toHaveBeenCalledWith('2026-09-03')
  })

  it('고를 수 없는 주의 날은 눌러도 안 준다', async () => {
    const { view, onSelect } = await 그리기()

    expect(view.getByLabelText('2026-09-25').props.accessibilityState?.disabled).toBe(true)
    fireEvent.press(view.getByLabelText('2026-09-25'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('고른 주를 두 줄에 걸친 띠로 칠하고 아래에 그 범위를 적는다', async () => {
    const { view } = await 그리기()

    // 9/17(목)~9/19(토)가 한 줄, 9/20(일)~9/23(수)가 다음 줄이다
    expect(view.getAllByTestId('week-calendar-band', { includeHiddenElements: true })).toHaveLength(2)
    expect(view.getByTestId('week-calendar-caption')).toHaveTextContent('선택한 주9월 17일 (목) ~ 9월 23일 (수)')
  })

  it('기간이면 시작 주 목요일부터 종료 주 수요일까지 칠한다', async () => {
    const { view } = await 그리기({
      selection: { start: '2026-09-03', end: '2026-09-10' },
      caption: '선택한 기간',
    })

    expect(view.getAllByTestId('week-calendar-band', { includeHiddenElements: true })).toHaveLength(3)
    expect(view.getByTestId('week-calendar-caption')).toHaveTextContent('선택한 기간9월 3일 (목) ~ 9월 16일 (수)')
  })

  it('탭을 넘기면 어느 끝을 고를지 바뀐다', async () => {
    const onTab = jest.fn()
    const { view } = await 그리기({
      selection: { start: '2026-09-03', end: null },
      caption: '선택한 기간',
      tabs: { active: 'start', onChange: onTab },
    })

    expect(view.getByTestId('week-calendar-tab-end')).toHaveTextContent('종료 주주 선택')
    fireEvent.press(view.getByTestId('week-calendar-tab-end'))
    expect(onTab).toHaveBeenCalledWith('end')
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
