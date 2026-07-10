/// <reference types="node" />
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import weeklyBosses from '../weekly-bosses.json'

const bossesDir = join(dirname(fileURLToPath(import.meta.url)), '../../assets/bosses')

const DIFFICULTY_PREFIX: Record<string, string> = {
  이지: 'easy',
  노멀: 'normal',
  하드: 'hard',
  카오스: 'chaos',
  익스트림: 'extreme',
}

describe('보스 초상화 파일 정합성', () => {
  it('portraitSlug가 있는 보스는 등록된 모든 난이도의 초상화 파일이 실제로 존재한다', () => {
    const missingFiles: string[] = []
    const sections = [...weeklyBosses.weekly, ...weeklyBosses.eventWeekly, ...weeklyBosses.monthly]

    for (const entry of sections) {
      const slug = (entry as { portraitSlug?: string }).portraitSlug
      if (!slug) continue

      for (const difficulty of entry.difficulties) {
        const prefix = DIFFICULTY_PREFIX[difficulty]
        expect(prefix, `알 수 없는 난이도 표기: ${difficulty}`).toBeDefined()

        const fileName = `${prefix}_${slug}.png`
        if (!existsSync(join(bossesDir, fileName))) {
          missingFiles.push(`${entry.boss} (${difficulty}) -> ${fileName}`)
        }
      }
    }

    expect(missingFiles).toEqual([])
  })

  it('portraitSlug가 없는 보스는 초상화 파일이 아직 없다는 뜻으로만 쓰인다(오탈자 방지용 존재 확인 생략)', () => {
    const sections = [...weeklyBosses.weekly, ...weeklyBosses.eventWeekly, ...weeklyBosses.monthly]
    const withoutSlug = sections.filter((entry) => !('portraitSlug' in entry)).map((entry) => entry.boss)

    // 문서화 목적의 스냅샷 성격 검증 — 목록이 예상과 다르면(신규 이미지 추가 등) 실패해 갱신을 유도
    expect(withoutSlug).toEqual(['자쿰', '매그너스', '파풀라투스', '반반', '피에르', '블러디 퀸', '벨룸', '벨로나'])
  })
})
