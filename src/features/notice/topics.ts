/**
 * 구독 토글 넷과 그 토픽 이름. **JS 에 두는 것이 요건이다.** 네이티브에 박으면 OTA 로 못 바꾼다.
 *
 * 서버가 이 이름으로 쏜다(`maple-routine-server` 의 `src/notice.ts` 의 `TOPIC_BY_KIND`).
 * 한쪽만 바꾸면 구독자가 0명인 토픽으로 조용히 나가고, 그 실패는 알림이 안 온다는 것 말고는
 * 어디에도 안 남는다.
 *
 * **`app` 의 토픽 이름 `notice` 는 못 바꾼다.** 이미 스토어에 나간 바이너리가 그것을 구독하고
 * 있어서, 게임 공지로 돌리면 업데이트를 안 받은 기기가 켠 적 없는 알림을 받는다.
 */
import type { NoticeKind, NoticeSubscriptions } from '../../types/notice'

export interface NoticeTopic {
  /** 분류 하나가 토글 하나다. 그래서 열쇠가 곧 `NoticeKind` 다. */
  key: NoticeKind
  /** FCM 토픽 이름. 서버와 같은 문자열이어야 한다. */
  topic: string
  label: string
}

export const NOTICE_TOPICS: readonly NoticeTopic[] = [
  { key: 'app', topic: 'notice', label: '앱 공지 사항' },
  { key: 'game', topic: 'notice-game', label: '게임 공지 사항' },
  // 이벤트 토픽으로 나가는 것이 썬데이뿐이라 이름이 그것이다. 서버가 나머지 이벤트를 안 보낸다.
  { key: 'event', topic: 'notice-event', label: '썬데이 메이플' },
  { key: 'update', topic: 'notice-update', label: '게임 업데이트 안내' },
  { key: 'cashshop', topic: 'notice-cashshop', label: '캐시 아이템 업데이트' },
]

/**
 * 알림 권한을 허용했을 때 켜 주는 것 (사용자 지정).
 *
 * **다섯을 다 켜지 않는다.** 업데이트와 캐시샵은 패치 날 한꺼번에 올라와서(실측: 8월 20일
 * 8시 14분에 이벤트 5건과 캐시샵 4건), 묻지도 않고 켜면 그날 알림이 여러 번 울린다. 점검
 * 안내와 썬데이는 늦게 알면 의미가 없는 종류라 켠다.
 */
export const DEFAULT_SUBSCRIPTIONS: NoticeSubscriptions = {
  app: true,
  game: true,
  event: true,
  update: false,
  cashshop: false,
}

/** 켜져 있는 분류 전부. 목록을 그 분류로만 물을 때 쓴다. */
export function subscribedKinds(subscriptions: NoticeSubscriptions): NoticeKind[] {
  return NOTICE_TOPICS.filter((one) => subscriptions[one.key]).map((one) => one.key)
}

/**
 * 하나라도 켜져 있으면 참. **전체 스위치는 이 값으로 그린다.**
 *
 * 따로 저장하지 않는 이유. 저장하면 `전체는 켜졌다고 적혔는데 넷은 다 꺼진` 상태가 생기고,
 * 그러면 스위치는 켜져 있는데 알림은 안 오는 화면이 된다. 파생하면 그 어긋남이 원리적으로
 * 불가능하다.
 */
export function anySubscribed(subscriptions: NoticeSubscriptions): boolean {
  return NOTICE_TOPICS.some((one) => subscriptions[one.key])
}
