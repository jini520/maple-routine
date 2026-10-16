/**
 * 우리 서버 `GET /v1/game-data` 에서 받아 계약을 통과한 칸들. 칸 하나가 표 하나다.
 *
 * 못 받았거나 계약을 어겼거나 서버가 아직 안 넣은 칸은 `null` 이다. 받는 쪽은 그 칸을 건너뛰고 들고 있던
 * 표를 그대로 쓴다. 표가 옮겨 올 때마다 칸이 는다.
 */
import type { BossCatalog } from './boss-catalog'

export interface GameData {
  bosses: BossCatalog | null
}
