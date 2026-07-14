import { describe, expect, it } from 'vitest'
import { matchDailyQuestRegionSlug, stripDailyQuestPrefix } from '../daily-quest-matching'

describe('stripDailyQuestPrefix', () => {
  it('"[일일 퀘스트] " 접두어를 제거한다', () => {
    expect(stripDailyQuestPrefix('[일일 퀘스트] 레헬른의 평온한 밤')).toBe('레헬른의 평온한 밤')
  })

  it('접두어가 없으면 원본 그대로 반환한다', () => {
    expect(stripDailyQuestPrefix('몬스터파크')).toBe('몬스터파크')
  })
})

describe('matchDailyQuestRegionSlug', () => {
  // 2026-07-14 사용자 제공 실제 API 응답의 daily_contents 17개 전체
  const cases: Array<[string, string]> = [
    ['소멸의 여로 조사', 'vanishingJourney'],
    ['츄츄 아일랜드 최고의 요리', 'chuchuIsland'],
    ['레헬른의 평온한 밤', 'lachelein'],
    ['아르카나의 평온한 바람', 'arcana'],
    ['모라스의 안정을 위해', 'morass'],
    ['에스페라 연구 명령', 'esfera'],
    ['문브릿지 조사', 'moonbridge'],
    ['고통의 미궁 조사', 'labyrinthOfSuffering'],
    ['리멘 조사', 'limen'],
    ['세르니움 조사', 'cernium'],
    ['호텔 아르크스 주변 청소', 'hotelArcus'],
    ['오디움 일대 탐사', 'odium'],
    ['도원경 오염 정화', 'dowonkyung'],
    ['아르테리아 잔당 처치', 'arteria'],
    ['카르시온 복구 지원', 'carcion'],
    ['탈라하트 고대신의 힘 조사', 'tallahart'],
    ['기어드락 크로노스의 잔재 수집', 'geardrock'],
  ]

  it.each(cases)('"%s"는 슬러그 "%s"로 매칭된다', (displayName, expectedSlug) => {
    expect(matchDailyQuestRegionSlug(displayName)).toBe(expectedSlug)
  })

  it('매칭되는 지역이 없으면 null을 반환한다', () => {
    expect(matchDailyQuestRegionSlug('알 수 없는 퀘스트')).toBeNull()
  })
})
