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
import type {
  NoticeKind,
  NoticeSubscriptions,
  NoticeTopicKey,
} from '../../types/notice'

export interface NoticeTopic {
  key: NoticeTopicKey
  /** FCM 토픽 이름. 서버와 같은 문자열이어야 한다. */
  topic: string
  label: string
  description: string
  /** 이 토글이 담는 분류. 목록을 걸러 물을 때도 쓴다. */
  kinds: readonly NoticeKind[]
}

export const NOTICE_TOPICS: readonly NoticeTopic[] = [
  {
    key: 'app',
    topic: 'notice',
    label: '앱 공지사항',
    description: '이 앱의 업데이트와 점검 소식',
    kinds: ['app'],
  },
  {
    key: 'game',
    topic: 'notice-game',
    label: '게임 공지사항',
    description: '메이플스토리 점검과 안내',
    kinds: ['game'],
  },
  {
    key: 'updateEvent',
    topic: 'notice-update-event',
    label: '업데이트·이벤트',
    // 이벤트는 전부가 아니라 썬데이만 온다(사용자 지정). 화면이 그것을 말하지 않으면
    // 사용자는 다른 이벤트 알림이 안 오는 것을 고장으로 읽는다.
    description: '패치 노트와 썬데이 메이플',
    kinds: ['update', 'event'],
  },
  {
    key: 'cashshop',
    topic: 'notice-cashshop',
    label: '캐시샵',
    description: '캐시 아이템 업데이트',
    kinds: ['cashshop'],
  },
]

/**
 * 알림 권한을 허용했을 때 켜 주는 것.
 *
 * **넷을 다 켜지 않는다.** 업데이트·이벤트와 캐시샵은 패치 날 한꺼번에 올라와서(실측: 8월 20일
 * 8시 14분에 이벤트 5건과 캐시샵 4건), 묻지도 않고 켜면 그날 알림이 아홉 번 울린다. 점검
 * 안내는 늦게 알면 의미가 없는 종류라 켠다.
 */
export const DEFAULT_SUBSCRIPTIONS: NoticeSubscriptions = {
  app: true,
  game: true,
  updateEvent: false,
  cashshop: false,
}

/** 켜져 있는 토글이 담는 분류 전부. 목록을 그 분류로만 물을 때 쓴다. */
export function subscribedKinds(subscriptions: NoticeSubscriptions): NoticeKind[] {
  return NOTICE_TOPICS.filter((one) => subscriptions[one.key]).flatMap((one) => [...one.kinds])
}
