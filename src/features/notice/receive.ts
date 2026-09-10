/**
 * 푸시 페이로드를 공지로 읽어 기기에 쌓는다.
 *
 * **여기가 계약이 실제로 지켜지는 자리다.** 서버가 필드 이름을 바꾸거나 빠뜨리면 화면이 빈 칸을
 * 그리는 대신 이 함수가 `null` 을 낸다. 그러면 그 푸시는 목록에 안 쌓이고, 안 쌓인 것이
 * 잘못 쌓인 것보다 낫다.
 *
 * 공지가 아닌 푸시가 올 수도 있다. 그때 던지면 안 된다. 조용히 지나간다.
 */
import { mergeNotices } from '../../storage/notices'
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

/**
 * 받아서 쌓는다. **같은 `id` 는 병합이 알아서 한 건으로 만든다.**
 *
 * 같은 공지가 포그라운드 수신과 탭 양쪽으로 들어올 수 있어서, 중복 억제를 여기서 따로 하지
 * 않는다. 저장소가 이미 그 규칙을 갖고 있다.
 */
export async function receiveNotice(data: PushData): Promise<void> {
  const notice = parseNotice(data)
  if (notice === null) return

  await mergeNotices([notice])
}
