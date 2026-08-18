import { describe, expect, it } from 'vitest'
import {
  getContentCatalogEntries,
  getContentSection,
  getMaxCountOverride,
  getShareScope,
  getSharedContentGroups,
  isCumulativeScore,
} from '../scheduler-content-scope'

describe('getShareScope', () => {
  it('worldShared에 등록된 항목은 world를 반환한다', () => {
    expect(getShareScope('몬스터파크')).toBe('world')
    expect(getShareScope('[메이플 유니온] 주간 드래곤 퇴치')).toBe('world')
  })

  it('accountShared에 등록된 항목은 account를 반환한다', () => {
    expect(getShareScope('에픽 던전 : 하이마운틴')).toBe('account')
    expect(getShareScope('에픽 던전 : 앵글러 컴퍼니')).toBe('account')
    expect(getShareScope('에픽 던전 : 악몽선경')).toBe('account')
  })

  it('카탈로그에 없는 항목은 character(기본값)를 반환한다', () => {
    expect(getShareScope('[길드] 주간 미션 포인트')).toBe('character')
    expect(getShareScope('무릉도장')).toBe('character')
    expect(getShareScope('존재하지 않는 콘텐츠')).toBe('character')
  })

  it('양쪽 공백이 달라도 매칭된다', () => {
    expect(getShareScope('몬스터 파크')).toBe('world')
    expect(getShareScope('에픽던전 : 악몽선경')).toBe('account')
    expect(getShareScope('[메이플유니온] 주간 드래곤 퇴치')).toBe('world')
  })

  // ADR-086 정정 1(2026-08-03, 실측): 접두·수식이 붙은 변형은 **별도 항목**이다 —
  // 매칭이 완전 일치라 '몬스터파크'가 아래 항목을 잡아주지 않는다. 이 사각 때문에 월드 공유
  // 진행이 캐릭터 활동으로 읽혀 미접속 캐릭터가 후보 목록에 남았다(게터, 실기기 계측).
  describe('접두·수식이 붙은 변형 (ADR-086 정정 1)', () => {
    it('[몬스터파크] 익스트림 몬스터파커 퀘스트는 world다', () => {
      expect(getShareScope('[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?')).toBe('world')
    })

    // 같은 계열이라도 공유 단위가 다르다(사용자 확인 2026-08-03) — 이름으로 유추하면 틀린다.
    it('PC방 주간 드래곤 퇴치는 account다 — 접두 없는 쪽(world)과 공유 단위가 다르다', () => {
      expect(getShareScope('[메이플 유니온] 주간 드래곤 퇴치')).toBe('world')
      expect(getShareScope('[메이플 유니온] PC방 주간 드래곤 퇴치')).toBe('account')
    })
  })
})

describe('getContentSection', () => {
  it('world/account 항목은 등록된 section을 반환한다', () => {
    expect(getContentSection('몬스터파크')).toBe('daily')
    expect(getContentSection('[메이플 유니온] 주간 드래곤 퇴치')).toBe('weekly')
    expect(getContentSection('에픽 던전 : 하이마운틴')).toBe('weekly')
  })

  it('character 범위(카탈로그에 없는) 항목은 null을 반환한다', () => {
    expect(getContentSection('무릉도장')).toBeNull()
  })
})

// ADR-086 정정 2: 공유 여부와는 다른 축 — 개인 기록이지만 리셋 없이 누적되는 항목.
describe('isCumulativeScore', () => {
  it('카탈로그에 등록된 누적 점수 항목은 true다', () => {
    expect(isCumulativeScore('[길드] 지하 수로')).toBe(true)
  })

  it('공백이 달라도 매칭된다', () => {
    expect(isCumulativeScore('[길드]지하수로')).toBe(true)
  })

  it('주기마다 리셋되는 항목은 false다 — 같은 길드 콘텐츠여도 축이 다르다', () => {
    expect(isCumulativeScore('[길드] 주간 미션 포인트')).toBe(false)
    expect(isCumulativeScore('[길드] 플래그 레이스')).toBe(false)
    expect(isCumulativeScore('몬스터파크')).toBe(false)
  })

  it('누적 점수 항목도 공유가 아니라 캐릭터 범위다 — 두 축은 독립이다', () => {
    expect(getShareScope('[길드] 지하 수로')).toBe('character')
  })
})

describe('getMaxCountOverride', () => {
  it('오버라이드가 등록된 항목은 그 값을 반환한다', () => {
    expect(getMaxCountOverride('[길드] 주간 미션 포인트')).toBe(10)
  })

  it('공백이 달라도 매칭된다', () => {
    expect(getMaxCountOverride('[길드]주간 미션포인트')).toBe(10)
  })

  it('오버라이드가 없는 항목은 null을 반환한다', () => {
    expect(getMaxCountOverride('몬스터파크')).toBeNull()
  })
})

describe('getContentCatalogEntries', () => {
  it('daily section에는 몬스터파크(world)만 있다', () => {
    const entries = getContentCatalogEntries('daily')
    expect(entries).toEqual([{ name: '몬스터파크', scope: 'world' }])
  })

  it('weekly section에는 world 2종 + account 4종이 있다', () => {
    const entries = getContentCatalogEntries('weekly')
    expect(entries).toContainEqual({ name: '[메이플 유니온] 주간 드래곤 퇴치', scope: 'world' })
    expect(entries).toContainEqual({
      name: '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?',
      scope: 'world',
    })
    expect(entries).toContainEqual({ name: '에픽 던전 : 하이마운틴', scope: 'account' })
    expect(entries).toContainEqual({ name: '에픽 던전 : 앵글러 컴퍼니', scope: 'account' })
    expect(entries).toContainEqual({ name: '에픽 던전 : 악몽선경', scope: 'account' })
    expect(entries).toContainEqual({ name: '[메이플 유니온] PC방 주간 드래곤 퇴치', scope: 'account' })
    expect(entries).toHaveLength(6)
  })
})

describe('getSharedContentGroups ([[ADR-147]] 정정 31)', () => {
  it('계열은 카탈로그가 적어 둔 순서다 — 배열을 읽은 첫 등장 순서가 아니다', () => {
    // worldShared → accountShared 로 읽으면 첫 등장 순서가 「몬스터파크 · 메이플 유니온 ·
    // 에픽던전」이라 사용자가 지정한 순서와 다르다. 그래서 `sharedGroupOrder` 가 따로 있다.
    expect(getSharedContentGroups().map((group) => group.group)).toEqual([
      '에픽던전',
      '몬스터파크',
      '메이플 유니온',
    ])
  })

  it('계열 안의 항목 순서는 worldShared → accountShared 를 이어 읽은 순서다', () => {
    const byGroup = new Map(getSharedContentGroups().map((group) => [group.group, group]))

    expect(byGroup.get('에픽던전')?.entries.map((entry) => entry.shortName)).toEqual([
      '하이마운틴',
      '앵글러컴퍼니',
      '악몽선경',
    ])
    // 월드 것(몬스터파크)이 계정 것보다 앞이고, 사이에 낀 유니온 항목은 이 계열에 안 든다.
    expect(byGroup.get('몬스터파크')?.entries.map((entry) => entry.shortName)).toEqual([
      '일간',
      '익스트림 몬스터파커',
    ])
    // 월드 하나 + 계정 하나가 한 계열로 묶이는 유일한 경우다.
    expect(byGroup.get('메이플 유니온')?.entries.map((entry) => entry.shortName)).toEqual([
      '주간 드래곤 퇴치',
      'PC방 주간 드래곤 퇴치',
    ])
  })

  it('원문 이름·section·scope 를 함께 나른다 — 호출부가 응답에서 항목을 다시 찾는다', () => {
    const [epic] = getSharedContentGroups()

    expect(epic?.entries[0]).toEqual({
      name: '에픽 던전 : 하이마운틴',
      shortName: '하이마운틴',
      group: '에픽던전',
      section: 'weekly',
      scope: 'account',
      onlyWhenScheduled: false,
    })
  })

  it('유니온 둘만 «스케줄러에 있을 때만» 표식을 단다 ([[ADR-147]] 정정 30)', () => {
    const conditional = getSharedContentGroups()
      .flatMap((group) => group.entries)
      .filter((entry) => entry.onlyWhenScheduled)
      .map((entry) => entry.shortName)

    expect(conditional).toEqual(['주간 드래곤 퇴치', 'PC방 주간 드래곤 퇴치'])
  })

  it('일곱을 하나도 빠뜨리거나 더하지 않는다', () => {
    const names = getSharedContentGroups().flatMap((group) =>
      group.entries.map((entry) => entry.name),
    )

    expect(names).toHaveLength(7)
    expect(new Set(names).size).toBe(7)
    // 카탈로그가 «공유» 라고 적은 것과 정확히 같은 집합이어야 한다 — 여기서 갈리면 「남은 스케줄」이
    // 빼는 것과 이 위젯이 그리는 것이 어긋나 항목이 통째로 사라지거나 두 곳에 겹쳐 나온다.
    for (const name of names) {
      expect(getShareScope(name)).not.toBe('character')
    }
  })
})

describe('getMaxCountOverride — 익스트림 몬스터파커 ([[ADR-147]] 정정 29)', () => {
  it('템플릿의 5가 아니라 사용자 확정값 2를 준다', () => {
    // `scheduler-content-template.json` 은 이 항목에 `max_count: 5` 를 들고 있다. 게임 규칙은
    // 주 2회라 오버라이드가 이긴다(사용자 확정 2026-08-18).
    expect(getMaxCountOverride('[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?')).toBe(2)
  })
})
