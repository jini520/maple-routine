/** 주 고르기 달력. MVP 등급은 매주 목요일에 바뀌어 날이 아니라 주(목~수)를 고른다. */
import { fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import { WeekCalendarPopover, type WeekCalendarPopoverProps } from '../WeekCalendarPopover'

const ANCHOR = { left: 100, top: 100, width: 120, height: 28 }

async function 그리기(props: Partial<WeekCalendarPopoverProps> = {}) {
  const onSelect = jest.fn()
  const view = await renderOverlay(
    <WeekCalendarPopover
      selection={{ start: '2026-09-17', end: '2026-09-17' }}
      isSelectable={(week) => week <= '2026-09-17'}
      min="2025-02-27"
      max="2026-09-23"
      monthKey="2026-09"
      onChangeMonth={jest.fn()}
      onSelect={onSelect}
      caption="선택한 주"
      anchor={ANCHOR}
      onClose={jest.fn()}
      {...props}
    />,
  )
  return { view, onSelect }
}

describe('WeekCalendarPopover', () => {
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
})
