/**
 * today 배너가 세울 공지 하나를 고르는 순수 함수.
 *
 * **하나만 고른다.** 안 읽은 것이 여럿이어도 쌓지 않는다. 쌓으면 첫 화면이 요약이 아니라 목록이
 * 된다. 남는 것이 없으면 `null` 이고, 그때 배너는 렌더 자체를 안 한다.
 */
import type { Notice } from '../../types/notice'

/** 못 읽는 발행일은 맨 뒤로. 서버가 이상한 값을 보내도 읽히는 공지가 진다. */
function publishedAtMs(notice: Notice): number {
  const ms = new Date(notice.publishedAt).getTime()
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms
}

/**
 * 안 닫은 것 중 가장 최근 발행분.
 *
 * **저장 순서에 안 기댄다.** `storage/notices.ts` 가 최근순으로 넣어 두기는 하지만, 그 사실에
 * 기대면 저장 순서를 바꾸는 날 배너가 옛 공지를 세운다.
 *
 * @param notices 기기에 쌓인 공지
 * @param dismissedIds 배너에서 닫은 id
 */
export function pickBannerNotice(
  notices: readonly Notice[],
  dismissedIds: readonly string[],
): Notice | null {
  const dismissed = new Set(dismissedIds)

  return notices.reduce<Notice | null>((best, notice) => {
    if (dismissed.has(notice.id)) return best
    if (best === null) return notice
    return publishedAtMs(notice) > publishedAtMs(best) ? notice : best
  }, null)
}
