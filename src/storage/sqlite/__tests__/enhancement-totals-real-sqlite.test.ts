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
import { loadEnhancementTotals, replaceEnhancementTotals } from '../../enhancement-totals'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { NEW_UUID_SQL } from '../uuid'
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
  getAuthConfig.mockResolvedValue({ login: null, apiKeys: [{ type: 'key', id: 'account-main', label: '', value: 'k' }] })
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
  characterName: '낟낟',
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

  // 성 칸 전에 표를 만든 기기는 CREATE 문이 칸을 안 붙인다. 칸이 없으면 INSERT 가 실패해 그 날의 강화 지출이 통째로 안 적힌다.
  it('성 칸이 없던 옛 기기의 표에도 적힌다. 옛 줄의 두 칸은 NULL 이다', async () => {
    real.inspect((db) => {
      db.exec(`CREATE TABLE enhancement_totals (
        id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
        nexon_account_id TEXT NOT NULL, history_date TEXT NOT NULL, character_name TEXT NOT NULL,
        enhancement_type TEXT NOT NULL, enhancement_category TEXT NOT NULL, item_group TEXT NOT NULL,
        item_key TEXT, item_name TEXT NOT NULL, attempts INTEGER NOT NULL, attempt_cost_meso INTEGER NOT NULL,
        destroy_defence_cost_meso INTEGER NOT NULL, event_world INTEGER, updated_at TEXT NOT NULL,
        UNIQUE (nexon_account_id, history_date, character_name, enhancement_category, item_group))`)
      db.exec(
        `INSERT INTO enhancement_totals (nexon_account_id, history_date, character_name, enhancement_type, enhancement_category,
           item_group, item_name, attempts, attempt_cost_meso, destroy_defence_cost_meso, event_world, updated_at)
         VALUES ('account-main', '2026-10-19', '낟낟', 'starforce', 'starforce', 'key:arcane_umbra_knuckle',
           '아케인셰이드 클로', 1, 1000, 0, 0, '2026-10-19T00:00:00.000Z')`,
      )
    })

    const starforce = draft({ enhancementType: 'starforce', enhancementCategory: 'starforce', fromStar: 17, toStar: 21 })
    await replaceEnhancementTotals('account-main', 'starforce', '2026-10-20', [starforce], NOW)

    expect((await loadEnhancementTotals('2026-10-19', '2026-10-20')).map((total) => [total.fromStar, total.toStar])).toEqual([
      [null, null],
      [17, 21],
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

describe('옛 원본을 합계로 옮기기', () => {
  it('날짜 · 종류마다 묶어 메인 계정으로 적고, 다 옮기면 표시를 남긴다', async () => {
    await seedHistory([
      { id: 'a', kind: 'cube', date: '2026-10-01', name: '낟낟', level: 200 },
      { id: 'b', kind: 'cube', date: '2026-10-01', name: '낟낟', level: 200 },
      { id: 'c', kind: 'cube', date: '2026-10-02', name: '머리맨들맨둘', level: 200 },
      { id: 'd', kind: 'starforce', date: '2026-10-02', name: '낟낟', level: null, payload: { before_starforce_count: 0, upgrade_item: '' } },
    ])

    await ensureEnhancementTotals()

    const totals = await loadEnhancementTotals('2026-10-01', '2026-10-02')
    expect(totals.map((total) => [total.historyDate, total.characterName, total.enhancementType, total.attempts, total.eventWorld]))
      .toEqual([
        ['2026-10-01', '낟낟', 'cube', 2, false],
        ['2026-10-02', '낟낟', 'starforce', 1, false],
        ['2026-10-02', '머리맨들맨둘', 'cube', 1, true],
      ])
    expect(new Set(totals.map((total) => total.nexonAccountId))).toEqual(new Set(['account-main']))
    expect(moved.markEnhancementTotalsMoved).toHaveBeenCalledTimes(1)
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
    await seedHistory([{ id: 'a', kind: 'cube', date: '2026-10-01', name: '낟낟', level: 200 }])

    await ensureEnhancementTotals()
    expect(await loadEnhancementTotals('2026-10-01', '2026-10-01')).toEqual([])
    expect(moved.markEnhancementTotalsMoved).not.toHaveBeenCalled()

    readEventWorldNames.mockReturnValue(new Set())
    await ensureEnhancementTotals()
    expect(await loadEnhancementTotals('2026-10-01', '2026-10-01')).toHaveLength(1)
  })
})
