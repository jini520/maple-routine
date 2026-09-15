// 완료 판정의 **출처**를 고정한다.
//
// 케이스를 카드 렌더러의 갈래마다 하나씩 둔다. 이 표가 카드와 갈라지는 순간이 곧 링이 거짓말을
// 시작하는 순간이라, 여기 없는 갈래는 **아직 안 본 갈래** 가 아니라 **빠뜨린 갈래**다.
import type { DailyContent, WeeklyContent } from '../../../types'

import {
  dailyContentCompletion,
  dailyContentProgress,
  weeklyContentCompletion,
  weeklyContentProgress,
  weeklyLimitClosedKeys,
} from '../content-completion'

function daily(overrides: Partial<DailyContent> = {}): DailyContent {
  return {
    contentKey: null,
    apiName: '일일 퀘스트',
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
    contentKey: null,
    apiName: '주간 항목',
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
    const monsterPark = { contentKey: 'monster_park', apiName: '몬스터파크', kind: 'contents' as const, questState: null }
    expect(dailyContentCompletion(daily({ ...monsterPark, nowCount: 3, maxCount: 3 }))).toBe('complete')
    expect(dailyContentCompletion(daily({ ...monsterPark, nowCount: 2, maxCount: 3 }))).toBe('incomplete')
  })

  // 0/0을 100%로 읽으면 **아직 안 열린 항목** 이 전부 완료로 채워진다.
  it('maxCount 가 0이면 완료가 아니다', () => {
    expect(dailyContentCompletion(daily({ kind: 'contents', nowCount: 0, maxCount: 0 }))).toBe('incomplete')
  })
})

describe('주간 완료 판정', () => {
  it('에픽 던전은 한 번이라도 돌면 완료다', () => {
    const epic = { contentKey: 'epic_dungeon_high_mountain', apiName: '에픽 던전 : 하이마운틴' }
    expect(weeklyContentCompletion(weekly({ ...epic, nowCount: 1 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ ...epic, nowCount: 0 }))).toBe('incomplete')
  })

  it('길드 플래그 레이스도 참여 여부다', () => {
    const flagRace = { contentKey: 'guild_flag_race', apiName: '[길드] 플래그 레이스' }
    expect(weeklyContentCompletion(weekly({ ...flagRace, nowCount: 1 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ ...flagRace, nowCount: 0 }))).toBe('incomplete')
  })

  // 점수에 상한이 없어도 참여했는가 는 잴 수 있다. 그래서 판정 대상이다.
  it('길드 지하 수로는 점수가 0이 아니면 완료다', () => {
    const waterway = { contentKey: 'guild_underground_waterway', apiName: '[길드] 지하 수로' }
    expect(weeklyContentCompletion(weekly({ ...waterway, nowCount: 1 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ ...waterway, nowCount: 1200 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ ...waterway, nowCount: 0 }))).toBe('incomplete')
  })

  it('길드 주간 미션 포인트는 카운트가 찼을 때 완료다', () => {
    const points = { contentKey: 'guild_weekly_mission_points', apiName: '[길드] 주간 미션 포인트' }
    expect(weeklyContentCompletion(weekly({ ...points, nowCount: 30, maxCount: 30 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ ...points, nowCount: 29, maxCount: 30 }))).toBe('incomplete')
  })

  it('유니온 드래곤은 quest_state 다', () => {
    const dragon = { contentKey: 'maple_union_weekly_dragon', apiName: '[메이플 유니온] 주간 드래곤 퇴치' }
    expect(weeklyContentCompletion(weekly({ ...dragon, questState: 2 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ ...dragon, questState: 1 }))).toBe('incomplete')
  })

  it('지역 주간 콘텐츠는 카운트, 익스트림 몬스터파커만 quest_state 다', () => {
    // 지역 콘텐츠(에르다 스펙트럼)는 now/max 로 온다.
    const erda = { contentKey: 'erda_spectrum', apiName: '에르다 스펙트럼' }
    expect(weeklyContentCompletion(weekly({ ...erda, nowCount: 1, maxCount: 1 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ ...erda, nowCount: 0, maxCount: 1 }))).toBe('incomplete')

    const extreme = { contentKey: 'monster_park_extreme', apiName: '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?' }
    expect(weeklyContentCompletion(weekly({ ...extreme, questState: 2, nowCount: 0, maxCount: 0 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ ...extreme, questState: 1, nowCount: 0, maxCount: 0 }))).toBe('incomplete')
  })

  it('성실한 조사에 대한 보답은 카운트가 찼을 때 완료다(quest_state 1 이어도)', () => {
    const faithful = {
      contentKey: 'weekly_quest_faithful_investigation_reward',
      apiName: '[주간 퀘스트] 성실한 조사에 대한 보답',
    }
    expect(weeklyContentCompletion(weekly({ ...faithful, questState: 1, nowCount: 2, maxCount: 2 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ ...faithful, questState: 1, nowCount: 1, maxCount: 2 }))).toBe('incomplete')
  })

  it('그 밖의 주간 퀘스트는 quest_state 다', () => {
    const critias = { contentKey: 'weekly_quest_critias', apiName: '[주간 퀘스트] 크리티아스 주간 임무' }
    expect(weeklyContentCompletion(weekly({ ...critias, questState: 2 }))).toBe('complete')
    expect(weeklyContentCompletion(weekly({ ...critias, questState: 0 }))).toBe('incomplete')
  })

  // 끝이 없는 항목은 미완료가 아니라 세지 않음이다. 이 자리에 남은 것은 무릉도장 하나다.
  // 층수는 참여 여부로도 못 접는다. 1층도 했다 인지는 답이 없다.
  it('무릉도장은 판정하지 않는다', () => {
    const muLungDojo = { contentKey: 'mu_lung_dojo', apiName: '무릉도장' }
    expect(weeklyContentCompletion(weekly({ ...muLungDojo, nowCount: 50, maxCount: 0 }))).toBe('unmeasurable')
    expect(weeklyContentCompletion(weekly({ ...muLungDojo, nowCount: 0, maxCount: 0 }))).toBe('unmeasurable')
  })
})

describe('진행 합계', () => {
  it('완료 수와 셀 수 있는 수를 센다', () => {
    const contents = [
      daily({ apiName: 'a', questState: 2 }),
      daily({ apiName: 'b', questState: 0 }),
      daily({ apiName: 'c', questState: 2 }),
    ]

    expect(dailyContentProgress(contents, 300)).toEqual({ completed: 2, total: 3 })
  })

  // 끝이 없는 항목이 분모에 들어가면 링이 100%에 절대 도달하지 못한다.
  it('끝이 없는 항목은 분모에서 빠진다', () => {
    const contents = [
      weekly({ contentKey: 'mu_lung_dojo', apiName: '무릉도장', nowCount: 90 }),
      // 지하 수로는 분모에 든다. 점수가 있으니 완료로도 센다.
      weekly({ contentKey: 'guild_underground_waterway', apiName: '[길드] 지하 수로', nowCount: 1200 }),
      weekly({ contentKey: 'weekly_quest_critias', apiName: '[주간 퀘스트] 크리티아스 주간 임무', questState: 2 }),
    ]

    expect(weeklyContentProgress(contents, 300, new Set())).toEqual({ completed: 2, total: 2 })
  })

  // 요구 레벨에 못 미치는 항목은 **분모에서도 빠진다.** 남겨 두면 그 캐릭터의
  // 링이 100%에 절대 도달하지 못하고, `남은 스케줄`의 숫자도 영원히 안 줄어든다.
  it('요구 레벨에 못 미치는 항목은 분모에서 빠진다', () => {
    const contents = [
      daily({ contentKey: 'monster_park', apiName: '몬스터파크', questState: 0 }),   // 요구 레벨 105
      // 표에 없는 항목이라 요구 레벨이 없다.
      daily({ apiName: '[일일 퀘스트] 소멸의 여로', questState: 2 }),
    ]

    expect(dailyContentProgress(contents, 300)).toEqual({ completed: 1, total: 2 })
    expect(dailyContentProgress(contents, 104)).toEqual({ completed: 1, total: 1 })
  })

  // 레벨을 모르면 단정하지 않는다. 전부 센다(태도).
  it('레벨을 모르면 아무것도 빼지 않는다', () => {
    const contents = [daily({ contentKey: 'monster_park', apiName: '몬스터파크', questState: 0 })]

    expect(dailyContentProgress(contents, null)).toEqual({ completed: 0, total: 1 })
  })

  it('빈 목록은 0/0 이다', () => {
    expect(dailyContentProgress([], 300)).toEqual({ completed: 0, total: 0 })
  })
})

// 에픽 던전은 4종이지만 주 3회가 한도다. 3종을 끝낸 뒤 남은 1종은 할 일이 아니라 `마감` 이다.
describe('에픽 던전 주간 한도', () => {
  const epic = (key: string, name: string, nowCount: number, isRegistered = true): WeeklyContent =>
    weekly({
      contentKey: `epic_dungeon_${key}`,
      apiName: `에픽 던전 : ${name}`,
      kind: 'contents',
      nowCount,
      questState: null,
      isRegistered,
    })
  const 넷 = [
    epic('high_mountain', '하이마운틴', 1),
    epic('angler_company', '앵글러 컴퍼니', 2),
    epic('nightmare_paradise', '악몽선경', 0),
    epic('aurum_regis', '아우룸 레기스', 1),
  ]

  it('3종을 완료하면 남은 1종이 막힌다', () => {
    expect([...weeklyLimitClosedKeys(넷)]).toEqual(['epic_dungeon_nightmare_paradise'])
  })

  it('2종이면 아무것도 안 막힌다', () => {
    expect(
      weeklyLimitClosedKeys([
        epic('high_mountain', '하이마운틴', 1),
        epic('angler_company', '앵글러 컴퍼니', 1),
        epic('nightmare_paradise', '악몽선경', 0),
      ]).size,
    ).toBe(0)
  })

  // 한도는 등록이 아니라 진행 횟수를 막는다. 원천은 표시 목록이 아니라 병합된 목록 전체다.
  it('등록 안 한 던전의 완료도 센다', () => {
    const 섞임 = [
      epic('high_mountain', '하이마운틴', 1),
      epic('angler_company', '앵글러 컴퍼니', 1),
      epic('nightmare_paradise', '악몽선경', 1, false),
      epic('aurum_regis', '아우룸 레기스', 0),
    ]

    expect([...weeklyLimitClosedKeys(섞임)]).toEqual(['epic_dungeon_aurum_regis'])
  })

  // 마감은 이번 주 일이 끝난 것이라 링의 분자에 든다. 안 넣으면 3/4 에 멈춰 100% 에 절대 못 닿는다.
  it('4종 추적 · 3종 완료면 링은 4/4 다', () => {
    expect(weeklyContentProgress(넷, 300, weeklyLimitClosedKeys(넷))).toEqual({ completed: 4, total: 4 })
  })

  it('요구 레벨 미달은 막혀도 분모에서 빠진다', () => {
    // 아우룸 레기스의 요구 레벨은 290 이다. 285 캐릭터에게는 그 한 줄이 이 캐릭터의 일이 아니다.
    const 셋완료 = [
      epic('high_mountain', '하이마운틴', 1),
      epic('angler_company', '앵글러 컴퍼니', 1),
      epic('nightmare_paradise', '악몽선경', 1),
      epic('aurum_regis', '아우룸 레기스', 0),
    ]

    expect(weeklyContentProgress(셋완료, 285, weeklyLimitClosedKeys(셋완료))).toEqual({ completed: 3, total: 3 })
  })
})
