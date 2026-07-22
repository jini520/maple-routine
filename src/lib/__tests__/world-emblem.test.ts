import { describe, expect, it } from 'vitest'
import { isChallengersWorld, worldEmblemUrl } from '../world-emblem'

describe('worldEmblemUrl', () => {
  it('매핑된 월드는 엠블럼 URL을 반환한다', () => {
    expect(worldEmblemUrl('엘리시움')).toBeTruthy()
    expect(worldEmblemUrl('스카니아')).toBeTruthy()
    expect(worldEmblemUrl('베라')).toBeTruthy()
  })

  it('챌린저스 1~4는 모두 같은 challengers 엠블럼으로 매핑된다', () => {
    const base = worldEmblemUrl('챌린저스')
    expect(base).toBeTruthy()
    expect(worldEmblemUrl('챌린저스2')).toBe(base)
    expect(worldEmblemUrl('챌린저스3')).toBe(base)
    expect(worldEmblemUrl('챌린저스4')).toBe(base)
  })

  it('매핑에 없는 월드는 null을 반환한다(폴백)', () => {
    expect(worldEmblemUrl('리부트')).toBeNull()
    expect(worldEmblemUrl('없는월드')).toBeNull()
  })
})

describe('isChallengersWorld', () => {
  it('챌린저스 1~4는 모두 챌린저스 월드로 판정한다', () => {
    expect(isChallengersWorld('챌린저스')).toBe(true)
    expect(isChallengersWorld('챌린저스2')).toBe(true)
    expect(isChallengersWorld('챌린저스3')).toBe(true)
    expect(isChallengersWorld('챌린저스4')).toBe(true)
  })

  it('챌린저스가 아닌 월드는 false를 반환한다', () => {
    expect(isChallengersWorld('엘리시움')).toBe(false)
    expect(isChallengersWorld('리부트')).toBe(false)
    expect(isChallengersWorld('없는월드')).toBe(false)
  })
})
