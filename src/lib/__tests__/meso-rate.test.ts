import {
  CHALLENGERS_MESO_PERCENT,
  EQUIP_MESO_CAP,
  challengersMesoOf,
  jobMesoOf,
  maxMesoRateOf,
  mesoPercentOf,
} from '../cashbook/meso-rate'
import type {
  NexonAbilityResponse,
  NexonCharacterSkillResponse,
  NexonItemEquipmentItem,
  NexonItemEquipmentResponse,
  NexonSymbolEquipmentResponse,
  NexonUnionArtifactResponse,
  NexonUnionRaiderResponse,
} from '../../types'

/** 잠재·에디셔널 표기(`+` 가 붙고 「증가」가 없다). */
const POT = (percent: number) => `메소 획득량 +${percent}%`
/** 어빌리티·유니온·아티팩트 표기(뒤에 「증가」가 붙는다). */
const INC = (percent: number) => `메소 획득량 ${percent}% 증가`

/** 잠재 `pot` 줄 · 에디셔널 `add` 줄을 든 장비 하나. 슬롯은 각각 셋이 상한이다. */
function item(pot: readonly string[] = [], add: readonly string[] = []) {
  const each: Record<string, string> = {}
  pot.forEach((value, index) => (each[`potential_option_${index + 1}`] = value))
  add.forEach((value, index) => (each[`additional_potential_option_${index + 1}`] = value))
  return each
}

const EMPTY_EQUIP: NexonItemEquipmentResponse = {}
const EMPTY_ABILITY: NexonAbilityResponse = {}
const EMPTY_SYMBOL: NexonSymbolEquipmentResponse = {}
const EMPTY_UNION: NexonUnionRaiderResponse = {}
const EMPTY_ARTIFACT: NexonUnionArtifactResponse = {}
const EMPTY_SKILL: NexonCharacterSkillResponse = {}

/** 축 하나만 채워 넣고 나머지는 비운다 — 합이 곧 그 축의 값이다. */
function only(sources: {
  itemEquipment?: NexonItemEquipmentResponse
  ability?: NexonAbilityResponse
  symbol?: NexonSymbolEquipmentResponse
  unionRaider?: NexonUnionRaiderResponse
  unionArtifact?: NexonUnionArtifactResponse
  skill?: NexonCharacterSkillResponse
  jobClass?: string | null
}) {
  return maxMesoRateOf({
    itemEquipment: sources.itemEquipment ?? EMPTY_EQUIP,
    ability: sources.ability ?? EMPTY_ABILITY,
    symbol: sources.symbol ?? EMPTY_SYMBOL,
    unionRaider: sources.unionRaider ?? EMPTY_UNION,
    unionArtifact: sources.unionArtifact ?? EMPTY_ARTIFACT,
    skill: sources.skill ?? EMPTY_SKILL,
    jobClass: sources.jobClass ?? null,
  })
}

describe('mesoPercentOf — 표기 둘을 한 정규식이 받는다', () => {
  it('잠재 표기와 어빌리티 표기를 모두 읽는다', () => {
    expect(mesoPercentOf('메소 획득량 +20%')).toBe(20)
    expect(mesoPercentOf('메소 획득량 20% 증가')).toBe(20)
  })

  it('소수도 읽는다 — 아티팩트가 `15.00%` 꼴을 쓴다', () => {
    expect(mesoPercentOf('메소 획득량 12.5% 증가')).toBe(12.5)
  })

  it('수치가 없는 크리스탈 옵션명은 0 이다', () => {
    // union_artifact_crystal 의 `crystal_option_name_*` 은 이름뿐이고 값이 없다([[ADR-177]] 결정 5 ②).
    expect(mesoPercentOf('메소 획득량 증가')).toBe(0)
  })

  it('메획이 아닌 옵션과 빈 값은 0 이다', () => {
    expect(mesoPercentOf('아이템 드롭률 +20%')).toBe(0)
    expect(mesoPercentOf(null)).toBe(0)
    expect(mesoPercentOf(undefined)).toBe(0)
  })
})

describe('장비 — 잠재 + 에디셔널 합에 100% 캡, 프리셋 단위', () => {
  it('에디셔널에 붙은 메획도 읽는다 — 실데이터엔 없지만 붙을 수 있다', () => {
    expect(only({ itemEquipment: { item_equipment: [item([], [POT(20), POT(20)])] } })).toBe(40)
  })

  it('잠재 100 + 에디셔널 20 = 120 은 캡에 걸려 100 이다', () => {
    const five = Array.from({ length: 5 }, () => item([POT(20)]))
    expect(only({ itemEquipment: { item_equipment: [...five, item([], [POT(20)])] } })).toBe(
      EQUIP_MESO_CAP,
    )
  })

  it('경계(정확히 100)에서는 캡이 안 깎는다', () => {
    const four = Array.from({ length: 4 }, () => item([POT(20)]))
    expect(only({ itemEquipment: { item_equipment: [...four, item([], [POT(20)])] } })).toBe(100)
  })

  it('캡은 프리셋마다 따로 건다 — 합산 뒤 캡이 아니다', () => {
    // P1 = 120(→100) · P2 = 60. 답은 100 이고, 합산 뒤 캡이면 min(180,100)=100 으로 **우연히 같다**.
    // 그래서 우연이 안 생기는 짝으로도 잰다(아래 it).
    expect(
      only({
        itemEquipment: {
          item_equipment_preset_1: [item([POT(20), POT(20), POT(20)]), item([POT(20), POT(20), POT(20)])],
          item_equipment_preset_2: [item([POT(20), POT(20), POT(20)])],
        },
      }),
    ).toBe(100)
  })

  it('프리셋 둘이 각각 60 이면 합산 뒤 캡(100)이 아니라 60 이다', () => {
    expect(
      only({
        itemEquipment: {
          item_equipment_preset_1: [item([POT(20), POT(20), POT(20)])],
          item_equipment_preset_2: [item([POT(20), POT(20), POT(20)])],
        },
      }),
    ).toBe(60)
  })

  it('현재 적용본과 프리셋 배열을 합치지 않는다 — 최댓값 하나만 센다', () => {
    // 같이 오는 필드라 전부 훑으면 200 으로 부푼다([[ADR-177]] 결정 5 ③).
    const meso100 = Array.from({ length: 5 }, () => item([POT(20)]))
    expect(only({ itemEquipment: { item_equipment: meso100, item_equipment_preset_1: meso100 } })).toBe(100)
  })

  it('잠재 슬롯은 셋까지다 — 넷째 칸은 존재하지 않으므로 안 읽는다', () => {
    // 타입에도 없는 칸이라 캐스팅해서 넣는다 — «넷째가 오면 어쩌나» 가 아니라 «와도 안 읽는다» 를
    // 잰다. 슬롯이 늘면 타입이 먼저 갈리고 이 케이스가 그때 이야기를 한다.
    const 넷째칸 = { potential_option_4: POT(20) } as unknown as NexonItemEquipmentItem
    expect(only({ itemEquipment: { item_equipment: [넷째칸] } })).toBe(0)
  })
})

describe('어빌리티 — 프리셋 넷 중 최댓값', () => {
  it('현재 적용본이 아니라 가장 높은 프리셋을 쓴다', () => {
    expect(
      only({
        ability: {
          ability_info: [{ ability_value: INC(0) }],
          ability_preset_1: { ability_info: [{ ability_value: INC(14) }] },
          ability_preset_2: { ability_info: [] },
          ability_preset_3: { ability_info: [{ ability_value: INC(20) }] },
        },
      }),
    ).toBe(20)
  })

  it('장비와 어빌리티는 축이 달라 각각의 최댓값이 더해진다', () => {
    // 프리셋은 독립 전환이라 «장비 P1 + 어빌 P3» 세팅이 실제로 도달 가능하다([[ADR-177]] 결정 4).
    expect(
      maxMesoRateOf({
        itemEquipment: { item_equipment_preset_1: [item([POT(20)])], item_equipment_preset_2: [] },
        ability: {
          ability_preset_1: { ability_info: [] },
          ability_preset_3: { ability_info: [{ ability_value: INC(20) }] },
        },
        symbol: EMPTY_SYMBOL,
        unionRaider: EMPTY_UNION,
        unionArtifact: EMPTY_ARTIFACT,
        skill: EMPTY_SKILL,
        jobClass: null,
      }),
    ).toBe(40)
  })
})

describe('심볼 — 전용 숫자 필드이고 캡 밖이다', () => {
  it('symbol_meso_rate 를 더한다 — `"0%"` 가 섞여 와도 안전하다', () => {
    expect(
      only({
        symbol: {
          symbol: [{ symbol_meso_rate: '15%' }, { symbol_meso_rate: '14%' }, { symbol_meso_rate: '0%' }],
        },
      }),
    ).toBe(29)
  })

  it('장비가 캡에 걸려도 심볼은 그 위에 얹힌다', () => {
    const over = Array.from({ length: 6 }, () => item([POT(20)])) // 120 → 100
    expect(
      only({
        itemEquipment: { item_equipment: over },
        symbol: { symbol: [{ symbol_meso_rate: '29%' }] },
      }),
    ).toBe(129)
  })
})

describe('유니온 — 죽은 프리셋과 크리스탈 이중계산', () => {
  it('union_raider_preset 이 전부 null 이면 현재 적용본으로 폴백한다', () => {
    expect(
      only({
        unionRaider: {
          union_raider_stat: [INC(4)],
          union_raider_preset_1: null,
          union_raider_preset_2: null,
          union_raider_preset_3: null,
          union_raider_preset_4: null,
          union_raider_preset_5: null,
        },
      }),
    ).toBe(4)
  })

  it('프리셋이 되살아나면 그중 최댓값을 쓴다', () => {
    expect(
      only({
        unionRaider: {
          union_raider_stat: [INC(4)],
          union_raider_preset_1: { union_raider_stat: [INC(9)] },
          union_raider_preset_2: { union_raider_stat: [INC(2)] },
        },
      }),
    ).toBe(9)
  })

  it('점령(스테이트) 효과 프리셋도 훑는다', () => {
    expect(
      only({
        unionRaider: {
          union_raider_stat: [INC(4)],
          union_state_stat: [],
          union_state_stat_preset: [{ union_state_stat: [INC(3)] }, { union_state_stat: [] }],
        },
      }),
    ).toBe(7)
  })

  it('아티팩트는 effect 만 센다 — crystal 을 더하면 이중 계산이다', () => {
    expect(
      only({
        unionArtifact: {
          union_artifact_effect: [{ name: INC(12) }],
          union_artifact_crystal: [
            { crystal_option_name_1: '메소 획득량 증가' },
            { crystal_option_name_3: '메소 획득량 증가' },
          ],
        },
      }),
    ).toBe(12)
  })
})

describe('실데이터 회귀 — 2026-08-28 실측 캐릭터(렌)', () => {
  it('장비 100 + 어빌 20 + 유니온 4 + 심볼 13 + 아티팩트 12 = 149', () => {
    const equipMeso = [
      item(['아이템 드롭률 +20%', POT(20), 'DEX +9%']), // 얼굴장식
      item([POT(20), POT(20), '올스탯 +6%']), // 반지1
      item(['아이템 드롭률 +20%', POT(20), '최대 MP +9%']), // 반지2
      item(['아이템 드롭률 +20%', POT(20), 'DEX +9%']), // 반지4
    ]
    expect(
      maxMesoRateOf({
        itemEquipment: { item_equipment: equipMeso, item_equipment_preset_1: equipMeso },
        ability: {
          ability_info: [{ ability_value: INC(20) }],
          ability_preset_1: { ability_info: [{ ability_value: INC(14) }] },
          ability_preset_3: { ability_info: [{ ability_value: INC(20) }] },
        },
        symbol: { symbol: [{ symbol_meso_rate: '0%' }, { symbol_meso_rate: '13%' }] },
        unionRaider: { union_raider_stat: ['STR 100 증가', INC(4)], union_raider_preset_1: null },
        unionArtifact: { union_artifact_effect: [{ name: '올스탯 150 증가' }, { name: INC(12) }] },
        skill: EMPTY_SKILL,
        jobClass: '패스파인더',
      }),
    ).toBe(149)
  })
})

describe('빈 응답', () => {
  it('아무것도 없으면 0 이다 — 던지지 않는다', () => {
    expect(only({})).toBe(0)
  })
})

/** 실응답을 그대로 옮긴 설명문 — `\r\n` 까지 같다(사용자 제공 2026-09-01). */
const 챌린저스설명 =
  '[마스터 레벨 : 1]\r\n챌린저스 월드에서 사파이어, 다이아몬드, 마스터, 챌린저, 슈퍼챌린저 티어를 달성한 자에게 적용되는 특별한 능력이다.'

describe('챌린저스 — 이름과 설명문 둘로 가른다', () => {
  it('그 설명문을 든 챌린저스가 있으면 20% 다', () => {
    expect(
      challengersMesoOf({
        character_skill: [
          { skill_name: '무기 숙련', skill_description: '무기의 숙련도를 올린다.' },
          { skill_name: '챌린저스', skill_description: 챌린저스설명 },
        ],
      }),
    ).toBe(CHALLENGERS_MESO_PERCENT)
  })

  it('티어가 다른 챌린저스는 0 이다 — 그 다섯이 아니면 이 버프가 아니다', () => {
    expect(
      challengersMesoOf({
        character_skill: [
          {
            skill_name: '챌린저스',
            skill_description:
              '[마스터 레벨 : 1]\r\n챌린저스 월드에서 브론즈, 실버, 골드, 플래티넘 티어를 달성한 자에게 적용되는 특별한 능력이다.',
          },
        ],
      }),
    ).toBe(0)
  })

  it('이름이 같아도 설명문이 비면 0 이다 — 레벨과 effect 로는 못 가른다', () => {
    expect(challengersMesoOf({ character_skill: [{ skill_name: '챌린저스' }] })).toBe(0)
  })

  it('스킬이 없거나 응답이 비어도 던지지 않는다', () => {
    expect(challengersMesoOf({})).toBe(0)
    expect(challengersMesoOf({ character_skill: null })).toBe(0)
  })
})

describe('직업이 스스로 갖는 메획 — 섀도어의 「그리드」', () => {
  it('섀도어면 20% 다', () => {
    expect(jobMesoOf('섀도어')).toBe(20)
  })

  it('다른 직업은 0 이다', () => {
    expect(jobMesoOf('나이트로드')).toBe(0)
    expect(jobMesoOf('듀얼블레이더')).toBe(0)
  })

  it('직업을 모르면 0 이다 — 캐시가 아직 안 따뜻할 수 있다', () => {
    expect(jobMesoOf(null)).toBe(0)
    expect(jobMesoOf(undefined)).toBe(0)
    expect(jobMesoOf('')).toBe(0)
  })
})

describe('maxMesoRateOf — 챌린저스와 그리드도 합산 통에 든다', () => {
  it('챌린저스만 켜지면 20 이다', () => {
    expect(only({ skill: { character_skill: [{ skill_name: '챌린저스', skill_description: 챌린저스설명 }] } })).toBe(20)
  })

  it('섀도어면 그리드로 20 이다', () => {
    expect(only({ jobClass: '섀도어' })).toBe(20)
  })

  it('둘이 겹치면 더해진다 — 서로 다른 축이다', () => {
    expect(
      only({
        skill: { character_skill: [{ skill_name: '챌린저스', skill_description: 챌린저스설명 }] },
        jobClass: '섀도어',
      }),
    ).toBe(40)
  })

  it('장비 캡 밖이다 — 100 을 채운 장비 위에 그대로 얹힌다', () => {
    expect(
      only({
        itemEquipment: { item_equipment: [item([POT(100)])] },
        skill: { character_skill: [{ skill_name: '챌린저스', skill_description: 챌린저스설명 }] },
        jobClass: '섀도어',
      }),
    ).toBe(140)
  })
})
