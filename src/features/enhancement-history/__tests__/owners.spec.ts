// 강화 응답은 그때의 캐릭터 이름만 준다. 그 이름을 그날 그 이름이었던 캐릭터(ocid)에 붙인다. 지금 이름으로 맞추면 이름을 바꾸기
// 전 날짜의 줄이나, 다른 캐릭터가 쓰던 이름의 줄을 잘못 붙인다.
import { NexonNetworkError } from '../../../nexon/errors'
import type { MapleAccount, MapleCharacter } from '../../../types'
import type { NexonCredential } from '../../../types/auth'
import type { EnhancementOwnerSighting } from '../../../storage/character-accounts'

jest.mock('../../../nexon/character/client', () => ({ fetchCharacterBasicOn: jest.fn() }))
jest.mock('../../../storage/character-dated-names', () => {
  const stored = new Map<string, { name: string | null; worldName: string | null }>()
  return {
    __stored: stored,
    datedNameKey: (ocid: string, dateKey: string) => `${ocid}|${dateKey}`,
    getDatedNames: jest.fn(async (ocids: string[], dateKeys: string[]) => {
      const found = new Map()
      for (const ocid of ocids) for (const dateKey of dateKeys) {
        const value = stored.get(`${ocid}|${dateKey}`)
        if (value !== undefined) found.set(`${ocid}|${dateKey}`, value)
      }
      return found
    }),
    saveDatedName: jest.fn(async (ocid: string, dateKey: string, value: { name: string | null; worldName: string | null }) => {
      stored.set(`${ocid}|${dateKey}`, value)
    }),
  }
})
jest.mock('../../../storage/character-first-days', () => {
  const stored = new Map()
  return {
    __stored: stored,
    getCharacterFirstDays: jest.fn(async (ocids: string[]) => new Map(ocids.flatMap((ocid) => (stored.has(ocid) ? [[ocid, stored.get(ocid)]] : [])))),
    saveCharacterFirstDay: jest.fn(async (ocid: string, value: unknown) => {
      stored.set(ocid, value)
    }),
  }
})

const { fetchCharacterBasicOn } = jest.requireMock('../../../nexon/character/client') as Record<string, jest.Mock>
const datedStore = jest.requireMock('../../../storage/character-dated-names') as { __stored: Map<string, unknown> }
const firstStore = jest.requireMock('../../../storage/character-first-days') as { __stored: Map<string, unknown> }

import { createOwnerResolver } from '../owners'

const 자격: NexonCredential = { type: 'key', value: 'k', accountId: 'account-a' }
const TODAY = '2026-11-10'

function 캐릭터(ocid: string, name: string, world = '스카니아'): MapleCharacter {
  return { ocid, name, world, worldKey: world === '스카니아' ? 'scania' : 'special', jobClass: '비숍', level: 280 }
}

function 목록(...characters: MapleCharacter[]): MapleAccount[] {
  return [{ accountId: 'maple-1', characters }]
}

/** ocid · 날짜마다 그날의 응답. 없으면 그날 값이 없다. */
function 그날(table: Record<string, Record<string, string>>, created: Record<string, string> = {}): void {
  fetchCharacterBasicOn.mockImplementation(async (_credential: NexonCredential, ocid: string, dateKey: string) => {
    const name = table[ocid]?.[dateKey] ?? null
    return name === null
      ? { name: null, worldName: null, createdDate: null }
      : { name, worldName: '스카니아', createdDate: created[ocid] ?? '2025-01-01' }
  })
}

function resolver(options: { accounts?: MapleAccount[] | null; sightings?: EnhancementOwnerSighting[] } = {}) {
  return createOwnerResolver({
    credential: 자격,
    nexonAccountId: 'account-a',
    accounts: options.accounts === undefined ? 목록() : options.accounts,
    sightings: options.sightings ?? [],
    todayDateKey: TODAY,
    now: new Date('2026-11-10T03:00:00Z'),
  })
}

beforeEach(() => {
  fetchCharacterBasicOn.mockReset()
  datedStore.__stored.clear()
  firstStore.__stored.clear()
})

describe('차례 1: 앱이 직접 본 기간', () => {
  it('그 이름으로 본 기간 안의 날이면 넥슨을 부르지 않고 붙인다', async () => {
    const ownerOf = resolver({
      accounts: null,
      sightings: [
        { ocid: 'o-1', name: '살름', accountId: 'maple-1', nexonAccountId: 'account-a', firstSeenOn: '2026-01-01', lastSeenOn: '2026-01-07', worldKey: 'scania' },
      ],
    })

    await expect(ownerOf('살름', '2026-01-05')).resolves.toEqual({
      ocid: 'o-1',
      accountId: 'maple-1',
      worldName: null,
      worldKey: 'scania',
      preLeap: false,
      leapDate: null,
    })
    expect(fetchCharacterBasicOn).not.toHaveBeenCalled()
  })
})

describe('차례 2: 그날 이름', () => {
  it('지금 이름이 같은 캐릭터부터 그날 이름을 묻고, 같으면 붙인다', async () => {
    그날({ 'o-1': { '2026-10-01': '루디' }, 'o-2': { '2026-10-01': '부캐' } })
    const ownerOf = resolver({ accounts: 목록(캐릭터('o-2', '부캐'), 캐릭터('o-1', '루디')) })

    await expect(ownerOf('루디', '2026-10-01')).resolves.toMatchObject({ ocid: 'o-1', accountId: 'maple-1', preLeap: false })
    expect(fetchCharacterBasicOn).toHaveBeenCalledTimes(1)
  })

  // 지금 이름으로 맞추면 이 줄을 붙일 곳이 없다.
  it('이름을 바꾸기 전 날짜의 줄은 그날 그 이름이었던 캐릭터에 붙인다', async () => {
    그날({ 'o-1': { '2026-01-05': '살름' }, 'o-2': { '2026-01-05': '부캐' } })
    const ownerOf = resolver({ accounts: 목록(캐릭터('o-2', '부캐'), 캐릭터('o-1', '낟낟')) })

    await expect(ownerOf('살름', '2026-01-05')).resolves.toMatchObject({ ocid: 'o-1' })
  })

  it('받은 그날 이름은 적어 두고, 같은 ocid · 날짜는 다시 부르지 않는다', async () => {
    그날({ 'o-1': { '2026-10-01': '루디' } })

    await resolver({ accounts: 목록(캐릭터('o-1', '루디')) })('루디', '2026-10-01')
    await resolver({ accounts: 목록(캐릭터('o-1', '루디')) })('루디', '2026-10-01')

    expect(fetchCharacterBasicOn).toHaveBeenCalledTimes(1)
  })

  it('오늘의 줄은 넥슨을 부르지 않고 목록의 지금 이름으로 붙인다', async () => {
    const ownerOf = resolver({ accounts: 목록(캐릭터('o-1', '루디')) })

    await expect(ownerOf('루디', TODAY)).resolves.toMatchObject({ ocid: 'o-1', worldName: '스카니아' })
    expect(fetchCharacterBasicOn).not.toHaveBeenCalled()
  })
})

describe('차례 3: 이름을 바꾼 날', () => {
  // `date` 의 값이 그날 어느 시각 기준인지 몰라, 바꾼 날 강화한 줄은 옛 이름으로도 새 이름으로도 올 수 있다.
  it('그날 이름과 다르면 같은 ocid 의 전날 · 다음 날 이름과도 견준다', async () => {
    그날({ 'o-1': { '2026-01-07': '살름', '2026-01-08': '낟낟', '2026-01-09': '낟낟' } })
    const ownerOf = resolver({ accounts: 목록(캐릭터('o-1', '낟낟')) })

    await expect(ownerOf('살름', '2026-01-08')).resolves.toMatchObject({ ocid: 'o-1', preLeap: false })
  })
})

describe('차례 4: 리프 전 기간', () => {
  // 리프하면 새 ocid 는 리프 다음 날부터 값이 오고, 만든 날은 처음 만든 날 그대로다(실측 2026-11-09, `지내우시`).
  it('그날 값이 없고 만든 날이 그날보다 앞이면, 처음 값이 온 날의 이름이 같을 때 붙인다. 이 줄은 리프 전 줄이다', async () => {
    const days: Record<string, string> = {}
    for (let day = 11; day <= 30; day += 1) days[`2026-09-${String(day).padStart(2, '0')}`] = '지내우시'
    for (let day = 1; day <= 31; day += 1) days[`2026-10-${String(day).padStart(2, '0')}`] = '지내우시'
    for (let day = 1; day <= 9; day += 1) days[`2026-11-${String(day).padStart(2, '0')}`] = '지내우시'
    그날({ 'o-새': days }, { 'o-새': '2026-06-18' })
    const ownerOf = resolver({ accounts: 목록(캐릭터('o-새', '지내우시')) })

    await expect(ownerOf('지내우시', '2026-08-01')).resolves.toEqual({
      ocid: 'o-새',
      accountId: 'maple-1',
      worldName: null,
      worldKey: null,
      preLeap: true,
      leapDate: '2026-09-11',
    })
    expect(firstStore.__stored.get('o-새')).toEqual({ createdDate: '2026-06-18', firstDate: '2026-09-11', firstName: '지내우시' })
  })

  // 적어 둔 그날 이름에는 만든 날이 없다. 그 값만 보면 리프 전 기간을 가르지 못한다.
  it('어제 이름을 적어 두었어도 만든 날을 받아 리프 전 기간을 가른다', async () => {
    그날({ 'o-새': { '2026-09-11': '지내우시', '2026-11-09': '지내우시' } }, { 'o-새': '2026-09-01' })
    datedStore.__stored.set('o-새|2026-11-09', { name: '지내우시', worldName: '스카니아' })
    const ownerOf = resolver({ accounts: 목록(캐릭터('o-새', '지내우시')) })

    await expect(ownerOf('지내우시', '2026-09-05')).resolves.toMatchObject({ ocid: 'o-새', preLeap: true })
  })

  it('리프 전 기간이라도 처음 값이 온 날의 이름과 다르면 붙이지 않는다', async () => {
    그날({ 'o-새': { '2026-09-11': '새이름', '2026-11-09': '새이름' } }, { 'o-새': '2026-06-18' })
    const ownerOf = resolver({ accounts: 목록(캐릭터('o-새', '새이름')) })

    await expect(ownerOf('옛이름', '2026-08-01')).resolves.toBe('none')
  })
})

describe('붙이지 못할 때', () => {
  it('응답 이름이 빈 글자면 넥슨을 부르지 않고 none 이다', async () => {
    await expect(resolver({ accounts: 목록(캐릭터('o-1', '루디')) })('', '2026-10-01')).resolves.toBe('none')
    expect(fetchCharacterBasicOn).not.toHaveBeenCalled()
  })

  it('넷 다 아니면 none 이다. 줄을 버린다', async () => {
    그날({ 'o-1': { '2026-10-01': '루디', '2026-09-30': '루디', '2026-10-02': '루디' } })

    await expect(resolver({ accounts: 목록(캐릭터('o-1', '루디')) })('지운캐릭', '2026-10-01')).resolves.toBe('none')
  })

  // 다시 받을 실패를 버린 줄로 보면 그 날이 굳어 다시 오지 않는다.
  it('넥슨을 부르다 실패했거나 목록을 못 받았으면 retry 다', async () => {
    fetchCharacterBasicOn.mockRejectedValue(new NexonNetworkError('끊김'))

    await expect(resolver({ accounts: 목록(캐릭터('o-1', '루디')) })('지운캐릭', '2026-10-01')).resolves.toBe('retry')
    await expect(resolver({ accounts: null })('지운캐릭', '2026-10-01')).resolves.toBe('retry')
  })
})
