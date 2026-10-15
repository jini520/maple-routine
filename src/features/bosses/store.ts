/**
 * 보스 표를 React 에 잇는 스토어. 화면은 이것을 구독해 표가 덮이면 다시 그린다.
 *
 * 표 자체는 `lib/boss/catalog` 가 들고 조회는 `lib/boss/bosses` 다. 이 스토어가 하는 일은 둘이다.
 * 켤 때 기기 사본과 서버 응답으로 표를 덮는 것, 표가 바뀌었다는 사실을 React 에 알리는 것.
 */
import { create } from 'zustand'

import { getBossCatalog, setBossCatalog, subscribeBossCatalog } from '../../lib/boss/catalog'
import { fetchBossCatalog } from '../../server/bosses'
import { getBossCatalogCopy, setBossCatalogCopy } from '../../storage/bosses'
import type { BossCatalog } from '../../types/boss-catalog'

interface BossCatalogState {
  /** 지금 표. 묶음 · 한도는 `lib/boss/bosses` 로 읽고 이 값은 다시 그릴 때를 아는 데 쓴다. */
  catalog: BossCatalog
}

export const useBossCatalogStore = create<BossCatalogState>()(() => ({
  catalog: getBossCatalog(),
}))

subscribeBossCatalog(() => {
  useBossCatalogStore.setState({ catalog: getBossCatalog() })
})

/**
 * 켤 때 한 번. 번들 → 기기 사본 → 서버 순으로 덮는다. **던지지 않는다.**
 *
 * 서버 응답은 `updatedAt` 이 지금 표와 다를 때만 쓰고, 그때 기기 사본도 함께 바꾼다. 못 받으면
 * 들고 있던 표 그대로다.
 */
export async function hydrateBossCatalog(): Promise<void> {
  const copy = await getBossCatalogCopy().catch(() => null)
  if (copy !== null) setBossCatalog(copy)

  const remote = await fetchBossCatalog()
  if (remote === null || remote.updatedAt === getBossCatalog().updatedAt) return

  // 저장 실패는 삼킨다. 이번 실행은 서버 표로 서고, 다음에 켜면 한 번 더 받는다.
  await setBossCatalogCopy(remote).catch(() => undefined)
  setBossCatalog(remote)
}
