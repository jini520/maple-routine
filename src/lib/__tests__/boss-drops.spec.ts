import {
  getAccessoryBoxContents,
  getBossDifficulties,
  getBossDropCandidates,
  getBossFixedDrops,
  dropTileIdentity,
  dropTileKey,
  getObtainableTileKeys,
  getRingBoxContents,
  bossDropsTable,
} from '../boss/boss-drops'
import { bossDifficultyIdOf } from '../boss/bosses'

// 2026-09-17 패치 앞뒤의 주. 기존 케이스는 패치 전 주로 본다.
const 패치전 = '2026-09-10'
const 패치후 = '2026-09-17'
// 패치가 적용되는 09-17 오전 10시 뒤. 기록을 지우는 판정은 시계를 안 보고 `null` 을 받는다.
const 패치후시각 = new Date('2026-09-18T12:00:00+09:00')

describe('getBossDropCandidates', () => {
  it('보스의 전 난이도 선택 후보(장비·소비)를 통합해 반환한다 (스우)', () => {
    const candidates = getBossDropCandidates('lotus', 패치전, 패치후시각)

    expect(candidates.length).toBeGreaterThan(0)
    // 선택 후보는 장비·소비만 (고정은 읽기 전용이라 제외)
    for (const candidate of candidates) {
      expect(['equipment', 'consumable']).toContain(candidate.category)
    }
    expect(candidates.some((candidate) => candidate.name === '주문의 흔적')).toBe(false)
  })

  it('같은 아이템은 key 로 통합하고 등장 난이도를 정규 순서로 담는다', () => {
    // 루즈 컨트롤 머신 마크(얼굴장식)는 스우 하드+익스트림에서 드롭 → 한 후보로 통합
    const marks = getBossDropCandidates('lotus', 패치전, 패치후시각).filter(
      (candidate) => candidate.name === '루즈 컨트롤 머신 마크',
    )
    expect(marks.length).toBe(1)
    expect(marks[0]).toMatchObject({ category: 'equipment' })
    expect(marks[0].difficulties).toEqual(['hard', 'extreme'])
  })

  it('난이도별로만 드롭되는 소비 상자도 모두 통합해 노출한다 (스우 녹옥/홍옥/백옥)', () => {
    const names = getBossDropCandidates('lotus', 패치전, 패치후시각).map((candidate) => candidate.name)
    expect(names).toContain('녹옥의 보스 반지 상자') // 노멀
    expect(names).toContain('홍옥의 보스 반지 상자') // 하드
    expect(names).toContain('백옥의 보스 반지 상자') // 익스트림
  })

  // 옛 scroll 카테고리는 코드가 순회하지 않아 화면에 나온 적이 없다. consumable로
  // 흡수했으니 이제 선택 후보로 잡혀야 한다.
  it('주문서 교환권 3종은 소비 후보로 노출된다 (가디언 엔젤 슬라임 카오스)', () => {
    const coupons = getBossDropCandidates('guardian_angel_slime', 패치전, 패치후시각).filter((candidate) =>
      candidate.name.endsWith('교환권'),
    )

    expect(coupons.map((candidate) => candidate.name)).toEqual([
      '프리미엄 악세서리 스크롤 교환권',
      '프리미엄 펫장비 스크롤 교환권',
      '매지컬 무기 주문서 교환권',
    ])
    for (const coupon of coupons) {
      expect(coupon.category).toBe('consumable')
      expect(coupon.difficulties).toEqual(['chaos'])
    }
  })

  it('듄켈 하드의 교환권은 하나로 통합된다. 옛 이름 갈림이 해소됐다', () => {
    const names = getBossDropCandidates('darknell', 패치전, 패치후시각)
      .map((candidate) => candidate.name)
      .filter((name) => name.includes('악세서리'))

    expect(names).toEqual(['프리미엄 악세서리 스크롤 교환권'])
  })
})

describe('getBossFixedDrops', () => {
  it('고정 드롭을 난이도별 그룹(정규 순서)으로 반환한다 (스우)', () => {
    const groups = getBossFixedDrops('lotus', 패치전, 패치후시각)

    expect(groups.map((group) => group.difficulty)).toEqual(['normal', 'hard', 'extreme'])
    // 같은 아이템도 난이도마다 값이 다름. 그룹별 값을 그대로 유지한다
    const hard = groups.find((group) => group.difficulty === 'hard')
    expect(hard?.items).toContainEqual(
      expect.objectContaining({ name: '솔 에르다의 기운', quantity: 50 }),
    )
    const extreme = groups.find((group) => group.difficulty === 'extreme')
    expect(extreme?.items).toContainEqual(
      expect.objectContaining({ name: '솔 에르다의 기운', quantity: 280 }),
    )
  })
})

describe('getBossDifficulties', () => {
  it('드롭 테이블에 표시 가능한 드롭이 있는 난이도를 정규 순서로 반환한다 (스우)', () => {
    expect(getBossDifficulties('lotus')).toEqual(['normal', 'hard', 'extreme'])
  })

  it('카링은 이지~익스트림 4난이도를 정규 순서로 반환한다', () => {
    expect(getBossDifficulties('kaling')).toEqual(['easy', 'normal', 'hard', 'extreme'])
  })
})

describe('getObtainableTileKeys', () => {
  it('그 난이도에서 획득 가능한 선택 타일 key 만 담는다 (스우 하드)', () => {
    const keys = getObtainableTileKeys('lotus', 'hard', 패치전)
    expect(keys.has('loose_control_machine_mark')).toBe(true) // 루즈 컨트롤 머신 마크, 하드+익스
    expect(keys.has('red_boss_ring_box')).toBe(true) // 홍옥, 하드
    expect(keys.has('complete_under_control')).toBe(false) // 익스 전용
    expect(keys.has('white_boss_ring_box')).toBe(false) // 백옥, 익스 전용
    expect(keys.has('green_boss_ring_box')).toBe(false) // 녹옥, 노멀 전용
  })
})

describe('dropTileKey · dropTileIdentity', () => {
  it('상자 결과는 상자 key, 그 밖은 아이템 key 다', () => {
    expect(dropTileKey({ itemKey: 'dreamy_belt', itemName: '몽환의 벨트' })).toBe('dreamy_belt')
    expect(
      dropTileKey({ itemKey: 'restraint_ring', itemName: '리스트레인트 링', boxOriginKey: 'red_boss_ring_box', boxOrigin: '홍옥의 보스 반지 상자' }),
    ).toBe('red_boss_ring_box')
    // 상자 결과인데 상자 key 가 없으면 나온 아이템 key 로 떨어지지 않는다. 다른 타일이 된다.
    expect(dropTileKey({ itemKey: 'restraint_ring', itemName: '리스트레인트 링', boxOriginKey: null, boxOrigin: '없어진 상자' })).toBeNull()
  })

  it('같은 key 면 적어 둔 이름이 달라도 같은 타일이고, key 가 없으면 이름으로 가른다', () => {
    expect(dropTileIdentity({ itemKey: 'dreamy_belt', itemName: '옛 이름' })).toBe(
      dropTileIdentity({ itemKey: 'dreamy_belt', itemName: '몽환의 벨트' }),
    )
    expect(dropTileIdentity({ itemKey: null, itemName: '익셉셔널 해머' })).toBe(
      dropTileIdentity({ itemKey: null, itemName: '익셉셔널 해머' }),
    )
    expect(dropTileIdentity({ itemKey: null, itemName: 'dreamy_belt' })).not.toBe(
      dropTileIdentity({ itemKey: 'dreamy_belt', itemName: '몽환의 벨트' }),
    )
  })
})

describe('getRingBoxContents (백옥 기준 그룹핑)', () => {
  it('백옥은 11 명명 반지만 반환하고 기타/연마석이 없다 (전부 레벨 있음)', () => {
    const c = getRingBoxContents('white_boss_ring_box')

    expect(c).not.toBeNull()
    expect(c?.levels).toEqual([3, 4])
    expect(c?.rings.length).toBe(11)
    const names = c!.rings.map((r) => r.name)
    expect(names).toContain('리스트레인트 링')
    expect(names).toContain('컨티뉴어스 링')
    expect(names).not.toContain('기타')
    expect(c?.rings.every((r) => r.hasLevel)).toBe(true)
  })

  // 서버 아이템 표에 백옥 밖 반지를 묶는 줄이 없다. 묶을 줄 없이 고르게 하면 서버가 받지 못하는 기록이 생긴다.
  it('홍옥은 백옥 반지만 세우고, 백옥 밖 반지와 기타는 세우지 않는다', () => {
    const c = getRingBoxContents('red_boss_ring_box')

    expect(c?.levels).toEqual([1, 2, 3, 4])
    const names = c!.rings.map((r) => r.name)
    expect(c?.rings.length).toBe(11)
    expect(names).toContain('리스트레인트 링')
    expect(names).not.toContain('레벨퍼프 - S링')
    expect(names).not.toContain('버든리프트 링')
    expect(names).not.toContain('기타')
  })

  it('생명은 명명 반지 + 생명의 연마석(레벨 없음)이고 기타는 없다', () => {
    const c = getRingBoxContents('life_boss_ring_box')

    expect(c?.levels).toEqual([3, 4])
    const names = c!.rings.map((r) => r.name)
    expect(names).not.toContain('기타')
    // 정렬: 명명 → 연마석 (기타 없음) → 연마석이 맨 뒤
    expect(names[names.length - 1]).toBe('생명의 연마석')
    expect(c?.rings.find((r) => r.name === '생명의 연마석')?.hasLevel).toBe(false)
    expect(c?.rings.find((r) => r.name === '리스트레인트 링')?.hasLevel).toBe(true)
    // 9 명명 + 연마석 1 = 10
    expect(c?.rings.length).toBe(10)
  })

  it('반지 상자가 아니면 null', () => {
    expect(getRingBoxContents('chaos_pitch_black_accessory_box')).toBeNull()
  })
})

// 칸마다 따로 받아 드롭 표가 보스 표보다 앞설 수 있다. 모르는 줄을 가리키는 보상은 보일 이름이 없어 뺀다.
describe('다른 칸을 가리키는 줄', () => {
  const 원래 = bossDropsTable.get()
  afterEach(() => bossDropsTable.set(원래))

  it('보스 표에 없는 난이도 줄 · 아이템 표에 없는 아이템 줄을 가리키는 보상은 후보에 세우지 않는다', () => {
    const 스우노말 = getBossDropCandidates('lotus', 패치전, null).map((candidate) => candidate.key)
    bossDropsTable.set({
      ...원래,
      bossDifficultyRewards: [
        ...원래.bossDifficultyRewards,
        { bossDifficultyId: 'nope', category: 'equipment', itemId: 원래.bossDifficultyRewards[0].itemId },
        { bossDifficultyId: bossDifficultyIdOf('lotus', 'normal') ?? '', category: 'equipment', itemId: 'nope' },
      ],
    })

    expect(getBossDropCandidates('lotus', 패치전, null).map((candidate) => candidate.key)).toEqual(스우노말)
  })

  // 상자 내용물은 상자 연마석 줄을 가리킨다. 기록은 아직 원래 연마석의 key 를 적어 같은 key 로 세워야 한다.
  it('상자 후보는 같은 물건의 원래 아이템 key 로 선다', () => {
    expect(getRingBoxContents('life_boss_ring_box')?.rings.map((ring) => ring.key)).toContain('life_whetstone')
    expect(getRingBoxContents('life_boss_ring_box')?.rings.map((ring) => ring.key)).not.toContain(
      'life_whetstone_from_box',
    )
  })
})

describe('getAccessoryBoxContents', () => {
  it('칠흑 장신구 상자의 후보 7종을 반환한다', () => {
    const contents = getAccessoryBoxContents('chaos_pitch_black_accessory_box')

    expect(contents).not.toBeNull()
    expect(contents?.length).toBe(7)
    expect(contents?.some((item) => item.name === '루즈 컨트롤 머신 마크')).toBe(true)
  })

  it('장신구 상자가 아니면 null', () => {
    expect(getAccessoryBoxContents('red_boss_ring_box')).toBeNull()
  })
})

// 2026-09-17 패치. 표에서 지우면 패치 전에 먹은 기록이 거짓 기록으로 지워지므로 줄이 기간을 든다.
describe('2026-09-17 패치: 아이템이 기간을 든다', () => {
  const 교환권 = ['프리미엄 악세서리 스크롤 교환권', '프리미엄 펫장비 스크롤 교환권', '매지컬 무기 주문서 교환권']
  const namesOf = (boss: string, periodKey: string): string[] =>
    getBossDropCandidates(boss, periodKey, 패치후시각).map((candidate) => candidate.name)
  const fixedOf = (boss: string, difficulty: string, periodKey: string) =>
    getBossFixedDrops(boss, periodKey, 패치후시각).find((group) => group.difficulty === difficulty)?.items ?? []

  it('교환권 셋은 패치 전 주에만 후보로 선다', () => {
    expect(namesOf('guardian_angel_slime', 패치전)).toEqual(expect.arrayContaining(교환권))
    for (const name of 교환권) {
      expect(namesOf('guardian_angel_slime', 패치후)).not.toContain(name)
    }
  })

  it('소울 에테르는 패치 뒤의 주부터 소비 후보로 선다', () => {
    expect(namesOf('kaling', 패치전)).not.toContain('1단계 소울 에테르')

    expect(getBossDropCandidates('kaling', 패치후, 패치후시각)).toContainEqual(
      expect.objectContaining({
        name: '1단계 소울 에테르',
        category: 'consumable',
        difficulties: ['normal', 'hard', 'extreme'],
      }),
    )
  })

  it('고정 보상도 그 주의 것을 준다 (데미안 하드 실버 1 → 0)', () => {
    expect(fixedOf('damien', 'hard', 패치전)).toContainEqual(
      expect.objectContaining({ name: '메멘토 실버 큐브', quantity: 1 }),
    )
    expect(fixedOf('damien', 'hard', 패치후).map((item) => item.name)).not.toContain('메멘토 실버 큐브')
  })

  it('수량이 바뀐 칸은 한 기간에 한 줄만 선다 (더스크 카오스 실버 2 → 1)', () => {
    const 실버 = (periodKey: string) =>
      fixedOf('gloom', 'chaos', periodKey).filter((item) => item.name === '메멘토 실버 큐브')

    expect(실버(패치전)).toEqual([expect.objectContaining({ quantity: 2 })])
    expect(실버(패치후)).toEqual([expect.objectContaining({ quantity: 1 })])
  })

  it('검은마법사 하드는 10월 기간부터 골드 8 이 실버 8 로 바뀐다', () => {
    const names = (periodKey: string) => fixedOf('black_mage', 'hard', periodKey).map((item) => item.name)

    expect(names('2026-09')).toContain('메멘토 골드 큐브')
    expect(names('2026-09')).not.toContain('메멘토 실버 큐브')
    expect(names('2026-10')).toContain('메멘토 실버 큐브')
    expect(names('2026-10')).not.toContain('메멘토 골드 큐브')
  })

  // 9월 기간은 9/1 에 시작한다. 처치 날짜가 없어 9월 초에 먹은 기록을 가를 수 없으므로 얻을 수
  // 있었던 것으로 본다.
  it('검은마법사의 9월 기간은 교환권을 얻을 수 있다. 10월 기간부터 못 얻는다', () => {
    expect(getObtainableTileKeys('black_mage', 'hard', '2026-09').has('magical_weapon_scroll_voucher')).toBe(true)
    expect(getObtainableTileKeys('black_mage', 'hard', '2026-10').has('magical_weapon_scroll_voucher')).toBe(false)
  })
})
