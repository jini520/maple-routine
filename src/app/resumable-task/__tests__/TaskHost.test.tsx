/** 이어서 하는 작업을 띄우는 자리. 러너 스토어는 `setState` 로 몰고 동작은 불렸는가만 본다. */
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useAppEntryStore } from '../../../features/app-entry/store'
import { useTaskRunnerStore } from '../../../features/resumable-task/store'
import { findResumableTask } from '../registry'
import { TaskHost } from '../TaskHost'

let checkPending: jest.Mock
let resumePending: jest.Mock

beforeEach(() => {
  checkPending = jest.fn(async () => {})
  resumePending = jest.fn(async () => {})
  useTaskRunnerStore.setState({ progress: null, resume: null, running: false, checked: false, checkPending, resumePending })
})

describe('TaskHost', () => {
  it('앱이 열리면 끝나지 않은 작업을 등록부로 확인한다', async () => {
    useAppEntryStore.setState({ stage: 'ready' })

    await renderOverlay(<TaskHost />)

    expect(checkPending).toHaveBeenCalledWith(findResumableTask)
  })

  it('앱이 열리기 전에는 확인하지 않는다', async () => {
    useAppEntryStore.setState({ stage: 'signIn' })

    await renderOverlay(<TaskHost />)

    expect(checkPending).not.toHaveBeenCalled()
  })

  it('재진행 확인에서 이어서 진행하기를 누르면 이어서 한다', async () => {
    useAppEntryStore.setState({ stage: 'ready' })
    const view = await renderOverlay(<TaskHost />)

    await act(async () => {
      useTaskRunnerStore.setState({
        resume: [{ name: '지난 기록 수수료 적용', done: 812, total: 1240, unit: '건', waiting: false }],
      })
    })
    await fireEvent.press(view.getByText('이어서 진행하기'))

    expect(resumePending).toHaveBeenCalled()
  })
})
