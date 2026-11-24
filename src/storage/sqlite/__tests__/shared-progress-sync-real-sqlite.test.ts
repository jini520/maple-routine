/// <reference types="node" />
/**
 * 공유 진행 원장의 받기 → 회차의 저장 → 대기 표 → 올리기를 진짜 SQLite 로 본다.
 *
 * 회차는 컨텐츠마다 · 캐릭터마다 저장 함수를 함께 부른다(`schedule-sync.ts` 의 `Promise.all`). 원장 쓰기가 겹치면 앞 쓰기가 읽은
 * 원장으로 뒤 쓰기의 항목을 덮는다. 덮인 항목은 원장에 없어 다음 저장이 새 항목으로 대기 표에 넣고, 올리기는 원본이 없어 지우기를
 * 보낸다. 회차마다 같은 일이 되풀이되어 올리기와 받기가 끝없이 나간다(심사용 서버에서 2026-11-24 재현).
 */
import { contentIdOf } from '../../../lib/scheduler/contents'
import { findWorld } from '../../../lib/world/worlds'
import type { SharedProgressEntry } from '../../../types'
import { installFakePreferences, type FakePreferences } from '../../__tests__/fake-preferences'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { applyPulledPreferenceRecords } from '../../server-sync-pull-preferences'
import { preferenceRecordIdOf, removeServerSync, type ServerSyncTable } from '../../server-sync-queue'
import { readServerSyncSource } from '../../server-sync-records'
import { setAccountSharedProgressEntry, setWorldSharedProgressEntry } from '../../shared-progress-cache'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite
let prefs: FakePreferences

beforeEach(async () => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  prefs = installFakePreferences()
  await getBossProfitDb()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const MAPLE_ID = 'maple-1'
const WORLD_ID = findWorld('elysium')!.id
const TABLE: ServerSyncTable = 'sharedContentProgress'

/** 이번 주(W202647)의 진행. 회차가 넥슨에서 받은 값이다. */
function progress(over: Partial<SharedProgressEntry>): SharedProgressEntry {
  return { active: false, kind: 'contents', nowCount: 0, maxCount: 0, questState: null, lastUpdatedBucket: '2026-11-19', ...over }
}

/** 심사용 서버의 시뮬레이터에서 한 캐릭터의 회차가 적은 공유 진행이다. 월드 둘, 계정 다섯이다. */
const WORLD_UPDATES: Record<string, SharedProgressEntry> = {
  maple_union_weekly_dragon: progress({ kind: 'quest', questState: 0 }),
  monster_park_extreme: progress({ questState: 2 }),
}
const ACCOUNT_UPDATES: Record<string, SharedProgressEntry> = {
  epic_dungeon_high_mountain: progress({ maxCount: 5 }),
  epic_dungeon_angler_company: progress({ maxCount: 5 }),
  epic_dungeon_nightmare_paradise: progress({ maxCount: 5 }),
  epic_dungeon_aurum_regis: progress({ maxCount: 5 }),
  maple_union_pc_cafe_weekly_dragon: progress({ kind: 'quest', questState: 0 }),
}

/** 캐릭터 하나의 회차가 원장에 적는 것. 회차와 같이 모든 항목을 함께 적는다. */
async function writeRound(): Promise<void> {
  await Promise.all([
    ...Object.entries(WORLD_UPDATES).map(([contentKey, entry]) => setWorldSharedProgressEntry(MAPLE_ID, 'elysium', contentKey, entry)),
    ...Object.entries(ACCOUNT_UPDATES).map(([contentKey, entry]) => setAccountSharedProgressEntry(MAPLE_ID, contentKey, entry)),
  ])
}

function recordIdOf(worldId: string | null, contentKey: string): string {
  return preferenceRecordIdOf(TABLE, [MAPLE_ID, worldId ?? '', contentIdOf(contentKey)!])
}

function queuedIds(): string[] {
  return real.inspect((file) =>
    (file.prepare('SELECT record_id FROM server_sync_queue ORDER BY rowid').all() as { record_id: string }[]).map((row) => row.record_id),
  )
}

async function ledger(key: string): Promise<Record<string, unknown>> {
  const raw = await prefs.get(key)
  return raw === null ? {} : (JSON.parse(raw) as Record<string, unknown>)
}

describe('공유 진행의 받기와 회차', () => {
  it('받은 항목과 같은 값을 다시 적으면 대기 표에 넣지 않고, 함께 적은 항목은 모두 원장에 남아 올리기가 지우기를 보내지 않는다', async () => {
    // 다른 기기가 먼저 올린 두 항목을 받았다.
    await applyPulledPreferenceRecords([
      {
        table: TABLE,
        deleted: false,
        mapleId: MAPLE_ID,
        worldId: WORLD_ID,
        contentId: contentIdOf('monster_park_extreme')!,
        entry: { isRegistered: false, nowCount: 0, maxCount: 0, questState: 2, periodCode: 'W202647' },
      },
      {
        table: TABLE,
        deleted: false,
        mapleId: MAPLE_ID,
        worldId: null,
        contentId: contentIdOf('maple_union_pc_cafe_weekly_dragon')!,
        entry: { isRegistered: false, nowCount: 0, maxCount: 0, questState: 0, periodCode: 'W202647' },
      },
    ])

    await writeRound()

    const added = [
      recordIdOf(WORLD_ID, 'maple_union_weekly_dragon'),
      ...['epic_dungeon_high_mountain', 'epic_dungeon_angler_company', 'epic_dungeon_nightmare_paradise', 'epic_dungeon_aurum_regis'].map(
        (contentKey) => recordIdOf(null, contentKey),
      ),
    ]
    expect(queuedIds().sort()).toEqual([...added].sort())
    expect(Object.keys(await ledger(`worldSharedProgress:${MAPLE_ID}:${WORLD_ID}`)).sort()).toEqual(
      Object.keys(WORLD_UPDATES).map((contentKey) => contentIdOf(contentKey)).sort(),
    )
    expect(Object.keys(await ledger(`accountSharedProgress:${MAPLE_ID}`)).sort()).toEqual(
      Object.keys(ACCOUNT_UPDATES).map((contentKey) => contentIdOf(contentKey)).sort(),
    )
    // 원본이 없는 대기 줄은 지우기로 올라간다. 회차가 방금 적은 항목이 지우기로 가면 서버에 닿지 않는다.
    for (const recordId of queuedIds()) expect(await readServerSyncSource(TABLE, recordId)).not.toBeNull()
  })

  // 첫 캐릭터의 저장이 동기화를 깨워, 받기는 다른 캐릭터의 회차가 적는 동안 같은 원장에 적는다.
  it('회차가 적는 동안 받은 항목도 원장에 남는다', async () => {
    const pulled = { isRegistered: true, nowCount: 3, maxCount: 7, questState: null, periodCode: 'D20261124' }
    // 받기가 원장을 읽은 뒤 적기 전에 회차가 끼어들게 받기의 첫 쓰기를 늦춘다.
    const set = prefs.set.getMockImplementation()!
    let delayed = false
    prefs.set.mockImplementation(async (key, value) => {
      if (!delayed && value.includes(contentIdOf('monster_park')!)) {
        delayed = true
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      return set(key, value)
    })

    const pulling = applyPulledPreferenceRecords([
      { table: TABLE, deleted: false, mapleId: MAPLE_ID, worldId: WORLD_ID, contentId: contentIdOf('monster_park')!, entry: pulled },
    ])
    await writeRound()
    await pulling

    const world = await ledger(`worldSharedProgress:${MAPLE_ID}:${WORLD_ID}`)
    expect(world[contentIdOf('monster_park')!]).toEqual(pulled)
    expect(Object.keys(world)).toHaveLength(Object.keys(WORLD_UPDATES).length + 1)
  })

  it('올린 뒤 다른 캐릭터의 회차가 같은 값을 적으면 대기 표가 비어 있다', async () => {
    await writeRound()
    for (const recordId of queuedIds()) await removeServerSync(recordId)

    await writeRound()

    expect(queuedIds()).toEqual([])
  })
})
