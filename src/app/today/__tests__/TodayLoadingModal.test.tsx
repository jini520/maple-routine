// 캐릭터 설정을 마치고 처음 들어오면 캐시가 비어 있어 위젯 격자가 빈 채로 선다. 그 사이
// 관리 캐릭터 수만큼 조회가 나가는데 표시가 제목 옆 글자뿐이라 **멈춘 것처럼 보였다**(사용자 보고).
import { act, waitFor } from '@testing-library/react-native'

const mockStore = {
  status: 'loading' as 'idle' | 'loading' | 'loaded' | 'error',
  characters: [] as unknown[],
  trackedOcids: ['o1', 'o2'] as string[] | null,
}
jest.mock('../../../features/content-scheduler/store', () => ({
  useContentSchedulerStore: () => mockStore,
}))

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useRefreshProgress } from '../../../features/refresh/progress'
import { TodayLoadingModal } from '../TodayLoadingModal'

/** 문턱을 넘겨 세운다. 문턱 자체는 아래 별도 케이스가 본다. */
async function 문턱넘기기(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(500)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  useRefreshProgress.getState().resetForTests()
  mockStore.status = 'loading'
  mockStore.characters = []
  mockStore.trackedOcids = ['o1', 'o2']
})

afterEach(() => {
  jest.useRealTimers()
})

it('그릴 것이 없고 도는 중이면 뜬다', async () => {
  const view = await renderOverlay(<TodayLoadingModal />)

  await 문턱넘기기()

  await waitFor(() => expect(view.getByTestId('loading-modal')).toBeTruthy())
  expect(view.getByText('체크리스트를 불러오고 있어요')).toBeTruthy()
})

// 캐시가 있으면 캐시 우선 표시가 이미 무언가를 그린다. 그 위에 모달을 세우면 읽을 수 있는
// 화면을 덮는 셈이 된다.
it('캐시로 그릴 것이 있으면 안 뜬다', async () => {
  mockStore.characters = [{ ocid: 'o1' }]

  const view = await renderOverlay(<TodayLoadingModal />)
  await 문턱넘기기()

  expect(view.queryByTestId('loading-modal')).toBeNull()
})

it('회차가 끝나면 걷힌다', async () => {
  mockStore.status = 'loaded'

  const view = await renderOverlay(<TodayLoadingModal />)
  await 문턱넘기기()

  expect(view.queryByTestId('loading-modal')).toBeNull()
})

// `null` 은 0명이 아니라 **저장소를 아직 안 읽었다** 다. 모르는 사이에 세우면 캐릭터가 없는
// 계정에서도 뜬다.
it('추적 목록을 아직 안 읽었으면 안 뜬다', async () => {
  mockStore.trackedOcids = null

  const view = await renderOverlay(<TodayLoadingModal />)
  await 문턱넘기기()

  expect(view.queryByTestId('loading-modal')).toBeNull()
})

it('추적 캐릭터가 없으면 안 뜬다', async () => {
  mockStore.trackedOcids = []

  const view = await renderOverlay(<TodayLoadingModal />)
  await 문턱넘기기()

  expect(view.queryByTestId('loading-modal')).toBeNull()
})

// 캐시가 찬 회차는 몇백 밀리초에 끝난다. 그 사이 세우면 화면이 한 번 번쩍일 뿐이고 사용자가
// 읽을 시간도 없다.
it('짧은 회차에는 안 뜬다', async () => {
  const view = await renderOverlay(<TodayLoadingModal />)

  await act(async () => {
    jest.advanceTimersByTime(300)
  })

  expect(view.queryByTestId('loading-modal')).toBeNull()
})

// 십수 초를 견디게 하는 것은 남은 양이 보이는 것이다. 분모는 `syncSchedules` 가 낸다.
it('진행률을 그대로 그린다', async () => {
  const 끝내기 = useRefreshProgress.getState().beginRound()
  const slot = useRefreshProgress.getState().start(12)
  useRefreshProgress.getState().advance(slot, 5)

  const view = await renderOverlay(<TodayLoadingModal />)
  await 문턱넘기기()

  expect(view.getByText('5 / 12')).toBeTruthy()
  await act(async () => {
    끝내기()
  })
})
