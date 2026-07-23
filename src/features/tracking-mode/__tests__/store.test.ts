import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTrackedCharacterOcids } from '../../../storage/character-selection'
import { getTrackingMode, setTrackingMode } from '../../../storage/tracking-mode'
import { seedManualTrackedContent } from '../seed'
import { useTrackingModeStore } from '../store'

vi.mock('../../../storage/tracking-mode', () => ({
  getTrackingMode: vi.fn(),
  setTrackingMode: vi.fn(),
}))

vi.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: vi.fn(),
}))

vi.mock('../seed', () => ({
  seedManualTrackedContent: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getTrackingMode).mockReset()
  vi.mocked(setTrackingMode).mockReset()
  vi.mocked(setTrackingMode).mockResolvedValue(undefined)
  vi.mocked(getTrackedCharacterOcids).mockReset()
  vi.mocked(getTrackedCharacterOcids).mockResolvedValue(null)
  vi.mocked(seedManualTrackedContent).mockReset()
  vi.mocked(seedManualTrackedContent).mockResolvedValue(undefined)
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('초기 상태', () => {
  it('mode는 auto다', () => {
    expect(useTrackingModeStore.getState().mode).toBe('auto')
  })
})

describe('restoreFromStorage', () => {
  it('저장된 값이 manual이면 mode를 manual로 갱신한다', async () => {
    vi.mocked(getTrackingMode).mockResolvedValue('manual')

    await useTrackingModeStore.getState().restoreFromStorage()

    expect(useTrackingModeStore.getState().mode).toBe('manual')
  })

  it('저장된 값이 없으면(storage가 기본값 auto 반환) mode는 auto다', async () => {
    vi.mocked(getTrackingMode).mockResolvedValue('auto')

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
  it('auto에서 manual로 전환하면 추적 중인 모든 ocid(content+boss 합집합, 중복 제거)를 시드한다', async () => {
    vi.mocked(getTrackedCharacterOcids).mockImplementation(async (kind) =>
      kind === 'content' ? ['ocid-a', 'ocid-b'] : ['ocid-b', 'ocid-c'],
    )

    await useTrackingModeStore.getState().setMode('manual')

    expect(seedManualTrackedContent).toHaveBeenCalledTimes(3)
    expect(seedManualTrackedContent).toHaveBeenCalledWith('ocid-a')
    expect(seedManualTrackedContent).toHaveBeenCalledWith('ocid-b')
    expect(seedManualTrackedContent).toHaveBeenCalledWith('ocid-c')
  })

  it('추적 목록이 아직 없으면(null) 시드 없이 전환만 한다', async () => {
    await useTrackingModeStore.getState().setMode('manual')

    expect(seedManualTrackedContent).not.toHaveBeenCalled()
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
