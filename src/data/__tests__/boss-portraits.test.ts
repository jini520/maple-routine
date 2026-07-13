/// <reference types="node" />
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import weeklyBosses from '../weekly-bosses.json'

const bossesDir = join(dirname(fileURLToPath(import.meta.url)), '../../assets/bosses')

describe('보스 초상화 파일 정합성', () => {
  it('portraitSlug가 있는 보스는 통합 초상화 파일(난이도 무관 1장)이 실제로 존재한다', () => {
    const missingFiles: string[] = []
    const sections = [...weeklyBosses.weekly, ...weeklyBosses.eventWeekly, ...weeklyBosses.monthly]

    for (const entry of sections) {
      const slug = (entry as { portraitSlug?: string }).portraitSlug
      if (!slug) continue

      const fileName = `${slug}.webp`
      if (!existsSync(join(bossesDir, fileName))) {
        missingFiles.push(`${entry.boss} -> ${fileName}`)
      }
    }

    expect(missingFiles).toEqual([])
  })

  it('portraitSlug가 없는 보스는 초상화 파일이 아직 없다는 뜻으로만 쓰인다(오탈자 방지용 존재 확인 생략)', () => {
    const sections = [...weeklyBosses.weekly, ...weeklyBosses.eventWeekly, ...weeklyBosses.monthly]
    const withoutSlug = sections.filter((entry) => !('portraitSlug' in entry)).map((entry) => entry.boss)

    // 문서화 목적의 스냅샷 성격 검증 — 목록이 예상과 다르면(신규 이미지 추가 등) 실패해 갱신을 유도
    expect(withoutSlug).toEqual(['벨로나'])
  })
})
