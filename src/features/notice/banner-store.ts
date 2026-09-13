/**
 * today 배너가 세우는 공지 하나.
 *
 * **문이 둘이고 그 차이가 이 파일의 실질이다.**
 *
 * - `load()`. 기기의 사본만 읽는다. 네트워크가 없어 마운트와 포커스마다 불러도 싸다.
 * - `refresh()`. 앱 공지를 서버에 묻고, 성공하면 사본을 응답으로 바꾼 뒤 다시 고른다.
 *
 * 푸시 내용은 저장하지 않으므로 새 공지와 지운 공지를 배너가 아는 길은 `refresh()` 뿐이다.
 */
import { create } from 'zustand'

import { fetchNotices } from '../../server/notices'
import { dismissNotice, getDismissedNoticeIds } from '../../storage/notice-banner'
import { getNotices } from '../../storage/notices'
import type { Notice } from '../../types/notice'
import { saveNoticeResponse } from './notice-copy'
import { pickBannerNotice } from './pick-banner-notice'

interface NoticeBannerState {
  /** 세울 공지. `null` 이면 배너가 렌더 자체를 안 한다. */
  notice: Notice | null
  load: () => Promise<void>
  refresh: () => Promise<void>
  /** 세워진 공지를 배너에서 닫는다. 목록과 상세에는 그대로 남는다. */
  dismiss: () => Promise<void>
}

/** 기기만 읽어 고른다. 실패하면 안 세운다. 첫 화면이 저장소 고장으로 죽으면 안 된다. */
async function pickFromDevice(): Promise<Notice | null> {
  try {
    const [notices, dismissed] = await Promise.all([getNotices(), getDismissedNoticeIds()])
    return pickBannerNotice(notices, dismissed)
  } catch {
    return null
  }
}

export const useNoticeBannerStore = create<NoticeBannerState>()((set, get) => ({
  notice: null,
  async load() {
    set({ notice: await pickFromDevice() })
  },
  async refresh() {
    // 앱 공지만 묻는다. 분류 없이 20건을 받으면 넥슨 공지가 몰린 날 앱 공지가 그 밖으로 밀린다.
    const remote = await fetchNotices(20, ['app']).catch(() => null)
    // 실패하면 사본을 안 건드린다. 빈 배열은 실패가 아니라 서버에 공지가 없다는 답이다.
    if (remote !== null) await saveNoticeResponse('app', remote).catch(() => undefined)

    await get().load()
  },
  async dismiss() {
    const { notice } = get()
    if (notice === null) return

    await dismissNotice(notice.id)
    // 다시 고른다. 후보가 최신 하나뿐이라 이 자리는 비고, 옛 공지가 올라오지 않는다.
    await get().load()
  },
}))
