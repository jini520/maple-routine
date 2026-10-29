/**
 * 칸 열일곱의 표와 계약 검사를 한 표로. 응답을 받는 쪽(`server/game-data`)과 표를 덮는 쪽
 * (`features/game-data/sync`)이 칸 이름으로 이 표를 돈다.
 *
 * 표와 `parse` 는 칸마다 그 조회 모듈이 든다. 여기는 모은 자리일 뿐이고 칸을 더하면 여기 한 줄과
 * `types/game-data` 의 `GameData` 에 칸 하나가 는다.
 */
import type { GameData, GameDataSection } from '../../types/game-data'
import { assetFilesTable, parseAssetFiles } from '../assets/asset-files'
import { imageCropsTable, parseImageCrops } from '../assets/image-crops'
import { bossDropsTable, dropBoxesTable, parseBossDrops, parseDropBoxes } from '../boss/boss-drops'
import { crystalPricesTable, parseCrystalPrices } from '../boss/boss-crystal-prices'
import { bossCatalogTable, parseBossCatalog } from '../boss/catalog'
import { cashbookCategoriesTable, parseCashbookCategories } from '../cashbook/categories'
import { huntingGroundsTable, parseHuntingGrounds } from '../cashbook/hunting-grounds'
import { huntLootTable, parseHuntLoot } from '../cashbook/hunt-loot'
import { parseSpendCatalog, spendCatalogTable } from '../cashbook/spend-catalog'
import { parseSymbolCosts, symbolCostsTable } from '../cashbook/symbol-costs'
import { dropItemsTable, parseDropItems } from '../drop/drop-items'
import { enhancementCostsTable, parseEnhancementCosts } from '../enhancement/cost'
import { equipmentItemsTable, parseEquipmentItems } from '../equipment/equipment-items'
import { mvpGradesTable, parseMvpGrades } from '../mvp/grades'
import { contentsTable, parseContents } from '../scheduler/contents'
import { parseWorlds, worldsTable } from '../world/worlds'
import type { GameTable } from './table'

/**
 * 기기 사본의 계약 판. 칸의 계약(`parse`)이 바뀌어 옛 사본이 못 읽히게 되면 이 글자를 올린다.
 * 그러면 켤 때 옛 사본을 통째로 버리고 잠금 화면이 처음부터 받는다.
 */
export const GAME_DATA_CONTRACT = '2026-10-29'

export interface GameDataSectionEntry<T> {
  table: GameTable<T>
  parse: (value: unknown) => T | null
}

export const SECTIONS: { readonly [K in GameDataSection]: GameDataSectionEntry<GameData[K]> } = {
  bosses: { table: bossCatalogTable, parse: parseBossCatalog },
  dropItems: { table: dropItemsTable, parse: parseDropItems },
  bossDrops: { table: bossDropsTable, parse: parseBossDrops },
  dropBoxes: { table: dropBoxesTable, parse: parseDropBoxes },
  crystalPrices: { table: crystalPricesTable, parse: parseCrystalPrices },
  worlds: { table: worldsTable, parse: parseWorlds },
  spendCatalog: { table: spendCatalogTable, parse: parseSpendCatalog },
  cashbookCategories: { table: cashbookCategoriesTable, parse: parseCashbookCategories },
  symbolCosts: { table: symbolCostsTable, parse: parseSymbolCosts },
  contents: { table: contentsTable, parse: parseContents },
  equipmentItems: { table: equipmentItemsTable, parse: parseEquipmentItems },
  enhancementCosts: { table: enhancementCostsTable, parse: parseEnhancementCosts },
  mvpGrades: { table: mvpGradesTable, parse: parseMvpGrades },
  huntingGrounds: { table: huntingGroundsTable, parse: parseHuntingGrounds },
  huntLoot: { table: huntLootTable, parse: parseHuntLoot },
  assets: { table: assetFilesTable, parse: parseAssetFiles },
  imageCrops: { table: imageCropsTable, parse: parseImageCrops },
}

/** 지금 표 열일곱의 값. */
export function currentGameData(): GameData {
  const data: Partial<Record<GameDataSection, unknown>> = {}
  for (const key of Object.keys(SECTIONS) as GameDataSection[]) data[key] = SECTIONS[key].table.get()
  return data as GameData
}

/** 표의 첫 값. 앱에서는 빈 표이고 jest 에서는 fixture 다. 테스트가 표를 되돌릴 때 쓴다. */
export const INITIAL_GAME_DATA: GameData = currentGameData()
