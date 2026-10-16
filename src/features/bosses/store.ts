/**
 * 보스 표를 React 에 잇는 스토어. 화면은 이것을 구독해 표가 덮이면 다시 그린다.
 *
 * 표 자체는 `lib/boss/catalog` 가 들고 조회는 `lib/boss/bosses` 다. 이 스토어가 하는 일은 둘이다.
 * 기기 사본과 서버 응답의 `bosses` 칸으로 표를 덮는 것, 표가 바뀌었다는 사실을 React 에 알리는 것.
 * 서버를 부르는 것은 `features/game-data/hydrate` 다. 표 전부를 한 번에 받기 때문이다.
 */
import { create } from 'zustand'

import { getBossCatalog, setBossCatalog, subscribeBossCatalog } from '../../lib/boss/catalog'
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

/** 기기 사본이 있으면 그것으로 표를 세운다. 없거나 못 읽으면 번들 그대로다. **던지지 않는다.** */
export async function loadBossCatalogCopy(): Promise<void> {
  const copy = await getBossCatalogCopy().catch(() => null)
  if (copy !== null) setBossCatalog(copy)
}

/**
 * 서버 응답의 `bosses` 칸으로 표를 덮는다. `updatedAt` 이 지금 표와 같으면 아무 일도 없다.
 *
 * 저장 실패는 삼킨다. 이번 실행은 서버 표로 서고, 다음에 켜면 한 번 더 받는다.
 *
 * @param remote 서버가 준 표
 */
export async function applyBossCatalog(remote: BossCatalog): Promise<void> {
  if (remote.updatedAt === getBossCatalog().updatedAt) return

  await setBossCatalogCopy(remote).catch(() => undefined)
  setBossCatalog(remote)
}
