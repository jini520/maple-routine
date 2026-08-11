import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPlatformMock, setEnabledMock, addListenerMock, removeMock } = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
  setEnabledMock: vi.fn(),
  addListenerMock: vi.fn(),
  removeMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
  registerPlugin: () => ({ setEnabled: setEnabledMock, addListener: addListenerMock }),
}))

// 포트 역전([[ADR-127]]) 후에도 검사 대상은 그대로다 — 플랫폼 가드가 어댑터로 옮겨갔으므로
// 실제 Capacitor 구현을 주입해 「어댑터 함수 → 어댑터 → 플러그인」을 한 단위로 본다.
const { addBackGestureListeners, setBackGestureEnabled } = await import('@core/native/back-gesture')
const { setBackGesturePort } = await import('@core/native/ports')
const { capacitorBackGesturePort } = await import('../adapters/capacitor-back-gesture')
setBackGesturePort(capacitorBackGesturePort)

beforeEach(() => {
  vi.clearAllMocks()
  addListenerMock.mockResolvedValue({ remove: removeMock })
})

describe('setBackGestureEnabled', () => {
  // 스택이 열려 있는 동안에만 시스템 뒤로가기를 가로챈다([[ADR-120]] 결정 17). 비어 있을 때까지
  // 가로채면 탭 최상위에서 시스템이 홈으로 돌아가며 그리는 predictive back 애니메이션이 사라진다 —
  // 사용자가 "웹뷰 앱이구나"를 알아차리는 자리가 정확히 그런 곳이다.
  it('안드로이드에서 켜고 끈다', async () => {
    getPlatformMock.mockReturnValue('android')

    await setBackGestureEnabled(true)
    await setBackGestureEnabled(false)

    expect(setEnabledMock).toHaveBeenNthCalledWith(1, { enabled: true })
    expect(setEnabledMock).toHaveBeenNthCalledWith(2, { enabled: false })
  })

  it('iOS·웹에서는 네이티브를 부르지 않는다', async () => {
    // iOS 에는 시스템 가장자리 뒤로가기가 없어 JS 제스처를 쓴다(결정 6).
    getPlatformMock.mockReturnValue('ios')
    await setBackGestureEnabled(true)

    getPlatformMock.mockReturnValue('web')
    await setBackGestureEnabled(true)

    expect(setEnabledMock).not.toHaveBeenCalled()
  })
})

describe('addBackGestureListeners', () => {
  it('네 가지 이벤트를 모두 구독하고 한 번에 해제한다', async () => {
    getPlatformMock.mockReturnValue('android')

    const remove = await addBackGestureListeners({ onInvoked: vi.fn() })

    expect(addListenerMock.mock.calls.map((call) => call[0])).toEqual([
      'backStarted',
      'backProgressed',
      'backInvoked',
      'backCancelled',
    ])

    remove()
    expect(removeMock).toHaveBeenCalledTimes(4)
  })

  // 3버튼 내비 사용자는 진행률 이벤트를 받지 못하고 `backInvoked` 만 온다. 그때도 같은 결과로
  // 수렴해야 하므로 나머지 핸들러는 선택이다.
  it('onInvoked 만 주어도 동작한다', async () => {
    getPlatformMock.mockReturnValue('android')
    const onInvoked = vi.fn()

    await addBackGestureListeners({ onInvoked })
    const invokedHandler = addListenerMock.mock.calls.find((call) => call[0] === 'backInvoked')?.[1]
    const progressHandler = addListenerMock.mock.calls.find(
      (call) => call[0] === 'backProgressed',
    )?.[1]

    progressHandler({ progress: 0.5, edge: 'left' })
    invokedHandler()

    expect(onInvoked).toHaveBeenCalledTimes(1)
  })

  it('안드로이드가 아니면 아무것도 구독하지 않는다', async () => {
    getPlatformMock.mockReturnValue('ios')

    const remove = await addBackGestureListeners({ onInvoked: vi.fn() })
    remove()

    expect(addListenerMock).not.toHaveBeenCalled()
  })
})
