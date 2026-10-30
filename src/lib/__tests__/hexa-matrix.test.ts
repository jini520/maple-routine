// 헥사 매트릭스 표를 읽는 쪽. 값은 fixture(사용자가 준 비용 표와 2026-10-30 에 조회한 직업 48 개의 코어)다.
import {
  findHexaCore,
  findHexaStat,
  hexaFragmentsBetween,
  hexaJobCores,
  hexaKindOf,
  hexaSpendMeso,
  parseHexaMatrix,
} from '../cashbook/hexa-matrix'
import hexaMatrix from '../../__fixtures__/game-data/hexa-matrix.json'

describe('hexaKindOf: 코어 이름과 API 타입으로 종류를 가른다', () => {
  it('이름 표에 있으면 그 종류다. 3rd 스킬 코어와 솔 야누스 · 솔 헤카테가 그렇다', () => {
    expect(hexaKindOf({ name: '창룡파천검 : 만참', apiType: '스킬 코어' })?.key).toBe('skill_3rd')
    expect(hexaKindOf({ name: '솔 야누스', apiType: '공용 코어' })?.key).toBe('common')
    expect(hexaKindOf({ name: '솔 헤카테', apiType: '공용 코어' })?.key).toBe('common')
  })

  it('이름 표에 없으면 그 API 타입의 기본 종류다. 공용 코어의 나머지 하나가 직업 공용 코어가 된다', () => {
    expect(hexaKindOf({ name: '창룡파천검 : 승천', apiType: '스킬 코어' })?.key).toBe('skill')
    expect(hexaKindOf({ name: '화중군자 VI', apiType: '공용 코어' })?.key).toBe('job_common')
    expect(hexaKindOf({ name: '매화검 본초 : 선참 VI', apiType: '마스터리 코어' })?.key).toBe('mastery')
  })

  // 소울마스터의 3rd 코어는 API 가 이름 끝에 공백을 붙여 준다. 그대로 비교하면 기본 종류로 잘못 간다.
  it('이름의 앞뒤 공백을 걷고 비교한다', () => {
    expect(hexaKindOf({ name: '셀레스티얼 클리브 ', apiType: '스킬 코어' })?.key).toBe('skill_3rd')
  })

  // 새 타입이 나왔는데 종류 표에 없으면 비용을 낼 수 없다. 아무 종류나 붙이면 틀린 금액이 저장된다.
  it('종류 표에 없는 API 타입은 null 이다', () => {
    expect(hexaKindOf({ name: '어떤 코어', apiType: '새 코어' })).toBeNull()
  })
})

describe('hexaJobCores: 직업의 코어 목록', () => {
  it('렌은 코어 열넷이 API 차례(스킬 → 마스터리 → 강화 → 공용)로 서고 코어마다 종류가 붙는다', () => {
    const cores = hexaJobCores('렌')

    expect(cores).toHaveLength(14)
    expect(cores.map((core) => core.kind?.key)).toEqual([
      'skill', 'skill', 'skill_3rd',
      'mastery', 'mastery', 'mastery', 'mastery',
      'enhance', 'enhance', 'enhance', 'enhance',
      'common', 'common', 'job_common',
    ])
  })

  it('모르는 직업은 빈 목록이다', () => {
    expect(hexaJobCores('없는 직업')).toEqual([])
  })

  it('기록의 key(코어 이름)로 직업을 몰라도 코어를 되짚는다', () => {
    expect(findHexaCore('매화검 본초 : 선참 VI')?.kind?.key).toBe('mastery')
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

describe('findHexaStat: 헥사 스탯과 활성화 조각', () => {
  it('헥사 스탯 Ⅱ 의 활성화는 조각 200 개다', () => {
    expect(findHexaStat('hexa_stat_2')).toEqual({ key: 'hexa_stat_2', name: '헥사 스탯 Ⅱ', activationFragments: 200 })
  })
})

describe('parseHexaMatrix: 계약을 어긴 표는 통째로 버린다', () => {
  const 표 = (patch: Record<string, unknown>) => ({ ...hexaMatrix, ...patch })

  it('fixture 는 통과한다', () => {
    expect(parseHexaMatrix(hexaMatrix)).not.toBeNull()
  })

  // 기본 종류가 둘이면 이름 표에 없는 코어가 어느 쪽인지 못 정한다.
  it('한 API 타입에 기본 종류가 둘이면 버린다', () => {
    const kinds = hexaMatrix.kinds.map((kind) => (kind.key === 'skill_3rd' ? { ...kind, isDefault: true } : kind))
    expect(parseHexaMatrix(표({ kinds }))).toBeNull()
  })

  it('이름 표나 비용 줄이 없는 종류를 가리키면 버린다', () => {
    expect(parseHexaMatrix(표({ nameKinds: [{ name: '솔 야누스', kind: '없는 종류' }] }))).toBeNull()
    expect(parseHexaMatrix(표({ levelCosts: [{ kind: '없는 종류', level: 0, fragments: 1, solErda: 0 }] }))).toBeNull()
  })

  it('활성화 비용을 모르는 스탯은 비용 없이 받는다', () => {
    const stats = [...hexaMatrix.stats, { key: 'hexa_stat_4', name: '헥사 스탯 Ⅳ', activationFragments: null }]
    expect(parseHexaMatrix(표({ stats }))?.stats.at(-1)).toEqual({ key: 'hexa_stat_4', name: '헥사 스탯 Ⅳ' })
  })
})
