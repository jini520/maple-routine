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

/** 메이플 ID 둘. A 에는 추적하지 않는 본캐(290)가 있고, B 에는 추적 캐릭터 하나뿐이다. */
const sources: AccountNameSources = {
  lists: [
    { accountId: 'maple-a', characters: [character('ocid-main', '본캐', 290), character('ocid-1', '낟낟', 280)] },
    { accountId: 'maple-b', characters: [character('ocid-2', '쪼꼬', 285)] },
  ],
  sightings: [seen('ocid-main', 'maple-a'), seen('ocid-1', 'maple-a'), seen('ocid-2', 'maple-b')],
  trackedOcids: ['ocid-1', 'ocid-2'],
  profileOf: (ocid) =>
    ({ 'ocid-1': { name: '낟낟', level: 280 }, 'ocid-2': { name: '쪼꼬', level: 285 } })[ocid] ?? null,
}

describe('accountLabelsOf: 메이플 ID 의 이름', () => {
  // 캐릭터 관리 · MVP 등급 화면과 같은 대표다. 추적하지 않는 캐릭터여도 그 ID 의 최고 레벨이면 대표다.
  it('저장된 목록에서 그 ID 의 최고 레벨 캐릭터를 대표로 쓴다', () => {
    expect(accountLabelsOf(['maple-a'], sources)).toEqual(new Map([['maple-a', '메이플 ID · 본캐']]))
  })

  it('목록이 없거나 그 ID 가 목록에 없으면 그 ID 의 추적 캐릭터 가운데 최고 레벨을 쓰고, 그것도 없으면 `메이플 ID` 만 적는다', () => {
    const withoutList = { ...sources, lists: undefined }

    expect(accountLabelsOf(['maple-a', 'maple-b', 'maple-gone'], withoutList)).toEqual(
      new Map([
        ['maple-a', '메이플 ID · 낟낟'],
        ['maple-b', '메이플 ID · 쪼꼬'],
        ['maple-gone', '메이플 ID'],
      ]),
    )
  })
})

describe('sheetAccountsOf: 시트의 메이플 ID 보기', () => {
  // 캐릭터 관리의 메이플 ID 드롭다운과 같은 차례다.
  it('추적 캐릭터가 속한 ID 만, 대표 레벨이 높은 차례로 세운다', () => {
    expect(sheetAccountsOf(sources)).toEqual([
      { accountId: 'maple-a', label: '메이플 ID · 본캐' },
      { accountId: 'maple-b', label: '메이플 ID · 쪼꼬' },
    ])
    expect(sheetAccountsOf({ ...sources, trackedOcids: ['ocid-2'] })).toEqual([
      { accountId: 'maple-b', label: '메이플 ID · 쪼꼬' },
    ])
  })

  it('소속을 모르는 추적 캐릭터의 ID 는 서지 않는다', () => {
    expect(sheetAccountsOf({ ...sources, sightings: [seen('ocid-2', 'maple-b')] })).toEqual([
      { accountId: 'maple-b', label: '메이플 ID · 쪼꼬' },
    ])
  })
})
