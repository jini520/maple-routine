jest.mock('../../../server/settlement', () => ({
  __esModule: true,
  fetchSettlement: jest.fn(),
}))

import { fetchSettlement } from '../../../server/settlement'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { Settlement } from '../../../types/settlement'
import { useSettlementStore } from '../store'

const fetchOne = jest.mocked(fetchSettlement)

const 결산중: Settlement = { settling: true, startedAt: '2026-09-16T15:30:00.000Z' }
const 어젯밤: Settlement = { settling: true, startedAt: '2026-09-15T15:10:00.000Z' }
const 아님: Settlement = { settling: false, startedAt: null }

beforeEach(async () => {
  const prefs = installFakePreferences()
  await prefs.remove('dismissedSettlement')
  jest.clearAllMocks()
  fetchOne.mockResolvedValue(아님)
  useSettlementStore.setState({ settling: false, startedAt: null, dismissedAt: null })
})

describe('refresh', () => {
  it('결산 중이면 줄이 선다', async () => {
    fetchOne.mockResolvedValue(결산중)

    await useSettlementStore.getState().refresh()

    expect(useSettlementStore.getState().settling).toBe(true)
    expect(useSettlementStore.getState().startedAt).toBe(결산중.startedAt)
  })

  it('결산이 끝나면 줄이 내려간다', async () => {
    fetchOne.mockResolvedValue(결산중)
    await useSettlementStore.getState().refresh()

    fetchOne.mockResolvedValue(아님)
    await useSettlementStore.getState().refresh()

    expect(useSettlementStore.getState().settling).toBe(false)
  })

  // 못 받은 것과 **결산 아님** 은 다른 사실이지만 화면이 하는 일은 같다. 안 세운다.
  it('서버를 못 받으면 안 세운다', async () => {
    fetchOne.mockResolvedValue(null)

    await useSettlementStore.getState().refresh()

    expect(useSettlementStore.getState().settling).toBe(false)
  })

  it('서버를 못 받아도 이미 선 줄을 남기지 않는다', async () => {
    fetchOne.mockResolvedValue(결산중)
    await useSettlementStore.getState().refresh()

    fetchOne.mockResolvedValue(null)
    await useSettlementStore.getState().refresh()

    expect(useSettlementStore.getState().settling).toBe(false)
  })

  // 갱신 자리가 넷이라 한 회차에 겹쳐 불린다. 그때마다 서버로 나가면 안 된다.
  it('겹쳐 불러도 서버는 한 번만 부른다', async () => {
    let settle: (value: Settlement) => void = () => undefined
    fetchOne.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )

    const first = useSettlementStore.getState().refresh()
    const second = useSettlementStore.getState().refresh()
    settle(결산중)
    await Promise.all([first, second])

    expect(fetchOne).toHaveBeenCalledTimes(1)
    expect(useSettlementStore.getState().settling).toBe(true)
  })
})

describe('닫기', () => {
  it('닫으면 그 결산 동안 안 선다', async () => {
    fetchOne.mockResolvedValue(결산중)
    await useSettlementStore.getState().refresh()

    await useSettlementStore.getState().dismiss()

    expect(useSettlementStore.getState().settling).toBe(true)
    expect(useSettlementStore.getState().visible).toBe(false)
  })

  // 열쇠가 시작 시각이라, 결산이 끝나는 순간 앱이 꺼져 있어도 다음 밤에 다시 선다.
  it('다음 밤 결산은 시작 시각이 달라 다시 선다', async () => {
    fetchOne.mockResolvedValue(어젯밤)
    await useSettlementStore.getState().refresh()
    await useSettlementStore.getState().dismiss()

    fetchOne.mockResolvedValue(결산중)
    await useSettlementStore.getState().refresh()

    expect(useSettlementStore.getState().visible).toBe(true)
  })

  it('앱을 다시 켜도 닫은 것을 기억한다', async () => {
    fetchOne.mockResolvedValue(결산중)
    await useSettlementStore.getState().refresh()
    await useSettlementStore.getState().dismiss()

    useSettlementStore.setState({ settling: false, startedAt: null, dismissedAt: null })
    await useSettlementStore.getState().refresh()

    expect(useSettlementStore.getState().visible).toBe(false)
  })

  it('결산 중이 아니면 안 선다', async () => {
    await useSettlementStore.getState().refresh()

    expect(useSettlementStore.getState().visible).toBe(false)
  })
})
