// 토픽 이름은 **서버와 나눠 갖는 계약**이다. 한쪽만 바꾸면 구독자가 0명인 토픽으로 조용히
// 나가고, 그 실패는 알림이 안 온다는 것 말고는 어디에도 안 남는다. 그래서 값을 여기 못박는다.
//
// 서버 쪽 짝은 `maple-routine-server` 의 `src/modules/push/push-text.ts` 의 `TOPIC_BY_KIND` 다.
import { NOTICE_TOPICS } from '../topics'
import { NOTICE_KINDS } from '../../../types/notice'

describe('구독 토글 넷', () => {
  it('토픽 이름이 서버와 같다', () => {
    expect(NOTICE_TOPICS.map((one) => [one.key, one.topic])).toEqual([
      ['app', 'notice'],
      ['game', 'notice-game'],
      ['event', 'notice-event'],
      ['update', 'notice-update'],
      ['cashshop', 'notice-cashshop'],
    ])
  })

  // 이미 스토어에 나간 바이너리가 `notice` 를 구독하고 있다. 그 이름을 게임 공지로 돌리면
  // 업데이트를 안 받은 기기가 켠 적 없는 알림을 받는다.
  it('앱 공지의 토픽 이름은 못 바꾼다', () => {
    expect(NOTICE_TOPICS.find((one) => one.key === 'app')?.topic).toBe('notice')
  })

  // 분류 하나가 토글 하나다. 그래서 열쇠가 곧 `NoticeKind` 이고 빠지거나 겹칠 수 없다.
  it('분류 다섯이 빠짐없이 한 줄씩 갖는다', () => {
    expect(NOTICE_TOPICS.map((one) => one.key).sort()).toEqual([...NOTICE_KINDS].sort())
  })
})
