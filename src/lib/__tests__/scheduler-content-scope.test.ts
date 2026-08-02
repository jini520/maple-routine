import { describe, expect, it } from 'vitest'
import {
  getContentCatalogEntries,
  getContentSection,
  getMaxCountOverride,
  getShareScope,
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
