import { getTrackedCharacterOcids } from '../../../storage/character-selection'
import { setTrackingMode } from '../../../storage/tracking-mode'
import { seedManualTrackedContentOnModeSwitch } from '../seed'
import { useTrackingModeStore } from '../store'

jest.mock('../../../storage/tracking-mode', () => ({
  getTrackingMode: jest.fn(),
  setTrackingMode: jest.fn(),
}))

jest.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: jest.fn(),
}))

jest.mock('../seed', () => ({
  seedManualTrackedContentOnModeSwitch: jest.fn(),
}))

beforeEach(() => {
  jest.mocked(setTrackingMode).mockReset()
  jest.mocked(setTrackingMode).mockResolvedValue(undefined)
  jest.mocked(getTrackedCharacterOcids).mockReset()
  jest.mocked(getTrackedCharacterOcids).mockResolvedValue(null)
  jest.mocked(seedManualTrackedContentOnModeSwitch).mockReset()
  jest.mocked(seedManualTrackedContentOnModeSwitch).mockResolvedValue(undefined)
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('setMode: 시드 트리거 (a): auto → manual 전환', () => {
  // 캐릭터마다 부르면 그 호출들이 단일 비행에 서로 합류해 전원이 첫 캐릭터의
  // 스케줄로 시드된다. 목록을 통째로 넘겨 회차를 하나로 만드는 것이 계약이다.
  it('auto에서 manual로 전환하면 추적 중인 ocid 목록을 한 번에 넘겨 시드한다', async () => {
    jest.mocked(getTrackedCharacterOcids).mockResolvedValue(['ocid-a', 'ocid-b', 'ocid-c'])

    await useTrackingModeStore.getState().setMode('manual')

    expect(seedManualTrackedContentOnModeSwitch).toHaveBeenCalledTimes(1)
    expect(seedManualTrackedContentOnModeSwitch).toHaveBeenCalledWith(['ocid-a', 'ocid-b', 'ocid-c'])
  })

  it('추적 목록이 아직 없으면(null) 빈 목록을 넘긴다. 시드가 할 일이 없다', async () => {
    await useTrackingModeStore.getState().setMode('manual')

    expect(seedManualTrackedContentOnModeSwitch).toHaveBeenCalledWith([])
    expect(useTrackingModeStore.getState().mode).toBe('manual')
  })

  it('이미 manual인 상태에서 다시 manual을 선택하면 시드하지 않는다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    await useTrackingModeStore.getState().setMode('manual')

    expect(seedManualTrackedContentOnModeSwitch).not.toHaveBeenCalled()
  })

  // 시드가 일부 캐릭터를 못 채워도 채운 캐릭터는 수동으로 쓸 수 있다. 모달은 이 거절을 받아 토스트만 띄운다.
  it('시드가 실패해도 모드는 manual 로 저장된 채 거절을 그대로 전한다', async () => {
    jest.mocked(seedManualTrackedContentOnModeSwitch).mockRejectedValue(new Error('못 채운 캐릭터'))

    await expect(useTrackingModeStore.getState().setMode('manual')).rejects.toThrow()

    expect(setTrackingMode).toHaveBeenCalledWith('manual')
    expect(useTrackingModeStore.getState().mode).toBe('manual')
  })

  it('manual에서 auto로 전환하면 시드하지 않는다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    await useTrackingModeStore.getState().setMode('auto')

    expect(seedManualTrackedContentOnModeSwitch).not.toHaveBeenCalled()
    expect(getTrackedCharacterOcids).not.toHaveBeenCalled()
  })
})
