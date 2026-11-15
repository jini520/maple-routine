// 전환이 끝난 뒤 한 번 부르기. 가계부가 `거래로 이동` 으로 받은 날짜로 기간을 옮길 때 쓴다. 기간을 옮기면 조회 회차와
// 달 읽기가 시작되어, 거래 내역이 빠지는 전환과 겹치면 전환과 시트가 느려진다.
import { runAfterTransitionEnd, type TransitionSource } from '../useRunAfterTransition'
import { 초점가짜 } from './screen-focus-fake'

const 소스 = (가짜: ReturnType<typeof 초점가짜>): TransitionSource => 가짜.navigation as unknown as TransitionSource

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('runAfterTransitionEnd', () => {
  it('부모 스택의 다음 전환이 끝날 때 한 번 부르고, 시간 제한은 지운다', async () => {
    const 부모 = 초점가짜(true)
    const 가짜 = 초점가짜(true, 부모)
    const task = jest.fn()

    runAfterTransitionEnd(소스(가짜), task, 600)
    expect(task).not.toHaveBeenCalled()

    await 부모.보내기('transitionEnd')
    expect(task).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1000)
    await 부모.보내기('transitionEnd')
    expect(task).toHaveBeenCalledTimes(1)
  })

  // 전환이 없는 이동(이미 가계부가 보이던 때)에는 이벤트가 오지 않는다. 그때도 기간은 옮겨야 한다.
  it('전환이 끝나지 않으면 시간 제한 뒤에 부른다', () => {
    const task = jest.fn()

    runAfterTransitionEnd(소스(초점가짜(true)), task, 600)
    jest.advanceTimersByTime(599)
    expect(task).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(task).toHaveBeenCalledTimes(1)
  })

  // 컴포넌트 테스트는 내비게이터 없이 렌더한다. 기다릴 전환이 없으니 바로 부른다.
  it('화면이 없으면 바로 부른다', () => {
    const task = jest.fn()

    runAfterTransitionEnd(undefined, task, 600)

    expect(task).toHaveBeenCalledTimes(1)
  })
})
