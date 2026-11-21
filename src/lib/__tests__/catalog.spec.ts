import bundled from '../../__fixtures__/game-data/bosses.json'
import {
  INITIAL_BOSS_CATALOG,
  getBossCatalog,
  parseBossCatalog,
  setBossCatalog,
  subscribeBossCatalog,
} from '../boss/catalog'
import type { BossCatalog } from '../../types/boss-catalog'

/** 서버 응답 모양의 작은 표. fixture 와 다른 값이어야 덮였는지 보인다. */
const 작은표: BossCatalog = {
  updatedAt: '2026-10-15T01:00:00.000Z',
  bosses: [
    { id: 'b-lotus', key: 'lotus', name: '스우', shortName: '스우', isSeasonBoss: false, portraitAssetId: 'lotus' },
  ],
  bossDifficulties: [
    { id: 'd-normal', bossId: 'b-lotus', difficulty: 'normal', cycle: 'weekly', requiredLevel: 190 },
    { id: 'd-hard', bossId: 'b-lotus', difficulty: 'hard', cycle: 'weekly', requiredLevel: 190, maxPartySize: 2 },
  ],
}

afterEach(() => {
  setBossCatalog(INITIAL_BOSS_CATALOG)
})

// jest 에서는 fixture 가 첫 표다.
describe('getBossCatalog', () => {
  it('처음에는 계약을 통과한 fixture bosses.json 이다', () => {
    expect(getBossCatalog()).toBe(INITIAL_BOSS_CATALOG)
    expect(getBossCatalog()).toEqual(parseBossCatalog(bundled))
  })

  // 응답 그대로인 fixture 는 선택 칸을 null 로 든다. 통과한 값에서는 그 칸이 빠진다.
  it('fixture 는 계약을 지킨다', () => {
    expect(parseBossCatalog(bundled)).not.toBeNull()
    expect(bundled.bosses.length).toBe(INITIAL_BOSS_CATALOG.bosses.length)
  })
})

describe('setBossCatalog', () => {
  it('표를 바꾸고 구독자에게 알린다', () => {
    const listener = jest.fn()
    subscribeBossCatalog(listener)

    setBossCatalog(작은표)

    expect(getBossCatalog()).toBe(작은표)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('같은 표를 다시 넣으면 알리지 않는다', () => {
    const listener = jest.fn()
    subscribeBossCatalog(listener)

    setBossCatalog(getBossCatalog())

    expect(listener).not.toHaveBeenCalled()
  })

  it('구독을 풀면 더 알리지 않는다', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeBossCatalog(listener)
    unsubscribe()

    setBossCatalog(작은표)

    expect(listener).not.toHaveBeenCalled()
  })
})

// 서버가 계약을 어긴 응답은 통째로 버린다. 줄 하나만 버리면 그 보스가 화면에서 조용히 사라진다.
describe('parseBossCatalog', () => {
  it('계약을 지킨 값은 아는 칸만 남겨 돌려준다', () => {
    const 덤 = { ...작은표, extra: 1, bosses: [{ ...작은표.bosses[0], note: '덤' }] }

    expect(parseBossCatalog(덤)).toEqual(작은표)
  })

  it('updatedAt 은 null 이어도 된다. 서버에서 받은 적 없는 사본이 그렇다', () => {
    expect(parseBossCatalog({ ...작은표, updatedAt: null })).toEqual({ ...작은표, updatedAt: null })
  })

  // 서버는 선택 칸을 null 로 보낸다. 코드에서는 빠진 칸이어야 `?? 기본값` 이 선다.
  it('선택 칸의 null 은 빠진 칸이 된다', () => {
    const [normal, hard] = 작은표.bossDifficulties
    const 응답 = {
      ...작은표,
      bosses: [{ ...작은표.bosses[0], validFrom: null, validUntil: null }],
      bossDifficulties: [{ ...normal, maxPartySize: null, validFrom: null, validUntil: null }, hard],
    }

    expect(parseBossCatalog(응답)).toEqual(작은표)
  })

  const [lotus] = 작은표.bosses
  const [normal, hard] = 작은표.bossDifficulties
  it.each([
    ['객체가 아니다', '표'],
    ['updatedAt 이 글자도 null 도 아니다', { ...작은표, updatedAt: 1 }],
    ['난이도의 파티 인원 상한이 양의 정수가 아니다', { ...작은표, bossDifficulties: [normal, { ...hard, maxPartySize: 0 }] }],
    ['보스가 비었다', { ...작은표, bosses: [] }],
    ['보스 key 가 비었다', { ...작은표, bosses: [{ ...lotus, key: '' }] }],
    ['시즌 보스 여부가 참 거짓이 아니다', { ...작은표, bosses: [{ ...lotus, isSeasonBoss: 'no' }] }],
    ['주기가 모르는 값이다', { ...작은표, bossDifficulties: [normal, { ...hard, cycle: 'daily' }] }],
    // 앱은 보스마다 주기 하나로 기간을 잡는다. 난이도마다 주기가 다르면 어느 기간에 적을지 정할 수 없다.
    ['한 보스의 난이도끼리 주기가 다르다', { ...작은표, bossDifficulties: [normal, { ...hard, cycle: 'monthly' }] }],
    ['초상 그림이 없다', { ...작은표, bosses: [{ ...lotus, portraitAssetId: undefined }] }],
    ['난이도 줄이 없는 보스가 있다', { ...작은표, bossDifficulties: [] }],
    ['이 칸에 없는 보스를 가리키는 난이도 줄이 있다', { ...작은표, bossDifficulties: [normal, { ...hard, bossId: 'nope' }] }],
    ['난이도가 모르는 값이다', { ...작은표, bossDifficulties: [normal, { ...hard, difficulty: 'nightmare' }] }],
    ['요구 레벨이 양의 정수가 아니다', { ...작은표, bossDifficulties: [normal, { ...hard, requiredLevel: 0 }] }],
    ['한 보스에 같은 난이도가 둘이다', { ...작은표, bossDifficulties: [normal, { ...hard, difficulty: 'normal' }] }],
    ['같은 key 가 둘이다', { ...작은표, bosses: [lotus, { ...lotus, id: 'b-other' }] }],
  ])('%s → null', (_name, value) => {
    expect(parseBossCatalog(value)).toBeNull()
  })
})
