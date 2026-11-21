import { INITIAL_GAME_DATA, SECTIONS, currentGameData } from '../sections'
import { GAME_DATA_SECTIONS, type GameDataSection } from '../../../types/game-data'

import appImages from '../../../__fixtures__/game-data/app-images.json'
import assets from '../../../__fixtures__/game-data/assets.json'
import bossDrops from '../../../__fixtures__/game-data/boss-drops.json'
import bosses from '../../../__fixtures__/game-data/bosses.json'
import cashbookCategories from '../../../__fixtures__/game-data/cashbook-categories.json'
import contents from '../../../__fixtures__/game-data/contents.json'
import crystalPrices from '../../../__fixtures__/game-data/crystal-prices.json'
import dropBoxes from '../../../__fixtures__/game-data/drop-boxes.json'
import enhancementCosts from '../../../__fixtures__/game-data/enhancement-costs.json'
import faqs from '../../../__fixtures__/game-data/faqs.json'
import gameRules from '../../../__fixtures__/game-data/game-rules.json'
import hexaMatrix from '../../../__fixtures__/game-data/hexa-matrix.json'
import huntingGrounds from '../../../__fixtures__/game-data/hunting-grounds.json'
import huntLoot from '../../../__fixtures__/game-data/hunt-loot.json'
import imageCrops from '../../../__fixtures__/game-data/image-crops.json'
import items from '../../../__fixtures__/game-data/items.json'
import mvpGrades from '../../../__fixtures__/game-data/mvp-grades.json'
import spendCatalog from '../../../__fixtures__/game-data/spend-catalog.json'
import symbolCosts from '../../../__fixtures__/game-data/symbol-costs.json'
import worlds from '../../../__fixtures__/game-data/worlds.json'

const RESPONSES: Record<GameDataSection, unknown> = {
  bosses,
  bossDrops,
  dropBoxes,
  crystalPrices,
  worlds,
  spendCatalog,
  cashbookCategories,
  symbolCosts,
  hexaMatrix,
  contents,
  enhancementCosts,
  mvpGrades,
  huntingGrounds,
  huntLoot,
  assets,
  imageCrops,
  faqs,
  appImages,
  items,
  gameRules,
}

/** 1.0.15 계약으로 아직 옮기지 않은 칸. 칸을 옮길 때마다 하나씩 지우고, 비면 이 목록째 지운다. */
const NOT_YET_MOVED: readonly GameDataSection[] = [
  'bossDrops',
  'dropBoxes',
  'crystalPrices',
  'spendCatalog',
  'cashbookCategories',
  'symbolCosts',
  'hexaMatrix',
  'contents',
  'enhancementCosts',
  'mvpGrades',
  'huntingGrounds',
  'huntLoot',
  'assets',
  'imageCrops',
  'faqs',
]

/** 응답의 `null` 칸을 지운 값. 계약 검사는 `null` 인 선택 칸을 빠진 칸으로 만든다. */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, field]) => (field === null ? [] : [[key, withoutNulls(field)]])),
  )
}

describe('SECTIONS', () => {
  it('칸 전부가 GAME_DATA_SECTIONS 와 같은 차례다', () => {
    expect(Object.keys(SECTIONS)).toEqual(GAME_DATA_SECTIONS)
  })

  // 표의 초기값은 계약을 통과한 값이다. 한 번 더 통과시켜도 같아야 응답을 덮어도 모양이 그대로다.
  it('fixture 칸 전부가 계약을 통과하고, 통과한 값을 다시 통과시켜도 같다', () => {
    for (const section of GAME_DATA_SECTIONS) {
      expect(SECTIONS[section].parse(INITIAL_GAME_DATA[section])).toEqual(INITIAL_GAME_DATA[section])
    }
  })

  // 앱 안의 값이 응답과 다른 모양이면 앱 안의 이름과 서버 · 관리 화면의 이름이 다시 갈린다.
  it('옮긴 칸은 계약을 통과한 값이 서버 응답과 같다. 다른 것은 null 인 선택 칸이 빠진 것뿐이다', () => {
    for (const section of GAME_DATA_SECTIONS.filter((name) => !NOT_YET_MOVED.includes(name))) {
      expect({ section, value: SECTIONS[section].parse(RESPONSES[section]) }).toEqual({
        section,
        value: withoutNulls(RESPONSES[section]),
      })
    }
  })
})

describe('currentGameData', () => {
  afterEach(() => {
    SECTIONS.mvpGrades.table.set(INITIAL_GAME_DATA.mvpGrades)
  })

  it('처음에는 fixture 칸 전부다', () => {
    expect(currentGameData()).toEqual(INITIAL_GAME_DATA)
  })

  it('표를 덮으면 그 칸이 새 값이다', () => {
    const 새표 = { ...INITIAL_GAME_DATA.mvpGrades, updatedAt: '2026-10-18T00:00:00.000Z' }
    SECTIONS.mvpGrades.table.set(새표)

    expect(currentGameData().mvpGrades).toBe(새표)
    expect(currentGameData().bosses).toBe(INITIAL_GAME_DATA.bosses)
  })
})
