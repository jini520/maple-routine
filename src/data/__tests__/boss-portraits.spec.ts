/// <reference types="node" />
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import bossesData from '../bosses.json'

const bossesDir = join(__dirname, '../../assets/bosses')

// 서버가 새 보스를 넣어도 그 그림은 앱 번들에 있어야 그려진다. 번들 사본의 보스는 전부 그림이 있어야 한다.
describe('보스 초상화 파일 정합성', () => {
  it('모든 보스의 portraitSlug 에 통합 초상화 파일(난이도 무관 1장)이 실제로 존재한다', () => {
    const missingFiles: string[] = []

    for (const boss of bossesData.bosses) {
      const fileName = `${boss.portraitSlug}.webp`
      if (!existsSync(join(bossesDir, fileName))) {
        missingFiles.push(`${boss.key} -> ${fileName}`)
      }
    }

    expect(missingFiles).toEqual([])
  })
})
