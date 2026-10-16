// 게임 데이터 동기화 스크립트. 서버 응답을 번들 파일들로 바꾸는 부분만 본다. 네트워크는 안 부른다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderBossesFile, renderGameDataFiles } from '../sync-game-data.mjs'

const 보스표 = {
  updatedAt: '2026-10-15T01:00:00.000Z',
  rules: { weeklyBossSelectionLimit: 12, weeklyCrystalSaleLimit: 90 },
  bosses: [
    {
      key: 'lotus',
      name: '스우',
      alias: '스우',
      cycle: 'weekly',
      portraitSlug: 'lotus',
      difficulties: [{ difficulty: 'normal', requiredLevel: 190 }],
    },
  ],
}
const 빈보스표 = { updatedAt: null, rules: { weeklyBossSelectionLimit: null, weeklyCrystalSaleLimit: null }, bosses: [] }

describe('renderGameDataFiles', () => {
  it('칸마다 번들 파일 하나다', () => {
    const { files, skipped } = renderGameDataFiles({ bosses: 보스표 })

    expect(files.map((f) => f.path)).toEqual(['src/data/bosses.json'])
    expect(JSON.parse(files[0].text)).toEqual(보스표)
    expect(skipped).toEqual([])
  })

  // 아직 한 번도 안 넣은 표다. 빈 표로 번들을 덮으면 앱이 그 표 없이 뜬다. 파일을 안 건드리고 이름만 알린다.
  it('updatedAt 이 null 인 칸은 파일을 안 쓰고 skipped 에 적는다', () => {
    const { files, skipped } = renderGameDataFiles({ bosses: 빈보스표 })

    expect(files).toEqual([])
    expect(skipped).toEqual(['bosses'])
  })

  it('칸이 없어도 skipped 다', () => {
    expect(renderGameDataFiles({}).skipped).toEqual(['bosses'])
  })

  it('응답이 객체가 아니면 던진다', () => {
    expect(() => renderGameDataFiles('표')).toThrow()
  })
})

describe('renderBossesFile', () => {
  it('updatedAt · rules · bosses 를 그 차례로, 들여쓰기 둘과 끝 줄바꿈으로 쓴다', () => {
    const text = renderBossesFile({ ...보스표, extra: '덤' })

    expect(text.endsWith('\n')).toBe(true)
    expect(JSON.parse(text)).toEqual(보스표)
    expect(Object.keys(JSON.parse(text))).toEqual(['updatedAt', 'rules', 'bosses'])
    expect(text.split('\n')[1]).toBe('  "updatedAt": "2026-10-15T01:00:00.000Z",')
  })

  it.each([
    ['객체가 아니다', '표'],
    ['updatedAt 이 없다', 빈보스표],
    ['rules 가 없다', { ...보스표, rules: undefined }],
    ['bosses 가 비었다', { ...보스표, bosses: [] }],
  ])('%s → 던진다', (_name, body) => {
    expect(() => renderBossesFile(body)).toThrow()
  })

  // 번들 사본과 스크립트가 같은 모양을 내야 `git diff` 가 값의 변화만 보여준다.
  it('지금 번들 사본은 이 스크립트가 쓰는 모양과 같다', () => {
    // jest 가 CJS 로 돌려 `import.meta.url` 이 비어 있다. `__dirname` 은 있다.
    const bundled = readFileSync(join(__dirname, '../../src/data/bosses.json'), 'utf8')
    const parsed = JSON.parse(bundled)
    // 한 번 받아 둔 뒤로는 updatedAt 이 문자열이다. 아직 null 이면 값을 끼워 같은 모양인지만 본다.
    const stamped = parsed.updatedAt ?? '2026-10-15T01:00:00.000Z'

    expect(renderBossesFile({ ...parsed, updatedAt: stamped })).toBe(
      bundled.replace('"updatedAt": null', `"updatedAt": "${stamped}"`),
    )
  })
})
