// 월드 마스터 표 조회. 기록 · 원장 · 판정은 월드 key 를 들고 이름 · 엠블럼 · 챌린저스 여부는 여기서 찾는다.
import { worldEmblemUrl } from '../../assets/asset-lookup'
import { findWorld, worldKeyOfApiName, worldNameOf } from '../worlds'

describe('API 이름에서 key 를 찾는다', () => {
  // 넥슨 표기는 ㅐ 다. ㅔ 로 적으면 핼리오스 캐릭터 전부가 월드 key 를 못 얻는다.
  it('핼리오스는 넥슨 표기로 찾는다', () => {
    expect(worldKeyOfApiName('핼리오스')).toBe('helios')
    expect(worldKeyOfApiName('헬리오스')).toBeNull()
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
