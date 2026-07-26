import { describe, expect, it } from 'vitest'
import {
  getAccessoryBoxContents,
  getBossDropCandidates,
  getBossFixedDrops,
  getRingBoxContents,
  isBoxItem,
} from '../boss-drops'

describe('getBossDropCandidates', () => {
  it('보스의 전 난이도 선택 후보(장비·소비)를 통합해 반환한다 (스우)', () => {
    const candidates = getBossDropCandidates('스우')

    expect(candidates.length).toBeGreaterThan(0)
    // 선택 후보는 장비·소비만 (고정은 읽기 전용이라 제외, ADR-040)
    for (const candidate of candidates) {
      expect(['equipment', 'consumable']).toContain(candidate.category)
    }
    expect(candidates.some((candidate) => candidate.name === '주문의 흔적')).toBe(false)
  })

  it('같은 아이템은 name+slot으로 통합하고 등장 난이도를 정규 순서로 담는다', () => {
    // 루즈 컨트롤 머신 마크(얼굴장식)는 스우 하드+익스트림에서 드롭 → 한 후보로 통합
    const marks = getBossDropCandidates('스우').filter(
      (candidate) => candidate.name === '루즈 컨트롤 머신 마크',
    )
    expect(marks.length).toBe(1)
    expect(marks[0]).toMatchObject({ category: 'equipment', slot: '얼굴장식' })
    expect(marks[0].difficulties).toEqual(['하드', '익스트림'])
  })

  it('난이도별로만 드롭되는 소비 상자도 모두 통합해 노출한다 (스우 녹옥/홍옥/백옥)', () => {
    const names = getBossDropCandidates('스우').map((candidate) => candidate.name)
    expect(names).toContain('녹옥의 보스 반지 상자') // 노멀
    expect(names).toContain('홍옥의 보스 반지 상자') // 하드
    expect(names).toContain('백옥의 보스 반지 상자') // 익스트림
  })

  it('없는 보스는 빈 배열을 반환한다', () => {
    expect(getBossDropCandidates('존재하지않는보스')).toEqual([])
  })
})

describe('getBossFixedDrops', () => {
  it('고정 드롭을 난이도별 그룹(정규 순서)으로 반환한다 (스우)', () => {
    const groups = getBossFixedDrops('스우')

    expect(groups.map((group) => group.difficulty)).toEqual(['노멀', '하드', '익스트림'])
    // 같은 아이템도 난이도마다 값이 다름 — 그룹별 값을 그대로 유지한다
    const hard = groups.find((group) => group.difficulty === '하드')
    expect(hard?.items).toContainEqual(
      expect.objectContaining({ name: '솔 에르다의 기운', amount: '50' }),
    )
    const extreme = groups.find((group) => group.difficulty === '익스트림')
    expect(extreme?.items).toContainEqual(
      expect.objectContaining({ name: '솔 에르다의 기운', amount: '280' }),
    )
  })

  it('고정 드롭이 없는 보스는 빈 배열을 반환한다', () => {
    expect(getBossFixedDrops('존재하지않는보스')).toEqual([])
  })
})

describe('isBoxItem', () => {
  it('반지 상자·칠흑 장신구 상자는 true', () => {
    expect(isBoxItem('홍옥의 보스 반지 상자')).toBe(true)
    expect(isBoxItem('혼돈의 칠흑 장신구 상자')).toBe(true)
  })

  it('일반 아이템은 false', () => {
    expect(isBoxItem('루즈 컨트롤 머신 마크')).toBe(false)
    expect(isBoxItem('주문의 흔적')).toBe(false)
  })
})

describe('getRingBoxContents', () => {
  it('반지 상자의 등급 목록과 반지 목록을 반환한다 (홍옥: 1~4레벨, 31종)', () => {
    const contents = getRingBoxContents('홍옥의 보스 반지 상자')

    expect(contents).not.toBeNull()
    expect(contents?.levels).toEqual([1, 2, 3, 4])
    expect(contents?.rings.length).toBe(31)
    expect(contents?.rings.some((ring) => ring.name === '리스트레인트 링')).toBe(true)
  })

  it('상자마다 목록이 다르다 (생명: 3~4레벨, 10종)', () => {
    const contents = getRingBoxContents('생명의 보스 반지 상자')

    expect(contents?.levels).toEqual([3, 4])
    expect(contents?.rings.length).toBe(10)
  })

  it('반지 상자가 아니면 null', () => {
    expect(getRingBoxContents('혼돈의 칠흑 장신구 상자')).toBeNull()
  })
})

describe('getAccessoryBoxContents', () => {
  it('칠흑 장신구 상자의 후보 7종을 반환한다', () => {
    const contents = getAccessoryBoxContents('혼돈의 칠흑 장신구 상자')

    expect(contents).not.toBeNull()
    expect(contents?.length).toBe(7)
    expect(contents?.some((item) => item.name === '루즈 컨트롤 머신 마크')).toBe(true)
  })

  it('메이린의 칠흑 장신구 상자도 동일 후보', () => {
    expect(getAccessoryBoxContents('메이린의 칠흑 장신구 상자')?.length).toBe(7)
  })

  it('장신구 상자가 아니면 null', () => {
    expect(getAccessoryBoxContents('홍옥의 보스 반지 상자')).toBeNull()
  })
})
