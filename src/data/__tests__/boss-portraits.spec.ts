/// <reference types="node" />
import { existsSync } from 'node:fs'
import {  join } from 'node:path'
import weeklyBosses from '../weekly-bosses.json'

const bossesDir = join(__dirname, '../../assets/bosses')

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
    // 전 엔트리에 portraitSlug 가 붙은 지금, JSON 리터럴 타입 그대로 두면 `in` 좁히기의 부정
    // 갈래가 never 로 접혀 컴파일이 깨진다. 슬러그 유무를 데이터가 아니라 **스키마**로 보도록
    // 넓힌 타입으로 읽는다(다시 슬러그 없는 보스가 생겨도 이 테스트는 그대로 선다).
    const sections = [
      ...weeklyBosses.weekly,
      ...weeklyBosses.eventWeekly,
      ...weeklyBosses.monthly,
    ] as { boss: string; portraitSlug?: string }[]
    const withoutSlug = sections.filter((entry) => !('portraitSlug' in entry)).map((entry) => entry.boss)

    // 문서화 목적의 스냅샷 성격 검증. 목록이 예상과 다르면(신규 이미지 추가 등) 실패해 갱신을 유도.
    // 벨로나 출시로 초상화가 붙어 현재는 전 보스가 슬러그를 갖는다.
    expect(withoutSlug).toEqual([])
  })
})
