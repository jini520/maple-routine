// 수익·지출 층이 **데이터를 소유한다**. 자식(보스 수익·가계부)은 상태를 구독만 한다.
//
// 자식마다 조립하던 때 난 결함 셋이 전부 `누가 부르나·언제 끝나나·누가 결과를 받나` 에서 났다.
// 소유자를 하나로 두면 그 물음이 사라진다.
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'

jest.mock('../../schedule-window/sync', () => ({ syncScheduleWindow: jest.fn() }))
jest.mock('../../schedule-window/window', () => ({ planScheduleWindow: jest.fn() }))
jest.mock('../../boss-profit/store', () => ({
  useBossProfitStore: { getState: () => ({ refresh: mockRefresh }) },
}))
const mockRefresh = jest.fn()
jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
jest.mock('../../enhancement-history/collect', () => ({
  collectEnhancementHistory: jest.fn(),
  measureEnhancementHistory: jest.fn(),
}))

import { useRefreshProgress } from '../../refresh/progress'
import { LedgerDataProvider, useLedgerData } from '../useLedgerData'

const { syncScheduleWindow: syncMock } = jest.requireMock('../../schedule-window/sync') as Record<string, jest.Mock>
const { planScheduleWindow: planMock } = jest.requireMock('../../schedule-window/window') as Record<string, jest.Mock>
const { getTrackedCharacterOcids: trackedMock } = jest.requireMock(
  '../../../storage/character-selection',
) as Record<string, jest.Mock>
const { collectEnhancementHistory: collectMock, measureEnhancementHistory: sizeMock } = jest.requireMock(
  '../../enhancement-history/collect',
) as Record<string, jest.Mock>

function Probe(): React.JSX.Element {
  const { status, revision, reload } = useLedgerData()
  return (
    <>
      <Text testID="probe">{`${status}:${revision}`}</Text>
      {/* 보스 수익의 당김. 강화를 안 받는다. */}
      <Text testID="reload" onPress={() => void reload(['live', 'window'])}>
        다시
      </Text>
      {/* 가계부의 당김. 강화까지 받는다. */}
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
  // 계획은 실행보다 먼저 선다. 그래야 수집기 셋의 분모 총합이 첫 순간부터 잡힌다.
  planMock.mockReset().mockResolvedValue({ apiKey: 'key-1', jobs: [{ ocid: 'o1', dateKey: '2026-09-01' }] })
  mockRefresh.mockReset().mockResolvedValue(undefined)
  trackedMock.mockReset().mockResolvedValue(['o1', 'o2'])
  collectMock.mockReset().mockResolvedValue(undefined)
  sizeMock.mockReset().mockResolvedValue({ total: 0, hasPast: false })
})

// 마운트는 **과거(창)만** 받는다. 오늘은 보스 수익 스토어의 진입 경로가 10분 TTL 로 이미
// 맡고 있어, 여기서 또 부르면 진입마다 조회가 두 번 나간다.
it('부모가 마운트되면 창만 채운다. 라이브는 안 부른다', async () => {
  const view = await 그리기()

  await waitFor(() => {
    expect(syncMock).toHaveBeenCalledWith(
      ['o1', 'o2'],
      expect.any(Date),
      expect.any(Function),
      // 미리 세운 계획을 그대로 넘긴다. 안 넘기면 창이 원장을 두 번 읽는다.
      expect.objectContaining({ jobs: expect.any(Array) }),
    )
  })
  await waitFor(() => {
    expect(view.getByTestId('probe')).toHaveTextContent('ready:1')
  })
  expect(mockRefresh).not.toHaveBeenCalled()
})

it('채우는 동안 filling 이다. 자식이 그 사이에 스피너를 그린다', async () => {
  let 끝내기!: () => void
  syncMock.mockReturnValue(new Promise<void>((resolve) => { 끝내기 = resolve }))

  const view = await 그리기()

  await waitFor(() => {
    expect(view.getByTestId('probe')).toHaveTextContent('filling:0')
  })

  await act(async () => {
    끝내기()
  })

  expect(view.getByTestId('probe')).toHaveTextContent('ready:1')
})

// 자식은 이 수가 오를 때 다시 읽는다. 창이 뒤늦게 채운 것을 받는 유일한 계기다.
// 당김은 **오늘과 과거를 함께** 받는다. 두 하위 화면의 당김이 이것만 부른다.
it('다시 부르면 라이브까지 받고 revision 이 또 오른다', async () => {
  const view = await 그리기()
  await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready:1'))

  await act(async () => {
    fireEvent.press(view.getByTestId('reload'))
  })

  expect(view.getByTestId('probe')).toHaveTextContent('ready:2')
  expect(syncMock).toHaveBeenCalledTimes(2)
  expect(mockRefresh).toHaveBeenCalledWith(['o1', 'o2'], { inPlace: true }, expect.any(Function))
})

it('관리 캐릭터가 없으면 안 부르고 바로 ready 다', async () => {
  trackedMock.mockResolvedValue([])

  const view = await 그리기()

  await waitFor(() => {
    expect(view.getByTestId('probe')).toHaveTextContent('ready:1')
  })
  expect(syncMock).not.toHaveBeenCalled()
})

// 창이 던져도 화면은 서야 한다. 못 채운 것은 다음 회차가 다시 온다.
it('창이 던져도 ready 로 끝난다', async () => {
  syncMock.mockRejectedValue(new Error('boom'))

  const view = await 그리기()

  await waitFor(() => {
    expect(view.getByTestId('probe')).toHaveTextContent('ready:1')
  })
})

// 소비자가 프로바이더 밖에 있으면 창이 없는 것이지 터질 일이 아니다.
it('프로바이더 밖에서는 idle 이다', async () => {
  const view = await render(<Probe />)

  expect(view.getByTestId('probe')).toHaveTextContent('idle:0')
})

// 사용자 보고 `가계부는 왜 로딩이 두번돼? 2가지가 한 프로그래스바에서 함께 진행돼야지`.
//
// 라이브가 자기 칸을 먼저 열고 끝내면 바가 100% 를 찍고, 그 뒤에 창·히스토리가 자기 분모를
// 더해 바가 통째로 뒤로 간다. 한 회차가 두 번 로딩하는 것으로 보인다.
describe('한 회차는 한 바다', () => {
  it('실행 전에 세 수집기의 분모가 다 선다', async () => {
    planMock.mockResolvedValue({
      apiKey: 'key-1',
      jobs: [
        { ocid: 'o1', dateKey: '2026-09-01' },
        { ocid: 'o2', dateKey: '2026-09-01' },
      ],
    })
    sizeMock.mockResolvedValue({ total: 9, hasPast: false })
    // 라이브가 도는 중에 잰다. 그 순간 이미 총합이 서 있어야 한다.
    let 분모 = -1
    mockRefresh.mockImplementation(() => {
      분모 = useRefreshProgress.getState().total
      return Promise.resolve()
    })

    const view = await 그리기()
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready:1'))
    await act(async () => {
      fireEvent.press(view.getByTestId('reload-all'))
    })

    // 라이브 2(추적 캐릭터) + 창 2 + 히스토리 9. 하나라도 늦게 서면 이 값이 작아진다.
    expect(분모).toBe(13)
  })

  // 라이브가 끝나도 바가 100% 로 안 간다. 다른 갈래의 몫이 이미 분모에 들어 있어서다.
  it('앞 갈래가 끝나도 바가 안 찬다', async () => {
    planMock.mockResolvedValue({ apiKey: 'key-1', jobs: [{ ocid: 'o1', dateKey: '2026-09-01' }] })
    sizeMock.mockResolvedValue({ total: 9, hasPast: false })
    let 라이브끝난뒤 = { done: -1, total: -1 }
    syncMock.mockImplementation(() => {
      const { done, total } = useRefreshProgress.getState()
      라이브끝난뒤 = { done, total }
      return Promise.resolve()
    })

    const view = await 그리기()
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready:1'))
    await act(async () => {
      fireEvent.press(view.getByTestId('reload-all'))
    })

    expect(라이브끝난뒤.done).toBeLessThan(라이브끝난뒤.total)
  })
})

// 무엇을 받을지는 **화면이 고른다**. 어떻게 받을지는 층이 안다. 보스 수익은 강화 사용 내역을
// 안 그리므로 그 조각을 안 넣는다.
describe('화면이 조각을 고른다', () => {
  it('보스 수익의 당김은 강화를 안 받는다', async () => {
    const view = await 그리기()
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready:1'))
    collectMock.mockClear()

    await act(async () => {
      fireEvent.press(view.getByTestId('reload'))
    })

    expect(collectMock).not.toHaveBeenCalled()
    // 나머지 둘은 받는다. 창을 빼면 가계부의 보스 결정석 줄이 빈다.
    expect(mockRefresh).toHaveBeenCalledWith(['o1', 'o2'], { inPlace: true }, expect.any(Function))
    expect(syncMock).toHaveBeenCalledTimes(2)
  })

  it('가계부의 당김은 강화까지 받는다', async () => {
    const view = await 그리기()
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready:1'))
    collectMock.mockClear()

    await act(async () => {
      fireEvent.press(view.getByTestId('reload-all'))
    })

    expect(collectMock).toHaveBeenCalledTimes(1)
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

// 회차가 도는 동안 화면이 읽으면 그 시점의 DB 가 아직 자라는 중이라 한 셀의 값이 종류가
// 도착할 때마다 커진다. 다 합산될 때까지 안 그린다(사용자 지정).
describe('회차 도중에는 안 알린다', () => {
  it('회차 표는 끝에 한 번만 오른다', async () => {
    let resolve = (): void => undefined
    collectMock.mockImplementation(() => new Promise<void>((done) => (resolve = () => done())))
    const view = await 그리기()

    await act(async () => {
      await Promise.resolve()
    })
    expect(view.getByTestId('probe')).toHaveTextContent('filling:0')

    await act(async () => {
      resolve()
    })
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready:1'))
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
