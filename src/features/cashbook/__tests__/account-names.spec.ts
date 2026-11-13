// 메이플 ID 의 이름과 시트의 메이플 ID 보기. 넥슨을 부르지 않고 기기에 있는 값으로만 만든다.
import type { CharacterAccountSighting } from '../../../lib/mvp/membership'
import type { MapleAccount } from '../../../types'
import { accountLabelsOf, sheetAccountsOf, type AccountNameSources } from '../account-names'

function character(ocid: string, name: string, level: number): MapleAccount['characters'][number] {
  return { ocid, name, world: '스카니아', worldKey: 'scania', jobClass: '히어로', level }
}

function seen(ocid: string, accountId: string): CharacterAccountSighting {
  return { ocid, name: ocid, accountId, firstSeenOn: '2026-08-01', lastSeenOn: '2026-11-01' }
}

const MAPLE_A = 'aaaa1111-ffff'
const MAPLE_B = 'bbbb2222-ffff'

/** 메이플 ID 둘. A 에는 추적하지 않는 본캐(290)가 있고, B 에는 추적 캐릭터 하나뿐이다. */
const sources: AccountNameSources = {
  lists: [
    { accountId: MAPLE_A, characters: [character('ocid-main', '본캐', 290), character('ocid-1', '낟낟', 280)] },
    { accountId: MAPLE_B, characters: [character('ocid-2', '쪼꼬', 285)] },
  ],
  sightings: [seen('ocid-main', MAPLE_A), seen('ocid-1', MAPLE_A), seen('ocid-2', MAPLE_B)],
  trackedOcids: ['ocid-1', 'ocid-2'],
  profileOf: (ocid) =>
    ({ 'ocid-1': { name: '낟낟', level: 280 }, 'ocid-2': { name: '쪼꼬', level: 285 } })[ocid] ?? null,
}

describe('accountLabelsOf: 메이플 ID 의 이름', () => {
  // 대표 캐릭터를 몰라도 ID 값에서 이름을 지으므로, 서로 다른 ID 가 같은 이름으로 서지 않는다.
  it('목록에 없는 ID 도 ID 앞 8자로 이름이 선다', () => {
    expect(accountLabelsOf([MAPLE_A, 'cccc3333-gone'])).toEqual(
      new Map([
        [MAPLE_A, '메이플ID-aaaa1111'],
        ['cccc3333-gone', '메이플ID-cccc3333'],
      ]),
    )
  })
})

describe('sheetAccountsOf: 시트의 메이플 ID 보기', () => {
  // 추적하지 않는 캐릭터여도 그 ID 의 최고 레벨이면 대표다. A 의 대표 본캐(290)가 B 의 쪼꼬(285)보다 높다.
  it('추적 캐릭터가 속한 ID 만, 저장된 목록의 대표 레벨이 높은 차례로 세운다', () => {
    expect(sheetAccountsOf(sources)).toEqual([
      { accountId: MAPLE_A, label: '메이플ID-aaaa1111' },
      { accountId: MAPLE_B, label: '메이플ID-bbbb2222' },
    ])
    expect(sheetAccountsOf({ ...sources, trackedOcids: ['ocid-2'] })).toEqual([
      { accountId: MAPLE_B, label: '메이플ID-bbbb2222' },
    ])
  })

  // 목록이 있으면 A(본캐 290)가 먼저지만, 목록이 없으면 A 의 추적 캐릭터 낟낟(280)이 B 의 쪼꼬(285)보다 낮다.
  it('목록이 없으면 추적 캐릭터의 최고 레벨로 차례를 정하고, 대표를 못 찾은 ID 는 맨 끝이다', () => {
    const withoutList = { ...sources, lists: undefined }
    expect(sheetAccountsOf(withoutList).map((one) => one.accountId)).toEqual([MAPLE_B, MAPLE_A])

    const onlyB = { ...withoutList, profileOf: (ocid: string) => (ocid === 'ocid-2' ? { name: '쪼꼬', level: 1 } : null) }
    expect(sheetAccountsOf(onlyB).map((one) => one.accountId)).toEqual([MAPLE_B, MAPLE_A])
  })

  it('소속을 모르는 추적 캐릭터의 ID 는 서지 않는다', () => {
    expect(sheetAccountsOf({ ...sources, sightings: [seen('ocid-2', MAPLE_B)] })).toEqual([
      { accountId: MAPLE_B, label: '메이플ID-bbbb2222' },
    ])
  })
})
