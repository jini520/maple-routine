// 진행률. **모달만 구독한다.**
//
// 층 프로바이더의 state 에 두면 작업 하나가 끝날 때마다 탭 내비게이터가 통째로 다시 그려진다
// (첫 진입이면 84번). 그래서 별도 스토어다.
import { useLedgerProgress } from '../progress'

beforeEach(() => {
  useLedgerProgress.getState().reset()
})

it('시작하면 분모가 서고 분자는 0 이다', () => {
  useLedgerProgress.getState().start(84)

  expect(useLedgerProgress.getState()).toMatchObject({ done: 0, total: 84 })
})

it('끝난 수를 그대로 싣는다', () => {
  const slot = useLedgerProgress.getState().start(84)

  useLedgerProgress.getState().advance(slot, 32)

  expect(useLedgerProgress.getState().done).toBe(32)
})

// 수집기가 둘이다(창·히스토리). 각자 자기 몫을 더해 분모를 만든다.
it('여러 수집기의 분모를 더한다', () => {
  useLedgerProgress.getState().start(84)
  useLedgerProgress.getState().start(21)

  expect(useLedgerProgress.getState().total).toBe(105)
})

// 분모가 아직 안 정해진 순간이 있다(원장 읽는 몇십 밀리초). 그때는 바를 안 그린다.
it('시작 전에는 분모가 0 이다', () => {
  expect(useLedgerProgress.getState().total).toBe(0)
})

it('회차가 끝나면 비운다', () => {
  const slot = useLedgerProgress.getState().start(84)
  useLedgerProgress.getState().advance(slot, 84)

  useLedgerProgress.getState().reset()

  expect(useLedgerProgress.getState()).toMatchObject({ done: 0, total: 0 })
})

// 각 수집기가 **자기 칸의 누적**을 올린다. 합으로 세므로 한쪽이 늦어도 다른 쪽이 안 밀린다.
it('여러 수집기의 분자를 더한다', () => {
  const 창 = useLedgerProgress.getState().start(10)
  const 히스토리 = useLedgerProgress.getState().start(10)

  useLedgerProgress.getState().advance(창, 4)
  useLedgerProgress.getState().advance(히스토리, 3)

  expect(useLedgerProgress.getState().done).toBe(7)
})
