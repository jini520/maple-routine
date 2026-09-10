// 토픽 이름은 **서버와 나눠 갖는 계약**이다. 한쪽만 바꾸면 구독자가 0명인 토픽으로 조용히
// 나가고, 그 실패는 알림이 안 온다는 것 말고는 어디에도 안 남는다. 그래서 값을 여기 못박는다.
//
// 서버 쪽 짝은 `maple-routine-server` 의 `src/notice.ts` 의 `TOPIC_BY_KIND` 다.
import { DEFAULT_SUBSCRIPTIONS, NOTICE_TOPICS, subscribedKinds } from '../topics'
import { NOTICE_KINDS, NO_SUBSCRIPTIONS } from '../../../types/notice'

describe('구독 토글 넷', () => {
  it('토픽 이름이 서버와 같다', () => {
    expect(NOTICE_TOPICS.map((one) => [one.key, one.topic])).toEqual([
      ['app', 'notice'],
      ['game', 'notice-game'],
      ['updateEvent', 'notice-update-event'],
      ['cashshop', 'notice-cashshop'],
    ])
  })

  // 이미 스토어에 나간 바이너리가 `notice` 를 구독하고 있다. 그 이름을 게임 공지로 돌리면
  // 업데이트를 안 받은 기기가 켠 적 없는 알림을 받는다.
  it('앱 공지의 토픽 이름은 못 바꾼다', () => {
    expect(NOTICE_TOPICS.find((one) => one.key === 'app')?.topic).toBe('notice')
  })

  it('분류 다섯이 빠짐없이 어느 토글엔가 담긴다', () => {
    const covered = NOTICE_TOPICS.flatMap((one) => [...one.kinds])

    expect([...covered].sort()).toEqual([...NOTICE_KINDS].sort())
  })

  it('한 분류가 두 토글에 걸치지 않는다', () => {
    const covered = NOTICE_TOPICS.flatMap((one) => [...one.kinds])

    expect(new Set(covered).size).toBe(covered.length)
  })
})

describe('켠 토글이 담는 분류', () => {
  it('아무것도 안 켜면 빈 목록이다', () => {
    expect(subscribedKinds(NO_SUBSCRIPTIONS)).toEqual([])
  })

  it('업데이트·이벤트 하나가 분류 둘을 담는다', () => {
    expect(subscribedKinds({ ...NO_SUBSCRIPTIONS, updateEvent: true })).toEqual(['update', 'event'])
  })
})

describe('권한을 허용했을 때 켜는 기본 묶음', () => {
  // 패치 날 이벤트 5건과 캐시샵 4건이 같은 분에 올라온다(실측 2026-08-20 08:14). 묻지도 않고
  // 켜면 그날 알림이 아홉 번 울린다.
  it('업데이트·이벤트와 캐시샵은 꺼진 채로 둔다', () => {
    expect(DEFAULT_SUBSCRIPTIONS).toEqual({
      app: true,
      game: true,
      updateEvent: false,
      cashshop: false,
    })
  })
})
