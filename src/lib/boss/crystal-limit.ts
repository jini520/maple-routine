/**
 * 주간 결정석 판매 한도를 따로 세는 묶음(한도 줄)을 가르는 규칙.
 *
 * @see docs/features/boss-profit.md 의 `결정석 칸`
 */
import { isChallengersWorld } from '../world/worlds'

/** 게임이 한도를 메이플 ID 마다 세기 시작한 주의 키(목요일, KST). 세는 방식도 함께 바뀌어 서버 표가 아닌 코드의 값 */
export const CRYSTAL_LIMIT_PER_MAPLE_ID_FROM = '2026-11-19'

/** 메이플 ID 안에서 챌린저스가 아닌 월드를 함께 세는 한도 줄의 열쇠 */
export const GENERAL_LIMIT_LINE = 'general'

/** 그 주가 한도를 메이플 ID 마다 세는 주인지 여부. 아니면 월드마다 세는 주 */
export function countsCrystalLimitPerMapleId(weekKey: string): boolean {
  return weekKey >= CRYSTAL_LIMIT_PER_MAPLE_ID_FROM
}

/**
 * 메이플 ID 안에서 그 월드가 드는 한도 줄의 열쇠.
 *
 * @param weekKey 주 키(목요일 `YYYY-MM-DD`)
 * @returns 메이플 ID 마다 세는 주는 챌린저스 월드만 제 월드 key 이고 나머지는 `general`, 그 전 주는 월드 key
 */
export function crystalLimitLineKey(worldKey: string, weekKey: string): string {
  if (!countsCrystalLimitPerMapleId(weekKey)) return worldKey
  return isChallengersWorld(worldKey) ? worldKey : GENERAL_LIMIT_LINE
}
