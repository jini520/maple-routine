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
}))

import { subscribeToTopic, unsubscribeFromTopic } from '@react-native-firebase/messaging'

import { rnPushPort } from '../rn-push'

const subscribe = jest.mocked(subscribeToTopic)
const unsubscribe = jest.mocked(unsubscribeFromTopic)

beforeEach(() => {
  jest.clearAllMocks()
  subscribe.mockResolvedValue(undefined)
  unsubscribe.mockResolvedValue(undefined)
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
