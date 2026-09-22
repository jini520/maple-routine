/** 온보딩의 MVP 등급 화면 둘. 캐릭터 설정 다음에 서고, 확인 버튼은 시작하기이며 수정이 없다. */
import { fireEvent, within } from '@testing-library/react-native'

jest.mock('../../../hooks/useScreenNavigation', () => ({
  useScreenNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}))
jest.mock('../../../lib/scheduler/reset-clock', () => ({
  ...jest.requireActual('../../../lib/scheduler/reset-clock'),
  getCurrentKstDateKey: () => '2026-09-22',
}))

var mockNavigate: jest.Mock
var mockGoBack: jest.Mock
mockNavigate = jest.fn()
mockGoBack = jest.fn()

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useAppEntryStore } from '../../../features/app-entry/store'
import { useMvpAskStore, type MvpAskAccount } from '../../../features/mvp-grade/flow-store'
import { useMvpOnboardingDraft } from '../../../features/mvp-grade/onboarding-draft'
import { MvpGradeConfirmScreen, MvpGradePickScreen } from '../MvpGradeOnboarding'

const A: MvpAskAccount = {
  accountId: 'A',
  summary: {
    accountId: 'A',
    representative: { ocid: 'a1', name: '에이', world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 },
    worldCounts: [{ worldKey: 'scania', world: '스카니아', count: 3 }],
    characterCount: 3,
  },
  portraitUrl: null,
  currentGrade: null,
}

let evaluate: jest.Mock
let complete: jest.Mock
let finishMvpOnboarding: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  evaluate = jest.fn(async () => {})
  complete = jest.fn(async () => {})
  finishMvpOnboarding = jest.fn(async () => {})
  useMvpAskStore.setState({
    ask: { kind: 'select', accountIds: ['A'], bulk: false },
    accounts: [A],
    weeklyOff: false,
    evaluate,
    complete,
  })
  useAppEntryStore.setState({ stage: 'mvpGrade', finishMvpOnboarding })
  useMvpOnboardingDraft.setState({ grades: {}, starts: {}, weeklyOff: false, seededFor: null })
})

describe('MvpGradePickScreen', () => {
  it('ID 마다 고르기 카드가 서고, 다음은 확인 화면을 민다', async () => {
    const view = await renderOverlay(<MvpGradePickScreen />)

    expect(view.getByText('MVP 등급을 알려주세요')).toBeTruthy()
    const card = within(view.getByTestId('mvp-grade-card-A'))
    expect(card.getByLabelText('일반').props.accessibilityState?.selected).toBe(true)

    await fireEvent.press(card.getByLabelText('다이아'))
    await fireEvent.press(view.getByRole('button', { name: '다음' }))

    expect(mockNavigate).toHaveBeenCalledWith('MvpGradeConfirm')
    expect(useMvpOnboardingDraft.getState().grades).toEqual({ A: 'diamond' })
  })

  it('머리 줄의 뒤로가기는 캐릭터 설정으로 돌아간다', async () => {
    const view = await renderOverlay(<MvpGradePickScreen />)

    await fireEvent.press(view.getByLabelText('뒤로'))

    expect(mockGoBack).toHaveBeenCalled()
  })

  it('물을 것을 아직 안 쟀으면 재고, 물을 ID 가 없으면 온보딩을 끝낸다', async () => {
    useMvpAskStore.setState({ ask: null, accounts: [] })

    await renderOverlay(<MvpGradePickScreen />)

    expect(evaluate).toHaveBeenCalled()
    expect(finishMvpOnboarding).toHaveBeenCalled()
  })
})

describe('MvpGradeConfirmScreen', () => {
  it('고른 등급으로 확인 카드가 서고 수정 없이 시작하기 하나다', async () => {
    useMvpOnboardingDraft.setState({ grades: { A: 'gold' }, starts: { A: '2026-09-10' }, seededFor: 'A' })
    const view = await renderOverlay(<MvpGradeConfirmScreen />)

    expect(view.getByText('이 등급이 맞나요?')).toBeTruthy()
    expect(within(view.getByTestId('mvp-grade-card-A')).getByLabelText('MVP 골드')).toBeTruthy()
    expect(within(view.getByTestId('mvp-grade-card-A')).getByText('9월 10일 (목)')).toBeTruthy()
    expect(view.queryByText('수정')).toBeNull()
    expect(view.queryByText('맞아요')).toBeNull()
  })

  it('시작하기는 이력을 적고 온보딩을 끝낸다', async () => {
    useMvpOnboardingDraft.setState({ grades: { A: 'red' }, starts: { A: '2026-09-17' }, seededFor: 'A' })
    const view = await renderOverlay(<MvpGradeConfirmScreen />)

    await fireEvent.press(view.getByRole('checkbox', { name: '앞으로 등급은 직접 바꿀게요' }))
    await fireEvent.press(view.getByRole('button', { name: '시작하기' }))

    expect(complete).toHaveBeenCalledWith(
      {
        choices: [{ accountId: 'A', grade: 'red', startWeek: '2026-09-17', changed: true }],
        weeklyOff: true,
        bulkApply: false,
      },
      expect.any(Date),
    )
    expect(finishMvpOnboarding).toHaveBeenCalled()
  })

  it('머리 줄의 뒤로가기는 고르기로 돌아간다', async () => {
    const view = await renderOverlay(<MvpGradeConfirmScreen />)

    await fireEvent.press(view.getByLabelText('뒤로'))

    expect(mockGoBack).toHaveBeenCalled()
  })
})
