/// <reference types="node" />
/**
 * 강화 합계 표(`enhancement_totals`)를 진짜 SQLite 로 태운다. 갈아 끼우기의 덮어 적기 · 지우기, 읽을 때 소속 기록에서 찾는 값과 옛
 * 원본을 옮기는 부팅 단계를 본다.
 *
 * 그 날을 통째로 다시 받아 갈아 끼우므로, 같은 줄이 둘로 늘거나 사라진 줄이 남으면 가계부의 강화 지출이 부푼다.
 */
import {
  __resetEnhancementTotalsMoveForTest,
  ensureEnhancementTotals,
} from '../../../features/enhancement-history/legacy-totals'
import type { EnhancementTotalDraft } from '../../../features/enhancement-history/spending'
import { findPreLeapWorldKey, loadEnhancementTotals, replaceEnhancementTotals } from '../../enhancement-totals'
import { recordCharacterAccounts } from '../../character-accounts'
import { saveDatedName } from '../../character-dated-names'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

jest.mock('../../api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../features/enhancement-history/event-world-names', () => ({ readEventWorldNames: jest.fn() }))
// 옮기기가 빠진 줄을 서버에 알린다. 테스트에서 운영 서버로 요청이 나가면 안 된다.
jest.mock('../../../features/enhancement-history/anomalies', () => ({
  ...jest.requireActual('../../../features/enhancement-history/anomalies'),
  reportEnhancementAnomalies: jest.fn(),
}))
jest.mock('../../enhancement-totals-moved', () => ({
  isEnhancementTotalsMoved: jest.fn(),
  markEnhancementTotalsMoved: jest.fn(),
}))
jest.mock('../../legacy-space', () => ({ reclaimLegacySpaceOnce: jest.fn() }))

const { getAuthConfig } = jest.requireMock('../../api-key') as Record<string, jest.Mock>
const { readEventWorldNames } = jest.requireMock('../../../features/enhancement-history/event-world-names') as Record<
  string,
  jest.Mock
>
const { reportEnhancementAnomalies } = jest.requireMock('../../../features/enhancement-history/anomalies') as Record<
  string,
  jest.Mock
>
const moved = jest.requireMock('../../enhancement-totals-moved') as Record<string, jest.Mock>
const { reclaimLegacySpaceOnce } = jest.requireMock('../../legacy-space') as Record<string, jest.Mock>

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  __resetEnhancementTotalsMoveForTest()
  getAuthConfig.mockResolvedValue({ login: null, mainKeyId: 'account-main', apiKeys: [{ type: 'key', id: 'account-main', label: '', value: 'k', loginId: null }] })
  readEventWorldNames.mockReturnValue(new Set(['머리맨들맨둘']))
  moved.isEnhancementTotalsMoved.mockResolvedValue(false)
  moved.markEnhancementTotalsMoved.mockReset().mockResolvedValue(undefined)
  reportEnhancementAnomalies.mockClear()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const NOW = new Date('2026-10-26T00:00:00.000Z')

const draft = (over: Partial<EnhancementTotalDraft> = {}): EnhancementTotalDraft => ({
  historyDate: '2026-10-20',
  ocid: 'ocid-낟낟',
  worldKey: 'elysium',
  enhancementCategory: 'cube_reset',
  itemName: '아케인셰이드 클로',
  attempts: 1,
  attemptCostMeso: 450_000,
  destroyDefenceCostMeso: 0,
  superiorCostMeso: 0,
  fromStar: null,
  toStar: null,
  eventWorld: false,
  ...over,
})

const EARRING = { itemName: '데아 시두스 이어링' }

/** 그 넥슨 계정의 목록에서 그 캐릭터를 두 날짜 사이에 본 소속 기록. */
async function sighting(ocid: string, name: string, account: { maple: string; nexon: string }, from: string, to: string): Promise<void> {
  for (const seenOn of [from, to]) {
    await recordCharacterAccounts(
      [{ accountId: account.maple, characters: [{ ocid, name, world: '', worldKey: 'elysium', jobClass: '', level: 1 }] }],
      seenOn,
      account.nexon,
    )
  }
}

const MAIN = { maple: 'maple-1', nexon: 'account-main' }

describe('갈아 끼우기', () => {
  it('같은 열쇠의 줄은 값을 고쳐 한 줄로 두고, 새 합계에 없는 줄은 지운다', async () => {
    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [draft(), draft(EARRING)], NOW)

    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [draft({ attempts: 3 })], NOW)

    expect(await loadEnhancementTotals('2026-10-20', '2026-10-20')).toEqual([
      expect.objectContaining({ itemName: '아케인셰이드 클로', attempts: 3 }),
    ])
  })

  // 표에 넥슨 계정 칸이 없다. 소속 기록은 목록에서 사라진 캐릭터와 리프 전 ocid 도 지우지 않고 둬서, 그 ocid 의 줄도 지운다.
  it('그 넥슨 계정으로 본 캐릭터의 그날 줄은 지금 목록에 없는 옛 ocid 의 줄이어도 갈아 끼운다', async () => {
    await sighting('ocid-옛', '낟낟', MAIN, '2026-09-01', '2026-09-10')
    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [draft({ ocid: 'ocid-옛' })], NOW)

    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [draft({ attempts: 3 })], NOW)

    expect((await loadEnhancementTotals('2026-10-20', '2026-10-20')).map((total) => [total.ocid, total.attempts])).toEqual([
      ['ocid-낟낟', 3],
    ])
  })

  // 한 종류를 다시 받았다고 같은 날 다른 종류 · 다른 계정의 합계가 지워지면 안 된다.
  it('비우면 그 계정 캐릭터 · 종류 · 날짜의 줄만 지운다', async () => {
    await sighting('ocid-낟낟', '낟낟', MAIN, '2026-10-01', '2026-10-31')
    await sighting('ocid-부캐', '부캐', { maple: 'maple-2', nexon: 'account-sub' }, '2026-10-01', '2026-10-31')
    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [draft()], NOW)
    await replaceEnhancementTotals('account-sub', 'cube', '2026-10-20', [draft({ ocid: 'ocid-부캐' })], NOW)
    await replaceEnhancementTotals('account-main', 'starforce', '2026-10-20', [draft({ enhancementCategory: 'starforce' })], NOW)

    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [], NOW)

    expect(
      (await loadEnhancementTotals('2026-10-20', '2026-10-20')).map((total) => [total.ocid, total.enhancementCategory]).sort(),
    ).toEqual([
      ['ocid-낟낟', 'starforce'],
      ['ocid-부캐', 'cube_reset'],
    ])
  })

  // 잠재능력 API 는 본 잠재와 에디셔널을 함께 준다. 다른 API 의 분류를 지우면 그 지출이 빠진다.
  it('받은 API 종류가 정하는 분류만 지운다. 잠재능력은 본 잠재와 에디셔널이다', async () => {
    await sighting('ocid-낟낟', '낟낟', MAIN, '2026-10-01', '2026-10-31')
    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [draft()], NOW)
    await replaceEnhancementTotals(
      'account-main',
      'potential',
      '2026-10-20',
      [draft({ enhancementCategory: 'potential' }), draft({ enhancementCategory: 'additional_potential' })],
      NOW,
    )

    await replaceEnhancementTotals('account-main', 'potential', '2026-10-20', [], NOW)

    expect((await loadEnhancementTotals('2026-10-20', '2026-10-20')).map((total) => total.enhancementCategory)).toEqual(['cube_reset'])
  })

  // 다시 매기기 요청이 성 없는 옛 줄을 이 길로 채운다. 고쳐 적기에서 칸이 빠지면 다시 받아도 성이 안 선다.
  it('갈아 끼울 때 성 칸과 슈페리얼 비용도 고쳐 적는다', async () => {
    const starforce = (fromStar: number | null, toStar: number | null, superiorCostMeso: number) =>
      draft({ enhancementCategory: 'starforce', fromStar, toStar, superiorCostMeso })
    await replaceEnhancementTotals('account-main', 'starforce', '2026-10-20', [starforce(null, null, 0)], NOW)

    await replaceEnhancementTotals('account-main', 'starforce', '2026-10-20', [starforce(17, 21, 55_382_200)], NOW)

    expect(await loadEnhancementTotals('2026-10-20', '2026-10-20')).toEqual([
      expect.objectContaining({ fromStar: 17, toStar: 21, superiorCostMeso: 55_382_200 }),
    ])
  })

  it('이벤트 월드 판정의 세 값을 그대로 되읽는다', async () => {
    await replaceEnhancementTotals(
      'account-main',
      'cube',
      '2026-10-20',
      [draft({ eventWorld: true }), draft({ ocid: 'ocid-둘째', eventWorld: false }), draft({ ocid: 'ocid-셋째', eventWorld: null })],
      NOW,
    )

    const totals = await loadEnhancementTotals('2026-10-20', '2026-10-20')
    expect(totals.map((total) => [total.ocid, total.eventWorld])).toEqual([
      ['ocid-낟낟', true],
      ['ocid-둘째', false],
      ['ocid-셋째', null],
    ])
  })
})

describe('읽기', () => {
  // 표는 월드를 줄 id 로, 장비를 이름으로 든다. 화면은 월드 key 로 가르고 장비 key 로 그림을 찾는다.
  it('월드를 key 로 되돌리고, 장비 key 는 이름으로 장비 표에서 찾는다', async () => {
    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [draft(), draft({ itemName: '타일런트 리카온 벨트', worldKey: null })], NOW)

    const totals = (await loadEnhancementTotals('2026-10-20', '2026-10-20')).sort((a, b) => a.itemName.localeCompare(b.itemName))
    expect(totals.map((total) => [total.itemName, total.itemKey, total.worldKey])).toEqual([
      ['아케인셰이드 클로', 'arcane_umbra_knuckle', 'elysium'],
      ['타일런트 리카온 벨트', null, null],
    ])
  })

  // 수집기는 앱이 그 캐릭터를 처음 보기 전의 날도 받는다. 날짜로만 찾으면 그런 줄의 스타포스가 MVP 할인을 잃는다.
  it('메이플 ID 와 대신 쓰는 이름은 그 날짜를 덮는 소속 기록에서, 없으면 가장 늦게 본 소속 기록에서 찾고, 그날 이름이 있으면 그 이름이다', async () => {
    await sighting('ocid-낟낟', '살름', { maple: 'maple-옛', nexon: 'account-main' }, '2026-09-01', '2026-09-30')
    await sighting('ocid-낟낟', '낟낟', MAIN, '2026-10-01', '2026-10-31')
    await saveDatedName('ocid-낟낟', '2026-09-15', { name: '그날이름', worldName: '엘리시움' }, NOW)
    for (const historyDate of ['2026-08-01', '2026-09-15', '2026-09-20', '2026-10-10']) {
      await replaceEnhancementTotals('account-main', 'cube', historyDate, [draft({ historyDate })], NOW)
    }
    await replaceEnhancementTotals('account-main', 'cube', '2026-10-11', [draft({ historyDate: '2026-10-11', ocid: 'ocid-모름' })], NOW)

    expect(
      (await loadEnhancementTotals('2026-08-01', '2026-10-31')).map((total) => [total.historyDate, total.ocid, total.accountId, total.characterName]),
    ).toEqual([
      ['2026-08-01', 'ocid-낟낟', 'maple-1', '낟낟'],
      ['2026-09-15', 'ocid-낟낟', 'maple-옛', '그날이름'],
      ['2026-09-20', 'ocid-낟낟', 'maple-옛', '살름'],
      ['2026-10-10', 'ocid-낟낟', 'maple-1', '낟낟'],
      ['2026-10-11', 'ocid-모름', null, null],
    ])
  })
})

/** 옛 기기에 남은 원본 표. 새 기기에는 없다. */
const LEGACY_HISTORY_TABLE = `CREATE TABLE IF NOT EXISTS enhancement_history (
  id TEXT NOT NULL PRIMARY KEY, kind TEXT NOT NULL, date_key TEXT NOT NULL, created_at TEXT NOT NULL, character_name TEXT NOT NULL,
  target_item TEXT NOT NULL, item_key TEXT, item_level INTEGER, payload TEXT NOT NULL, cost_meso INTEGER)`

function historyTableExists(): boolean {
  return real.inspect((db) => db.prepare(`SELECT 1 FROM sqlite_master WHERE name = 'enhancement_history'`).all().length > 0)
}

/** 옛 원본 표에 줄을 심는다. 큐브 한 줄은 200 레벨이라 감정비용이 500,000 이다. */
async function seedHistory(rows: { id: string; kind: string; date: string; name: string; level: number | null; payload?: object }[]) {
  const db = await getBossProfitDb()
  await db.execute(LEGACY_HISTORY_TABLE)
  for (const row of rows) {
    await db.run(
      `INSERT INTO enhancement_history (id, kind, date_key, created_at, character_name, target_item, item_key, item_level, payload)
       VALUES (?, ?, ?, ?, ?, '아케인셰이드 클로', 'arcane_umbra_knuckle', ?, ?)`,
      [row.id, row.kind, row.date, `${row.date}T10:00:00.000+09:00`, row.name, row.level, JSON.stringify(row.payload ?? {})],
    )
  }
}

// 리프 전 줄은 리프 뒤 ocid 에 붙지만 그 월드는 리프 전 월드다. 같은 기간의 스타포스 줄이 그 월드를 든다.
describe('리프 전 월드', () => {
  it('리프한 날 앞의 그 캐릭터 스타포스 줄 가운데 날짜가 가까운 줄의 월드다', async () => {
    const starforce = (historyDate: string, worldKey: string) => draft({ historyDate, enhancementCategory: 'starforce', worldKey })
    await replaceEnhancementTotals('account-main', 'starforce', '2026-08-01', [starforce('2026-08-01', 'challengers_2')], NOW)
    await replaceEnhancementTotals('account-main', 'starforce', '2026-09-20', [starforce('2026-09-20', 'elysium')], NOW)

    await expect(findPreLeapWorldKey('ocid-낟낟', '2026-09-11', '2026-08-05')).resolves.toBe('challengers_2')
    await expect(findPreLeapWorldKey('ocid-낟낟', '2026-07-01', '2026-06-05')).resolves.toBeNull()
  })
})

/** 앱이 그 이름으로 본 기간. 옮기는 단계는 넥슨을 부를 수 없어 이것으로만 줄을 캐릭터에 붙인다. */
async function seenAs(ocid: string, name: string, worldKey: string): Promise<void> {
  await recordCharacterAccounts(
    [{ accountId: 'maple-1', characters: [{ ocid, name, world: '', worldKey, jobClass: '', level: 1 }] }],
    '2026-09-01',
    'account-main',
  )
  await recordCharacterAccounts(
    [{ accountId: 'maple-1', characters: [{ ocid, name, world: '', worldKey, jobClass: '', level: 1 }] }],
    '2026-10-31',
    'account-main',
  )
}

// 새 DB 는 열 때 기기 변환을 마쳐, 옮긴 합계가 변환한 표의 모양으로 들어가는지 본다.
describe('옛 원본을 합계로 옮기기', () => {
  it('날짜 · 종류마다 앱이 본 캐릭터에 붙여 적고, 다 옮기면 표시를 남긴다', async () => {
    await seenAs('o-낟낟', '낟낟', 'elysium')
    await seenAs('o-머리', '머리맨들맨둘', 'special')
    await seedHistory([
      { id: 'a', kind: 'cube', date: '2026-10-01', name: '낟낟', level: 200 },
      { id: 'b', kind: 'cube', date: '2026-10-01', name: '낟낟', level: 200 },
      { id: 'c', kind: 'cube', date: '2026-10-02', name: '머리맨들맨둘', level: 200 },
      { id: 'd', kind: 'starforce', date: '2026-10-02', name: '낟낟', level: null, payload: { before_starforce_count: 0, upgrade_item: '' } },
    ])

    await ensureEnhancementTotals()

    const totals = await loadEnhancementTotals('2026-10-01', '2026-10-02')
    expect(totals.map((total) => [total.historyDate, total.ocid, total.enhancementCategory, total.attempts, total.eventWorld]))
      .toEqual([
        ['2026-10-01', 'o-낟낟', 'cube_reset', 2, false],
        ['2026-10-02', 'o-낟낟', 'starforce', 1, false],
        ['2026-10-02', 'o-머리', 'cube_reset', 1, true],
      ])
    expect(moved.markEnhancementTotalsMoved).toHaveBeenCalledTimes(1)
    expect(historyTableExists()).toBe(false)
  })

  // 원본은 옮기는 단계 말고는 읽는 곳이 없다. 옮긴 기기에 남기면 자리만 차지한다.
  it('이미 옮긴 기기는 원본 표를 지우고, 새 기기에는 원본 표가 처음부터 없다', async () => {
    await getBossProfitDb()
    expect(historyTableExists()).toBe(false)

    await seedHistory([{ id: 'a', kind: 'cube', date: '2026-10-01', name: '낟낟', level: 200 }])
    moved.isEnhancementTotalsMoved.mockResolvedValue(true)
    await ensureEnhancementTotals()

    expect(historyTableExists()).toBe(false)
  })

  // 넥슨에서 그날 이름을 찾게 한다. 버린 채 두면 그 날의 지출이 영영 빠진다.
  it('앱이 본 적 없는 이름의 줄은 적지 않고, 그 날을 다시 받을 날로 적는다', async () => {
    await seenAs('o-낟낟', '낟낟', 'elysium')
    await seedHistory([
      { id: 'a', kind: 'cube', date: '2026-10-01', name: '낟낟', level: 200 },
      { id: 'b', kind: 'cube', date: '2026-10-01', name: '지운캐릭', level: 200 },
    ])

    await ensureEnhancementTotals()

    expect((await loadEnhancementTotals('2026-10-01', '2026-10-01')).map((total) => total.ocid)).toEqual(['o-낟낟'])
    expect(real.inspect((db) => db.prepare('SELECT nexon_account_id, enhancement_type, history_date FROM enhancement_refetches').all())).toEqual([
      { nexon_account_id: 'account-main', enhancement_type: 'cube', history_date: '2026-10-01' },
    ])
  })

  // 옛 원본은 메인 계정의 자격으로 받은 것이다. 서버가 메인 계정의 줄에 적도록 메인 계정에서 받은 상황으로 알린다.
  it('옮기며 빠진 줄을 메인 계정에서 받은 상황으로 알린다', async () => {
    await seenAs('o-낟낟', '낟낟', 'elysium')
    await seedHistory([{ id: 'a', kind: 'cube', date: '2026-10-01', name: '낟낟', level: null }])

    await ensureEnhancementTotals()

    expect(reportEnhancementAnomalies).toHaveBeenCalledWith([
      expect.objectContaining({ nexonAccountId: 'account-main', historyDate: '2026-10-01', apiType: 'cube', reason: 'no_level' }),
    ])
  })

  // 강화 원본이 마지막으로 지워지는 옛 표다. 그 전에 VACUUM 하면 원본까지 다시 쓰고 한 번 더 돌려야 한다.
  it.each([
    ['옮긴 뒤', false],
    ['이미 옮긴 기기', true],
  ])('%s 원본 표를 지운 다음에 공간 회수를 부른다', async (_label, alreadyMoved) => {
    await seenAs('o-낟낟', '낟낟', 'elysium')
    await seedHistory([{ id: 'a', kind: 'cube', date: '2026-10-01', name: '낟낟', level: 200 }])
    moved.isEnhancementTotalsMoved.mockResolvedValue(alreadyMoved)
    const tableLeftAtReclaim: boolean[] = []
    reclaimLegacySpaceOnce.mockReset().mockImplementation(async () => {
      tableLeftAtReclaim.push(historyTableExists())
    })

    await ensureEnhancementTotals()

    expect(tableLeftAtReclaim).toEqual([false])
  })

  it('옮긴 표시가 있으면 다시 옮기지 않는다', async () => {
    moved.isEnhancementTotalsMoved.mockResolvedValue(true)
    await seedHistory([{ id: 'a', kind: 'cube', date: '2026-10-01', name: '낟낟', level: 200 }])

    await ensureEnhancementTotals()

    expect(await loadEnhancementTotals('2026-10-01', '2026-10-01')).toEqual([])
  })

  // 이름 목록 없이 옮기면 판정이 빈 줄이 남고, 옛 날짜는 다시 받지 않아 그 지출이 영영 안 보인다.
  it('계정이나 이벤트 월드 이름 목록이 없으면 옮기지 않고 다음 호출이 다시 본다', async () => {
    readEventWorldNames.mockReturnValue(null)
    await seenAs('o-낟낟', '낟낟', 'elysium')
    await seedHistory([{ id: 'a', kind: 'cube', date: '2026-10-01', name: '낟낟', level: 200 }])

    await ensureEnhancementTotals()
    expect(await loadEnhancementTotals('2026-10-01', '2026-10-01')).toEqual([])
    expect(moved.markEnhancementTotalsMoved).not.toHaveBeenCalled()

    readEventWorldNames.mockReturnValue(new Set())
    await ensureEnhancementTotals()
    expect(await loadEnhancementTotals('2026-10-01', '2026-10-01')).toHaveLength(1)
  })
})
