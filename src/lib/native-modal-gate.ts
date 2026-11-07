/**
 * 앱을 다시 띄우기 직전에 RN `Modal` 을 모두 닫는 문. 공용 `Modal` 이 읽고, 다시 띄우는 자리가 닫고 되돌린다.
 *
 * iOS 는 모달이 떠 있는 채 다시 띄우면 그 뷰 컨트롤러가 내용 없이 남아 다시 띄운 앱의 터치를 모두 막는다.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { Platform } from 'react-native'

/** 닫혔다는 알림을 기다리는 상한. 알림이 끝내 오지 않아도 다시 띄우기가 막히지 않게 하는 값 */
export const NATIVE_MODAL_CLOSE_CAP_MS = 1500

let open = true
const listeners = new Set<() => void>()
/** 그려졌는데 iOS 가 아직 닫았다고 알리지 않은 모달 */
const presented = new Set<object>()
const waiters = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function release(token: object): void {
  if (!presented.delete(token) || presented.size > 0) return
  for (const done of [...waiters]) done()
}

/** 모달이 지금 떠도 되는지. 다시 띄우기 직전에 거짓이 된다 */
export function nativeModalsOpen(): boolean {
  return open
}

/**
 * RN `Modal` 하나를 이 문에 잇는 훅. 돌려준 두 값을 그대로 RN `Modal` 에 넘긴다.
 *
 * @param shown 그 모달을 지금 그리는가. 그리지 않는 모달은 닫기를 기다리게 하지 않는다
 * @example const gate = useNativeModalGate(splashDone)
 */
export function useNativeModalGate(shown: boolean): { visible: boolean; onDismiss: () => void } {
  const isOpen = useSyncExternalStore(subscribe, nativeModalsOpen)
  const token = useRef<object | null>(null)

  const forget = useCallback(() => {
    if (token.current === null) return
    release(token.current)
    token.current = null
  }, [])

  useEffect(() => {
    if (!shown) {
      forget()
      return
    }
    // 닫는 중에는 새로 세지 않는다. 내려갔다는 알림이 풀 몫이다.
    if (isOpen && token.current === null) {
      token.current = {}
      presented.add(token.current)
    }
  }, [shown, isOpen, forget])

  useEffect(() => forget, [forget])

  return { visible: isOpen, onDismiss: forget }
}

/**
 * 떠 있는 RN `Modal` 을 모두 내리고, iOS 가 다 닫았다고 알릴 때까지 기다리는 함수. 다시 띄우기 바로 앞에서 부른다.
 *
 * 안드로이드는 기다리지 않는다. 그쪽 모달은 다시 시작과 함께 사라지고 닫혔다는 알림도 오지 않는다.
 */
export function closeNativeModals(): Promise<void> {
  open = false
  emit()
  if (Platform.OS !== 'ios' || presented.size === 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const done = (): void => {
      clearTimeout(timer)
      waiters.delete(done)
      resolve()
    }
    timer = setTimeout(done, NATIVE_MODAL_CLOSE_CAP_MS)
    waiters.add(done)
  })
}

/** 다시 띄우기가 실패해 화면을 되돌릴 때 모달을 다시 그리게 하는 함수. 안 부르면 그 뒤로 어떤 모달도 뜨지 않는다 */
export function reopenNativeModals(): void {
  open = true
  emit()
}

/** 테스트 전용. 문을 열고 센 모달을 비운다. */
export function __resetNativeModalGateForTest(): void {
  open = true
  presented.clear()
  waiters.clear()
}
