// 아코디언 한 줄에 들어가는 **짧은 이름**([[ADR-147]] 정정 26 · 41).
//
// 두 축이 다른 규칙을 쓴다 — **일일은 지역명까지 줄이고, 주간은 접두어만 뗀다.** 그 비대칭이 이
// 파일의 요점이라 두 축을 나란히 놓고 본다.
import { describe, expect, it } from 'vitest'

import { CONTENT_TEMPLATE } from '@core/lib/scheduler-content-template'

import { shortDailyContentName, shortWeeklyContentName } from '../short-content-name'

describe('shortWeeklyContentName — 접두어만 뗀다 ([[ADR-147]] 정정 41)', () => {
  // 지역 매칭을 걷은 이유가 이 넷이다 — 정정 26 이 하던 일이 이것뿐이었고, 그중 둘이 같은 글자로
  // 접혔다(타락한 세계수 ×2).
  it.each([
    ['[주간 퀘스트] 크리티아스 주간 임무', '크리티아스 주간 임무'],
    ['[주간 퀘스트] 타락한 세계수 주간 임무', '타락한 세계수 주간 임무'],
    ['[주간 퀘스트] 타락한 세계수 정화에 대한 보답', '타락한 세계수 정화에 대한 보답'],
    ['[주간 퀘스트] 헤이븐 주간 임무', '헤이븐 주간 임무'],
  ])('%s → %s', (원문, 기대) => {
    expect(shortWeeklyContentName(원문)).toBe(기대)
  })

  it('지역명이 앞에 안 오는 보상형도 같은 규칙이다 — 예외가 아니다', () => {
    expect(shortWeeklyContentName('[주간 퀘스트] 성실한 조사에 대한 보답')).toBe(
      '성실한 조사에 대한 보답',
    )
    expect(shortWeeklyContentName('[주간 퀘스트] 꾸준한 의뢰에 대한 보답')).toBe(
      '꾸준한 의뢰에 대한 보답',
    )
  })

  it('접두어가 없는 이름은 손대지 않는다', () => {
    expect(shortWeeklyContentName('에르다 스펙트럼')).toBe('에르다 스펙트럼')
    expect(shortWeeklyContentName('무릉도장')).toBe('무릉도장')
    expect(shortWeeklyContentName('[길드] 지하 수로')).toBe('[길드] 지하 수로')
  })

  // 정정 40 이 잡은 결함의 원천 — 이제 참조 데이터 안에서는 안 겹친다. 다만 그것은 데이터의
  // 우연이지 이 함수가 보장하는 성질이 아니라, 호출부의 `key` 는 인덱스를 함께 쓴다.
  it('지금 참조 데이터에서는 짧은 이름이 겹치지 않는다', () => {
    const 이름들 = CONTENT_TEMPLATE.weekly.map((entry) => shortWeeklyContentName(entry.content_name))

    expect(new Set(이름들).size).toBe(이름들.length)
  })
})

describe('shortDailyContentName — 지역명까지 줄인다 (그대로)', () => {
  // 일일은 지역당 하나뿐이라 겹치지 않고, 뒷말(«조사»·«평온한 밤»)이 정보를 안 더한다.
  it.each([
    ['[일일 퀘스트] 소멸의 여로 조사', '소멸의 여로'],
    ['[일일 퀘스트] 레헬른의 평온한 밤', '레헬른'],
    ['[일일 퀘스트] 호텔 아르크스 주변 청소', '호텔 아르크스'],
  ])('%s → %s', (원문, 기대) => {
    expect(shortDailyContentName(원문)).toBe(기대)
  })

  it('접두어가 없는 이름은 손대지 않는다', () => {
    expect(shortDailyContentName('몬스터파크')).toBe('몬스터파크')
  })

  it('지금 참조 데이터에서는 짧은 이름이 겹치지 않는다', () => {
    const 이름들 = CONTENT_TEMPLATE.daily.map((entry) => shortDailyContentName(entry.content_name))

    expect(new Set(이름들).size).toBe(이름들.length)
  })
})
