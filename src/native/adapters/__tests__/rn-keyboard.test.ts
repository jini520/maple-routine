import { Keyboard, type KeyboardEvent } from 'react-native'

import { rnKeyboardPort } from '../rn-keyboard'

/**
 * 진짜 `Keyboard` 에 붙여서 진짜로 emit 한다. `addListener` 를 목으로 가로채면 "**해제 함수가
 * 리스너를 실제로 떼는가**"를 못 본다(목은 `remove()` 가 불렸다는 것까지만 말한다). 이 파일이
 * 지키려는 것이 바로 그 자리다: 안 떼면 화면 전환마다 리스너가 쌓인다.
 *
 * 그러려면 내부 `_emitter` 를 거쳐야 한다. RN 0.86 의 `KeyboardImpl` 은 `emit` 을 밖에 내주지
 * 않는다(타입 선언은 `NativeEventEmitter` 를 상속한다고 적지만 실제 프로토타입에는
 * `addListener`·`removeAllListeners`·`dismiss`·`isVisible`·`metrics`·`scheduleLayoutAnimation`
 * 뿐이다). RN 업그레이드로 이 필드가 사라지면 아래 가드가 **읽을 수 있는 메시지로** 깨진다 —
 * 조용히 초록이 되는 것보다 낫다.
 */
const EVENT = {
  duration: 0,
  easing: 'keyboard',
  endCoordinates: { screenX: 0, screenY: 0, width: 0, height: 0 },
} as unknown as KeyboardEvent

function emit(eventName: string): void {
  const emitter = (Keyboard as unknown as { _emitter?: { emit?: unknown } })._emitter
  if (typeof emitter?.emit !== 'function') {
    throw new Error(
      'Keyboard._emitter.emit 이 없습니다 — RN 내부 구조가 바뀌었습니다. 이 테스트가 검사하려는 것은 ' +
        '"해제 함수가 리스너를 실제로 떼는가"이므로, 목으로 대체하지 말고 emit 경로를 다시 찾으세요.',
    )
  }
  ;(emitter as { emit(name: string, event: KeyboardEvent): void }).emit(eventName, EVENT)
}

describe('rnKeyboardPort', () => {
  it('키보드가 뜨면 true, 내려가면 false 로 알린다', async () => {
    const onChange = jest.fn()
    const unsubscribe = await rnKeyboardPort.addVisibilityListener(onChange)

    emit('keyboardDidShow')
    emit('keyboardDidHide')

    expect(onChange.mock.calls).toEqual([[true], [false]])
    unsubscribe()
  })

  it('해제하면 그 뒤 이벤트에는 반응하지 않는다 — 두 리스너 모두', async () => {
    const onChange = jest.fn()
    const unsubscribe = await rnKeyboardPort.addVisibilityListener(onChange)

    unsubscribe()
    emit('keyboardDidShow')
    emit('keyboardDidHide')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('구독을 여럿 붙였다가 하나만 해제하면 나머지는 산다', async () => {
    const first = jest.fn()
    const second = jest.fn()
    const unsubscribeFirst = await rnKeyboardPort.addVisibilityListener(first)
    const unsubscribeSecond = await rnKeyboardPort.addVisibilityListener(second)

    unsubscribeFirst()
    emit('keyboardDidShow')

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(true)
    unsubscribeSecond()
  })

  // Capacitor 는 `keyboardWillShow`/`keyboardWillHide` 를 썼지만 RN 에서 그 둘은 **iOS 에서만** 온다.
  // 안드로이드에서 안 오는 이벤트에 매달리면 그 플랫폼에서 탭바가 키보드 위에 남는다. 그래서
  // 양쪽에 다 오는 `did` 쪽을 쓴다. 둘 다 듣는 것도 답이 아니다(iOS 에서 will → did 로 두 번 불린다).
  it('will 계열 이벤트에는 반응하지 않는다', async () => {
    const onChange = jest.fn()
    const unsubscribe = await rnKeyboardPort.addVisibilityListener(onChange)

    emit('keyboardWillShow')
    emit('keyboardWillHide')

    expect(onChange).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('해제 함수를 돌려준다', async () => {
    const unsubscribe = await rnKeyboardPort.addVisibilityListener(jest.fn())

    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  // 포트 시그니처가 Promise 라 호출부는 `await` 한다. RN `Keyboard.addListener` 는 동기지만 그
  // 차이가 밖으로 새면 안 된다.
  it('Promise 를 돌려준다', () => {
    const pending = rnKeyboardPort.addVisibilityListener(jest.fn())

    expect(pending).toBeInstanceOf(Promise)
    void pending.then((unsubscribe) => {
      unsubscribe()
    })
  })
})
