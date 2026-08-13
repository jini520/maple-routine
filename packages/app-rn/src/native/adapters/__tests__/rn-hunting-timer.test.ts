// 이 파일이 지키는 것은 **없다는 사실이 드러나는가** 다.
//
// 사냥 타이머는 [[ADR-005]] 에 설계만 있고 네이티브 구현이 존재한 적이 없다(`rn-hunting-timer.ts`
// 상단). Capacitor 는 실기기에서 세 메서드를 전부 거부했고, 여기서 지키려는 것은 그 거부가
// **조용한 성공으로 바뀌지 않는 것**이다 — 그렇게 바뀌면 화면은 타이머가 도는 줄 알고 사용자는
// 울리지 않는 알림을 기다린다. 그건 코드를 읽어서는 안 보인다.

import { Platform } from 'react-native'

import { huntingTimerUnimplementedMessage, rnHuntingTimerPort } from '../rn-hunting-timer'

describe('구현 없음이 드러난다', () => {
  // 셋 다 거부다. 하나라도 resolve 하면 "일부는 된다"로 읽힌다.
  it.each(['start', 'stop', 'getState'] as const)('%s 는 거부한다', async (method) => {
    const call =
      method === 'start'
        ? rnHuntingTimerPort.start({ soundIntervalMinutes: 1 })
        : method === 'stop'
          ? rnHuntingTimerPort.stop()
          : rnHuntingTimerPort.getState()

    await expect(call).rejects.toThrow(`"HuntingTimer.${method}()" is not implemented`)
  })

  // `{ isRunning: false }` 를 돌려주면 호출부는 "정지 상태"라는 답을 받은 것으로 읽어 시작 버튼을
  // 그리고, 없다는 사실은 start() 가 실패할 때에야 드러난다. 상태 모양을 흉내 내면 안 된다.
  it('getState 는 HuntingTimerState 모양을 흉내 내지 않는다', async () => {
    const state = await rnHuntingTimerPort.getState().catch(() => null)
    expect(state).toBeNull()
  })

  // 동기 throw 면 `await` 없이 `.catch()` 만 단 호출부에서 예외가 그대로 터진다. Capacitor 는
  // `.then()` 안에서 던져 거부된 Promise 로 나왔다 — 그 모양을 지킨다.
  it.each(['start', 'stop', 'getState'] as const)(
    '%s 는 동기로 던지지 않고 거부된 Promise 를 준다',
    (method) => {
      let promise: Promise<unknown> | undefined
      expect(() => {
        promise =
          method === 'start'
            ? rnHuntingTimerPort.start({ soundIntervalMinutes: 1 })
            : method === 'stop'
              ? rnHuntingTimerPort.stop()
              : rnHuntingTimerPort.getState()
      }).not.toThrow()
      expect(promise).toBeInstanceOf(Promise)
      return expect(promise).rejects.toThrow()
    },
  )

  // 어느 타깃에서 났는지가 로그의 첫 질문이라 Capacitor 도 메시지에 플랫폼을 담았다.
  it('메시지가 플랫폼을 담는다', async () => {
    await expect(rnHuntingTimerPort.start({ soundIntervalMinutes: 1 })).rejects.toThrow(
      `is not implemented on ${Platform.OS}`,
    )
    expect(huntingTimerUnimplementedMessage('start', 'android')).toContain(
      'is not implemented on android',
    )
  })

  // 되살리려는 사람이 근거 문서로 가는 유일한 실마리다.
  it('메시지가 ADR-005 를 가리킨다', () => {
    expect(huntingTimerUnimplementedMessage('start', 'ios')).toContain('ADR-005')
  })
})

describe('상태를 들고 있지 않다', () => {
  // "두 번 불러도 안전한가" — 거부는 그 자체로 멱등이지만, 확인하려는 것은 호출을 세거나 플래그를
  // 세우는 숨은 상태가 없다는 것이다. 있으면 두 번째 호출부터 첫 번째와 다르게 굴 수 있다.
  it('start·stop 을 거듭 불러도 매번 같게 거부한다', async () => {
    for (const call of [
      () => rnHuntingTimerPort.start({ soundIntervalMinutes: 1 }),
      () => rnHuntingTimerPort.start({ soundIntervalMinutes: 1 }),
      () => rnHuntingTimerPort.stop(),
      () => rnHuntingTimerPort.stop(),
    ]) {
      await expect(call()).rejects.toThrow('is not implemented')
    }
  })

  // start 가 성공한 척 상태를 남겼다면 그 뒤 getState 가 달라졌을 것이다.
  it('start 를 시도한 뒤에도 getState 는 그대로 거부한다', async () => {
    await expect(rnHuntingTimerPort.start({ soundIntervalMinutes: 5 })).rejects.toThrow()
    await expect(rnHuntingTimerPort.getState()).rejects.toThrow(
      '"HuntingTimer.getState()" is not implemented',
    )
  })

  // soundIntervalMinutes 를 소비하는 코드가 없다 — 값이 무엇이든 결과가 같다는 것이 그 사실의
  // 관측 가능한 형태다. 라이브러리 반복 설정으로 변환되는 자리는 존재하지 않는다.
  it.each([1, 2, 30, 0, -1, Number.NaN])(
    'soundIntervalMinutes=%p 도 갈리지 않는다',
    async (soundIntervalMinutes) => {
      await expect(rnHuntingTimerPort.start({ soundIntervalMinutes })).rejects.toThrow(
        '"HuntingTimer.start()" is not implemented',
      )
    },
  )
})
