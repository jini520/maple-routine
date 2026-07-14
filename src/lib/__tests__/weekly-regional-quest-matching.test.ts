import { describe, expect, it } from 'vitest'
import { matchWeeklyRegionalQuestSlug } from '../weekly-regional-quest-matching'

describe('matchWeeklyRegionalQuestSlug', () => {
  const cases: Array<[string, string]> = [
    ['에르다 스펙트럼', 'vanishingJourney'],
    ['배고픈 무토', 'chuchuIsland'],
    ['미드나잇 체이서', 'lachelein'],
    ['스피릿 세이비어', 'arcana'],
    ['엔하임 디펜스', 'morass'],
    ['프로텍트 에스페라', 'esfera'],
  ]

  it.each(cases)('"%s"는 슬러그 "%s"로 매칭된다', (name, expectedSlug) => {
    expect(matchWeeklyRegionalQuestSlug(name)).toBe(expectedSlug)
  })

  it('매칭되는 콘텐츠명이 없으면 null을 반환한다', () => {
    expect(matchWeeklyRegionalQuestSlug('에픽 던전 : 하이마운틴')).toBeNull()
  })
})
