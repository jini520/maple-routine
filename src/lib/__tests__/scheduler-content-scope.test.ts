import { describe, expect, it } from 'vitest'
import {
  getContentCatalogEntries,
  getContentSection,
  getMaxCountOverride,
  getShareScope,
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

  it('weekly section에는 유니온 드래곤 퇴치(world) + 에픽 던전 3종(account)이 있다', () => {
    const entries = getContentCatalogEntries('weekly')
    expect(entries).toContainEqual({ name: '[메이플 유니온] 주간 드래곤 퇴치', scope: 'world' })
    expect(entries).toContainEqual({ name: '에픽 던전 : 하이마운틴', scope: 'account' })
    expect(entries).toContainEqual({ name: '에픽 던전 : 앵글러 컴퍼니', scope: 'account' })
    expect(entries).toContainEqual({ name: '에픽 던전 : 악몽선경', scope: 'account' })
    expect(entries).toHaveLength(4)
  })
})
