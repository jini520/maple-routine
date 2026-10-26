/**
 * jest 판 `lib/game-data/initial`. 표가 fixture 의 실제 게임 데이터로 시작한다.
 *
 * fixture 는 운영 서버 `GET /v1/game-data` 를 칸마다 떠 둔 것이다. 값을 고정해 두는 테스트가 많아서 서버가 바뀌어도
 * 따라 바꾸지 않는다. 계약을 어긴 fixture 는 던진다. 그 칸의 테스트가 빈 표로 돌면 엉뚱한 곳에서 실패한다.
 */
import type { GameDataSection } from '../../types/game-data'

import assets from './assets.json'
import bossDrops from './boss-drops.json'
import bosses from './bosses.json'
import cashbookCategories from './cashbook-categories.json'
import contents from './contents.json'
import crystalPrices from './crystal-prices.json'
import dropBoxes from './drop-boxes.json'
import dropItems from './drop-items.json'
import enhancementCosts from './enhancement-costs.json'
import equipmentItems from './equipment-items.json'
import huntingGrounds from './hunting-grounds.json'
import imageCrops from './image-crops.json'
import mvpGrades from './mvp-grades.json'
import spendCatalog from './spend-catalog.json'
import symbolCosts from './symbol-costs.json'
import worlds from './worlds.json'

const FIXTURES: Record<GameDataSection, unknown> = {
  bosses,
  dropItems,
  bossDrops,
  dropBoxes,
  crystalPrices,
  worlds,
  spendCatalog,
  cashbookCategories,
  symbolCosts,
  contents,
  equipmentItems,
  enhancementCosts,
  mvpGrades,
  huntingGrounds,
  assets,
  imageCrops,
}

export function initialTable<T>(name: GameDataSection, _empty: T, parse: (value: unknown) => T | null): T {
  const value = parse(FIXTURES[name])
  if (value === null) throw new Error(`fixture ${name} 이 계약을 어겼습니다`)
  return value
}
