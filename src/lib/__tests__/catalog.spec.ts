import bundled from '../../__fixtures__/game-data/bosses.json'
import {
  INITIAL_BOSS_CATALOG,
  getBossCatalog,
  parseBossCatalog,
  setBossCatalog,
  subscribeBossCatalog,
} from '../boss/catalog'
import type { BossCatalog } from '../../types/boss-catalog'

/** 서버 응답 모양의 작은 표. 번들과 다른 값이어야 덮였는지 보인다. */
const 작은표: BossCatalog = {
  updatedAt: '2026-10-15T01:00:00.000Z',
  rules: { weeklyBossSelectionLimit: 10, weeklyCrystalSaleLimit: 80, defaultMaxPartySize: 6 },
  bosses: [
    {
      key: 'lotus',
      name: '스우',
      alias: '스우',
      cycle: 'weekly',
      portraitSlug: 'lotus',
      difficulties: [
        { difficulty: 'normal', requiredLevel: 190 },
        { difficulty: 'hard', requiredLevel: 190, maxPartySize: 2 },
      ],
    },
  ],
}

afterEach(() => {
  setBossCatalog(INITIAL_BOSS_CATALOG)
})

// 번들 사본이 첫 표다. 서버도 기기 사본도 없는 첫 실행이 이것으로 선다.
describe('getBossCatalog', () => {
  it('처음에는 계약을 통과한 번들 bosses.json 이다', () => {
    expect(getBossCatalog()).toBe(INITIAL_BOSS_CATALOG)
    expect(getBossCatalog()).toEqual(parseBossCatalog(bundled))
  })

  // 응답 그대로인 번들은 선택 칸을 null 로 든다. 통과한 값에서는 그 칸이 빠진다.
  it('번들 사본은 계약을 지킨다', () => {
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

  it('updatedAt 은 null 이어도 된다. 서버에서 받은 적 없는 번들 사본이 그렇다', () => {
    expect(parseBossCatalog({ ...작은표, updatedAt: null })).toEqual({ ...작은표, updatedAt: null })
  })

  // 서버는 선택 칸을 null 로 보낸다. 코드에서는 빠진 칸이어야 `?? 기본값` 이 선다.
  it('선택 칸의 null 은 빠진 칸이 된다', () => {
    const 응답 = {
      ...작은표,
      bosses: [
        {
          ...작은표.bosses[0],
          from: null,
          until: null,
          difficulties: [{ difficulty: 'normal', requiredLevel: 190, maxPartySize: null, from: null, until: null }],
        },
      ],
    }

    expect(parseBossCatalog(응답)).toEqual({
      ...작은표,
      bosses: [{ ...작은표.bosses[0], difficulties: [{ difficulty: 'normal', requiredLevel: 190 }] }],
    })
  })

  it.each([
    ['객체가 아니다', '표'],
    ['updatedAt 이 글자도 null 도 아니다', { ...작은표, updatedAt: 1 }],
    ['규칙이 없다', { ...작은표, rules: undefined }],
    [
      '한도가 정수가 아니다',
      { ...작은표, rules: { weeklyBossSelectionLimit: null, weeklyCrystalSaleLimit: 90, defaultMaxPartySize: 6 } },
    ],
    // 파티 상한 기본값은 게임 수치라 코드가 6 을 들지 않는다. 없으면 표를 버리고 들고 있던 표가 선다.
    ['파티 인원 기본 상한이 없다', { ...작은표, rules: { weeklyBossSelectionLimit: 12, weeklyCrystalSaleLimit: 90 } }],
    [
      '난이도의 파티 인원 상한이 양의 정수가 아니다',
      { ...작은표, bosses: [{ ...작은표.bosses[0], difficulties: [{ difficulty: 'hard', requiredLevel: 190, maxPartySize: 0 }] }] },
    ],
    ['보스가 비었다', { ...작은표, bosses: [] }],
    ['보스 key 가 비었다', { ...작은표, bosses: [{ ...작은표.bosses[0], key: '' }] }],
    ['주기가 모르는 값이다', { ...작은표, bosses: [{ ...작은표.bosses[0], cycle: 'daily' }] }],
    ['초상 파일명이 없다', { ...작은표, bosses: [{ ...작은표.bosses[0], portraitSlug: undefined }] }],
    ['난이도가 비었다', { ...작은표, bosses: [{ ...작은표.bosses[0], difficulties: [] }] }],
    [
      '난이도가 모르는 값이다',
      { ...작은표, bosses: [{ ...작은표.bosses[0], difficulties: [{ difficulty: 'nightmare', requiredLevel: 1 }] }] },
    ],
    [
      '요구 레벨이 양의 정수가 아니다',
      { ...작은표, bosses: [{ ...작은표.bosses[0], difficulties: [{ difficulty: 'hard', requiredLevel: 0 }] }] },
    ],
    [
      '한 보스에 같은 난이도가 둘이다',
      {
        ...작은표,
        bosses: [
          {
            ...작은표.bosses[0],
            difficulties: [
              { difficulty: 'hard', requiredLevel: 190 },
              { difficulty: 'hard', requiredLevel: 200 },
            ],
          },
        ],
      },
    ],
    ['같은 key 가 둘이다', { ...작은표, bosses: [작은표.bosses[0], 작은표.bosses[0]] }],
  ])('%s → null', (_name, value) => {
    expect(parseBossCatalog(value)).toBeNull()
  })
})
