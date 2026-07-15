import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPlatformMock, addListenerMock, removeMock } = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
  addListenerMock: vi.fn(),
  removeMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
}))

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: { addListener: addListenerMock },
}))

const { addKeyboardVisibilityListener } = await import('../keyboard')

beforeEach(() => {
  getPlatformMock.mockReset().mockReturnValue('ios')
  removeMock.mockReset()
  addListenerMock.mockReset().mockResolvedValue({ remove: removeMock })
})

describe('addKeyboardVisibilityListener', () => {
  it('키보드가 뜨면 true, 내려가면 false를 전달한다', async () => {
    const onChange = vi.fn()

    await addKeyboardVisibilityListener(onChange)

    const events = addListenerMock.mock.calls.map(([name]) => name)
    expect(events).toEqual(['keyboardWillShow', 'keyboardWillHide'])

    const show = addListenerMock.mock.calls[0][1]
    const hide = addListenerMock.mock.calls[1][1]

    show()
    expect(onChange).toHaveBeenCalledWith(true)

    hide()
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('반환된 정리 함수가 두 리스너를 모두 해제한다', async () => {
    const remove = await addKeyboardVisibilityListener(vi.fn())

    remove()

    expect(removeMock).toHaveBeenCalledTimes(2)
  })

  it('안드로이드에서도 동작한다 — 두 플랫폼 공통 처리다', async () => {
    getPlatformMock.mockReturnValue('android')

    await addKeyboardVisibilityListener(vi.fn())

    expect(addListenerMock).toHaveBeenCalledTimes(2)
  })

  it('웹에서는 등록하지 않고 정리 함수는 안전하게 동작한다', async () => {
    getPlatformMock.mockReturnValue('web')

    const remove = await addKeyboardVisibilityListener(vi.fn())
    remove()

    expect(addListenerMock).not.toHaveBeenCalled()
    expect(removeMock).not.toHaveBeenCalled()
  })
})
