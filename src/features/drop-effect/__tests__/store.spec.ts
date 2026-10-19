import { getDropEffectEnabled, setDropEffectEnabled } from '../../../storage/drop-effect'
import { useDropEffectStore } from '../store'

jest.mock('../../../storage/drop-effect', () => ({
  getDropEffectEnabled: jest.fn(),
  setDropEffectEnabled: jest.fn(),
}))

beforeEach(() => {
  jest.mocked(getDropEffectEnabled).mockReset()
  jest.mocked(setDropEffectEnabled).mockReset()
  jest.mocked(setDropEffectEnabled).mockResolvedValue(undefined)
  useDropEffectStore.setState({ enabled: true })
})

describe('초기 상태', () => {
  it('enabled는 기본 true(연출 표시)', () => {
    expect(useDropEffectStore.getState().enabled).toBe(true)
  })
})

describe('restoreFromStorage', () => {
  it('저장된 값이 false면 enabled를 false로 갱신한다', async () => {
    jest.mocked(getDropEffectEnabled).mockResolvedValue(false)

    await useDropEffectStore.getState().restoreFromStorage()

    expect(useDropEffectStore.getState().enabled).toBe(false)
  })
})

describe('setEnabled', () => {
  it('false로 설정하면 setDropEffectEnabled를 호출하고 상태를 false로 갱신한다', async () => {
    await useDropEffectStore.getState().setEnabled(false)

    expect(setDropEffectEnabled).toHaveBeenCalledWith(false)
    expect(useDropEffectStore.getState().enabled).toBe(false)
  })
})
