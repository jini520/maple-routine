// 보스 표 동기화 스크립트. 서버 응답을 번들 `src/data/bosses.json` 으로 바꾸는 부분만 본다.
// 네트워크는 안 부른다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderBossesFile } from '../sync-bosses.mjs'

const 응답 = {
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

describe('renderBossesFile', () => {
  it('updatedAt · rules · bosses 를 그 차례로, 들여쓰기 둘과 끝 줄바꿈으로 쓴다', () => {
    const text = renderBossesFile({ ...응답, extra: '덤' })

    expect(text.endsWith('\n')).toBe(true)
    expect(JSON.parse(text)).toEqual(응답)
    expect(Object.keys(JSON.parse(text))).toEqual(['updatedAt', 'rules', 'bosses'])
    expect(text.split('\n')[1]).toBe('  "updatedAt": "2026-10-15T01:00:00.000Z",')
  })

  // 아직 한 번도 안 넣은 서버의 모양이다. 빈 표로 번들을 덮으면 앱이 보스 없이 뜬다.
  it('서버가 비었으면(updatedAt null) 던진다', () => {
    expect(() =>
      renderBossesFile({ updatedAt: null, rules: { weeklyBossSelectionLimit: null, weeklyCrystalSaleLimit: null }, bosses: [] }),
    ).toThrow('아직 보스 표가 없습니다')
  })

  it.each([
    ['객체가 아니다', '표'],
    ['rules 가 없다', { ...응답, rules: undefined }],
    ['bosses 가 비었다', { ...응답, bosses: [] }],
  ])('%s → 던진다', (_name, body) => {
    expect(() => renderBossesFile(body)).toThrow()
  })

  // 번들 사본과 스크립트가 같은 모양을 내야 `git diff` 가 값의 변화만 보여준다.
  it('지금 번들 사본은 이 스크립트가 쓰는 모양과 같다', () => {
    // jest 가 CJS 로 돌려 `import.meta.url` 이 비어 있다. `__dirname` 은 있다.
    const bundled = readFileSync(join(__dirname, '../../src/data/bosses.json'), 'utf8')
    const parsed = JSON.parse(bundled)

    expect(renderBossesFile({ ...parsed, updatedAt: '2026-10-15T01:00:00.000Z' })).toBe(
      bundled.replace('"updatedAt": null', '"updatedAt": "2026-10-15T01:00:00.000Z"'),
    )
  })
})
