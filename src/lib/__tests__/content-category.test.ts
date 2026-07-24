import { describe, expect, it } from 'vitest'
import { categorizeContentEntries, contentCountTag, WEEKLY_CATEGORY_ORDER } from '../content-category'
import { CONTENT_TEMPLATE } from '../scheduler-content-template'
import type { SchedulerContentTemplateEntry } from '../manual-content-merge'

function entry(
  content_name: string,
  type: 'contents' | 'quest' = 'contents',
  max_count = 0,
): SchedulerContentTemplateEntry {
  return { content_name, type, registration_flag: 'false', now_count: 0, max_count, quest_state: null }
}

describe('categorizeContentEntries', () => {
  it('대괄호 접두사에서 카테고리를 뽑고 접두사를 뗀 표시명을 만든다', () => {
    const groups = categorizeContentEntries([
      entry('[일일 퀘스트] 소멸의 여로 조사'),
      entry('[일일 퀘스트] 츄츄 아일랜드 최고의 요리'),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('일일 퀘스트')
    expect(groups[0].items.map((i) => i.displayName)).toEqual([
      '소멸의 여로 조사',
      '츄츄 아일랜드 최고의 요리',
    ])
    // 토글·저장은 원본 content_name으로 해야 하므로 원본 엔트리를 그대로 보존한다
    expect(groups[0].items[0].entry.content_name).toBe('[일일 퀘스트] 소멸의 여로 조사')
  })

  it('"에픽 던전 :" 접두사도 카테고리로 인식한다', () => {
    const groups = categorizeContentEntries([entry('에픽 던전 : 하이마운틴')])

    expect(groups[0].label).toBe('에픽 던전')
    expect(groups[0].items[0].displayName).toBe('하이마운틴')
  })

  it('접두사도 오버라이드도 없는 항목은 헤더 없는 단독 그룹(label null)이고 표시명은 원본이다', () => {
    const groups = categorizeContentEntries([entry('알 수 없는 컨텐츠')])

    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBeNull()
    expect(groups[0].items[0].displayName).toBe('알 수 없는 컨텐츠')
  })

  it('카테고리 첫 등장 순서를 보존하고, 떨어져 있어도 같은 카테고리는 한 그룹으로 묶는다', () => {
    const groups = categorizeContentEntries([
      entry('[길드] 주간 미션 포인트'),
      entry('[일일 퀘스트] 소멸의 여로 조사'),
      entry('[길드] 지하 수로'),
    ])

    // 길드가 떨어져 있어도 한 그룹, 첫 등장 순서(길드 → 일일 퀘스트) 보존
    expect(groups.map((g) => g.label)).toEqual(['길드', '일일 퀘스트'])
    expect(groups[0].items.map((i) => i.displayName)).toEqual(['주간 미션 포인트', '지하 수로'])
  })
})

describe('categorizeContentEntries — 도메인 오버라이드 (사용자 지정, ADR-006)', () => {
  it('접두사 없는 단독 항목도 오버라이드가 있으면 헤더 있는 그룹이 된다 (몬스터파크·무릉도장)', () => {
    const groups = categorizeContentEntries([entry('몬스터파크'), entry('무릉도장')])

    expect(groups.map((g) => g.label)).toEqual(['몬스터파크', '무릉도장'])
    expect(groups[0].items[0].displayName).toBe('몬스터파크')
    expect(groups[1].items[0].displayName).toBe('무릉도장')
  })

  it('아케인리버 지역 결계·퀘스트를 한 그룹으로 묶고, [주간 퀘스트] 접두사 항목은 접두사를 뗀다', () => {
    const groups = categorizeContentEntries([
      entry('에르다 스펙트럼'),
      entry('프로텍트 에스페라'),
      entry('[주간 퀘스트] 성실한 조사에 대한 보답'),
      entry('[주간 퀘스트] 크리티아스 주간 임무'),
    ])

    // 성실한 조사는 아케인리버로 이동, 크리티아스는 주간 퀘스트에 남는다
    expect(groups.map((g) => g.label)).toEqual(['아케인리버 지역 퀘스트', '주간 퀘스트'])
    expect(groups[0].items.map((i) => i.displayName)).toEqual([
      '에르다 스펙트럼',
      '프로텍트 에스페라',
      '성실한 조사에 대한 보답',
    ])
    expect(groups[1].items.map((i) => i.displayName)).toEqual(['크리티아스 주간 임무'])
  })
})

describe('categorizeContentEntries — 실제 템플릿 그룹 구성 (사용자 확정 2026-07-24)', () => {
  it('일간: 몬스터파크 · 일일 퀘스트 두 그룹 (몬스터파크도 단독 그룹화)', () => {
    const labels = categorizeContentEntries(CONTENT_TEMPLATE.daily).map((g) => g.label)
    expect(labels).toEqual(['몬스터파크', '일일 퀘스트'])
  })

  it('주간: 사용자 지정 순서(WEEKLY_CATEGORY_ORDER)로 7개 그룹 + 아케인리버 지역 퀘스트 구성', () => {
    const groups = categorizeContentEntries(CONTENT_TEMPLATE.weekly, WEEKLY_CATEGORY_ORDER)

    expect(groups.map((g) => g.label)).toEqual([
      '에픽 던전',
      '몬스터파크',
      '길드',
      '아케인리버 지역 퀘스트',
      '주간 퀘스트',
      '무릉도장',
      '메이플 유니온',
    ])

    const arcane = groups.find((g) => g.label === '아케인리버 지역 퀘스트')
    expect(arcane?.items.map((i) => i.displayName)).toEqual([
      '에르다 스펙트럼',
      '배고픈 무토',
      '미드나잇 체이서',
      '스피릿 세이비어',
      '엔하임 디펜스',
      '프로텍트 에스페라',
      '성실한 조사에 대한 보답',
    ])

    // 성실한 조사가 빠진 주간 퀘스트 그룹은 나머지 5개만 남는다
    const weekly = groups.find((g) => g.label === '주간 퀘스트')
    expect(weekly?.items.map((i) => i.displayName)).toEqual([
      '크리티아스 주간 임무',
      '타락한 세계수 주간 임무',
      '타락한 세계수 정화에 대한 보답',
      '헤이븐 주간 임무',
      '꾸준한 의뢰에 대한 보답',
    ])
  })
})

describe('contentCountTag — 태그 오버라이드 (사용자 지정, ADR-006)', () => {
  it('아이템 오버라이드가 카테고리·기본 규칙보다 우선한다', () => {
    // 일간 몬스터파크: "월드 당 최대 14회"
    expect(contentCountTag(entry('몬스터파크', 'contents', 14), '몬스터파크')).toBe('월드 당 최대 14회')
    // 익스트림 몬스터파크(주간, 같은 카테고리지만 아이템 오버라이드가 이김): "ID당 2회"
    expect(
      contentCountTag(entry('[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?', 'quest', 5), '몬스터파크'),
    ).toBe('ID당 2회')
  })

  it('카테고리 오버라이드: 에픽 던전 = ID당 1회, 아케인리버 = 태그 숨김(null)', () => {
    expect(contentCountTag(entry('에픽 던전 : 하이마운틴', 'contents', 0), '에픽 던전')).toBe('ID당 1회')
    expect(contentCountTag(entry('에르다 스펙트럼', 'contents', 1), '아케인리버 지역 퀘스트')).toBeNull()
  })

  it('오버라이드가 없으면 기본 규칙(contents & max>0 → 최대 N회, 그 외 null)', () => {
    expect(contentCountTag(entry('[길드] 주간 미션 포인트', 'contents', 10), '길드')).toBe('최대 10회')
    expect(contentCountTag(entry('[일일 퀘스트] 소멸의 여로 조사', 'quest', 100), '일일 퀘스트')).toBeNull()
    expect(contentCountTag(entry('무릉도장', 'contents', 0), '무릉도장')).toBeNull()
  })
})

describe('categorizeContentEntries — categoryOrder 재정렬', () => {
  it('목록에 있는 카테고리는 그 순서로 앞세우고, 없는 카테고리는 첫 등장 순서로 뒤에 둔다', () => {
    const groups = categorizeContentEntries(
      [
        entry('[메이플 유니온] 주간 드래곤 퇴치'),
        entry('[길드] 주간 미션 포인트'),
        entry('에픽 던전 : 하이마운틴'),
      ],
      ['에픽 던전', '길드'],
    )

    // 에픽 던전(0)·길드(1)가 앞으로, 목록에 없는 메이플 유니온은 뒤에(첫 등장 순서 유지)
    expect(groups.map((g) => g.label)).toEqual(['에픽 던전', '길드', '메이플 유니온'])
  })
})
