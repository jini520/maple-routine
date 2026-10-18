/// <reference types="node" />
// 번들 열셋이 각 칸의 계약을 통과하고, 번들이 가리키는 그림 파일이 앱에 있는지 본다.
//
// 값은 서버가 기준이라 여기서 못박지 않는다. 참조 · 기간 겹침 · 경계는 서버의 FK · CHECK · 쓰기 검사가 든다.
// 그림은 서버가 파일명만 들고 앱 빌드가 파일을 들어, 서버가 새 파일명을 보내도 번들에 그림이 없으면 화면이
// 폴백을 그린다. 그 어긋남을 동기화할 때 여기서 잡는다.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { WORLD_EMBLEM_ASSETS } from '../../assets/generated/worlds'
import { getBossPortraitUrl, getDailyQuestBackgroundUrl } from '../../lib/assets/asset-lookup'
import { SPEND_REWARD_COIN } from '../../lib/cashbook/spend-catalog'
import { BUNDLED_GAME_DATA, SECTIONS } from '../../lib/game-data/sections'
import { GAME_DATA_SECTIONS, type GameDataSection } from '../../types/game-data'

const ASSETS = join(__dirname, '../../assets')

/** 칸 이름의 번들 파일. 동기화 스크립트가 쓰는 이름과 같다. */
function bundledFileOf(section: GameDataSection): unknown {
  const name = section.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  return JSON.parse(readFileSync(join(__dirname, '..', `${name}.json`), 'utf8')) as unknown
}

function itemIconExists(file: string): boolean {
  return existsSync(join(ASSETS, 'items', file)) || existsSync(join(ASSETS, 'items', 'rings', file))
}

describe('번들 열셋은 계약을 통과한다', () => {
  it.each(GAME_DATA_SECTIONS)('%s', (section) => {
    const raw = bundledFileOf(section)
    const parsed = SECTIONS[section].parse(raw)

    expect(parsed).not.toBeNull()
    // 서버에서 받아 쓴 사본이다. 받은 적 없는 null 이면 동기화를 안 돌린 것이다.
    expect(typeof (raw as { updatedAt: unknown }).updatedAt).toBe('string')
  })

  it('표가 처음 드는 값이 그 번들이다', () => {
    for (const section of GAME_DATA_SECTIONS) {
      expect(BUNDLED_GAME_DATA[section]).toEqual(SECTIONS[section].parse(bundledFileOf(section)))
    }
  })
})

describe('번들이 가리키는 그림 파일이 있다', () => {
  it('드롭 아이템의 그림은 assets/items/ 또는 assets/items/rings/ 에 있다', () => {
    const missing = BUNDLED_GAME_DATA.dropItems.items
      .filter((item) => item.iconFile !== undefined && !itemIconExists(item.iconFile))
      .map((item) => `${item.key} -> ${item.iconFile}`)
    expect(missing).toEqual([])
  })

  it('지출 타일의 그림 파일과 지역 아이콘이 있다. 세라자르 주화 그림도 있다', () => {
    const missing: string[] = []
    for (const tile of BUNDLED_GAME_DATA.spendCatalog.tiles) {
      if (tile.iconFile !== undefined && !existsSync(join(ASSETS, 'items', tile.iconFile))) missing.push(tile.key)
      if (
        tile.iconMap !== undefined &&
        !['webp', 'png'].some((ext) => existsSync(join(ASSETS, 'maps', 'icons', `${tile.iconMap}.${ext}`)))
      ) {
        missing.push(tile.key)
      }
    }
    expect(missing).toEqual([])
    expect(existsSync(join(ASSETS, 'items', SPEND_REWARD_COIN.icon))).toBe(true)
  })

  it('심볼 그림은 assets/items/ 에 있다', () => {
    const missing = BUNDLED_GAME_DATA.symbolCosts.symbols
      .filter((symbol) => !existsSync(join(ASSETS, 'items', symbol.iconFile)))
      .map((symbol) => symbol.key)
    expect(missing).toEqual([])
  })

  it('월드 엠블럼은 모두 에셋에 있다', () => {
    const missing = BUNDLED_GAME_DATA.worlds.worlds
      .filter((world) => world.emblem !== undefined && WORLD_EMBLEM_ASSETS[world.emblem] === undefined)
      .map((world) => world.key)
    expect(missing).toEqual([])
  })

  it('컨텐츠의 지도 배경과 보스 초상 slug 는 에셋에 있다', () => {
    const missing = BUNDLED_GAME_DATA.contents.contents
      .filter(
        (content) =>
          (content.backgroundMap !== undefined && getDailyQuestBackgroundUrl(content.backgroundMap) === null) ||
          (content.backgroundPortrait !== undefined && getBossPortraitUrl(content.backgroundPortrait) === null),
      )
      .map((content) => content.key)
    expect(missing).toEqual([])
  })

  it('보스 초상 slug 는 에셋에 있다', () => {
    const missing = BUNDLED_GAME_DATA.bosses.bosses
      .filter((boss) => getBossPortraitUrl(boss.portraitSlug) === null)
      .map((boss) => boss.key)
    expect(missing).toEqual([])
  })
})
