/**
 * 화면 머리 아래 한 줄이 읽는 값. **실시간 데이터를 마지막으로 받은 시각 하나**다.
 *
 * 페이지마다 따로 재지 않는다. 화면 다섯이 같은 실시간 원천(스케줄러 회차 · 오늘 강화)을
 * 공유하므로, 페이지마다 재면 같은 한 번의 조회로 그린 데이터인데 값이 갈린다.
 *
 * **적는 자리는 둘뿐이다.** `syncSchedules` 의 회차 하나(스케줄러 + `character/basic`)와,
 * 오늘이 든 범위의 강화 내역 조회. 기기 DB 읽기와 과거 기간 조회는 여기 안 닿는다.
 */
import { create } from 'zustand'

import { getRealtimeFetchedAt, setRealtimeFetchedAt } from '../../storage/data-freshness'

interface DataFreshnessState {
  /** ISO 8601. 받은 적이 없으면 `null` 이고 그때는 그 줄을 안 그린다. */
  fetchedAt: string | null
  /** 저장된 값을 상태에 올린다. 부팅이 한 번 부른다. */
  restore: () => Promise<void>
  /** 실시간 조회가 끝났다고 알린다. */
  markRealtimeFetch: (fetchedAt: string) => Promise<void>
}

export const useDataFreshness = create<DataFreshnessState>()((set, get) => ({
  fetchedAt: null,
  async restore() {
    // 실패해도 던지지 않는다. 줄 하나가 안 그려질 뿐이고 부팅을 막을 일이 아니다.
    set({ fetchedAt: await getRealtimeFetchedAt().catch(() => null) })
  },
  async markRealtimeFetch(fetchedAt) {
    const at = new Date(fetchedAt).getTime()
    if (Number.isNaN(at)) return

    // **뒤로 안 간다.** 회차에 합류한 호출이 같은 결과를 들고 한 번 더 알리고, 실패한 캐릭터는
    // 캐시의 옛 `syncedAt` 을 들고 온다. 큰 쪽만 남긴다.
    const current = get().fetchedAt
    if (current !== null && new Date(current).getTime() >= at) return

    set({ fetchedAt })
    await setRealtimeFetchedAt(fetchedAt).catch(() => undefined)
  },
}))
