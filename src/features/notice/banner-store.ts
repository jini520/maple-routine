/**
 * today 배너가 세우는 공지 하나.
 *
 * **문이 둘이고 그 차이가 이 파일의 실질이다.**
 *
 * - `load()`. 기기만 읽는다. 네트워크가 없어 언제 불러도 싸다.
 * - `refresh()`. 서버에서 받아 기기에 합친 뒤 다시 고른다.
 *
 * 앞에 있을 때 도착한 푸시가 `load()` 를 두드리므로 그 문에 네트워크를 붙이면 알림 한 건이
 * 요청 한 건이 된다. 반대로 배경에서 도착만 하고 안 탭한 공지는 기기에 없어서, `refresh()` 가
 * 없으면 첫 화면이 그것을 영영 모른다.
 */
import { create } from 'zustand'

import { fetchNotices } from '../../server/notices'
import { dismissNotice, getDismissedNoticeIds } from '../../storage/notice-banner'
import { getNotices, mergeNotices } from '../../storage/notices'
import type { Notice } from '../../types/notice'
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
    // 조회 실패를 배너의 실패로 만들지 않는다. 기기에 있는 것은 그대로 선다.
    const remote = await fetchNotices().catch(() => [])
    if (remote.length > 0) await mergeNotices(remote).catch(() => undefined)

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
