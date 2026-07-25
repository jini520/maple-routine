import { describe, expect, it } from 'vitest'
import {
  getAccessoryBoxContents,
  getBossDropCandidates,
  getRingBoxContents,
  isBoxItem,
} from '../boss-drops'

describe('getBossDropCandidates', () => {
  it('보스+난이도의 드롭 후보를 카테고리와 함께 반환한다 (스우 하드)', () => {
    const candidates = getBossDropCandidates('스우', '하드')

    expect(candidates.length).toBeGreaterThan(0)
    // 카테고리가 모두 유효한 3종 중 하나
    for (const candidate of candidates) {
      expect(['fixed', 'equipment', 'consumable']).toContain(candidate.category)
    }
    // 장비: 루즈 컨트롤 머신 마크(얼굴장식)
    const mark = candidates.find((candidate) => candidate.name === '루즈 컨트롤 머신 마크')
    expect(mark).toMatchObject({ category: 'equipment', slot: '얼굴장식' })
    // 소비: 홍옥의 보스 반지 상자
    expect(candidates.some((candidate) => candidate.name === '홍옥의 보스 반지 상자')).toBe(true)
  })

  it('없는 보스/난이도 조합은 빈 배열을 반환한다', () => {
    expect(getBossDropCandidates('존재하지않는보스', '하드')).toEqual([])
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
