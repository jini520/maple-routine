/**
 * 운영자 공지와 게임 공지 한 건.
 *
 * **푸시 페이로드의 `data` 와 서버 응답이 같은 모양이다.** 그래야 상세 화면이 출처를 안 가린다.
 * 한쪽만 바꾸면 다른 쪽 타입 검사가 못 잡으므로 필드를 더할 때는 서버 저장소도 함께 볼 것.
 */

/**
 * 어디서 온 공지인가. 다섯이고 **구독 토글은 넷**이다(`features/notice/topics.ts` 가 묶는다).
 *
 * 넷으로 접지 않고 다섯으로 두는 이유는 원본이 다섯이기 때문이다. 업데이트와 이벤트를 저장
 * 단계에서 합치면 목록이 둘을 가를 방법이 없어진다.
 */
export type NoticeKind = 'app' | 'game' | 'update' | 'event' | 'cashshop'

export const NOTICE_KINDS: readonly NoticeKind[] = ['app', 'game', 'update', 'event', 'cashshop']

export function isNoticeKind(value: unknown): value is NoticeKind {
  return typeof value === 'string' && (NOTICE_KINDS as readonly string[]).includes(value)
}

/**
 * 상세 본문 한 조각. **HTML 이 앱에 안 들어오게 하는 것이 이 타입의 목적이다.**
 *
 * 넥슨 본문은 스마트에디터 HTML 이고 서버가 이 모양으로 바꿔 준다. 앱은 문자열과 배열만
 * 그리므로 본문에 무엇이 들어 있든 태그가 화면에 닿지 않는다.
 */
export type NoticeBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'image'; src: string }
  | { type: 'link'; text: string; href: string }
  | { type: 'table'; rows: string[][] }

export interface Notice {
  /** 중복 억제와 탭 이동의 열쇠. 서버가 정한다. */
  id: string
  /**
   * 옛 기기에 쌓인 것과 옛 푸시에는 없다. 읽는 자리에서 `app` 으로 채운다 - 그때는 운영자
   * 공지밖에 없었다.
   */
  kind: NoticeKind
  title: string
  /** 목록 미리보기와 알림에 쓰는 평문. 넥슨 공지는 `blocks` 에서 뽑은 앞부분이다. */
  body: string
  /** ISO 8601. 정렬 기준이다. */
  publishedAt: string
  /** 밖으로 나가는 주소. 없을 수 있다. */
  link?: string
  /**
   * 상세 본문. **목록 조회에는 안 실린다.**
   *
   * 업데이트 한 건이 블록 797개 · JSON 57KB다(실측). 목록 20건에 실으면 한 응답이 MB 단위가
   * 된다. `fetchNotice` 로 한 건을 받을 때만 온다.
   */
  blocks?: NoticeBlock[]
}

/** 구독 토글 넷의 열쇠. 무엇을 담는지는 `features/notice/topics.ts` 가 안다. */
export type NoticeTopicKey = 'app' | 'game' | 'updateEvent' | 'cashshop'

export type NoticeSubscriptions = Record<NoticeTopicKey, boolean>

/** 아무것도 안 켠 상태. 기본은 꺼짐이고 켠 사람만 받는다. */
export const NO_SUBSCRIPTIONS: NoticeSubscriptions = {
  app: false,
  game: false,
  updateEvent: false,
  cashshop: false,
}
