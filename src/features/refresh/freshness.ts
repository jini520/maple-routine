/**
 * 페이지가 마지막으로 데이터를 부른 시각. 헤더 아래 한 줄이 이 값을 그린다.
 *
 * **페이지 단위인 것이 요점이다.** 스케줄러 둘은 고른 캐릭터의 `syncedAt` 을 적고 있었는데 그
 * 값은 캐릭터를 바꾸면 뛴다. today 는 스토어 넷을 읽으면서 그중 하나의 시각만 적고 있었다.
 * 페이지가 언제 갱신됐나 를 묻는 줄이라 답도 페이지 것이어야 한다.
 *
 * **적는 자리는 화면이다.** 화면이 데이터를 부르는 함수가 끝나는 곳에서 적는다. 진입 조회가
 * 게이트에 막혀 실제로 안 나간 회차에도 적히므로 이 값은 **최대 그 게이트만큼 낙관적**이다
 * (10분). 정확히 재려면 스토어 넷이 실제로 나갔는가 를 같은 모양으로 내야 한다.
 */
import { create } from 'zustand'

import {
  getDataFetchedAt,
  setDataFetchedAt,
  type FreshnessMap,
  type FreshnessPage,
} from '../../storage/data-freshness'

export type { FreshnessPage } from '../../storage/data-freshness'

interface DataFreshnessState {
  fetchedAt: FreshnessMap
  /** 저장된 맵을 상태에 올린다. 부팅이 한 번 부른다. */
  restore: () => Promise<void>
  /** 지금을 그 페이지의 시각으로 적는다. */
  markFetched: (page: FreshnessPage) => Promise<void>
}

export const useDataFreshness = create<DataFreshnessState>()((set) => ({
  fetchedAt: {},
  async restore() {
    // 실패해도 던지지 않는다. 줄 하나가 안 그려질 뿐이고 부팅을 막을 일이 아니다.
    set({ fetchedAt: await getDataFetchedAt().catch(() => ({})) })
  },
  async markFetched(page) {
    const now = new Date().toISOString()
    // 화면이 먼저 바뀐다. 저장이 늦거나 실패해도 방금 받은 것은 방금 받은 것이다.
    set((state) => ({ fetchedAt: { ...state.fetchedAt, [page]: now } }))
    await setDataFetchedAt(page, now).catch(() => undefined)
  },
}))
