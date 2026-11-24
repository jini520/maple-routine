/**
 * 컨텐츠 스케줄러의 화면 상태. 넥슨에서 받은 값은 여기 없다. 그것은 쿼리 캐시가 들고 `useContentSchedule` 이 뷰로
 * 만든다. 여기 남는 것은 기기에만 있는 값(수동 추적)과 화면이 고른 것(탭)뿐이다.
 */
import { create } from 'zustand'

import { isGuildContent } from '../../lib/scheduler/content-category'
import { findContent } from '../../lib/scheduler/contents'
import type { CachedCharacterBasicEntry } from '../../storage/character-basic-cache'
import {
  getManualTrackedContent,
  setManualTrackedContent,
  type ManualTrackedItem,
} from '../../storage/manual-tracked-content'
import { batchRecordWrites } from '../../storage/record-revision-batch'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { readTrackedOcidsSync } from '../schedule-sync/read-schedule'
import { useTrackingModeStore } from '../tracking-mode/store'
import { applyContentManageDraft, isContentTracked, type ContentManageDraft } from './manage-draft'

export type { ContentCharacterView } from './views'

// 스케줄러 화면과 관리 페이지가 함께 쓰는 탭 식별자. 두 화면이 각자 선언하면 그 복제가 각자
// 판단해도 된다 처럼 보인다.
export type ContentTab = 'daily' | 'weekly'

export interface ContentSchedulerState {
  // 수동 모드에서 캐릭터별 추적 항목(멤버십). 값 필드는 여기 두지 않고 표시 시점에 캐시의
  // 동기화 값 또는 템플릿에서 조회한다.
  manualTrackedByOcid: Record<string, ManualTrackedItem[]>
  // 화면 로컬 state 가 아니라 스토어가 소유한다. 화면이 언마운트돼도 살아남고, 관리 페이지가
  // 같은 값을 읽어 보던 탭 그대로 열린다. 영속화하지 않는다. 앱을 다시 켜면 기본값으로 돌아온다.
  activeTab: ContentTab
}

export interface ContentSchedulerStore extends ContentSchedulerState {
  /** 추적 캐릭터의 기기 값을 읽는다. 수동 모드에서만 멤버십을 읽는다. 자동 모드는 등록 여부로 목록을 정한다. */
  loadLocal(ocids: readonly string[]): Promise<void>
  /** 캐시의 추적 목록으로 `loadLocal`. 설정이 모드를 바꾼 뒤 부른다. */
  reloadLocal(): Promise<void>
  /**
   * 컨텐츠 관리의 초안을 한 번에 저장하는 함수. 쓰기 알림은 끝날 때 한 번이다. 실패하면 던진다.
   *
   * 길드에 가입하지 않은 캐릭터의 길드 컨텐츠는 새로 켜지 않고 나머지만 저장한다.
   */
  saveManualContentDraft(ocid: string, draft: ContentManageDraft): Promise<void>
  // 보스 수익의 setTab 과 달리 동기다. 그쪽은 탭이 바뀌면 기간을 다시 불러와야 하지만 여기 탭은
  // 이미 받아 둔 데이터를 갈라 보여줄 뿐이라 네트워크가 없다.
  setActiveTab(tab: ContentTab): void
}

const initialState: ContentSchedulerState = {
  manualTrackedByOcid: {},
  activeTab: 'daily',
}

export const useContentSchedulerStore = create<ContentSchedulerStore>()((set, get) => ({
  ...initialState,

  async loadLocal(ocids) {
    if (useTrackingModeStore.getState().mode !== 'manual') {
      set({ manualTrackedByOcid: {} })
      return
    }
    const manualTrackedByOcid = Object.fromEntries(
      await Promise.all(ocids.map(async (ocid) => [ocid, await getManualTrackedContent(ocid)] as const)),
    )
    set({ manualTrackedByOcid })
  },

  reloadLocal() {
    return get().loadLocal(readTrackedOcidsSync() ?? [])
  },

  setActiveTab(tab) {
    set({ activeTab: tab })
  },

  // 저장소(단일 진실 공급원)에서 지금 배열을 읽어 초안을 얹고 한 번 쓴 뒤 화면 상태를 갱신한다. 받기가 넣은 항목을 덮지 않는다.
  // 값 필드는 저장하지 않는다. kind 는 화면이 탭으로 정해 넘긴다. 선택할 수 없는 항목은 여기서 막는다. 화면에서만 막으면 다른 호출
  // 경로가 샌다.
  saveManualContentDraft(ocid, draft) {
    return batchRecordWrites(async () => {
      // 길드 콘텐츠는 길드에 가입한 캐릭터만 진행할 수 있다. guildName이 null일 때만
      // 막는다. undefined는 "미가입"이 아니라 "모름"이라 잠그면 안 된다(같은 이유로 기본 정보가 없어도 통과).
      const guildName = queryClient.getQueryData<CachedCharacterBasicEntry>(queryKeys.characterBasic(ocid))?.profile.guildName
      const current = await getManualTrackedContent(ocid)
      // 이미 추적 중인 길드 콘텐츠는 그대로 둔다. 길드를 나가도 끌 수 있어야 한다.
      const allowed: ContentManageDraft =
        guildName === null
          ? {
              daily: withoutGuildAdds(draft.daily, current, 'daily'),
              weekly: withoutGuildAdds(draft.weekly, current, 'weekly'),
            }
          : draft
      const next = applyContentManageDraft(current, allowed)
      await setManualTrackedContent(ocid, next)
      set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, [ocid]: next } }))
    })
  },
}))

/** 새로 켜는 길드 콘텐츠를 뺀 초안 한 종류. */
function withoutGuildAdds(
  draft: ContentManageDraft['daily'],
  current: readonly ManualTrackedItem[],
  kind: 'daily' | 'weekly',
): ContentManageDraft['daily'] {
  return Object.fromEntries(
    Object.entries(draft).filter(
      ([contentKey, tracked]) =>
        tracked !== true || isContentTracked(current, kind, contentKey) || !isGuildContent(findContent(contentKey)),
    ),
  )
}
