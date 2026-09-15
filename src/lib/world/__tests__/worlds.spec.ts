// 월드 마스터 표 조회. 기록 · 원장 · 판정은 월드 key 를 들고 이름 · 엠블럼 · 챌린저스 여부는 여기서 찾는다.
import { worldEmblemUrl } from '../../assets/asset-lookup'
import { findWorld, isChallengersWorld, isEventWorld, worldKeyOfApiName, worldNameOf, WORLDS } from '../worlds'

describe('API 이름에서 key 를 찾는다', () => {
  it('API 표기 그대로 찾는다', () => {
    expect(worldKeyOfApiName('엘리시움')).toBe('elysium')
    expect(worldKeyOfApiName('챌린저스')).toBe('challengers')
    expect(worldKeyOfApiName('챌린저스2')).toBe('challengers_2')
    expect(worldKeyOfApiName('스페셜')).toBe('special')
  })

  // 규칙은 보스 · 컨텐츠 · 강화와 같다.
  it('NFC 뒤 공백을 지우고 완전 일치로 맞춘다', () => {
    expect(worldKeyOfApiName('챌린저스 2')).toBe('challengers_2')
    expect(worldKeyOfApiName('엘리시움'.normalize('NFD'))).toBe('elysium')
  })

  // 앞부분이 같다고 챌린저스가 아니다. 새 챌린저스 월드는 표부터 고친다.
  it('표에 없는 이름은 null 이다', () => {
    expect(worldKeyOfApiName('챌린저스5')).toBeNull()
    expect(worldKeyOfApiName('리부트')).toBeNull()
  })
})

describe('key 로 찾는다', () => {
  it('보이는 이름은 표 이름이고 모르는 key 면 넘긴 이름이다', () => {
    expect(worldNameOf('challengers_2', '옛 이름')).toBe('챌린저스2')
    expect(worldNameOf('nope', '어딘가')).toBe('어딘가')
    expect(worldNameOf(null, '어딘가')).toBe('어딘가')
    expect(findWorld(undefined)).toBeNull()
  })

  it('챌린저스 넷만 챌린저스 월드다', () => {
    expect(WORLDS.filter((world) => isChallengersWorld(world.key)).map((world) => world.key)).toEqual([
      'challengers',
      'challengers_2',
      'challengers_3',
      'challengers_4',
    ])
    expect(isChallengersWorld(null)).toBe(false)
  })

  // 챌린저스는 시즌 월드지만 재화가 본섭으로 넘어와 이벤트 월드가 아니다(사용자 지정).
  it('스페셜만 이벤트 월드다', () => {
    expect(WORLDS.filter((world) => isEventWorld(world.key)).map((world) => world.key)).toEqual(['special'])
    expect(isEventWorld(null)).toBe(false)
  })
})

describe('worldEmblemUrl', () => {
  it('엠블럼이 있는 월드는 그림을 찾는다', () => {
    expect(worldEmblemUrl('elysium')).toBeTruthy()
    expect(worldEmblemUrl('scania')).toBeTruthy()
  })

  it('챌린저스 넷은 같은 그림이다', () => {
    const base = worldEmblemUrl('challengers')
    expect(base).toBeTruthy()
    expect(worldEmblemUrl('challengers_2')).toBe(base)
    expect(worldEmblemUrl('challengers_4')).toBe(base)
  })

  it('엠블럼이 없는 월드와 모르는 key 는 null 이다', () => {
    expect(worldEmblemUrl('special')).toBeNull()
    expect(worldEmblemUrl('nope')).toBeNull()
    expect(worldEmblemUrl(null)).toBeNull()
  })
})
