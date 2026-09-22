/** 등급을 물을 것이 있으면 모달을 띄우는 자리. 스토어는 모킹하지 않고 `setState` 로 몬다. */
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useAppEntryStore } from '../../../features/app-entry/store'
import { useMvpAskStore } from '../../../features/mvp-grade/flow-store'
import { useTaskRunnerStore } from '../../../features/resumable-task/store'
import { MvpGradeHost } from '../MvpGradeHost'

let evaluate: jest.Mock
let complete: jest.Mock

beforeEach(() => {
  evaluate = jest.fn(async () => {})
  complete = jest.fn(async () => {})
  useMvpAskStore.setState({ ask: null, accounts: [], weeklyOff: false, evaluate, complete })
  // 끝나지 않은 작업을 확인했고 도는 작업이 없다
  useTaskRunnerStore.setState({ checked: true, running: false, resume: null, progress: null })
})

describe('MvpGradeHost', () => {
  it('끝나지 않은 작업을 확인하기 전이나 작업이 남아 있으면 재지 않고, 끝나면 잰다', async () => {
    useAppEntryStore.setState({ stage: 'ready' })
    useTaskRunnerStore.setState({
      checked: true,
      resume: [{ name: '지난 기록 수수료 적용', done: 1, total: 2, unit: '건', waiting: false }],
    })
    await renderOverlay(<MvpGradeHost />)
    expect(evaluate).not.toHaveBeenCalled()

    await act(async () => {
      useTaskRunnerStore.setState({ resume: null, running: true })
    })
    expect(evaluate).not.toHaveBeenCalled()

    await act(async () => {
      useTaskRunnerStore.setState({ running: false })
    })
    expect(evaluate).toHaveBeenCalledTimes(1)
  })

  it('앱이 열리기 전에는 재지 않는다', async () => {
    useAppEntryStore.setState({ stage: 'characterSetup' })

    await renderOverlay(<MvpGradeHost />)

    expect(evaluate).not.toHaveBeenCalled()
  })

  it('앱이 열리면 재고, 물을 것이 생기면 모달을 띄워 답을 넘긴다', async () => {
    useAppEntryStore.setState({ stage: 'ready' })
    const view = await renderOverlay(<MvpGradeHost />)
    expect(evaluate).toHaveBeenCalledTimes(1)
    expect(view.queryByText('MVP 등급을 알려주세요')).toBeNull()

    await act(async () => {
      useMvpAskStore.setState({
        ask: { kind: 'select', accountIds: ['A'], bulk: false },
        accounts: [{ accountId: 'A', summary: null, portraitUrl: null, currentGrade: null }],
      })
    })
    await fireEvent.press(view.getByText('다음'))
    await fireEvent.press(view.getByText('맞아요'))

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ choices: [expect.objectContaining({ accountId: 'A', grade: 'normal' })] }),
      expect.any(Date),
    )
  })
})
