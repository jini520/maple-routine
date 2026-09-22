/** 설정의 MVP 등급 목록과 ID 이력 상세. 스토어는 `setState` 로 몰고, 저장은 불렸는가만 본다. */
import type { ReactNode } from 'react'
import { fireEvent, within } from '@testing-library/react-native'

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}))
jest.mock('../../../lib/scheduler/reset-clock', () => ({
  ...jest.requireActual('../../../lib/scheduler/reset-clock'),
  getCurrentKstDateKey: () => '2026-09-22',
}))

var mockNavigate: jest.Mock
mockNavigate = jest.fn()

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useMvpGradeSettingsStore, type MvpGradeAccountView } from '../../../features/mvp-grade/settings-store'
import { SettingsMvpGradeScreen } from '../SettingsMvpGradeScreen'
import { SettingsMvpGradeHistoryScreen } from '../SettingsMvpGradeHistoryScreen'

const A: MvpGradeAccountView = {
  accountId: 'A',
  summary: {
    accountId: 'A',
    representative: { ocid: 'a1', name: '에이', world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 },
    worldCounts: [{ worldKey: 'scania', world: '스카니아', count: 3 }],
    characterCount: 3,
  },
  portraitUrl: null,
  history: [
    { startDate: '2025-11-20', grade: 'bronze' },
    { startDate: '2026-05-07', grade: 'red' },
    { startDate: '2026-05-21', grade: null },
    { startDate: '2026-06-11', grade: 'silver' },
    { startDate: '2026-09-17', grade: 'diamond' },
  ],
}

let load: jest.Mock
let saveHistory: jest.Mock
let setWeeklyCheck: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  load = jest.fn(async () => {})
  saveHistory = jest.fn(async () => {})
  setWeeklyCheck = jest.fn(async () => {})
  useMvpGradeSettingsStore.setState({ status: 'ready', accounts: [A], weeklyOff: false, load, saveHistory, setWeeklyCheck })
})

describe('SettingsMvpGradeScreen', () => {
  it('들어오면 읽고, 읽는 동안은 불러오는 중이다', async () => {
    useMvpGradeSettingsStore.setState({ status: 'loading', accounts: [] })
    const view = await renderOverlay(<SettingsMvpGradeScreen />)

    expect(load).toHaveBeenCalled()
    expect(view.getByTestId('loading-state')).toBeTruthy()
  })

  it('읽지 못하면 다시 시도를 준다', async () => {
    useMvpGradeSettingsStore.setState({ status: 'failed', accounts: [] })
    const view = await renderOverlay(<SettingsMvpGradeScreen />)

    await fireEvent.press(view.getByText('다시 시도'))

    expect(view.getByText('MVP 등급을 불러오지 못했습니다')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('ID 마다 지금 등급 한 줄과 이력 수를 보이고, 이력을 누르면 상세로 간다', async () => {
    const view = await renderOverlay(<SettingsMvpGradeScreen />)
    const card = within(view.getByTestId('mvp-grade-account-A'))

    expect(card.getByText('스카니아 Lv.280 에이')).toBeTruthy()
    expect(card.getByText('9월 17일 (목)')).toBeTruthy()
    expect(card.getByText('지금')).toBeTruthy()
    expect(card.getByLabelText('MVP 다이아')).toBeTruthy()

    await fireEvent.press(card.getByText('이력 5건 보기'))
    expect(mockNavigate).toHaveBeenCalledWith('SettingsMvpGradeHistory', { accountId: 'A' })
  })

  it('변경을 누르면 등급 변경 시트가 열리고 저장하면 이력을 적는다', async () => {
    const view = await renderOverlay(<SettingsMvpGradeScreen />)

    await fireEvent.press(view.getByRole('button', { name: '변경' }))
    expect(view.getByText('등급 변경')).toBeTruthy()
    await fireEvent.press(view.getByLabelText('블랙'))
    await fireEvent.press(view.getByRole('button', { name: '저장' }))

    expect(saveHistory).toHaveBeenCalledWith(
      'A',
      [...A.history.slice(0, 4), { startDate: '2026-09-17', grade: 'black' }],
      expect.any(Date),
    )
  })

  it('매주 등급 확인 스위치는 저장값의 반대로 서고, 끄면 끈 값을 적는다', async () => {
    const view = await renderOverlay(<SettingsMvpGradeScreen />)
    const toggle = view.getByRole('switch', { name: '매주 등급 확인' })

    expect(toggle.props.accessibilityState?.checked).toBe(true)
    await fireEvent.press(toggle)
    expect(setWeeklyCheck).toHaveBeenCalledWith(false)
  })
})

describe('SettingsMvpGradeHistoryScreen', () => {
  async function 그리기() {
    return renderOverlay(<SettingsMvpGradeHistoryScreen route={{ params: { accountId: 'A' } }} />)
  }

  it('위 카드가 지금 등급 · 혜택 · 시작 날짜를 보인다', async () => {
    const view = await 그리기()
    const top = within(view.getByTestId('mvp-grade-now'))

    expect(top.getByLabelText('MVP 다이아')).toBeTruthy()
    expect(top.getByText('경매장 수수료 3% · 스타포스 10% 할인')).toBeTruthy()
    expect(top.getByText('9월 17일 (목)부터')).toBeTruthy()
  })

  it('이력은 최신부터 서고, 해가 바뀌는 자리에 연도 줄이 서고, 빈 줄은 등급 없음이다', async () => {
    const view = await 그리기()
    const list = within(view.getByTestId('mvp-grade-timeline'))

    expect(view.getByText('이력 5건')).toBeTruthy()
    const labels = list.getAllByRole('button').map((row) => row.props.accessibilityLabel)
    expect(labels).toEqual([
      '9월 17일 (목)부터 다이아 고치기',
      '6월 11일 (목)부터 실버 고치기',
      '5월 21일 (목)부터 등급 없음 고치기',
      '5월 7일 (목)부터 레드 고치기',
      '11월 20일 (목)부터 브론즈 고치기',
    ])
    expect(list.getByText('2026')).toBeTruthy()
    expect(list.getByText('2025')).toBeTruthy()
    expect(list.getByText('등급 없음')).toBeTruthy()
  })

  it('+ 추가는 기록 추가 시트를 연다', async () => {
    const view = await 그리기()

    await fireEvent.press(view.getByRole('button', { name: '+ 추가' }))

    expect(view.getByText('기록 추가')).toBeTruthy()
  })

  it('줄을 누르면 고치기 시트가 열리고, 지우기는 확인을 거쳐 그 줄을 지운다', async () => {
    const view = await 그리기()

    await fireEvent.press(view.getByLabelText('6월 11일 (목)부터 실버 고치기'))
    expect(view.getByText('등급 기록 고치기')).toBeTruthy()
    await fireEvent.press(view.getByRole('button', { name: '이 기록 지우기' }))

    expect(view.queryByText('등급 기록 고치기')).toBeNull()
    expect(view.getByText('등급 기록을 지울까요?')).toBeTruthy()
    await fireEvent.press(view.getByText('기록 지우기'))

    expect(saveHistory).toHaveBeenCalledWith(
      'A',
      A.history.filter((entry) => entry.startDate !== '2026-06-11'),
      expect.any(Date),
    )
  })
})
