/**
 * 켤 때 한 번, 게임 데이터 표를 기기 사본과 서버 응답으로 덮는 흐름. **던지지 않는다.**
 *
 * 표마다 기기 사본을 먼저 세우고, 서버를 **한 번** 받아 칸마다 `updatedAt` 이 다른 표만 덮는다.
 * 칸이 `null` 이면(못 받았거나 계약을 어겼거나 서버가 아직 비었다) 그 표는 들고 있던 그대로다.
 * 표가 옮겨 올 때마다 줄이 하나씩 는다.
 */
import { fetchGameData } from '../../server/game-data'
import { applyBossCatalog, loadBossCatalogCopy } from '../bosses/store'

export async function hydrateGameData(): Promise<void> {
  await loadBossCatalogCopy()

  const remote = await fetchGameData()
  if (remote === null) return

  if (remote.bosses !== null) await applyBossCatalog(remote.bosses)
}
