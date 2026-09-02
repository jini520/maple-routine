import { getTrackedCharacterOcids } from '../../../storage/character-selection'
import { getTrackingMode, setTrackingMode } from '../../../storage/tracking-mode'
import { seedManualTrackedContent } from '../seed'
import { useTrackingModeStore } from '../store'

jest.mock('../../../storage/tracking-mode', () => ({
  getTrackingMode: jest.fn(),
  setTrackingMode: jest.fn(),
}))

jest.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: jest.fn(),
}))

jest.mock('../seed', () => ({
  seedManualTrackedContent: jest.fn(),
}))

beforeEach(() => {
  jest.mocked(getTrackingMode).mockReset()
  jest.mocked(setTrackingMode).mockReset()
  jest.mocked(setTrackingMode).mockResolvedValue(undefined)
  jest.mocked(getTrackedCharacterOcids).mockReset()
  jest.mocked(getTrackedCharacterOcids).mockResolvedValue(null)
  jest.mocked(seedManualTrackedContent).mockReset()
  jest.mocked(seedManualTrackedContent).mockResolvedValue(undefined)
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('초기 상태', () => {
  it('mode는 auto다', () => {
    expect(useTrackingModeStore.getState().mode).toBe('auto')
  })
})

describe('restoreFromStorage', () => {
  it('저장된 값이 manual이면 mode를 manual로 갱신한다', async () => {
    jest.mocked(getTrackingMode).mockResolvedValue('manual')

    await useTrackingModeStore.getState().restoreFromStorage()

    expect(useTrackingModeStore.getState().mode).toBe('manual')
  })

  it('저장된 값이 없으면(storage가 기본값 auto 반환) mode는 auto다', async () => {
    jest.mocked(getTrackingMode).mockResolvedValue('auto')

    await useTrackingModeStore.getState().restoreFromStorage()

    expect(useTrackingModeStore.getState().mode).toBe('auto')
  })
})

describe('setMode', () => {
  it('manual로 설정하면 setTrackingMode를 호출하고 상태를 manual로 갱신한다', async () => {
    await useTrackingModeStore.getState().setMode('manual')

    expect(setTrackingMode).toHaveBeenCalledWith('manual')
    expect(useTrackingModeStore.getState().mode).toBe('manual')
  })

  it('manual에서 auto로 되돌리면 setTrackingMode를 호출하고 상태를 auto로 갱신한다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    await useTrackingModeStore.getState().setMode('auto')

    expect(setTrackingMode).toHaveBeenCalledWith('auto')
    expect(useTrackingModeStore.getState().mode).toBe('auto')
  })
})

describe('setMode — 시드 트리거 (a): auto → manual 전환 (ADR-035 결정 14)', () => {
  // ADR-147 정정 42: 캐릭터마다 부르면 그 호출들이 단일 비행에 서로 합류해 전원이 첫 캐릭터의
  // 스케줄로 시드된다. 목록을 통째로 넘겨 회차를 하나로 만드는 것이 계약이다.
  it('auto에서 manual로 전환하면 추적 중인 ocid 목록을 한 번에 넘겨 시드한다', async () => {
    jest.mocked(getTrackedCharacterOcids).mockResolvedValue(['ocid-a', 'ocid-b', 'ocid-c'])

    await useTrackingModeStore.getState().setMode('manual')

    expect(seedManualTrackedContent).toHaveBeenCalledTimes(1)
    expect(seedManualTrackedContent).toHaveBeenCalledWith(['ocid-a', 'ocid-b', 'ocid-c'])
  })

  it('추적 목록이 아직 없으면(null) 빈 목록을 넘긴다 — 시드가 할 일이 없다', async () => {
    await useTrackingModeStore.getState().setMode('manual')

    expect(seedManualTrackedContent).toHaveBeenCalledWith([])
    expect(useTrackingModeStore.getState().mode).toBe('manual')
  })

  it('이미 manual인 상태에서 다시 manual을 선택하면 시드하지 않는다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    await useTrackingModeStore.getState().setMode('manual')

    expect(seedManualTrackedContent).not.toHaveBeenCalled()
  })

  it('manual에서 auto로 전환하면 시드하지 않는다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    await useTrackingModeStore.getState().setMode('auto')

    expect(seedManualTrackedContent).not.toHaveBeenCalled()
    expect(getTrackedCharacterOcids).not.toHaveBeenCalled()
  })
})
