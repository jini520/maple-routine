import { describe, expect, it } from 'vitest'
import { matchWeeklyQuestRegionSlug, stripWeeklyQuestPrefix } from '../weekly-quest-matching'

describe('stripWeeklyQuestPrefix', () => {
  it('"[주간 퀘스트] " 접두어를 제거한다', () => {
    expect(stripWeeklyQuestPrefix('[주간 퀘스트] 크리티아스 주간 임무')).toBe('크리티아스 주간 임무')
  })

  it('접두어가 없으면 원본 그대로 반환한다', () => {
    expect(stripWeeklyQuestPrefix('무릉도장')).toBe('무릉도장')
  })
})

describe('matchWeeklyQuestRegionSlug', () => {
  // 2026-07-21 사용자 제공 주간 콘텐츠 목록 (ADR-021 연장)
  const cases: Array<[string, string]> = [
    ['성실한 조사에 대한 보답', 'roadOfVanishing'],
    ['크리티아스 주간 임무', 'critias'],
    ['타락한 세계수 정화에 대한 보답', 'fallenWorldTree'],
    ['타락한 세계수 주간 임무', 'fallenWorldTree'],
    ['헤이븐 주간 임무장', 'haven'],
    ['꾸준한 의뢰에 대한 보답', 'haven'],
    ['무릉도장', 'muruengRaid'],
  ]

  it.each(cases)('"%s"는 슬러그 "%s"로 매칭된다', (displayName, expectedSlug) => {
    expect(matchWeeklyQuestRegionSlug(displayName)).toBe(expectedSlug)
  })

  it('매칭되는 지역이 없으면 null을 반환한다', () => {
    expect(matchWeeklyQuestRegionSlug('알 수 없는 퀘스트')).toBeNull()
  })
})
