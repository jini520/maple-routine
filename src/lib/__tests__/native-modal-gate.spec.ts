/**
 * 다시 띄우기 직전에 RN `Modal` 을 닫는 문.
 *
 * iOS 는 모달이 닫혔다는 알림이 온 뒤에 다시 띄워야 한다. 떠 있는 채 다시 띄우면 그 모달의 투명한 화면이 남아 다시 띄운 앱의
 * 터치를 모두 막는다.
 */
import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import {
  NATIVE_MODAL_CLOSE_CAP_MS,
  __resetNativeModalGateForTest,
  closeNativeModals,
  reopenNativeModals,
  useNativeModalGate,
} from '../native-modal-gate'

/** 약속이 끝났는지 나중에 들여다보는 표. */
function track(promise: Promise<void>): { settled: boolean } {
  const state = { settled: false }
  void promise.then(() => {
    state.settled = true
  })
  return state
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

const originalOS = Platform.OS

beforeEach(() => {
  jest.useFakeTimers()
  __resetNativeModalGateForTest()
  Platform.OS = 'ios'
})

afterEach(() => {
  jest.useRealTimers()
  Platform.OS = originalOS
})

describe('closeNativeModals', () => {
  it('iOS 는 떠 있는 모달이 닫혔다고 알릴 때까지 기다린다', async () => {
    const { result } = await renderHook(() => useNativeModalGate(true))
    expect(result.current.visible).toBe(true)

    let closing = { settled: false }
    await act(async () => {
      closing = track(closeNativeModals())
    })
    expect(result.current.visible).toBe(false)

    await act(async () => {
      jest.advanceTimersByTime(NATIVE_MODAL_CLOSE_CAP_MS - 1)
    })
    expect(closing.settled).toBe(false)

    await act(async () => {
      result.current.onDismiss()
    })
    await flush()
    expect(closing.settled).toBe(true)
  })

  // 알림이 끝내 오지 않아도 다시 띄우기가 막히면 안 된다.
  it('닫혔다는 알림이 오지 않아도 상한에서 끝난다', async () => {
    await renderHook(() => useNativeModalGate(true))

    let closing = { settled: false }
    await act(async () => {
      closing = track(closeNativeModals())
    })
    await act(async () => {
      jest.advanceTimersByTime(NATIVE_MODAL_CLOSE_CAP_MS)
    })

    expect(closing.settled).toBe(true)
  })

  // 안드로이드의 RN `Modal` 은 다시 시작과 함께 사라지고 `onDismiss` 도 오지 않는다.
  it('안드로이드는 모달을 내리기만 하고 기다리지 않는다', async () => {
    Platform.OS = 'android'
    const { result } = await renderHook(() => useNativeModalGate(true))

    let closing = { settled: false }
    await act(async () => {
      closing = track(closeNativeModals())
    })
    await flush()

    expect(result.current.visible).toBe(false)
    expect(closing.settled).toBe(true)
  })

  it('그리지 않는 모달과 이미 언마운트된 모달은 기다리지 않는다', async () => {
    await renderHook(() => useNativeModalGate(false))
    const mounted = await renderHook(() => useNativeModalGate(true))
    await mounted.unmount()

    let closing = { settled: false }
    await act(async () => {
      closing = track(closeNativeModals())
    })
    await flush()

    expect(closing.settled).toBe(true)
  })
})

describe('reopenNativeModals', () => {
  // 적용이 실패해 화면을 되돌린 뒤에는 `apply-error` 모달이 떠야 하고, 다음 적용도 그 모달이 닫히기를 기다려야 한다.
  it('되돌리면 다시 그리고, 다음 닫기도 그 모달을 기다린다', async () => {
    const { result } = await renderHook(() => useNativeModalGate(true))

    await act(async () => {
      void closeNativeModals()
    })
    await act(async () => {
      result.current.onDismiss()
    })
    await act(async () => {
      reopenNativeModals()
    })
    expect(result.current.visible).toBe(true)

    let closing = { settled: false }
    await act(async () => {
      closing = track(closeNativeModals())
    })
    await flush()
    expect(closing.settled).toBe(false)

    await act(async () => {
      result.current.onDismiss()
    })
    await flush()
    expect(closing.settled).toBe(true)
  })
})
