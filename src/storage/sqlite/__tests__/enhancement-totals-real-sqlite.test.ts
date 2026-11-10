/// <reference types="node" />
/**
 * 강화 합계 표(`enhancement_totals`)를 진짜 SQLite 로 태운다. 갈아 끼우기의 덮어 적기 · 지우기와 옛 원본을 옮기는 부팅 단계를 본다.
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

const { getAuthConfig } = jest.requireMock('../../api-key') as Record<string, jest.Mock>
const { readEventWorldNames } = jest.requireMock('../../../features/enhancement-history/event-world-names') as Record<
  string,
  jest.Mock
>
const moved = jest.requireMock('../../enhancement-totals-moved') as Record<string, jest.Mock>

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  __resetEnhancementTotalsMoveForTest()
  getAuthConfig.mockResolvedValue({ login: null, mainKeyId: 'account-main', apiKeys: [{ type: 'key', id: 'account-main', label: '', value: 'k', loginId: null }] })
  readEventWorldNames.mockReturnValue(new Set(['머리맨들맨둘']))
  moved.isEnhancementTotalsMoved.mockResolvedValue(false)
  moved.markEnhancementTotalsMoved.mockReset().mockResolvedValue(undefined)
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const NOW = new Date('2026-10-26T00:00:00.000Z')

const draft = (over: Partial<EnhancementTotalDraft> = {}): EnhancementTotalDraft => ({
  historyDate: '2026-10-20',
  characterName: over.characterName ?? '낟낟',
  ocid: `ocid-${over.characterName ?? '낟낟'}`,
  accountId: 'maple-1',
  worldKey: 'elysium',
  enhancementType: 'cube',
  enhancementCategory: 'cube_reset',
  itemGroup: 'key:arcane_umbra_knuckle',
  itemKey: 'arcane_umbra_knuckle',
  itemName: '아케인셰이드 클로',
  attempts: 1,
  attemptCostMeso: 450_000,
  destroyDefenceCostMeso: 0,
  fromStar: null,
  toStar: null,
  eventWorld: false,
  ...over,
})

const EARRING = { itemGroup: 'key:dea_sidus_earring', itemKey: 'dea_sidus_earring', itemName: '데아 시두스 이어링' }

describe('갈아 끼우기', () => {
  it('같은 열쇠의 줄은 값을 고쳐 한 줄로 두고, 새 합계에 없는 줄은 지운다', async () => {
    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [draft(), draft(EARRING)], NOW)

    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [draft({ attempts: 3 })], NOW)

    expect(await loadEnhancementTotals('2026-10-20', '2026-10-20')).toEqual([
      expect.objectContaining({ itemGroup: 'key:arcane_umbra_knuckle', attempts: 3 }),
    ])
  })

  // 계정 id 만 보면 옛 번호로 적힌 같은 캐릭터의 줄이 남아 같은 강화가 두 번 세어진다.
  it('그 넥슨 계정 캐릭터의 그날 줄은 다른 계정 id 로 적혔어도 갈아 끼운다', async () => {
    await replaceEnhancementTotals('account-old', 'cube', '2026-10-20', [draft(), draft(EARRING)], NOW)

    await replaceEnhancementTotals('account-new', 'cube', '2026-10-20', [draft({ attempts: 3 })], NOW, ['ocid-낟낟'])

    expect((await loadEnhancementTotals('2026-10-20', '2026-10-20')).map((total) => [total.nexonAccountId, total.itemGroup, total.attempts]))
      .toEqual([['account-new', 'key:arcane_umbra_knuckle', 3]])
  })

  // 한 종류를 다시 받았다고 같은 날 다른 종류 · 다른 계정의 합계가 지워지면 안 된다.
  it('비우면 그 계정 · 종류 · 날짜의 줄만 지운다', async () => {
    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [draft()], NOW)
    await replaceEnhancementTotals('account-sub', 'cube', '2026-10-20', [draft({ characterName: '부캐' })], NOW)
    const starforce = draft({ enhancementType: 'starforce', enhancementCategory: 'starforce' })
    await replaceEnhancementTotals('account-main', 'starforce', '2026-10-20', [starforce], NOW)

    await replaceEnhancementTotals('account-main', 'cube', '2026-10-20', [], NOW)

    expect((await loadEnhancementTotals('2026-10-20', '2026-10-20')).map((total) => total.characterName).sort())
      .toEqual(['낟낟', '부캐'])
  })

  // 다시 매기기 요청이 성 없는 옛 줄을 이 길로 채운다. 고쳐 적기에서 칸이 빠지면 다시 받아도 성이 안 선다.
  it('갈아 끼울 때 성 칸도 고쳐 적는다', async () => {
    const starforce = (fromStar: number | null, toStar: number | null) =>
      draft({ enhancementType: 'starforce', enhancementCategory: 'starforce', fromStar, toStar })
    await replaceEnhancementTotals('account-main', 'starforce', '2026-10-20', [starforce(null, null)], NOW)

    await replaceEnhancementTotals('account-main', 'starforce', '2026-10-20', [starforce(17, 21)], NOW)

    expect(await loadEnhancementTotals('2026-10-20', '2026-10-20')).toEqual([
      expect.objectContaining({ fromStar: 17, toStar: 21 }),
    ])
  })

  it('이벤트 월드 판정의 세 값을 그대로 되읽는다', async () => {
    await replaceEnhancementTotals(
      'account-main',
      'cube',
      '2026-10-20',
      [draft({ eventWorld: true }), draft({ characterName: '둘째', eventWorld: false }), draft({ characterName: '셋째', eventWorld: null })],
      NOW,
    )

    const totals = await loadEnhancementTotals('2026-10-20', '2026-10-20')
    expect(totals.map((total) => [total.characterName, total.eventWorld])).toEqual([
      ['낟낟', true],
      ['둘째', false],
      ['셋째', null],
    ])
  })
})

/** 옛 원본 표에 줄을 심는다. 큐브 한 줄은 200 레벨이라 감정비용이 500,000 이다. */
async function seedHistory(rows: { id: string; kind: string; date: string; name: string; level: number | null; payload?: object }[]) {
  const db = await getBossProfitDb()
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
    const starforce = (historyDate: string, worldKey: string) =>
      draft({ historyDate, enhancementType: 'starforce', enhancementCategory: 'starforce', worldKey })
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

describe('옛 원본을 합계로 옮기기', () => {
  it('날짜 · 종류마다 앱이 본 캐릭터에 붙여 메인 계정으로 적고, 다 옮기면 표시를 남긴다', async () => {
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
    expect(totals.map((total) => [total.historyDate, total.ocid, total.enhancementType, total.attempts, total.eventWorld]))
      .toEqual([
        ['2026-10-01', 'o-낟낟', 'cube', 2, false],
        ['2026-10-02', 'o-낟낟', 'starforce', 1, false],
        ['2026-10-02', 'o-머리', 'cube', 1, true],
      ])
    expect(new Set(totals.map((total) => total.nexonAccountId))).toEqual(new Set(['account-main']))
    expect(moved.markEnhancementTotalsMoved).toHaveBeenCalledTimes(1)
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
