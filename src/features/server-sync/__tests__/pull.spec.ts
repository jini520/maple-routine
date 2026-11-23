/**
 * 번호를 보내 받고, 받은 줄을 넣은 뒤 번호를 갈아 끼우는 받기.
 *
 * 여기서 막는 사고는 셋이다. 넣기 전에 번호를 적어 앱이 꺼지면 그 줄을 영영 놓치는 것, 서버가 같은 쪽을 계속 주면 끝나지 않는 것,
 * 180일 넘게 받지 않은 기기가 서버가 지운 표식을 놓친 채 지운 기록을 계속 보이는 것이다.
 */
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import type { SyncPullCursors, SyncPullOutcome, SyncPullResponse } from '../../../server/sync'
import type { ServerSyncCursors } from '../../../storage/server-sync-cursors'
import type { ServerSyncTable } from '../../../storage/server-sync-queue'
import { pullServerSync, type PullDeps } from '../pull'

const HEADERS = { 'x-maple-id-hash': 'h' }
const MAPLE = 'maple-1'
const MAPLE_HASH = nexonIdHashHex(MAPLE)
const OTHER_HASH = 'e'.repeat(64)
const AT = '2026-11-23T00:00:00.000Z'

function response(patch: Partial<SyncPullResponse> = {}): SyncPullResponse {
  return {
    mapleIds: [MAPLE_HASH],
    cursors: { nexonAccount: { id: 'account-1', changeSeq: 10 }, mapleIds: { [MAPLE_HASH]: 10 } },
    oldestDeletedChangeSeq: null,
    hasMore: false,
    records: {},
    ...patch,
  }
}

const answered = (one: SyncPullResponse): SyncPullOutcome => ({ outcome: 'answered', response: one })

function setup(
  outcomes: SyncPullOutcome[],
  stored: ServerSyncCursors = { nexonAccount: null, mapleIds: {} },
  signIn: { previousMapleIds: string[] } | null = null,
  device: string[] = [],
) {
  let cursors = stored
  let signedIn = signIn
  const events: string[] = []
  const sent: SyncPullCursors[] = []
  const deps: PullDeps = {
    identity: jest.fn(async () => HEADERS),
    getCursors: jest.fn(async () => cursors),
    setCursors: jest.fn(async (next: ServerSyncCursors) => {
      events.push(`cursors ${JSON.stringify(next)}`)
      cursors = next
    }),
    pull: jest.fn(async (_headers: Record<string, string>, request: SyncPullCursors) => {
      sent.push(request)
      const next = outcomes.shift()
      if (next === undefined) throw new Error('요청이 더 나갔다')
      return next
    }),
    lookup: jest.fn(async () => ({
      ocids: new Map([[nexonIdHashHex('ocid-1'), 'ocid-1']]),
      mapleIds: new Map([[MAPLE_HASH, MAPLE]]),
      nexonAccountIds: new Map([[MAPLE, 'nexon-account-1']]),
    })),
    applySqlite: jest.fn(async (record) => {
      events.push(`sqlite ${record.table} ${record.id}`)
      if (record.id === 'broken') throw new Error('CHECK')
      return record.id !== 'queued'
    }),
    applySettledDay: jest.fn(async (record) => {
      events.push(`settled ${record.historyDate}`)
      return true
    }),
    applyPreferences: jest.fn(async (records) => {
      events.push(`preferences ${records.map((one: { table: string }) => one.table).join(',')}`)
    }),
    clearOwners: jest.fn(async (owners) => {
      events.push(`clear ${JSON.stringify(owners)}`)
    }),
    replaceMatched: jest.fn(async () => {
      events.push('replace matched')
      return new Set<ServerSyncTable>()
    }),
    forgetReleasedSubAccounts: jest.fn(async (hashes: ReadonlySet<string>) => {
      events.push(`released ${[...hashes].join(',')}`)
    }),
    forgetMapleIds: jest.fn(async (hashes: readonly string[]) => {
      events.push(`forget ${hashes.join(',')}`)
    }),
    getSignIn: jest.fn(async () => signedIn),
    clearSignIn: jest.fn(async () => {
      events.push('sign-in cleared')
      signedIn = null
    }),
    deviceMapleIds: jest.fn(async () => device),
    afterRecordsChanged: jest.fn(),
  }
  return { deps, events, sent, current: () => cursors }
}

it('신원이 없으면 받지 않는다', async () => {
  const { deps } = setup([])
  ;(deps.identity as jest.Mock).mockResolvedValue(null)

  const summary = await pullServerSync({}, deps)

  expect(deps.pull).not.toHaveBeenCalled()
  // 처음 동기화는 끝까지 받았을 때만 올린다. 신원이 없어 받지 않은 것을 끝까지 받은 것으로 읽으면 받기 없이 올린다.
  expect(summary.finished).toBe(false)
})

it('기억한 번호를 보내고, 받은 줄을 표 차례로 다 넣은 뒤에 응답의 번호를 적는다', async () => {
  const stored = { nexonAccount: { id: 'account-1', changeSeq: 3 }, mapleIds: { [MAPLE_HASH]: 5 } }
  const { deps, events, sent, current } = setup(
    [
      answered(
        response({
          records: {
            bossDrops: [{ id: 'drop-1', profitEntryId: 'entry-1', deletedAt: null }],
            bossProfitEntries: [{ id: 'entry-1', ocid: nexonIdHashHex('ocid-1'), deletedAt: null }],
            enhancementSettledDays: [{ mapleId: MAPLE_HASH, apiType: 'cube', historyDate: '2026-11-20' }],
            mapleIdNames: [{ mapleId: MAPLE_HASH, name: '본캐' }],
          },
        }),
      ),
    ],
    stored,
  )

  const summary = await pullServerSync({}, deps)

  expect(sent).toEqual([stored])
  expect(events).toEqual([
    'replace matched',
    'sqlite bossProfitEntries entry-1',
    'sqlite bossDrops drop-1',
    'settled 2026-11-20',
    'preferences mapleIdNames',
    `cursors ${JSON.stringify({ nexonAccount: { id: 'account-1', changeSeq: 10 }, mapleIds: { [MAPLE_HASH]: 10 } })}`,
  ])
  expect(current()).toEqual(response().cursors)
  expect(summary).toMatchObject({ applied: 4, skipped: 0, stopped: false, finished: true })
  expect(deps.afterRecordsChanged).toHaveBeenCalledWith(
    new Set(['bossProfitEntries', 'bossDrops', 'enhancementSettledDays', 'mapleIdNames']),
  )
})

// 한 줄 때문에 받기가 멈추면 번호가 오르지 않아 같은 줄에서 계속 멈춘다.
it('넣지 못한 줄과 대기 중이라 건너뛴 줄은 세고 나머지를 넣은 뒤 번호를 적는다', async () => {
  const { deps, current } = setup([
    answered(
      response({
        records: {
          bossSplitSettings: [{ id: 'broken' }, { id: 'queued' }, { id: 'split-1' }],
          trackedCharacters: [{ ocid: OTHER_HASH, sortOrder: 0, isRepresentative: true }],
        },
      }),
    ),
  ])

  const summary = await pullServerSync({}, deps)

  expect(summary).toMatchObject({ applied: 1, skipped: 3 })
  expect(current()).toEqual(response().cursors)
  expect(deps.applyPreferences).not.toHaveBeenCalled()
})

// 처음 동기화의 받기만 id 없는 Preferences 기록의 서버 값을 남긴다. 짝이 없는 대표를 모르면 기기 쪽 대표가 올라가 서버가 그 대표를 내린다.
it('처음 동기화의 받기는 넣기를 마친 시각과 서버 대표가 짝이 없는 캐릭터인지를 Preferences 넣기에 넘긴다', async () => {
  const records = {
    trackedCharacters: [
      { ocid: OTHER_HASH, sortOrder: 0, isRepresentative: true, deletedAt: null },
      { ocid: nexonIdHashHex('ocid-1'), sortOrder: 1, isRepresentative: false, deletedAt: null },
    ],
  }
  const first = setup([answered(response({ records }))])
  await pullServerSync({ firstQueuedAt: 'Q' }, first.deps)
  expect(first.deps.applyPreferences).toHaveBeenCalledWith(
    [expect.objectContaining({ table: 'trackedCharacters', ocid: 'ocid-1' })],
    { firstQueuedAt: 'Q', unpairedRepresentative: true },
  )

  const later = setup([answered(response({ records }))])
  await pullServerSync({}, later.deps)
  expect(later.deps.applyPreferences).toHaveBeenCalledWith([expect.objectContaining({ ocid: 'ocid-1' })], {
    firstQueuedAt: undefined,
    unpairedRepresentative: false,
  })
})

it('`hasMore` 가 꺼질 때까지 이어 받고 화면은 끝에 한 번 다시 읽는다', async () => {
  const first = response({
    hasMore: true,
    cursors: { nexonAccount: { id: 'account-1', changeSeq: 10 }, mapleIds: { [MAPLE_HASH]: 4 } },
    records: { mvpGradeHistory: [{ id: 'mvp-1', mapleId: MAPLE_HASH }] },
  })
  const { deps, sent } = setup([answered(first), answered(response({ records: { rememberedLevels: [{ id: 'level-1' }] } }))])

  const summary = await pullServerSync({}, deps)

  expect(sent[1]).toEqual(first.cursors)
  expect(summary.pages).toBe(2)
  expect(deps.afterRecordsChanged).toHaveBeenCalledTimes(1)
  expect(deps.afterRecordsChanged).toHaveBeenCalledWith(new Set(['mvpGradeHistory', 'rememberedLevels']))
})

// 서버가 같은 쪽을 계속 주면 받기가 끝나지 않는다.
it('`hasMore` 인데 번호가 그대로면 멈춘다', async () => {
  const stuck = response({ hasMore: true })
  const { deps } = setup([answered(stuck), answered(stuck), answered(stuck)])

  const summary = await pullServerSync({}, deps)

  expect(deps.pull).toHaveBeenCalledTimes(2)
  expect(summary).toMatchObject({ stopped: true, finished: false })
})

it('응답이 없거나 요청 전체가 거절되면 번호를 두고 멈춘다', async () => {
  for (const outcome of [{ outcome: 'no-response' } as const, { outcome: 'refused', status: 401 } as const]) {
    const { deps } = setup([outcome])

    const summary = await pullServerSync({}, deps)

    expect(summary).toMatchObject({ stopped: true, finished: false })
    expect(deps.setCursors).not.toHaveBeenCalled()
  }
})

describe('가장 오래된 삭제 표식', () => {
  it('번호가 0 보다 크고 표식보다 작은 주인만 비우고, 그 주인의 번호를 0 으로 적어 그 응답의 줄은 넣지 않고 다시 받는다', async () => {
    const stored = { nexonAccount: { id: 'account-1', changeSeq: 50 }, mapleIds: { [MAPLE_HASH]: 5, [OTHER_HASH]: 0 } }
    const stale = response({
      mapleIds: [MAPLE_HASH, OTHER_HASH],
      oldestDeletedChangeSeq: 20,
      records: { mvpGradeHistory: [{ id: 'mvp-old', mapleId: MAPLE_HASH }] },
    })
    const { deps, events, sent } = setup([answered(stale), answered(response({ records: { mvpGradeHistory: [{ id: 'mvp-1' }] } }))], stored)

    await pullServerSync({}, deps)

    expect(events[1]).toBe(`clear ${JSON.stringify({ mapleIds: [MAPLE], person: false })}`)
    expect(sent[1]).toEqual({ nexonAccount: { id: 'account-1', changeSeq: 50 }, mapleIds: { [MAPLE_HASH]: 0, [OTHER_HASH]: 0 } })
    expect(events).not.toContain('sqlite mvpGradeHistory mvp-old')
    expect(events).toContain('sqlite mvpGradeHistory mvp-1')
  })

  it('사람의 번호가 작으면 사람의 기록을 비우고 사람의 번호를 비운다. 넥슨 계정 줄이 바뀐 번호는 서버가 0 으로 봐 비우지 않는다', async () => {
    const stored = { nexonAccount: { id: 'account-1', changeSeq: 5 }, mapleIds: { [MAPLE_HASH]: 50 } }
    const { deps, sent } = setup([answered(response({ oldestDeletedChangeSeq: 20 })), answered(response())], stored)

    await pullServerSync({}, deps)

    expect(deps.clearOwners).toHaveBeenCalledWith({ mapleIds: [], person: true })
    expect(sent[1]).toEqual({ nexonAccount: null, mapleIds: { [MAPLE_HASH]: 50 } })

    const moved = setup(
      [answered(response({ oldestDeletedChangeSeq: 20, cursors: { nexonAccount: { id: 'account-2', changeSeq: 10 }, mapleIds: { [MAPLE_HASH]: 60 } } }))],
      stored,
    )
    await pullServerSync({}, moved.deps)
    expect(moved.deps.clearOwners).not.toHaveBeenCalled()
  })

  it('짝이 없는 메이플 ID 는 `#` 를 붙인 해시로 비우고, 표식이 null 이면 비우지 않는다', async () => {
    const stored = { nexonAccount: null, mapleIds: { [OTHER_HASH]: 5 } }
    const first = setup([answered(response({ mapleIds: [OTHER_HASH], oldestDeletedChangeSeq: 20 })), answered(response())], stored)
    await pullServerSync({}, first.deps)
    expect(first.deps.clearOwners).toHaveBeenCalledWith({ mapleIds: [`#${OTHER_HASH}`], person: false })

    const none = setup([answered(response({ mapleIds: [OTHER_HASH], oldestDeletedChangeSeq: null }))], stored)
    await pullServerSync({}, none.deps)
    expect(none.deps.clearOwners).not.toHaveBeenCalled()
  })
})

it('받은 줄의 해시를 원문으로 바꿔 넣는다', async () => {
  const { deps } = setup([
    answered(response({ records: { bossSplitSettings: [{ id: 'split-1', ocid: nexonIdHashHex('ocid-1'), createdAt: AT, updatedAt: AT }] } })),
  ])

  await pullServerSync({}, deps)

  expect(deps.applySqlite).toHaveBeenCalledWith(expect.objectContaining({ id: 'split-1', row: expect.objectContaining({ ocid: 'ocid-1' }) }))
})

// 짝이 생긴 `#` 를 먼저 원문으로 바꿔야 받은 줄의 유일 기준이 기기 줄과 맞는다.
it('받기 전에 짝이 생긴 `#` 를 원문으로 바꾸고, 바꾼 표의 화면을 다시 읽는다', async () => {
  const { deps, events } = setup([answered(response())])
  ;(deps.replaceMatched as jest.Mock).mockImplementation(async () => {
    events.push('replace matched')
    return new Set(['bossProfitEntries'])
  })

  await pullServerSync({}, deps)

  expect(events[0]).toBe('replace matched')
  expect(deps.afterRecordsChanged).toHaveBeenCalledWith(new Set(['bossProfitEntries']))
})

describe('다른 기기의 부계정 해제', () => {
  it('앞 받기의 목록에 있던 메이플 ID 가 빠지면 그 부계정을 이 기기에서 뺀다. 이어 받는 쪽에서는 다시 보지 않는다', async () => {
    const stored = { nexonAccount: { id: 'account-1', changeSeq: 9 }, mapleIds: { [MAPLE_HASH]: 9, [OTHER_HASH]: 9 } }
    const first = response({ hasMore: true, cursors: { nexonAccount: { id: 'account-1', changeSeq: 10 }, mapleIds: { [MAPLE_HASH]: 10 } } })
    const { deps } = setup([answered(first), answered(response())], stored)

    await pullServerSync({}, deps)

    expect(deps.forgetReleasedSubAccounts).toHaveBeenCalledTimes(1)
    expect(deps.forgetReleasedSubAccounts).toHaveBeenCalledWith(new Set([OTHER_HASH]))
  })

  // 해제한 메이플 ID 의 기록은 서버가 받지 않는다. 다시 등록하면 받기가 0 부터 받아 돌아온다.
  it('그 메이플 ID 의 기록을 대기 중인 것까지 비우고, 응답의 번호로 그 메이플 ID 의 번호를 뺀다', async () => {
    const stored = { nexonAccount: { id: 'account-1', changeSeq: 9 }, mapleIds: { [MAPLE_HASH]: 9, [OTHER_HASH]: 9 } }
    const { deps, events, current } = setup([answered(response())], stored)

    await pullServerSync({}, deps)

    expect(events.indexOf(`forget ${OTHER_HASH}`)).toBeGreaterThan(events.indexOf(`released ${OTHER_HASH}`))
    expect(current().mapleIds).toEqual({ [MAPLE_HASH]: 10 })
    expect(deps.afterRecordsChanged).toHaveBeenCalled()
  })

  // 다른 사람으로 로그인했거나 넥슨 계정 줄이 합쳐졌으면 목록이 바뀌는 것이 해제가 아니다.
  it('넥슨 계정 줄이 바뀌었거나 앞 목록이 없으면 견주지 않는다', async () => {
    const moved = setup(
      [answered(response())],
      { nexonAccount: { id: 'account-2', changeSeq: 9 }, mapleIds: { [OTHER_HASH]: 9 } },
    )
    await pullServerSync({}, moved.deps)
    expect(moved.deps.forgetReleasedSubAccounts).not.toHaveBeenCalled()

    const fresh = setup([answered(response())])
    await pullServerSync({}, fresh.deps)
    expect(fresh.deps.forgetReleasedSubAccounts).not.toHaveBeenCalled()
  })
})

// 같은 사람인지는 서버가 답한다. 로그인할 때 기기가 비운 것은 기기가 아는 새 계정의 메이플 ID 로 가린 것이다.
describe('로그인 뒤 첫 받기', () => {
  it('응답의 목록에 없는 메이플 ID 의 기록을 비우고 표시를 지운다. 같은 사람이면 그 응답의 줄을 넣는다', async () => {
    const { deps, events } = setup(
      [answered(response({ records: { bossProfitEntries: [{ id: 'entry-1', ocid: nexonIdHashHex('ocid-1'), deletedAt: null }] } }))],
      { nexonAccount: { id: 'account-1', changeSeq: 3 }, mapleIds: { [MAPLE_HASH]: 5 } },
      { previousMapleIds: [MAPLE_HASH] },
      [MAPLE, 'maple-old', `#${OTHER_HASH}`, `#${MAPLE_HASH}`],
    )

    await pullServerSync({}, deps)

    expect(events.slice(0, 4)).toEqual([
      'replace matched',
      `clear ${JSON.stringify({ mapleIds: ['maple-old', `#${OTHER_HASH}`], person: false })}`,
      'sign-in cleared',
      'sqlite bossProfitEntries entry-1',
    ])
    expect(deps.pull).toHaveBeenCalledTimes(1)
  })

  // 번호의 넥슨 계정 줄이 응답과 같으면 서버가 번호 뒤의 줄만 주어 비운 기록이 돌아오지 않는다.
  it('앞 계정과 하나도 겹치지 않으면 사람의 기록도 비우고, 사람의 번호 없이 그 응답의 줄은 넣지 않고 다시 받는다', async () => {
    const { deps, events, sent } = setup(
      [answered(response({ records: { partyAppointments: [{ id: 'appointment-1' }] } })), answered(response())],
      { nexonAccount: { id: 'account-1', changeSeq: 3 }, mapleIds: { [MAPLE_HASH]: 5 } },
      { previousMapleIds: [OTHER_HASH] },
      [MAPLE],
    )

    await pullServerSync({}, deps)

    expect(events).toContain(`clear ${JSON.stringify({ mapleIds: [], person: true })}`)
    expect(sent[1]).toEqual({ nexonAccount: null, mapleIds: { [MAPLE_HASH]: 5 } })
    expect(deps.applyPreferences).not.toHaveBeenCalled()
    expect(deps.getSignIn).toHaveBeenCalledTimes(1)
  })

  it('표시가 없으면 비우지 않는다', async () => {
    const { deps } = setup([answered(response())], { nexonAccount: null, mapleIds: {} }, null, ['maple-old'])

    await pullServerSync({}, deps)

    expect(deps.clearOwners).not.toHaveBeenCalled()
    expect(deps.clearSignIn).not.toHaveBeenCalled()
  })
})
