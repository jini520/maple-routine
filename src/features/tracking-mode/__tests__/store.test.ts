import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTrackingMode, setTrackingMode } from '../../../storage/tracking-mode'
import { useTrackingModeStore } from '../store'

vi.mock('../../../storage/tracking-mode', () => ({
  getTrackingMode: vi.fn(),
  setTrackingMode: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getTrackingMode).mockReset()
  vi.mocked(setTrackingMode).mockReset()
  vi.mocked(setTrackingMode).mockResolvedValue(undefined)
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
