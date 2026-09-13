/**
 * 서버 조회 결과를 기기의 사본과 배너의 닫은 기록에 옮기는 자리.
 *
 * 둘을 한 자리에서 옮기는 이유는 **닫은 기록을 정리해도 되는 조회가 따로 있어서**다. 닫은 기록은 앱
 * 공지 id 만 들고, 게임 공지를 묻는 응답에는 앱 공지 id 가 없다. 그 응답으로 정리하면 닫아 둔 배너가
 * 전부 되살아난다. 목록 화면과 배너가 각자 정리하면 그 조건이 두 벌이 된다.
 */
import { forgetDismissedNotice, keepDismissedNotices } from '../../storage/notice-banner'
import { removeNotice, replaceNotices } from '../../storage/notices'
import type { Notice, NoticeKind } from '../../types/notice'

/**
 * 한 분류를 묻는 조회가 성공했을 때 부르는 함수. 사본을 바꾸고, 앱 공지면 닫은 기록도 정리한다.
 *
 * @param kind 조회가 물은 분류 하나
 * @param notices 받은 공지. 빈 배열이면 그 분류의 사본이 빈다
 */
export async function saveNoticeResponse(kind: NoticeKind, notices: readonly Notice[]): Promise<void> {
  await replaceNotices(kind, notices)
  if (kind === 'app') await keepDismissedNotices(notices.map((n) => n.id))
}

/** 서버가 없다고 답한 공지를 사본과 닫은 기록에서 빼는 함수. */
export async function forgetNotice(id: string): Promise<void> {
  await removeNotice(id)
  await forgetDismissedNotice(id)
}
