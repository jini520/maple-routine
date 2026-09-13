/**
 * 푸시 페이로드를 공지로 읽는다. **기기에 쌓지 않는다.**
 *
 * 공지의 기준은 서버다. 푸시 내용을 저장하면 서버가 그 공지를 지워도 기기에서 지울 신호가 없다.
 * 여기서 읽는 것은 공지 푸시인가와 어느 공지인가(`id`)뿐이고, 내용은 조회가 서버에서 받는다.
 *
 * **여기가 계약이 실제로 지켜지는 자리다.** 서버가 필드 이름을 바꾸거나 빠뜨리면 이 함수가 `null` 을
 * 내고, 그 푸시로는 상세를 열지 않는다.
 *
 * 공지가 아닌 푸시가 올 수도 있다. 그때 던지면 안 된다. 조용히 지나간다.
 */
import type { PushData } from '../../native/push'
import { isNoticeKind, type Notice } from '../../types/notice'

/** 못 읽으면 `null`. 던지지 않는다. */
export function parseNotice(data: PushData): Notice | null {
  const { noticeId, kind, title, body, publishedAt, link } = data

  // 빈 문자열은 없는 것과 같다. id 가 비면 병합 열쇠가 없어 목록이 한 칸으로 뭉치고, 제목이나
  // 발행일이 비면 목록 한 줄을 못 그린다.
  //
  // **본문은 여기 없다.** 이벤트와 캐시샵 본문은 이미지 한 장이라 평문이 0자로 온다. 본문을
  // 필수로 보면 그 두 분류의 알림이 통째로 버려져서, 탭해도 상세가 안 열린다. 본문은 상세
  // 화면이 서버에서 받아 채운다.
  if (!noticeId || !title || !publishedAt) return null

  return {
    id: noticeId,
    // 분류가 없으면 운영자 공지다. 토글이 하나였던 시절에 나간 푸시에는 이 값이 없다.
    kind: isNoticeKind(kind) ? kind : 'app',
    title,
    body: body ?? '',
    publishedAt,
    ...(link ? { link } : {}),
  }
}
