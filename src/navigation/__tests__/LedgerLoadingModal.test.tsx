// 불러오는 중은 **층이 말한다**. 하위 화면은 자기 스피너를 갖지 않는다.
import { act, waitFor } from '@testing-library/react-native'

const mockLedger = { status: 'ready' as 'idle' | 'filling' | 'ready', revision: 1, reload: jest.fn() }
jest.mock('../../features/ledger/useLedgerData', () => ({
  useLedgerData: () => mockLedger,
}))

import { renderOverlay } from '../../components/__tests__/render-atom'
import { useLedgerProgress } from '../../features/ledger/progress'
import { LedgerLoadingModal } from '../LedgerLoadingModal'

beforeEach(() => {
  jest.useFakeTimers()
  mockLedger.status = 'ready'
  useLedgerProgress.getState().reset()
})

afterEach(() => {
  jest.useRealTimers()
})

it('다 불러왔으면 아무것도 안 그린다', async () => {
  const view = await renderOverlay(<LedgerLoadingModal />)

  expect(view.queryByTestId('loading-modal')).toBeNull()
})

// 원장이 이미 찬 회차는 조회가 0건이라 몇백 밀리초에 끝난다. 그 사이 세우면 화면이 한 번
// 번쩍일 뿐이고 사용자가 읽을 시간도 없다.
it('짧은 회차에는 안 뜬다', async () => {
  mockLedger.status = 'filling'
  const view = await renderOverlay(<LedgerLoadingModal />)

  await act(async () => {
    jest.advanceTimersByTime(300)
  })

  expect(view.queryByTestId('loading-modal')).toBeNull()
})

it('오래 걸리는 회차에는 뜬다', async () => {
  mockLedger.status = 'filling'
  const view = await renderOverlay(<LedgerLoadingModal />)

  await act(async () => {
    jest.advanceTimersByTime(500)
  })

  await waitFor(() => {
    expect(view.getByTestId('loading-modal')).toBeTruthy()
  })
  expect(view.getByText('보스 수익을 불러오고 있어요')).toBeTruthy()
})

// **십수 초를 견디게 하는 것은 남은 양이 보이는 것**이다.
describe('진행', () => {
  async function 오래끄는화면() {
    mockLedger.status = 'filling'
    const view = await renderOverlay(<LedgerLoadingModal />)
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    return view
  }

  it('창이 알린 수를 그대로 그린다', async () => {
    const slot = useLedgerProgress.getState().start(84)
    useLedgerProgress.getState().advance(slot, 32)

    const view = await 오래끄는화면()

    expect(view.getByText('32 / 84')).toBeTruthy()
  })

  // 분모가 아직 안 정해진 순간(원장 읽는 몇십 밀리초)에는 바도 이유도 안 그린다.
  it('분모가 없으면 바를 안 그린다', async () => {
    const view = await 오래끄는화면()

    expect(view.queryByTestId('loading-modal-progress')).toBeNull()
    expect(view.getByText('보스 수익을 불러오고 있어요')).toBeTruthy()
  })
})
