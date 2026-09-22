/** 앱이 중간에 닫힌 작업을 이어서 할지 묻는 모달. 제목 · 설명 · 버튼은 모든 작업이 같이 쓴다. */
import { fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import { TaskResumeModal } from '../TaskResumeModal'

const TASKS = [
  { name: '지난 기록 수수료 적용', done: 812, total: 1240, waiting: false },
  { name: '자동 수수료 다시 계산', done: 0, total: 380, waiting: true },
]

describe('TaskResumeModal', () => {
  it('작업마다 멈춘 자리를 보이고, 기다리는 작업은 대기다', async () => {
    const view = await renderOverlay(<TaskResumeModal tasks={TASKS} busy={false} onResume={jest.fn()} />)

    expect(view.getByText('끝나지 않은 작업이 있어요')).toBeTruthy()
    expect(view.getByText('앱이 중간에 닫혀 멈춘 작업이에요. 멈춘 곳부터 이어서 진행해요.')).toBeTruthy()
    expect(view.getByTestId('task-resume-0')).toHaveTextContent('지난 기록 수수료 적용812 / 1,240건')
    expect(view.getByTestId('task-resume-1')).toHaveTextContent('자동 수수료 다시 계산대기')
  })

  it('버튼은 이어서 진행하기 하나다', async () => {
    const onResume = jest.fn()
    const view = await renderOverlay(<TaskResumeModal tasks={TASKS} busy={false} onResume={onResume} />)

    await fireEvent.press(view.getByText('이어서 진행하기'))

    expect(onResume).toHaveBeenCalled()
    expect(view.queryByText('나중에')).toBeNull()
  })
})
