/**
 * today 배너가 세울 공지 하나를 고르는 순수 함수.
 *
 * **후보는 가장 최근 공지 하나뿐이다.** 그것을 닫았으면 옛 공지를 그 자리에 올리지 않고 `null`
 * 을 낸다. `다시 보지 않기` 는 이 배너를 치워라로 읽히지 다음 것을 보여 달라로 읽히지 않고,
 * 누른 자리에 다른 글이 즉시 서면 안 없어진 것으로 보인다.
 *
 * 지난 공지를 읽는 자리는 설정 · 공지사항 목록이다.
 */
import type { Notice } from '../../types/notice'

/** 못 읽는 발행일은 맨 뒤로. 서버가 이상한 값을 보내도 읽히는 공지가 진다. */
function publishedAtMs(notice: Notice): number {
  const ms = new Date(notice.publishedAt).getTime()
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms
}

/**
 * 가장 최근 발행분. 단 그것이 닫혔으면 `null`.
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
  const latest = notices.reduce<Notice | null>(
    (best, notice) =>
      best === null || publishedAtMs(notice) > publishedAtMs(best) ? notice : best,
    null,
  )

  if (latest === null || dismissedIds.includes(latest.id)) return null
  return latest
}
