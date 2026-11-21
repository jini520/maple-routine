// 헥사 매트릭스 표를 읽는 쪽. 값은 fixture(사용자가 준 비용 표와 직업 48 개 · 전직업의 코어)다.
import {
  allocateHexaStorage,
  findHexaCore,
  findHexaStat,
  hexaFragmentsBetween,
  hexaFragmentsLeft,
  hexaJobCores,
  hexaSpendMeso,
  hexaStorageCandidates,
  parseHexaMatrix,
} from '../cashbook/hexa-matrix'
import hexaMatrix from '../../__fixtures__/game-data/hexa-matrix.json'

describe('hexaJobCores: 직업의 코어 목록', () => {
  it('렌은 코어 열넷이 종류의 차례(스킬 → 3rd → 마스터리 → 강화 → 공용 → 직업 공용)로 서고 코어마다 종류가 붙는다', () => {
    const cores = hexaJobCores('렌')

    expect(cores).toHaveLength(14)
    expect(cores.map((core) => core.kind.key)).toEqual([
      'skill', 'skill', 'skill_3rd',
      'mastery', 'mastery', 'mastery', 'mastery',
      'enhance', 'enhance', 'enhance', 'enhance',
      'common', 'common', 'job_common',
    ])
  })

  // 모든 직업이 함께 쓰는 코어는 `전직업` 줄 하나에만 있다. 직업마다 목록에 섞어야 솔 야누스 · 솔 헤카테를 고를 수 있다.
  it('전직업 줄의 코어가 직업마다 공용 코어 자리에 선다', () => {
    expect(hexaJobCores('히어로').filter((core) => core.kind.key === 'common').map((core) => core.name)).toEqual([
      '솔 야누스',
      '솔 헤카테',
    ])
  })

  // 호영만 3rd 스킬 코어가 스킬 코어 둘보다 앞에 저장돼 있었다. 1.0.15 부터 종류의 차례로 맞춘다(사용자 선택 2026-11-20).
  it('호영도 스킬 코어 둘 다음에 3rd 스킬 코어가 선다', () => {
    expect(hexaJobCores('호영').slice(0, 3).map((core) => core.kind.key)).toEqual(['skill', 'skill', 'skill_3rd'])
  })

  it('모르는 직업과 전직업은 빈 목록이다', () => {
    expect(hexaJobCores('없는 직업')).toEqual([])
    expect(hexaJobCores('전직업')).toEqual([])
  })

  it('기록의 key(코어 이름)로 직업을 몰라도 코어를 되짚는다', () => {
    expect(findHexaCore('매화검 본초 : 선참 VI')?.kind.key).toBe('mastery')
    expect(findHexaCore('없는 코어')).toBeNull()
  })
})

describe('hexaFragmentsBetween: 레벨 범위에 드는 조각 · 솔 에르다', () => {
  it('강화 전 레벨의 단계부터 강화 후 바로 앞 단계까지 더한다', () => {
    // 마스터리 25→26 110 · 26→27 115 · 27→28 120
    expect(hexaFragmentsBetween('mastery', 25, 28)).toEqual({ fragments: 345, solErda: 9 })
  })

  it('0 에서 30 까지는 사용자가 준 표의 합계와 같다', () => {
    expect(hexaFragmentsBetween('skill', 0, 30)).toEqual({ fragments: 4500, solErda: 150 })
    expect(hexaFragmentsBetween('job_common', 0, 30)).toEqual({ fragments: 4035, solErda: 137 })
  })

  it('범위가 거꾸로이거나 만렙을 넘으면 null 이다', () => {
    expect(hexaFragmentsBetween('skill', 5, 5)).toBeNull()
    expect(hexaFragmentsBetween('skill', 29, 31)).toBeNull()
    expect(hexaFragmentsBetween('없는 종류', 0, 1)).toBeNull()
  })
})

describe('hexaSpendMeso: 지출 금액', () => {
  it('(필요 조각 − 교환 불가) × 개당 가격이다', () => {
    expect(hexaSpendMeso({ fragments: 345, untradable: 45, price: 7_200_000 })).toBe(2_160_000_000)
  })

  it('교환 불가가 필요 조각보다 많으면 0 이다', () => {
    expect(hexaSpendMeso({ fragments: 83, untradable: 100, price: 7_200_000 })).toBe(0)
  })
})

describe('hexaSpendMeso: 보관에서 가져온 조각', () => {
  it('지출 체크를 끄면 보관에서 가져온 몫은 금액에서 빠지고, 켜면 들어간다', () => {
    const input = { fragments: 690, untradable: 30, price: 7_200_000, taken: 420 }
    expect(hexaSpendMeso({ ...input, takenAsSpend: false })).toBe(240 * 7_200_000)
    expect(hexaSpendMeso({ ...input, takenAsSpend: true })).toBe(660 * 7_200_000)
  })

  it('필요 조각은 교환 불가와 보관 몫을 뺀 수이고, 지출 체크와 상관없다', () => {
    expect(hexaFragmentsLeft({ fragments: 690, untradable: 30, taken: 420 })).toBe(240)
    expect(hexaFragmentsLeft({ fragments: 690, untradable: 30, taken: 660 })).toBe(0)
    expect(hexaFragmentsLeft({ fragments: 50, untradable: 80, taken: 0 })).toBe(0)
  })
})

describe('hexaStorageCandidates: 보관을 가져오는 캐릭터와 차례', () => {
  const accounts: Record<string, string> = { main: 'A', alt1: 'A', alt2: 'A', otherWorld: 'A', noWorld: 'A', other: 'B' }
  const worlds: Record<string, string> = { main: 'scania', alt1: 'scania', alt2: 'scania', otherWorld: 'luna', other: 'scania' }
  const accountOf = (ocid: string): string | null => accounts[ocid] ?? null
  const worldOf = (ocid: string): string | null => worlds[ocid] ?? null

  it('강화한 캐릭터가 먼저이고, 그다음은 같은 메이플 ID · 같은 월드의 추적 캐릭터를 캐릭터 관리 순서로 둔다', () => {
    expect(
      hexaStorageCandidates({
        ocid: 'main',
        trackedOcids: ['alt2', 'other', 'otherWorld', 'noWorld', 'main', 'alt1'],
        accountOf,
        worldOf,
      }),
    ).toEqual(['main', 'alt2', 'alt1'])
  })

  it('메이플 ID 나 월드를 모르면 강화한 캐릭터 자신뿐이다', () => {
    expect(hexaStorageCandidates({ ocid: 'lost', trackedOcids: ['lost', 'main', 'alt1'], accountOf, worldOf })).toEqual([
      'lost',
    ])
    expect(hexaStorageCandidates({ ocid: 'noWorld', trackedOcids: ['noWorld', 'main'], accountOf, worldOf })).toEqual([
      'noWorld',
    ])
  })

  it('강화한 캐릭터가 추적 목록에 없어도 먼저 선다', () => {
    expect(hexaStorageCandidates({ ocid: 'main', trackedOcids: ['alt1'], accountOf, worldOf })).toEqual(['main', 'alt1'])
  })
})

describe('allocateHexaStorage: 보관에서 가져오는 배분', () => {
  it('교환 불가를 먼저 빼고, 남은 개수를 차례대로 가져오며 마지막 캐릭터는 모자란 만큼만 쓴다', () => {
    const result = allocateHexaStorage({
      fragments: 690,
      untradable: 30,
      storages: [
        { ocid: 'main', stored: 120 },
        { ocid: 'alt1', stored: 300 },
        { ocid: 'alt2', stored: 400 },
      ],
    })
    expect(result.uses).toEqual([
      { ocid: 'main', fragments: 120 },
      { ocid: 'alt1', fragments: 300 },
      { ocid: 'alt2', fragments: 240 },
    ])
    expect(result.taken).toBe(660)
  })

  it('보관이 0 이하인 캐릭터는 건너뛰고, 보관이 모자라면 있는 만큼만 가져온다', () => {
    const result = allocateHexaStorage({
      fragments: 690,
      untradable: 30,
      storages: [
        { ocid: 'main', stored: -20 },
        { ocid: 'alt1', stored: 0 },
        { ocid: 'alt2', stored: 400 },
      ],
    })
    expect(result.uses).toEqual([{ ocid: 'alt2', fragments: 400 }])
    expect(result.taken).toBe(400)
  })

  it('교환 불가가 필요 조각 이상이면 보관에서 가져오지 않는다', () => {
    const result = allocateHexaStorage({ fragments: 50, untradable: 80, storages: [{ ocid: 'main', stored: 100 }] })
    expect(result).toEqual({ uses: [], taken: 0 })
  })

  it('메이플 ID · 월드의 기타 조각을 먼저 가져오고, 모자란 만큼만 캐릭터의 사냥 조각에서 가져온다', () => {
    const result = allocateHexaStorage({
      fragments: 500,
      untradable: 0,
      other: { accountId: 'maple-a', worldKey: 'scania', stored: 300 },
      storages: [
        { ocid: 'main', stored: 150 },
        { ocid: 'alt1', stored: 100 },
      ],
    })
    expect(result).toEqual({
      otherUse: { accountId: 'maple-a', worldKey: 'scania', fragments: 300 },
      uses: [
        { ocid: 'main', fragments: 150 },
        { ocid: 'alt1', fragments: 50 },
      ],
      taken: 500,
    })
  })

  it('기타 조각으로 다 채우면 사냥 조각은 가져오지 않는다', () => {
    const result = allocateHexaStorage({
      fragments: 100,
      untradable: 20,
      other: { accountId: 'maple-a', worldKey: 'scania', stored: 300 },
      storages: [{ ocid: 'main', stored: 150 }],
    })
    expect(result).toEqual({ otherUse: { accountId: 'maple-a', worldKey: 'scania', fragments: 80 }, uses: [], taken: 80 })
  })
})

describe('findHexaStat: 헥사 스탯과 활성화 조각', () => {
  it('헥사 스탯 Ⅱ 의 활성화는 조각 200 개다', () => {
    expect(findHexaStat('hexa_stat_2')).toMatchObject({ key: 'hexa_stat_2', name: '헥사 스탯 Ⅱ', activationFragmentQuantity: 200 })
  })
})

describe('parseHexaMatrix: 계약을 어긴 표는 통째로 버린다', () => {
  const 표 = (patch: Record<string, unknown>) => ({ ...hexaMatrix, ...patch })

  it('fixture 는 통과한다', () => {
    expect(parseHexaMatrix(hexaMatrix)).not.toBeNull()
  })

  it('코어나 비용 줄이 이 칸에 없는 직업 · 종류를 가리키면 버린다', () => {
    const [core] = hexaMatrix.hexaCores
    const [cost] = hexaMatrix.hexaCoreLevelCosts
    expect(parseHexaMatrix(표({ hexaCores: [{ ...core, typeId: '없는 종류' }] }))).toBeNull()
    expect(parseHexaMatrix(표({ hexaCores: [{ ...core, jobId: '없는 직업' }] }))).toBeNull()
    expect(parseHexaMatrix(표({ hexaCoreLevelCosts: [{ ...cost, typeId: '없는 종류' }] }))).toBeNull()
  })

  it('활성화 비용을 모르는 스탯은 비용 없이 받는다', () => {
    const hexaStats = [...hexaMatrix.hexaStats, { id: 's4', key: 'hexa_stat_4', name: '헥사 스탯 Ⅳ', activationFragmentQuantity: null }]
    expect(parseHexaMatrix(표({ hexaStats }))?.hexaStats.at(-1)).toEqual({ id: 's4', key: 'hexa_stat_4', name: '헥사 스탯 Ⅳ' })
  })
})
