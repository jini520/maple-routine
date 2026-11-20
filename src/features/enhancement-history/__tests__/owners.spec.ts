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
    getOcidsNamed: jest.fn(async (name: string) => [
      ...new Set([...stored].filter(([, value]) => value.name === name).map(([key]) => key.split('|')[0]!)),
    ]),
    getNoValueThroughDates: jest.fn(async (ocids: string[]) => {
      const through = new Map<string, string>()
      for (const [key, value] of stored) {
        const [ocid, dateKey] = key.split('|') as [string, string]
        if (value.name !== null || !ocids.includes(ocid)) continue
        if ((through.get(ocid) ?? '') < dateKey) through.set(ocid, dateKey)
      }
      return through
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

// 넥슨 로그인 사용자의 그날 이름 호출은 모두가 함께 쓰는 번들 개발자 키로 간다. 사용자 기기에서 60일에 약 2,460번 불러
// 가계부가 8분 넘게 불러오는 중으로 남았다(2026-11-10). 이름은 한때 한 캐릭터만 쓰므로 묻는 차례만 바꿔 부르는 수를 줄인다.
describe('묻는 차례', () => {
  const 스무명 = () => 목록(...Array.from({ length: 20 }, (_, at) => 캐릭터(`o-${at + 1}`, `캐릭${at + 1}`)))
  const 날짜들 = ['2025-12-01', '2025-12-02', '2025-12-03', '2025-12-04', '2025-12-05']
  /** 모든 캐릭터는 그 날들에 지금 이름이고, o-15 만 그때 `살름` 이었다. */
  const 살름표 = () => {
    const table: Record<string, Record<string, string>> = {}
    for (let at = 1; at <= 20; at += 1) {
      table[`o-${at}`] = Object.fromEntries(날짜들.map((day) => [day, at === 15 ? '살름' : `캐릭${at}`]))
    }
    return table
  }
  const callsOn = (dateKey: string) => fetchCharacterBasicOn.mock.calls.filter((call) => call[2] === dateKey).length

  it('한 번 붙인 이름은 다른 날짜에서 그 캐릭터부터 묻는다', async () => {
    그날(살름표())
    const ownerOf = resolver({ accounts: 스무명() })

    await expect(ownerOf('살름', '2025-12-01')).resolves.toMatchObject({ ocid: 'o-15' })
    await expect(ownerOf('살름', '2025-12-02')).resolves.toMatchObject({ ocid: 'o-15' })

    expect(callsOn('2025-12-02')).toBe(1)
  })

  // 회차가 바뀌어도 앞 회차에서 적어 둔 그날 이름으로 그 캐릭터를 안다.
  it('적어 둔 그날 이름에 그 이름이 있는 캐릭터부터 묻는다', async () => {
    그날(살름표())
    datedStore.__stored.set('o-15|2025-11-01', { name: '살름', worldName: '스카니아' })

    await expect(resolver({ accounts: 스무명() })('살름', '2025-12-02')).resolves.toMatchObject({ ocid: 'o-15' })

    expect(callsOn('2025-12-02')).toBe(1)
  })

  // 다시 받는 날들은 한꺼번에 돈다. 같은 이름을 나란히 찾으면 앞에서 찾은 캐릭터를 뒤가 모른다.
  it('같은 이름을 여러 날짜에서 한꺼번에 찾아도 앞에서 찾은 캐릭터부터 묻는다', async () => {
    그날(살름표())
    const ownerOf = resolver({ accounts: 스무명() })

    const owners = await Promise.all(날짜들.map((day) => ownerOf('살름', day)))

    expect(owners.map((owner) => (typeof owner === 'string' ? owner : owner.ocid))).toEqual(날짜들.map(() => 'o-15'))
    expect(날짜들.slice(1).map(callsOn)).toEqual([1, 1, 1, 1])
  })

  // 리프 전 줄마다 계정의 캐릭터를 다 묻고서야 차례 4 로 가면, 리프 전 기간 하루마다 캐릭터 수만큼 부른다.
  it('지금 이름이 같은 캐릭터는 리프 전 기간까지 먼저 보고, 나머지 캐릭터는 묻지 않는다', async () => {
    const days: Record<string, string> = { '2026-09-11': '지내우시', '2026-11-09': '지내우시' }
    그날({ ...Object.fromEntries(Array.from({ length: 10 }, (_, at) => [`o-${at + 1}`, { '2026-08-01': `캐릭${at + 1}` }])), 'o-새': days }, {
      'o-새': '2026-06-18',
    })
    const accounts = 목록(...Array.from({ length: 10 }, (_, at) => 캐릭터(`o-${at + 1}`, `캐릭${at + 1}`)), 캐릭터('o-새', '지내우시'))

    await expect(resolver({ accounts })('지내우시', '2026-08-01')).resolves.toMatchObject({ ocid: 'o-새', preLeap: true })

    expect(fetchCharacterBasicOn.mock.calls.filter((call) => call[1] !== 'o-새')).toHaveLength(0)
  })

  // 값은 처음 값이 온 날부터 이어진다. 그 앞 날짜는 물어도 값이 없다.
  it('그 날짜나 그 뒤에 값이 없던 캐릭터는 맨 뒤에 묻고, 다른 캐릭터에서 찾으면 묻지 않는다', async () => {
    그날({ 'o-1': {}, 'o-2': { '2025-12-05': '부캐' }, 'o-3': { '2025-12-05': '살름' } })
    datedStore.__stored.set('o-1|2025-12-10', { name: null, worldName: null })
    const ownerOf = resolver({ accounts: 목록(캐릭터('o-1', '새캐릭'), 캐릭터('o-2', '부캐'), 캐릭터('o-3', '낟낟')) })

    await expect(ownerOf('살름', '2025-12-05')).resolves.toMatchObject({ ocid: 'o-3' })

    expect(fetchCharacterBasicOn.mock.calls.filter((call) => call[1] === 'o-1')).toHaveLength(0)
  })

  // 넥슨 데이터가 중간에 하루 빈 날이 있으면, 건너뛴 캐릭터의 줄을 버리고 그 날을 굳혀 영영 잃는다.
  it('아무도 맞지 않으면 값이 없던 캐릭터까지 묻는다. 건너뛰지 않는다', async () => {
    그날({ 'o-1': { '2025-12-05': '살름' }, 'o-2': { '2025-12-05': '부캐' } })
    datedStore.__stored.set('o-1|2025-12-10', { name: null, worldName: null })
    const ownerOf = resolver({ accounts: 목록(캐릭터('o-1', '새캐릭'), 캐릭터('o-2', '부캐')) })

    await expect(ownerOf('살름', '2025-12-05')).resolves.toMatchObject({ ocid: 'o-1' })
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
