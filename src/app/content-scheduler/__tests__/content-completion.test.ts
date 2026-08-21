// 완료 판정의 **출처**를 고정한다([[ADR-142]] 결정 4).
//
// 케이스를 카드 렌더러의 갈래마다 하나씩 둔다 — 이 표가 카드와 갈라지는 순간이 곧 링이 거짓말을
// 시작하는 순간이라, 여기 없는 갈래는 «아직 안 본 갈래» 가 아니라 **빠뜨린 갈래**다.
import type { DailyContent, WeeklyContent } from '../../../types'

import {
  dailyContentCompletion,
  dailyContentProgress,
  weeklyContentCompletion,
  weeklyContentProgress,
} from '../content-completion'

function daily(overrides: Partial<DailyContent> = {}): DailyContent {
  return {
    name: '일일 퀘스트',
    kind: 'quest',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: 0,
    ...overrides,
  }
}

function weekly(overrides: Partial<WeeklyContent> = {}): WeeklyContent {
  return {
    name: '주간 항목',
    kind: 'quest',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: 0,
    ...overrides,
  }
}

describe('일간 완료 판정', () => {
  it('퀘스트는 quest_state 2 가 완료다', () => {
    expect(dailyContentCompletion(daily({ questState: 2 }))).toBe('complete')
    expect(dailyContentCompletion(daily({ questState: 1 }))).toBe('incomplete')
    expect(dailyContentCompletion(daily({ questState: 0 }))).toBe('incomplete')
  })

  it('몬스터파크는 카운트가 찼을 때 완료다', () => {
    const monsterPark = { name: '몬스터파크', kind: 'contents' as const, questState: null }
    expect(dailyContentCompletion(daily({ ...monsterPark, nowCount: 3, maxCount: 3 }))).toBe('complete')
    expect(dailyContentCompletion(daily({ ...monsterPark, nowCount: 2, maxCount: 3 }))).toBe('incomplete')
  })

  // 0/0을 100%로 읽으면 «아직 안 열린 항목» 이 전부 완료로 채워진다.
  it('maxCount 가 0이면 완료가 아니다', () => {
    expect(dailyContentCompletion(daily({ kind: 'contents', nowCount: 0, maxCount: 0 }))).toBe('incomplete')
  })
})

describe('주간 완료 판정', () => {
  it('에픽 던전은 한 번이라도 돌면 완료다', () => {
    const name = '에픽 던전 : 하이마운틴'
    expect(weeklyContentCompletion(weekly({ name, nowCount: 1 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ name, nowCount: 0 }))).toBe('incomplete')
  })

  it('길드 플래그 레이스도 참여 여부다', () => {
    const name = '[길드] 플래그 레이스'
    expect(weeklyContentCompletion(weekly({ name, nowCount: 1 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ name, nowCount: 0 }))).toBe('incomplete')
  })

  // [[ADR-142]] 정정 7(사용자 지시): 점수에 상한이 없어도 «참여했는가» 는 잴 수 있다 —
  // `unmeasurable` 이었다가 판정 대상이 됐다.
  it('길드 지하 수로는 점수가 0이 아니면 완료다', () => {
    const name = '[길드] 지하 수로'
    expect(weeklyContentCompletion(weekly({ name, nowCount: 1 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ name, nowCount: 1200 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ name, nowCount: 0 }))).toBe('incomplete')
  })

  it('길드 주간 미션 포인트는 카운트가 찼을 때 완료다', () => {
    const name = '[길드] 주간 미션 포인트'
    expect(weeklyContentCompletion(weekly({ name, nowCount: 30, maxCount: 30 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ name, nowCount: 29, maxCount: 30 }))).toBe('incomplete')
  })

  it('유니온 드래곤은 quest_state 다', () => {
    const name = '[메이플 유니온] 주간 드래곤 퇴치'
    expect(weeklyContentCompletion(weekly({ name, questState: 2 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ name, questState: 1 }))).toBe('incomplete')
  })

  it('지역 주간 콘텐츠는 카운트, 익스트림 몬스터파커만 quest_state 다', () => {
    // 지역 콘텐츠(에르다 스펙트럼)는 now/max 로 온다.
    expect(weeklyContentCompletion(weekly({ name: '에르다 스펙트럼', nowCount: 1, maxCount: 1 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ name: '에르다 스펙트럼', nowCount: 0, maxCount: 1 }))).toBe('incomplete')

    const extreme = '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?'
    expect(weeklyContentCompletion(weekly({ name: extreme, questState: 2, nowCount: 0, maxCount: 0 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ name: extreme, questState: 1, nowCount: 0, maxCount: 0 }))).toBe('incomplete')
  })

  it('성실한 조사에 대한 보답은 카운트가 찼을 때 완료다(quest_state 1 이어도)', () => {
    const name = '[주간 퀘스트] 성실한 조사에 대한 보답'
    expect(weeklyContentCompletion(weekly({ name, questState: 1, nowCount: 2, maxCount: 2 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ name, questState: 1, nowCount: 1, maxCount: 2 }))).toBe('incomplete')
  })

  it('그 밖의 주간 퀘스트는 quest_state 다', () => {
    const name = '[주간 퀘스트] 크리티아스'
    expect(weeklyContentCompletion(weekly({ name, questState: 2 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ name, questState: 0 }))).toBe('incomplete')
  })

  // 결정 4의 핵심 — 끝이 없는 항목은 «미완료» 가 아니라 «세지 않음» 이다. 정정 7 이후 이 자리에
  // 남은 것은 무릉도장 하나다(층수는 참여 여부로도 못 접는다 — 1층도 «했다» 인지는 답이 없다).
  it('무릉도장은 판정하지 않는다', () => {
    const name = '[주간 퀘스트] 무릉도장'
    expect(weeklyContentCompletion(weekly({ name, nowCount: 50, maxCount: 0 }))).toBe('unmeasurable')
    expect(weeklyContentCompletion(weekly({ name, nowCount: 0, maxCount: 0 }))).toBe('unmeasurable')
  })
})

describe('진행 합계', () => {
  it('완료 수와 셀 수 있는 수를 센다', () => {
    const contents = [
      daily({ name: 'a', questState: 2 }),
      daily({ name: 'b', questState: 0 }),
      daily({ name: 'c', questState: 2 }),
    ]

    expect(dailyContentProgress(contents)).toEqual({ completed: 2, total: 3 })
  })

  // 끝이 없는 항목이 분모에 들어가면 링이 100%에 절대 도달하지 못한다.
  it('끝이 없는 항목은 분모에서 빠진다', () => {
    const contents = [
      weekly({ name: '[주간 퀘스트] 무릉도장', nowCount: 90 }),
      // 지하 수로는 정정 7로 **분모에 든다** — 점수가 있으니 완료로도 센다.
      weekly({ name: '[길드] 지하 수로', nowCount: 1200 }),
      weekly({ name: '[주간 퀘스트] 크리티아스', questState: 2 }),
    ]

    expect(weeklyContentProgress(contents)).toEqual({ completed: 2, total: 2 })
  })

  it('빈 목록은 0/0 이다', () => {
    expect(dailyContentProgress([])).toEqual({ completed: 0, total: 0 })
  })
})
