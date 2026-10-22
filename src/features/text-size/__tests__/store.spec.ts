// 고른 글자 크기가 **저장과 화면 배수에 함께** 걸리는가. 저장만 되고 배수가 안 바뀌면 다음 실행에서야
// 바뀌고, 배수만 바뀌고 저장이 안 되면 다시 켰을 때 되돌아간다.
import { installFakePreferences, type FakePreferences } from '../../../storage/__tests__/fake-preferences'
import { STORAGE_KEYS } from '../../../storage/keys'
import { __resetTextScaleForTest, getTextScale } from '../../../theme/text-scale'
import { useTextSizeStore } from '../store'

let prefs: FakePreferences

beforeEach(() => {
  prefs = installFakePreferences()
  __resetTextScaleForTest()
  useTextSizeStore.setState({ size: 'default' })
})

describe('restoreFromStorage: 부팅 때 저장된 단계를 배수로 놓는다', () => {
  it('저장된 단계의 배수를 놓는다', async () => {
    await prefs.set(STORAGE_KEYS.textSize, 'xlarge')

    await useTextSizeStore.getState().restoreFromStorage()

    expect(useTextSizeStore.getState().size).toBe('xlarge')
    expect(getTextScale()).toBe(1.2)
  })

  it.each([null, 'huge'])('저장된 값이 %p 이면 기본(1.0)이다', async (stored) => {
    if (stored !== null) await prefs.set(STORAGE_KEYS.textSize, stored)

    await useTextSizeStore.getState().restoreFromStorage()

    expect(useTextSizeStore.getState().size).toBe('default')
    expect(getTextScale()).toBe(1)
  })
})

describe('selectSize: 고르면 저장과 배수가 함께 바뀐다', () => {
  it('저장하고 배수를 바로 바꾼다', async () => {
    await useTextSizeStore.getState().selectSize('small')

    expect(await prefs.get(STORAGE_KEYS.textSize)).toBe('small')
    expect(getTextScale()).toBe(0.9)
  })

  it('저장이 실패하면 배수를 안 바꾼다. 다시 켰을 때 되돌아가는 크기를 보여 주지 않는다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))

    await expect(useTextSizeStore.getState().selectSize('large')).rejects.toThrow('disk full')

    expect(useTextSizeStore.getState().size).toBe('default')
    expect(getTextScale()).toBe(1)
  })
})
