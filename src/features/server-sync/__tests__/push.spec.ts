/**
 * 대기 표를 묶어 올리고 결과마다 대기 줄과 기기 줄을 다루는 회차.
 *
 * 여기서 막는 사고는 셋이다. 오프라인이 시도 횟수를 태워 쌓인 기록을 버리는 것, 받았다는 결과에 대기 줄을 지워 그 사이의 수정을
 * 잃는 것, 서버가 합친 수익 건을 같은 요청의 드롭이 가리켜 사용자의 드롭이 지워지는 것이다.
 */
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import type { SyncPushOutcome, SyncPushRecord, SyncPushResult } from '../../../server/sync'
import type { SyncQueueEntry } from '../../../storage/server-sync-queue'
import { pushServerSync, type PushDeps } from '../push'

const HEADERS = { 'x-maple-id-hash': 'a'.repeat(64) }

let seq = 0
function entry(recordType: string, recordId: string, attempts = 0, createdAt = '2026-11-23T00:00:00.000Z'): SyncQueueEntry {
  seq += 1
  return { id: `q-${seq}`, recordType, recordId, attempts, lastError: null, createdAt }
}

/** 표마다 최소한의 원본. 주인이 필요한 표는 `ocid-1` 의 기록이다. */
function sourceOf(table: string, id: string): Record<string, unknown> {
  switch (table) {
    case 'characterWorldLeaps':
      return { id, previous_ocid: `old-${id}`, ocid: 'ocid-1' }
    case 'cashbookEntries':
      return {
        id,
        ocid: null,
        account_id: 'maple-1',
        world_id: null,
        category_id: 'category-1',
        date: '2026-11-20',
        memo: null,
        recorded_at: '2026-11-20T00:00:00.000Z',
        items: [{ item_name: '물건', amount_meso: 1 }],
        hunt_input: null,
        transfer_input: null,
        exchange_input: null,
        fragment_uses: [],
      }
    case 'inventoryItems':
      return { id, account_id: 'maple-1', world_id: 'w', item_id: 'i', cashbook_item_type_id: 't', added_quantity: 1 }
    case 'bossProfitEntries':
      return {
        id,
        ocid: 'ocid-1',
        boss_difficulty_id: 'd',
        period_code: 'W202647',
        world_id: null,
        crystal_price_meso: 1,
        crystal_received_meso: 1,
        split_type: 'even',
        party_size: 1,
        split_share_millipercent: null,
        split_fee_percent: 3,
        split_fee_follows_mvp_grade: 0,
        cleared_date: null,
        clear_recorded_by: 'manual',
      }
    case 'bossDrops':
      return {
        id,
        profit_entry_id: 'entry-1',
        item_id: 'i',
        category: 'fixed',
        price_status: 'pending',
        sale_fee_follows_mvp_grade: 1,
        split_fee_follows_mvp_grade: 1,
      }
    case 'mvpGradeHistory':
      return { id, account_id: 'maple-1', from_date: '2026-11-01', grade_id: 'g' }
    case 'mapleIdNames':
      return { mapleId: 'maple-1', name: '본캐' }
    default:
      throw new Error(`이 테스트에 없는 표: ${table}`)
  }
}

interface Harness {
  deps: PushDeps
  queue: SyncQueueEntry[]
  sent: SyncPushRecord[][]
  removed: string[]
  counted: { recordId: string; error: string }[]
  replaced: [string, string, string][]
  deleted: [string, string][]
  notices: string[]
  changedTables: string[][]
  /** 보내기와 기다리기의 차례 */
  events: string[]
  /** 원본을 갈아 끼운다. 보낸 뒤 바뀐 기록을 흉내 낸다 */
  sources: Map<string, Record<string, unknown> | null>
}

function harness(options: {
  entries: SyncQueueEntry[]
  identity?: Record<string, string> | null
  answer?: (records: SyncPushRecord[]) => SyncPushOutcome
  names?: Record<string, string | null | 'silent'>
}): Harness {
  const h: Harness = {
    queue: [...options.entries],
    sent: [],
    removed: [],
    counted: [],
    replaced: [],
    deleted: [],
    notices: [],
    changedTables: [],
    events: [],
    sources: new Map(),
    deps: undefined as unknown as PushDeps,
  }
  const ok = (records: SyncPushRecord[]): SyncPushOutcome => ({
    outcome: 'answered',
    results: records.map(() => ({ ok: true, id: null })),
  })
  h.deps = {
    identity: async () => (options.identity === undefined ? HEADERS : options.identity),
    list: async () => [...h.queue],
    read: async (table, recordId) => (h.sources.has(recordId) ? (h.sources.get(recordId) ?? null) : sourceOf(table, recordId)),
    owners: {
      mapleIdOfOcid: async (ocid) => (ocid === 'ocid-1' ? 'maple-1' : null),
      mapleIdOfNexonAccount: async () => null,
      mapleIdOfProfitEntry: async () => 'maple-1',
    },
    send: async (_headers, records) => {
      h.sent.push(records)
      h.events.push(`send ${records.length}`)
      return (options.answer ?? ok)(records)
    },
    remove: async (recordId) => {
      h.removed.push(recordId)
      h.queue = h.queue.filter((one) => one.recordId !== recordId)
    },
    countAttempt: async (recordId, error) => {
      h.counted.push({ recordId, error })
    },
    replaceId: async (table, from, to) => {
      h.replaced.push([table, from, to])
      h.queue = h.queue.map((one) => (one.recordId === from ? { ...one, recordId: to } : one))
    },
    deleteRecord: async (table, recordId) => {
      h.deleted.push([table, recordId])
      h.queue = h.queue.filter((one) => one.recordId !== recordId)
    },
    nameOf: async (_table, source) => {
      const id = (source as { id?: string } | null)?.id ?? ''
      return options.names?.[id] ?? null
    },
    notify: (message) => {
      h.notices.push(message)
    },
    afterRecordsChanged: (tables) => {
      h.changedTables.push([...tables])
    },
    wait: async (ms) => {
      h.events.push(`wait ${ms}`)
    },
  }
  return h
}

const ids = (records: SyncPushRecord[]): unknown[] => records.map((record) => record.row.id)

describe('묶기', () => {
  it('서버 표 차례로, 같은 표 안에서는 넣은 차례로 한 요청에 싣는다', async () => {
    const h = harness({
      entries: [
        entry('bossDrops', 'drop-1'),
        entry('characterWorldLeaps', 'leap-1'),
        entry('cashbookEntries', 'cash-1'),
        entry('characterWorldLeaps', 'leap-2'),
      ],
    })

    await pushServerSync({}, h.deps)

    expect(h.sent.map(ids)).toEqual([['leap-1', 'leap-2', 'cash-1', 'drop-1']])
  })

  it('한 요청은 100건을 넘지 않는다', async () => {
    const h = harness({ entries: Array.from({ length: 150 }, (_, i) => entry('mvpGradeHistory', `mvp-${i}`)) })

    await pushServerSync({}, h.deps)

    expect(h.sent.map((records) => records.length)).toEqual([100, 50])
    expect(h.removed).toHaveLength(150)
  })

  it('한 요청의 본문은 UTF-8 로 256KB 를 넘지 않는다', async () => {
    const h = harness({ entries: Array.from({ length: 6 }, (_, i) => entry('cashbookEntries', `cash-${i}`)) })
    for (let i = 0; i < 6; i++) h.sources.set(`cash-${i}`, { ...sourceOf('cashbookEntries', `cash-${i}`), memo: '가'.repeat(30_000) })

    await pushServerSync({}, h.deps)

    expect(h.sent.length).toBeGreaterThan(1)
    expect(h.sent.flat()).toHaveLength(6)
    for (const records of h.sent) expect(utf8ToBytes(JSON.stringify({ records })).length).toBeLessThanOrEqual(256 * 1024)
  })

  // 서버가 수익 건을 다른 줄로 합치면 받은 id 의 줄을 지운다. 같은 요청의 드롭이 그 id 를 가리키면 거절되고 기기가 드롭을 지운다.
  it('수익 건과 드롭, 인벤토리와 가계부 기록은 한 요청에 싣지 않고, 앞 요청의 결과로 바꾼 id 로 다음 요청을 읽는다', async () => {
    const h = harness({
      entries: [
        entry('inventoryItems', 'inv-1'),
        entry('cashbookEntries', 'cash-1'),
        entry('bossProfitEntries', 'entry-1'),
        entry('bossDrops', 'drop-1'),
      ],
      answer: (records) => ({
        outcome: 'answered',
        results: records.map((record) => ({ ok: true, id: record.row.id === 'entry-1' ? 'entry-server' : null })),
      }),
    })
    // 기기 줄을 서버 id 로 바꾸면 드롭이 가리키는 칸도 바뀐다(`replaceServerSyncRecordId`).
    const replaceId = h.deps.replaceId
    h.deps.replaceId = async (table, from, to) => {
      await replaceId(table, from, to)
      h.sources.set('drop-1', { ...sourceOf('bossDrops', 'drop-1'), profit_entry_id: to })
    }

    await pushServerSync({}, h.deps)

    expect(h.sent.map(ids)).toEqual([['inv-1'], ['cash-1', 'entry-1'], ['drop-1']])
    expect(h.sent[2]![0]!.row.profitEntryId).toBe('entry-server')
  })
})

describe('결과', () => {
  it('받았으면 대기 줄을 지우고, 서버가 다른 id 를 돌려주면 기기 줄을 그 id 로 바꾼다', async () => {
    const h = harness({
      entries: [entry('mvpGradeHistory', 'mvp-1'), entry('mvpGradeHistory', 'mvp-2')],
      answer: () => ({ outcome: 'answered', results: [{ ok: true, id: 'mvp-1' }, { ok: true, id: 'mvp-server' }] }),
    })

    const summary = await pushServerSync({}, h.deps)

    expect(h.removed).toEqual(['mvp-1', 'mvp-2'])
    expect(h.replaced).toEqual([['mvpGradeHistory', 'mvp-2', 'mvp-server']])
    expect(h.changedTables).toEqual([['mvpGradeHistory']])
    expect(summary).toMatchObject({ sent: 2, stopped: false })
  })

  // 기기에 id 가 없는 표는 서버가 id 를 만들어 돌려준다. 기기 줄에는 바꿀 id 가 없다.
  it('기기에 id 가 없는 표는 서버가 돌려준 id 로 바꾸지 않는다', async () => {
    const h = harness({
      entries: [entry('mapleIdNames', 'mapleIdNames:maple-1')],
      answer: () => ({ outcome: 'answered', results: [{ ok: true, id: 'server-row' }] }),
    })

    await pushServerSync({}, h.deps)

    expect(h.removed).toEqual(['mapleIdNames:maple-1'])
    expect(h.replaced).toEqual([])
  })

  // 트리거는 대기 줄이 있으면 넣지 않는다. 그대로 지우면 보낸 뒤의 수정이 올라가지 않는다.
  it('받았어도 보낸 뒤에 원본이 바뀌었으면 대기 줄을 남긴다', async () => {
    const h = harness({ entries: [entry('mvpGradeHistory', 'mvp-1')] })
    const send = h.deps.send
    h.deps.send = async (headers, records) => {
      h.sources.set('mvp-1', { ...sourceOf('mvpGradeHistory', 'mvp-1'), grade_id: 'changed' })
      return send(headers, records)
    }

    await pushServerSync({}, h.deps)

    expect(h.removed).toEqual([])
    expect(h.counted).toEqual([])
    expect(h.sent).toHaveLength(1)
  })

  it('두 거절은 대기 줄과 기기 줄을 지우고 끝날 때 거절마다 알린다', async () => {
    const h = harness({
      entries: [entry('bossProfitEntries', 'entry-1'), entry('bossProfitEntries', 'entry-2'), entry('bossProfitEntries', 'entry-3')],
      answer: () => ({
        outcome: 'answered',
        results: [
          { ok: false, code: 'duplicate_record', reason: 'r' },
          { ok: false, code: 'record_deleted', reason: 'r' },
          { ok: false, code: 'record_deleted', reason: 'r' },
        ],
      }),
      names: { 'entry-1': '루시드 하드 처치 기록', 'entry-2': '윌 하드 처치 기록', 'entry-3': null },
    })

    await pushServerSync({}, h.deps)

    expect(h.deleted).toEqual([
      ['bossProfitEntries', 'entry-1'],
      ['bossProfitEntries', 'entry-2'],
      ['bossProfitEntries', 'entry-3'],
    ])
    expect(h.removed).toEqual([])
    expect(h.notices).toEqual([
      '루시드 하드 처치 기록은 다른 기기에서 먼저 적어, 그 기록으로 바꿨습니다',
      '기록 2건은 다른 기기에서 지워, 고친 내용을 저장하지 못했습니다',
    ])
    expect(h.changedTables).toEqual([['bossProfitEntries']])
  })

  it('자동으로 적은 기록의 거절은 기기 줄만 지우고 알리지 않는다', async () => {
    const answer = (): SyncPushOutcome => ({
      outcome: 'answered',
      results: [{ ok: false, code: 'duplicate_record', reason: 'r' }],
    })
    const silent = harness({ entries: [entry('bossProfitEntries', 'entry-1')], answer, names: { 'entry-1': 'silent' } })
    await pushServerSync({}, silent.deps)

    expect(silent.deleted).toEqual([['bossProfitEntries', 'entry-1']])
    expect(silent.notices).toEqual([])
  })

  it('다른 거절은 횟수를 세고 다섯 번째에 대기 줄을 빼며, 그 회차에서 다시 보내지 않는다', async () => {
    const results: SyncPushResult[] = [
      { ok: false, code: 'maple_id_not_registered', reason: '이 신원의 메이플 ID 가 아니다' },
      { ok: false, code: null, reason: '수익 건이 아직 없다' },
    ]
    const h = harness({
      entries: [entry('mvpGradeHistory', 'mvp-1', 0), entry('mvpGradeHistory', 'mvp-2', 4)],
      answer: () => ({ outcome: 'answered', results }),
    })

    const summary = await pushServerSync({}, h.deps)

    expect(h.sent).toHaveLength(1)
    expect(h.counted).toEqual([{ recordId: 'mvp-1', error: 'maple_id_not_registered: 이 신원의 메이플 ID 가 아니다' }])
    expect(h.removed).toEqual(['mvp-2'])
    expect(h.deleted).toEqual([])
    expect(summary).toMatchObject({ rejected: 1, dropped: 1 })
  })

  it.each<[string, SyncPushOutcome]>([
    ['응답이 오지 않으면', { outcome: 'no-response' }],
    ['신원이 거절되면', { outcome: 'refused', status: 401 }],
    ['서버 오류면', { outcome: 'refused', status: 500 }],
  ])('%s 아무것도 세지 않고 그 회차를 멈춘다', async (_name, outcome) => {
    const h = harness({
      entries: Array.from({ length: 120 }, (_, i) => entry('mvpGradeHistory', `mvp-${i}`)),
      answer: () => outcome,
    })

    const summary = await pushServerSync({}, h.deps)

    expect(h.sent).toHaveLength(1)
    expect(h.removed).toEqual([])
    expect(h.counted).toEqual([])
    expect(summary.stopped).toBe(true)
  })

  it('메이플 ID 를 모르는 기록은 보내지 않고 세지 않으며, 지우기가 없는 표의 지운 원본은 대기 줄만 지운다', async () => {
    const h = harness({ entries: [entry('characterWorldLeaps', 'leap-1'), entry('enhancementSettledDays', 'check-1')] })
    h.sources.set('leap-1', { id: 'leap-1', previous_ocid: 'old', ocid: 'ocid-모름' })
    h.sources.set('check-1', null)

    const summary = await pushServerSync({}, h.deps)

    expect(h.sent).toEqual([])
    expect(h.removed).toEqual(['check-1'])
    expect(h.counted).toEqual([])
    expect(summary).toMatchObject({ held: 1 })
  })
})

// 처음 동기화가 넣은 줄은 사용자가 방금 친 값이 아니다. 메이플 ID 를 몰라 남은 줄은 늦게 올라가도 그렇다.
describe('처음 올리기', () => {
  const QUEUED_AT = '2026-11-24T00:00:00.000Z'
  const BEFORE = '2026-11-23T23:59:59.000Z'
  const AFTER = '2026-11-24T00:00:01.000Z'

  it('넣기를 마친 시각까지 들어간 줄의 거절은 알리지 않고, 그 뒤에 넣은 줄의 거절은 알린다', async () => {
    const h = harness({
      entries: [
        entry('bossProfitEntries', 'entry-old', 0, BEFORE),
        entry('bossProfitEntries', 'entry-first', 0, QUEUED_AT),
        entry('bossProfitEntries', 'entry-new', 0, AFTER),
      ],
      answer: (records) => ({
        outcome: 'answered',
        results: records.map(() => ({ ok: false, code: 'duplicate_record', reason: 'r' })),
      }),
      names: { 'entry-old': '루시드 하드 처치 기록', 'entry-first': '윌 하드 처치 기록', 'entry-new': '진 힐라 하드 처치 기록' },
    })

    await pushServerSync({ firstQueuedAt: QUEUED_AT }, h.deps)

    expect(h.deleted.map(([, id]) => id)).toEqual(['entry-old', 'entry-first', 'entry-new'])
    expect(h.notices).toEqual(['진 힐라 하드 처치 기록은 다른 기기에서 먼저 적어, 그 기록으로 바꿨습니다'])
  })

  // 출시 직후 모든 기기가 한꺼번에 올리는 부하를 나눈다.
  it('처음 올리기의 줄을 실은 요청만 앞 요청과 1초 띄운다', async () => {
    const h = harness({
      entries: [
        ...Array.from({ length: 150 }, (_, i) => entry('mvpGradeHistory', `mvp-${i}`, 0, QUEUED_AT)),
        ...Array.from({ length: 150 }, (_, i) => entry('mapleIdNames', `mapleIdNames:maple-${i}`, 0, AFTER)),
      ],
    })

    await pushServerSync({ firstQueuedAt: QUEUED_AT }, h.deps)

    expect(h.events).toEqual(['send 100', 'wait 1000', 'send 100', 'send 100'])
  })

  it('넣기를 마친 시각이 없으면 띄우지 않는다', async () => {
    const h = harness({ entries: Array.from({ length: 150 }, (_, i) => entry('mvpGradeHistory', `mvp-${i}`)) })

    await pushServerSync({}, h.deps)

    expect(h.events).toEqual(['send 100', 'send 50'])
  })
})

it('신원이 없으면 대기 표를 읽지도 보내지도 않는다', async () => {
  const h = harness({ entries: [entry('mvpGradeHistory', 'mvp-1')], identity: null })
  const list = jest.fn(h.deps.list)
  h.deps.list = list

  await pushServerSync({}, h.deps)

  expect(list).not.toHaveBeenCalled()
  expect(h.sent).toEqual([])
})

// 해시는 서버가 원문 없이 같은 캐릭터를 잇는 열쇠다. 회차가 바꾼 값이 그대로 서버로 가는지 본다.
it('보내는 기록의 넥슨 식별자는 해시다', async () => {
  const h = harness({ entries: [entry('characterWorldLeaps', 'leap-1')] })

  await pushServerSync({}, h.deps)

  expect(h.sent[0]![0]!.row).toMatchObject({ mapleId: nexonIdHashHex('maple-1'), ocid: nexonIdHashHex('ocid-1') })
})
