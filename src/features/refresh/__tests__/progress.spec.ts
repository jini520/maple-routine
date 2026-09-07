// 진행률. **모달만 구독한다.**
//
// 층 프로바이더의 state 에 두면 작업 하나가 끝날 때마다 탭 내비게이터가 통째로 다시 그려진다
// (첫 진입이면 84번). 그래서 별도 스토어다.
import { useRefreshProgress } from '../progress'

function 상태(): { done: number; total: number } {
  const { done, total } = useRefreshProgress.getState()
  return { done, total }
}

it('시작하면 분모가 서고 분자는 0 이다', () => {
  const 끝내기 = useRefreshProgress.getState().beginRound()
  useRefreshProgress.getState().start(84)

  expect(상태()).toEqual({ done: 0, total: 84 })
  끝내기()
})

it('끝난 수를 그대로 싣는다', () => {
  const 끝내기 = useRefreshProgress.getState().beginRound()
  const slot = useRefreshProgress.getState().start(84)

  useRefreshProgress.getState().advance(slot, 32)

  expect(상태().done).toBe(32)
  끝내기()
})

// 수집기가 여럿이다(스케줄러·창·히스토리). 각자 자기 몫을 더해 분모를 만든다.
it('여러 수집기의 분모를 더한다', () => {
  const 끝내기 = useRefreshProgress.getState().beginRound()
  useRefreshProgress.getState().start(84)
  useRefreshProgress.getState().start(21)

  expect(상태().total).toBe(105)
  끝내기()
})

// 각 수집기가 **자기 칸의 누적**을 올린다. 합으로 세므로 한쪽이 늦어도 다른 쪽이 안 밀린다.
it('여러 수집기의 분자를 더한다', () => {
  const 끝내기 = useRefreshProgress.getState().beginRound()
  const 창 = useRefreshProgress.getState().start(10)
  const 히스토리 = useRefreshProgress.getState().start(10)

  useRefreshProgress.getState().advance(창, 4)
  useRefreshProgress.getState().advance(히스토리, 3)

  expect(상태().done).toBe(7)
  끝내기()
})

// 분모가 아직 안 정해진 순간이 있다(원장 읽는 몇십 밀리초). 그때는 바를 안 그린다.
it('시작 전에는 분모가 0 이다', () => {
  expect(상태()).toEqual({ done: 0, total: 0 })
})

it('회차가 끝나면 비운다', () => {
  const 끝내기 = useRefreshProgress.getState().beginRound()
  const slot = useRefreshProgress.getState().start(84)
  useRefreshProgress.getState().advance(slot, 84)

  끝내기()

  expect(상태()).toEqual({ done: 0, total: 0 })
})

// **이것이 회차를 세는 이유다.** 한 회차 안의 단계가 순차라(라이브 → 창·히스토리) 칸이 자기
// 몫만 끝나고 사라지면 그 사이에 분모가 0 이 돼 바가 꺼졌다 켜진다.
describe('회차 안의 단계', () => {
  it('앞 단계가 끝나도 바가 안 꺼진다', () => {
    const 끝내기 = useRefreshProgress.getState().beginRound()
    const 라이브 = useRefreshProgress.getState().start(12)
    useRefreshProgress.getState().advance(라이브, 12)

    // 다음 단계가 자기 몫을 연다. 앞 단계의 12 는 그대로 남는다.
    useRefreshProgress.getState().start(113)

    expect(상태()).toEqual({ done: 12, total: 125 })
    끝내기()
  })

  // 안쪽에서 도는 회차(`syncSchedules`)가 자기 회차를 열고 닫아도 바깥 회차가 살아 있으면
  // 칸이 안 걷힌다. 그래야 층의 회차 하나가 통째로 한 바가 된다.
  it('안쪽 회차가 닫혀도 바깥이 열려 있으면 안 비운다', () => {
    const 바깥 = useRefreshProgress.getState().beginRound()
    const 안쪽 = useRefreshProgress.getState().beginRound()
    const slot = useRefreshProgress.getState().start(12)
    useRefreshProgress.getState().advance(slot, 12)

    안쪽()

    expect(상태()).toEqual({ done: 12, total: 12 })

    바깥()
    expect(상태()).toEqual({ done: 0, total: 0 })
  })

  // 같은 함수를 두 번 불러도 참조 수가 한 번만 준다. 안 그러면 겹친 회차에서 남의 몫까지 닫는다.
  it('같은 끝내기를 두 번 불러도 한 번만 센다', () => {
    const 바깥 = useRefreshProgress.getState().beginRound()
    const 안쪽 = useRefreshProgress.getState().beginRound()
    useRefreshProgress.getState().start(12)

    안쪽()
    안쪽()

    expect(상태().total).toBe(12)
    바깥()
  })
})

// 없는 칸에 올려도 안 터진다. 회차가 걷힌 뒤 늦게 온 응답이 그 자리다.
it('걷힌 칸에 올려도 조용하다', () => {
  const 끝내기 = useRefreshProgress.getState().beginRound()
  const slot = useRefreshProgress.getState().start(10)
  끝내기()

  expect(() => useRefreshProgress.getState().advance(slot, 5)).not.toThrow()
  expect(상태()).toEqual({ done: 0, total: 0 })
})

// 계획은 추정으로 연다(추적 목록의 캐릭터 수). 실제로 자격을 지난 수가 그보다 적을 수 있는데,
// 안 고치면 바가 끝까지 안 찬다.
it('실제 분모가 오면 고친다', () => {
  const 끝내기 = useRefreshProgress.getState().beginRound()
  const slot = useRefreshProgress.getState().start(5)

  useRefreshProgress.getState().advance(slot, 3, 3)

  expect(상태()).toEqual({ done: 3, total: 3 })
  끝내기()
})

it('안 주면 분모를 그대로 둔다', () => {
  const 끝내기 = useRefreshProgress.getState().beginRound()
  const slot = useRefreshProgress.getState().start(5)

  useRefreshProgress.getState().advance(slot, 3)

  expect(상태()).toEqual({ done: 3, total: 5 })
  끝내기()
})
