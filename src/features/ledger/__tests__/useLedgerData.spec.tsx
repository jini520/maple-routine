// 수익·지출 층이 **데이터를 소유한다**. 자식(보스 수익·가계부)은 상태를 구독만 한다.
//
// 자식마다 조립하던 때 난 결함 셋이 전부 `누가 부르나·언제 끝나나·누가 결과를 받나` 에서 났다.
// 소유자를 하나로 두면 그 물음이 사라진다.
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'

jest.mock('../../schedule-window/sync', () => ({ syncScheduleWindow: jest.fn() }))
jest.mock('../../boss-profit/store', () => ({
  useBossProfitStore: { getState: () => ({ refresh: mockRefresh }) },
}))
const mockRefresh = jest.fn()
jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
jest.mock('../../enhancement-history/collect', () => ({ collectEnhancementHistory: jest.fn() }))

import { LedgerDataProvider, useLedgerData } from '../useLedgerData'

const { syncScheduleWindow: syncMock } = jest.requireMock('../../schedule-window/sync') as Record<string, jest.Mock>
const { getTrackedCharacterOcids: trackedMock } = jest.requireMock(
  '../../../storage/character-selection',
) as Record<string, jest.Mock>
const { collectEnhancementHistory: collectMock } = jest.requireMock(
  '../../enhancement-history/collect',
) as Record<string, jest.Mock>

function Probe(): React.JSX.Element {
  const { status, revision, reload } = useLedgerData()
  return (
    <>
      <Text testID="probe">{`${status}:${revision}`}</Text>
      <Text testID="reload" onPress={() => void reload()}>
        다시
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
  syncMock.mockReset().mockResolvedValue(undefined)
  mockRefresh.mockReset().mockResolvedValue(undefined)
  trackedMock.mockReset().mockResolvedValue(['o1', 'o2'])
  collectMock.mockReset().mockResolvedValue(undefined)
})

// 마운트는 **과거(창)만** 받는다. 오늘은 보스 수익 스토어의 진입 경로가 10분 TTL 로 이미
// 맡고 있어, 여기서 또 부르면 진입마다 조회가 두 번 나간다.
it('부모가 마운트되면 창만 채운다. 라이브는 안 부른다', async () => {
  const view = await 그리기()

  await waitFor(() => {
    expect(syncMock).toHaveBeenCalledWith(['o1', 'o2'], expect.any(Date), expect.any(Function))
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
  expect(mockRefresh).toHaveBeenCalledWith(['o1', 'o2'], { inPlace: true })
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

// 끝에서 한 번만 올리면 지난 달로 옮긴 사용자가 105콜이 다 끝날 때까지 빈 달력을 본다.
describe('들어오는 대로 반영한다', () => {
  function RangeProbe(props: { from: string; to: string }): React.JSX.Element {
    const { revision, requestDateRange } = useLedgerData()
    return (
      <>
        <Text testID="rev">{String(revision)}</Text>
        <Text testID="range" onPress={() => requestDateRange({ from: props.from, to: props.to })}>
          범위
        </Text>
      </>
    )
  }

  it('회차 도중에도 회차 표가 오른다', async () => {
    // 수집기가 한 칸을 끝낼 때마다 부르는 통로. 흘린 시각이 멀면 그때마다 오른다.
    collectMock.mockImplementation(
      async (_days: string[], _now: Date, _progress: unknown, landed: () => void) => {
        landed()
        await new Promise((resolve) => setTimeout(resolve, 700))
        landed()
      },
    )
    const view = await 그리기()

    // 도중 둘 + 끝 하나. 끝에서만 올렸다면 `ready:1` 이다.
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready:3'))
  })

  // 달력을 보려고 옮긴 것인데 그 위를 모달이 덮으면 아무것도 못 본다.
  it('기간을 옮겨도 모달을 안 띄운다', async () => {
    const view = await render(
      <LedgerDataProvider>
        <RangeProbe from="2026-01-01" to="2026-01-03" />
        <Probe />
      </LedgerDataProvider>,
    )
    await waitFor(() => expect(view.getByTestId('probe')).toHaveTextContent('ready:1'))

    let resolve = (): void => undefined
    collectMock.mockImplementation(() => new Promise<void>((done) => (resolve = () => done())))
    await act(async () => {
      fireEvent.press(view.getByTestId('range'))
    })

    expect(view.getByTestId('probe')).toHaveTextContent('ready:1')
    await act(async () => {
      resolve()
    })
  })
})
