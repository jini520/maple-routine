// 게임 데이터 동기화 스크립트. 서버 응답을 번들 파일들로 바꾸는 부분만 본다. 네트워크는 안 부른다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SECTIONS, fileNameOf, renderGameDataFiles, renderSectionFile } from '../sync-game-data.mjs'
import { GAME_DATA_SECTIONS } from '../../src/types/game-data'

const 보스표 = {
  updatedAt: '2026-10-15T01:00:00.000Z',
  rules: { weeklyBossSelectionLimit: 12, weeklyCrystalSaleLimit: 90, defaultMaxPartySize: 6 },
  bosses: [
    {
      key: 'lotus',
      name: '스우',
      alias: '스우',
      cycle: 'weekly',
      portraitSlug: 'lotus',
      difficulties: [{ difficulty: 'normal', requiredLevel: 190, maxPartySize: null, from: null, until: null }],
    },
  ],
}
const 월드표 = { updatedAt: '2026-10-16T15:07:54.435Z', worlds: [{ key: 'scania', name: '스카니아', emblem: 'scania', challengers: false, event: false }] }
const 빈보스표 = { updatedAt: null, rules: { weeklyBossSelectionLimit: null, weeklyCrystalSaleLimit: null }, bosses: [] }

describe('SECTIONS', () => {
  it('앱의 칸 열셋과 같은 차례다', () => {
    expect(SECTIONS).toEqual(GAME_DATA_SECTIONS)
  })

  it('파일 이름은 칸 이름을 kebab-case 로 바꾼 것이다', () => {
    expect(fileNameOf('bosses')).toBe('src/data/bosses.json')
    expect(fileNameOf('dropItems')).toBe('src/data/drop-items.json')
    expect(fileNameOf('huntingGrounds')).toBe('src/data/hunting-grounds.json')
  })
})

describe('renderGameDataFiles', () => {
  it('칸마다 번들 파일 하나다. 선택 칸의 null 도 응답 그대로 적는다', () => {
    const { files, skipped } = renderGameDataFiles({ bosses: 보스표, worlds: 월드표 })

    expect(files.map((f) => f.path)).toEqual(['src/data/bosses.json', 'src/data/worlds.json'])
    expect(JSON.parse(files[0].text)).toEqual(보스표)
    expect(JSON.parse(files[1].text)).toEqual(월드표)
    expect(skipped).toEqual(SECTIONS.filter((section) => section !== 'bosses' && section !== 'worlds'))
  })

  // 아직 한 번도 안 넣은 표다. 빈 표로 번들을 덮으면 앱이 그 표 없이 뜬다. 파일을 안 건드리고 이름만 알린다.
  it('updatedAt 이 null 인 칸은 파일을 안 쓰고 skipped 에 적는다', () => {
    const { files, skipped } = renderGameDataFiles({ bosses: 빈보스표 })

    expect(files).toEqual([])
    expect(skipped).toContain('bosses')
  })

  it('응답이 객체가 아니면 던진다', () => {
    expect(() => renderGameDataFiles('표')).toThrow()
  })
})

describe('renderSectionFile', () => {
  it('응답 칸을 들여쓰기 둘과 끝 줄바꿈으로 쓴다. 칸의 차례도 응답 그대로다', () => {
    const text = renderSectionFile('bosses', 보스표)

    expect(text.endsWith('\n')).toBe(true)
    expect(JSON.parse(text)).toEqual(보스표)
    expect(Object.keys(JSON.parse(text))).toEqual(['updatedAt', 'rules', 'bosses'])
    expect(text.split('\n')[1]).toBe('  "updatedAt": "2026-10-15T01:00:00.000Z",')
  })

  it.each([
    ['객체가 아니다', '표'],
    ['updatedAt 이 없다', 빈보스표],
  ])('%s → 던진다', (_name, body) => {
    expect(() => renderSectionFile('bosses', body)).toThrow()
  })

  // 번들 사본과 스크립트가 같은 모양을 내야 `git diff` 가 값의 변화만 보여준다.
  it.each(SECTIONS)('지금 번들 %s 는 이 스크립트가 쓰는 모양과 같다', (section) => {
    // jest 가 CJS 로 돌려 `import.meta.url` 이 비어 있다. `__dirname` 은 있다.
    const bundled = readFileSync(join(__dirname, '../..', fileNameOf(section)), 'utf8')

    expect(renderSectionFile(section, JSON.parse(bundled))).toBe(bundled)
  })
})
