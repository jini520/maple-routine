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

// 포트 역전([[ADR-127]]) 후에도 검사 대상은 그대로다 — 플랫폼 가드가 어댑터로 옮겨갔으므로
// 실제 Capacitor 구현을 주입해 「어댑터 함수 → 어댑터 → 플러그인」을 한 단위로 본다.
const { addKeyboardVisibilityListener } = await import('../keyboard')
const { setKeyboardPort } = await import('../ports')
const { capacitorKeyboardPort } = await import('../adapters/capacitor-keyboard')
setKeyboardPort(capacitorKeyboardPort)

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
