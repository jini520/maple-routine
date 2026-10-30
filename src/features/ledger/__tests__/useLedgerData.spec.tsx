// 수익·지출 층은 회차의 **진행**을 소유한다. 자식(보스 수익·가계부·통계)은 상태를 구독하고 다시 불러 달라고 부탁만 한다.
//
// 기록은 들지 않는다. 회차가 쓴 기록은 표의 판을 올리고, 그 표를 읽는 쿼리가 무효화되어 자식이 다시 읽는다.
// 자식마다 조립하던 때 난 결함 셋이 전부 `누가 부르나·언제 끝나나·누가 결과를 받나` 에서 났다.
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'

jest.mock('../../schedule-window/sync', () => ({ syncScheduleWindow: jest.fn() }))
jest.mock('../../schedule-window/window', () => ({ planScheduleWindow: jest.fn() }))
jest.mock('../../schedule-sync/schedule-query', () => ({
  refreshSchedules: jest.fn(),
  prefetchSchedules: jest.fn(),
  readTrackedOcids: jest.fn(),
}))
jest.mock('../../refresh/pull', () => ({ collectTodayEnhancement: jest.fn() }))
jest.mock('../../enhancement-history/collect', () => ({
  collectEnhancementHistory: jest.fn(),
  measureEnhancementHistory: jest.fn(),
}))

import { useRefreshProgress } from '../../refresh/progress'
import { LedgerDataProvider, useLedgerData } from '../useLedgerData'

const { syncScheduleWindow: syncMock } = jest.requireMock('../../schedule-window/sync') as Record<string, jest.Mock>
const { planScheduleWindow: planMock } = jest.requireMock('../../schedule-window/window') as Record<string, jest.Mock>
const {
  refreshSchedules: refreshMock,
  prefetchSchedules: prefetchMock,
  readTrackedOcids: trackedMock,
} = jest.requireMock('../../schedule-sync/schedule-query') as Record<string, jest.Mock>
const { collectTodayEnhancement: todayMock } = jest.requireMock('../../refresh/pull') as Record<string, jest.Mock>
const { collectEnhancementHistory: collectMock, measureEnhancementHistory: sizeMock } = jest.requireMock(
  '../../enhancement-history/collect',
) as Record<string, jest.Mock>

function Probe(): React.JSX.Element {
  const { status, reload } = useLedgerData()
  return (
    <>
      <Text testID="probe">{status}</Text>
      {/* 보스 수익의 당김. 범위 강화를 안 받는다. */}
      <Text testID="reload" onPress={() => void reload(['live', 'window'])}>
        다시
      </Text>
      {/* 가계부의 당김. 범위 강화까지 받는다. */}
      <Text testID="reload-all" onPress={() => void reload(['live', 'window', 'enhancement'])}>
        다시(가계부)
      </Text>
    </>
  )
}

const 그리기 = async () =>
  render(
    <LedgerDataProvider>
      <Probe />
    </LedgerDataProvider>,
  )

beforeEach(() => {
  useRefreshProgress.getState().resetForTests()
  syncMock.mockReset().mockResolvedValue(undefined)
  // 계획은 실행보다 먼저 선다. 그래야 수집기의 분모 총합이 첫 순간부터 잡힌다.
  planMock.mockReset().mockResolvedValue({ apiKey: 'key-1', jobs: [{ ocid: 'o1', dateKey: '2026-09-01' }] })
  refreshMock.mockReset().mockResolvedValue(undefined)
  prefetchMock.mockReset().mockResolvedValue(undefined)
  trackedMock.mockReset().mockResolvedValue(['o1', 'o2'])
  todayMock.mockReset().mockResolvedValue(undefined)
  collectMock.mockReset().mockResolvedValue(undefined)
  sizeMock.mockReset().mockResolvedValue({ total: 0, hasPast: false })
})

// 창은 회차가 쓴 오늘 기록을 봐야 처치 날짜를 캔다. 창이 회차보다 먼저 후보를 읽으면 오늘 결정석에 날짜가 안 붙는다.
// 그래서 마운트는 만료된 회차만 받고(신선하면 지나간다) 그 뒤에 창을 채운다.
it('마운트는 만료된 회차를 먼저 받은 뒤 창을 채운다. 신선해도 받는 회차는 안 튼다', async () => {
  let 회차끝내기!: () => void
  prefetchMock.mockReturnValue(new Promise<void>((resolve) => { 회차끝내기 = resolve }))

  const view = await 그리기()

  await waitFor(() => expect(prefetchMock).toHaveBeenCalledTimes(1))
  expect(syncMock).not.toHaveBeenCalled()

  await act(async () => {
    회차끝내기()
  })

  await waitFor(() => {
    expect(syncMock).toHaveBeenCalledWith(
      ['o1', 'o2'],
      expect.any(Date),
      expect.any(Function),
      // 미리 세운 계획을 그대로 넘긴다. 안 넘기면 창이 원장을 두 번 읽는다.
      expect.objectContaining({ jobs: expect.any(Array) }),
    )
  })
  await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready'))
  expect(refreshMock).not.toHaveBeenCalled()
})

it('채우는 동안 filling 이다. 자식이 그 사이에 스켈레톤을 그린다', async () => {
  // 안 받은 지난 날이 있는 회차라야 모달 경로로 들어간다. 오늘 칸만 받는 회차는 조용하다.
  sizeMock.mockResolvedValue({ total: 105, hasPast: true })
  let 끝내기!: () => void
  syncMock.mockReturnValue(new Promise<void>((resolve) => { 끝내기 = resolve }))

  const view = await 그리기()

  await waitFor(() => {
    expect(view.getByTestId('probe')).toHaveTextContent('filling')
  })

  await act(async () => {
    끝내기()
  })

  expect(view.getByTestId('probe')).toHaveTextContent('ready')
})

// 당김은 지금 상태를 보겠다는 뜻이라 회차가 신선해도 받는다. 두 하위 화면의 당김이 이것만 부른다.
it('다시 부르면 신선해도 회차를 받고 창을 또 채운다', async () => {
  const view = await 그리기()
  await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready'))

  await act(async () => {
    fireEvent.press(view.getByTestId('reload'))
  })

  expect(refreshMock).toHaveBeenCalledTimes(1)
  expect(syncMock).toHaveBeenCalledTimes(2)
})

it('관리 캐릭터가 없으면 창을 안 채우고 바로 ready 다', async () => {
  trackedMock.mockResolvedValue([])

  const view = await 그리기()

  await waitFor(() => {
    expect(view.getByTestId('probe')).toHaveTextContent('ready')
  })
  expect(syncMock).not.toHaveBeenCalled()
})

// 창이 던져도 화면은 서야 한다. 못 채운 것은 다음 회차가 다시 온다.
it('창이 던져도 ready 로 끝난다', async () => {
  syncMock.mockRejectedValue(new Error('boom'))

  const view = await 그리기()

  await waitFor(() => {
    expect(view.getByTestId('probe')).toHaveTextContent('ready')
  })
})

// 소비자가 프로바이더 밖에 있으면 창이 없는 것이지 터질 일이 아니다.
it('프로바이더 밖에서는 idle 이다', async () => {
  const view = await render(<Probe />)

  expect(view.getByTestId('probe')).toHaveTextContent('idle')
})

// 사용자 보고 `가계부는 왜 로딩이 두번돼? 2가지가 한 프로그래스바에서 함께 진행돼야지`.
//
// 앞 갈래가 자기 칸을 먼저 열고 끝내면 바가 100% 를 찍고, 그 뒤에 창·히스토리가 자기 분모를
// 더해 바가 통째로 뒤로 간다. 한 회차가 두 번 로딩하는 것으로 보인다.
describe('한 회차는 한 바다', () => {
  it('회차를 받기 전에 창과 강화의 분모가 다 선다', async () => {
    planMock.mockResolvedValue({
      apiKey: 'key-1',
      jobs: [
        { ocid: 'o1', dateKey: '2026-09-01' },
        { ocid: 'o2', dateKey: '2026-09-01' },
      ],
    })
    sizeMock.mockResolvedValue({ total: 9, hasPast: false })
    // 회차가 도는 순간 잰다. 그때 이미 총합이 서 있어야 한다.
    let 분모 = -1
    refreshMock.mockImplementation(() => {
      분모 = useRefreshProgress.getState().total
      return Promise.resolve()
    })

    const view = await 그리기()
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready'))
    await act(async () => {
      fireEvent.press(view.getByTestId('reload-all'))
    })

    // 창 2 + 히스토리 9. 회차의 칸은 회차가 스스로 열어 여기 안 든다. 하나라도 늦게 서면 이 값이 작아진다.
    expect(분모).toBe(11)
  })

  // 앞 갈래가 끝나도 바가 100% 로 안 간다. 다른 갈래의 몫이 이미 분모에 들어 있어서다.
  it('앞 갈래가 끝나도 바가 안 찬다', async () => {
    planMock.mockResolvedValue({ apiKey: 'key-1', jobs: [{ ocid: 'o1', dateKey: '2026-09-01' }] })
    sizeMock.mockResolvedValue({ total: 9, hasPast: false })
    let 창이돌때 = { done: -1, total: -1 }
    syncMock.mockImplementation(() => {
      const { done, total } = useRefreshProgress.getState()
      창이돌때 = { done, total }
      return Promise.resolve()
    })

    const view = await 그리기()
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready'))
    await act(async () => {
      fireEvent.press(view.getByTestId('reload-all'))
    })

    expect(창이돌때.done).toBeLessThan(창이돌때.total)
  })
})

// 무엇을 받을지는 **화면이 고른다**. 어떻게 받을지는 층이 안다. 보스 수익은 강화 사용 내역을
// 안 그리므로 그 조각을 안 넣는다. 오늘 강화는 하루치라 어느 당김에나 든다.
describe('화면이 조각을 고른다', () => {
  it('보스 수익의 당김은 회차 · 창 · 오늘 강화다. 범위 강화는 안 받는다', async () => {
    const view = await 그리기()
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready'))
    collectMock.mockClear()
    todayMock.mockClear()

    await act(async () => {
      fireEvent.press(view.getByTestId('reload'))
    })

    expect(collectMock).not.toHaveBeenCalled()
    expect(todayMock).toHaveBeenCalledTimes(1)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    // 창을 빼면 가계부의 보스 결정석 줄이 빈다.
    expect(syncMock).toHaveBeenCalledTimes(2)
  })

  it('가계부의 당김은 범위 강화를 받고, 오늘은 그 범위에 들어 따로 안 받는다', async () => {
    const view = await 그리기()
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready'))
    collectMock.mockClear()
    todayMock.mockClear()

    await act(async () => {
      fireEvent.press(view.getByTestId('reload-all'))
    })

    expect(collectMock).toHaveBeenCalledTimes(1)
    expect(todayMock).not.toHaveBeenCalled()
  })
})

// 강화 사용 내역도 이 층이 소유한다. 창과 **함께** 돌아야 진행 바가 도는 중에 안 흔들린다.
describe('강화 사용 내역', () => {
  function RangeProbe(props: { from: string; to: string }): React.JSX.Element {
    const { requestDateRange } = useLedgerData()
    return (
      <Text testID="range" onPress={() => requestDateRange({ from: props.from, to: props.to })}>
        범위
      </Text>
    )
  }

  it('마운트에서 창과 함께 돈다', async () => {
    await 그리기()

    await waitFor(() => expect(collectMock).toHaveBeenCalledTimes(1))
    expect(syncMock).toHaveBeenCalledTimes(1)
  })

  // 화면이 자기 범위를 알려 주기를 기다리면 창이 먼저 분모를 잡고 뒤늦게 히스토리가 자기 몫을
  // 더해 바가 뒤로 간다. 그래서 층이 기본 범위를 안다.
  it('화면이 말하기 전에도 날짜를 안다', async () => {
    await 그리기()

    await waitFor(() => expect(collectMock).toHaveBeenCalled())
    expect((collectMock.mock.calls[0][0] as string[]).length).toBeGreaterThan(27)
  })

  it('범위가 바뀌면 새 회차가 돈다', async () => {
    const view = await render(
      <LedgerDataProvider>
        <RangeProbe from="2026-01-01" to="2026-01-03" />
      </LedgerDataProvider>,
    )
    await waitFor(() => expect(collectMock).toHaveBeenCalled())
    collectMock.mockClear()

    await act(async () => {
      fireEvent.press(view.getByTestId('range'))
    })

    await waitFor(() => expect(collectMock).toHaveBeenCalledTimes(1))
    expect(collectMock.mock.calls[0][0]).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })

  // 화면이 다시 그릴 때마다 부른다. 같은 값이면 아무 일도 안 나야 한다.
  it('같은 범위를 다시 말하면 안 돈다', async () => {
    const view = await render(
      <LedgerDataProvider>
        <RangeProbe from="2026-01-01" to="2026-01-03" />
      </LedgerDataProvider>,
    )
    await waitFor(() => expect(collectMock).toHaveBeenCalled())

    await act(async () => {
      fireEvent.press(view.getByTestId('range'))
    })
    collectMock.mockClear()
    await act(async () => {
      fireEvent.press(view.getByTestId('range'))
    })

    expect(collectMock).not.toHaveBeenCalled()
  })
})

// 회차가 도는 동안 화면은 아무 값도 안 그린다. 한 번도 안 받아 본 범위면 그것이
// 몇 초라 빈 격자가 서 있으므로, 그 자리를 층의 모달이 든다(사용자 지정).
describe('기록이 없는 기간으로 이동', () => {
  function MoveProbe(): React.JSX.Element {
    const { status, knownLong, requestDateRange } = useLedgerData()
    return (
      <>
        <Text testID="probe">{`${status}:${knownLong ? '잼' : '안잼'}`}</Text>
        <Text
          testID="move"
          onPress={() => requestDateRange({ from: '2026-01-01', to: '2026-01-03' })}
        >
          이동
        </Text>
        <Text
          testID="move2"
          onPress={() => requestDateRange({ from: '2026-02-01', to: '2026-02-03' })}
        >
          또 이동
        </Text>
      </>
    )
  }

  /** 마운트 회차를 끝낸 뒤, **끝나지 않는 회차**로 기간을 옮긴다. 도는 중을 볼 수 있게. */
  async function 이동중() {
    const view = await render(
      <LedgerDataProvider>
        <MoveProbe />
      </LedgerDataProvider>,
    )
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready:안잼'))

    let 끝내기 = (): void => undefined
    collectMock.mockImplementation(() => new Promise<void>((done) => (끝내기 = () => done())))
    await act(async () => {
      fireEvent.press(view.getByTestId('move'))
    })
    return { view, 끝내기: () => 끝내기() }
  }

  it('안 받은 지난 날이 있으면 모달을 띄운다', async () => {
    sizeMock.mockResolvedValue({ total: 105, hasPast: true })

    const { view, 끝내기 } = await 이동중()

    // 시작 전에 쟀으므로 모달이 400ms 를 안 끈다.
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('filling:잼'))
    await act(async () => {
      끝내기()
    })
    expect(view.getByTestId('probe')).toHaveTextContent('ready:안잼')
  })

  // 이미 받아 둔 달은 조회가 0건이라 회차가 몇십 밀리초에 끝난다. 그 위에 모달을 세우면
  // 화면이 한 번 번쩍일 뿐이다.
  it('받아 둔 범위면 안 띄운다', async () => {
    sizeMock.mockResolvedValue({ total: 3, hasPast: false })

    const { view } = await 이동중()

    expect(view.getByTestId('probe')).toHaveTextContent('ready:안잼')
  })

  // 안 뜨는 모달보다 안 걷히는 모달이 나쁘다.
  it('원장을 못 읽으면 안 띄운다', async () => {
    sizeMock.mockRejectedValue(new Error('boom'))

    const { view } = await 이동중()

    expect(view.getByTestId('probe')).toHaveTextContent('ready:안잼')
  })

  // 문턱을 걷으니 모달이 분모보다 먼저 뜨게 됐다. 카드가 짧게 떴다가 바가 붙으며 자란다
  // (실기기 2026-09-07). 미리 잰 분모를 넘겨 첫 순간부터 바가 서게 한다.
  it('미리 잰 분모로 바가 첫 순간부터 선다', async () => {
    sizeMock.mockResolvedValue({ total: 105, hasPast: true })

    const { view, 끝내기 } = await 이동중()

    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('filling:잼'))
    // 히스토리 105 + 창 1. **수집기 둘의 총합**이 첫 순간에 선다. 각자 자기 차례에 등록하면
    // 앞 수집기가 100% 를 찍은 뒤라 바가 뒤로 간다.
    expect(useRefreshProgress.getState().total).toBe(106)
    await act(async () => {
      끝내기()
    })
  })

  // 기간을 연타하면 회차가 겹친다. 앞 회차가 끝나며 뒤 회차의 모달을 꺼 버리면 안 된다.
  it('회차가 겹치면 뒤 회차가 끝날 때까지 선다', async () => {
    sizeMock.mockResolvedValue({ total: 105, hasPast: true })

    const { view, 끝내기: 앞회차끝내기 } = await 이동중()
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('filling:잼'))

    let 뒤회차끝내기 = (): void => undefined
    collectMock.mockImplementation(() => new Promise<void>((done) => (뒤회차끝내기 = () => done())))
    await act(async () => {
      fireEvent.press(view.getByTestId('move2'))
    })

    await act(async () => {
      앞회차끝내기()
    })
    expect(view.getByTestId('probe')).toHaveTextContent('filling:잼')

    await act(async () => {
      뒤회차끝내기()
    })
    expect(view.getByTestId('probe')).toHaveTextContent('ready:안잼')
  })
})

// 탭을 떠나면 층이 층 스택에서 빠진다. 그래서 **재진입이 곧 마운트**이고, 마운트 회차가 모달을
// 세우면 방문할 때마다 스피너가 돈다(사용자 보고 2026-09-23).
//
// 기간 이동이 쓰던 판정을 마운트도 쓴다. 오늘 칸만 받는 회차는 모달도 없고 화면도 안 막는다.
describe('탭 재진입', () => {
  function EntryProbe(): React.JSX.Element {
    const { status, knownLong, collecting } = useLedgerData()
    return (
      <Text testID="probe">
        {`${status}:${knownLong ? '잼' : '안잼'}:${collecting ? '막음' : '안막음'}`}
      </Text>
    )
  }

  const 진입 = async () =>
    render(
      <LedgerDataProvider>
        <EntryProbe />
      </LedgerDataProvider>,
    )

  /** 회차를 도는 중에 붙잡는다. 끝나 버리면 어느 길로 갔든 `ready` 라 구별이 안 된다. */
  function 회차를_붙잡는다(): void {
    collectMock.mockImplementation(() => new Promise<void>(() => undefined))
  }

  it('오늘 칸만 받는 회차는 모달도 없고 화면도 안 막는다', async () => {
    sizeMock.mockResolvedValue({ total: 4, hasPast: false })
    회차를_붙잡는다()

    const view = await 진입()

    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('idle:안잼:안막음'))
  })

  it('안 받은 지난 날이 있으면 모달을 띄우고 화면을 막는다', async () => {
    sizeMock.mockResolvedValue({ total: 105, hasPast: true })
    회차를_붙잡는다()

    const view = await 진입()

    // 이미 쟀으므로 400ms 문턱을 걷는다(`잼`). 기간 이동이 그러는 것과 같은 이유다.
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('filling:잼:막음'))
  })

  // 안 뜨는 모달보다 안 걷히는 모달이 나쁘다. 못 막는 화면보다 안 풀리는 화면이 나쁘다.
  it('원장을 못 읽으면 안 띄우고 안 막는다', async () => {
    sizeMock.mockRejectedValue(new Error('db'))
    회차를_붙잡는다()

    const view = await 진입()

    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('idle:안잼:안막음'))
  })

  // 잰 값을 회차에 넘겨야 한다. 안 넘기면 회차가 같은 원장을 한 번 더 읽는다.
  it('잰 분모를 회차에 넘긴다. 원장을 두 번 안 읽는다', async () => {
    sizeMock.mockResolvedValue({ total: 4, hasPast: false })

    await 진입()

    await waitFor(() => expect(collectMock).toHaveBeenCalled())
    expect(sizeMock).toHaveBeenCalledTimes(1)
  })
})
