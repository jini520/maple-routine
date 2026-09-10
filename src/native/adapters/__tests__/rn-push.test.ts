// 어댑터가 포트 계약을 지키는지 본다. 구독한 토픽 이름이 그대로 넘어가는지가 핵심이다.
// 이름이 어긋나면 발송은 성공하는데 기기에 안 온다. 그 실패는 코드를 읽어서는 안 보인다.
//
// 목은 팩토리 **안에서** `jest.fn()` 을 만든다(`rn-notifications.test.ts` 와 같은 방식).
// 바깥 `const` 로 두면 팩토리가 그 초기화보다 먼저 돌아 `undefined` 가 넘어간다.
//
// 흉내 내는 것은 메시징 전체가 아니라 우리가 부르는 함수 셋뿐이다. 패키지 진입점은 import
// 시점에 네이티브 모듈을 잡아 jest 에서 던지므로 통째로 대체한다.
jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  getMessaging: jest.fn(() => ({})),
  subscribeToTopic: jest.fn(),
  unsubscribeFromTopic: jest.fn(),
  getAPNSToken: jest.fn(),
}))

import { Platform } from 'react-native'
import {
  getAPNSToken,
  subscribeToTopic,
  unsubscribeFromTopic,
} from '@react-native-firebase/messaging'

import { rnPushPort } from '../rn-push'

const subscribe = jest.mocked(subscribeToTopic)
const unsubscribe = jest.mocked(unsubscribeFromTopic)
const apnsToken = jest.mocked(getAPNSToken)

beforeEach(() => {
  jest.clearAllMocks()
  subscribe.mockResolvedValue(undefined)
  unsubscribe.mockResolvedValue(undefined)
  // 기본은 `토큰이 이미 있다`. 없는 경우는 그 테스트가 따로 세운다.
  apnsToken.mockResolvedValue('apns-token')
  Platform.OS = 'ios'
})

describe('토픽 구독', () => {
  it('받은 이름을 그대로 넘긴다', async () => {
    await rnPushPort.subscribe('notice')

    expect(subscribe).toHaveBeenCalledWith(expect.anything(), 'notice')
    expect(unsubscribe).not.toHaveBeenCalled()
  })

  it('해제도 같은 이름으로 간다', async () => {
    await rnPushPort.unsubscribe('notice')

    expect(unsubscribe).toHaveBeenCalledWith(expect.anything(), 'notice')
    expect(subscribe).not.toHaveBeenCalled()
  })

  // 실패를 삼키면 구독됐다고 믿는데 안 된 상태가 조용히 남는다. 부르는 쪽이 알아야 한다.
  it('실패를 삼키지 않는다', async () => {
    subscribe.mockRejectedValue(new Error('network'))

    await expect(rnPushPort.subscribe('notice')).rejects.toThrow('network')
  })
})

// `subscribeToTopic` 은 FCM 토큰을 쓰고 FCM 토큰은 APNs 토큰이 있어야 발급된다. APNs 등록은
// 앱이 뜰 때 시작해 비동기로 끝나므로, 그 사이에 누르면 구독이
// `No APNS token specified before fetching FCM Token` 으로 던진다(실기기 관측 2026-09-10).
describe('APNs 토큰을 기다린다', () => {
  it('토큰이 있으면 바로 건다', async () => {
    await rnPushPort.subscribe('notice-game')

    expect(subscribe).toHaveBeenCalledWith(expect.anything(), 'notice-game')
  })

  it('토큰이 늦게 오면 기다렸다 건다', async () => {
    apnsToken.mockResolvedValueOnce(null).mockResolvedValue('apns-token')

    await rnPushPort.subscribe('notice-game')

    expect(apnsToken).toHaveBeenCalledTimes(2)
    expect(subscribe).toHaveBeenCalled()
  })

  // 토큰 없이 구독하면 FCM 이 영문 오류를 내고 사용자가 그것을 읽는다.
  // 가짜 시계를 쓰는 이유는 기다리는 상한이 5초라 실제로 재면 테스트가 그만큼 멈추기 때문이다.
  it('끝내 안 오면 읽을 수 있는 사유로 던진다', async () => {
    jest.useFakeTimers()
    apnsToken.mockResolvedValue(null)

    const pending = rnPushPort.subscribe('notice-game')
    const rejected = expect(pending).rejects.toThrow(/알림 서버/)
    await jest.advanceTimersByTimeAsync(6_000)
    await rejected

    expect(subscribe).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  // 끄는 길이 토큰 때문에 막히면 구독을 못 지운다. 해제도 같은 문을 지난다.
  it('해제도 토큰을 기다린다', async () => {
    apnsToken.mockResolvedValueOnce(null).mockResolvedValue('apns-token')

    await rnPushPort.unsubscribe('notice-game')

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('안드로이드는 기다리지 않는다', async () => {
    Platform.OS = 'android'

    await rnPushPort.subscribe('notice-game')

    expect(apnsToken).not.toHaveBeenCalled()
    expect(subscribe).toHaveBeenCalled()
  })
})
