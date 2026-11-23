/**
 * 로그인을 저장하기 전에 앞 사람의 기록을 가리는 주인 바꾸기. 기기에는 지금 로그인한 사람의 기록만 둔다.
 *
 * 여기서 막는 사고는 셋이다. 앞 사람의 올리지 못한 기록을 말없이 지우는 것, 같은 사람의 기록을 앞 사람의 것으로 지우는 것, 앞 사람의
 * 기록이 새 사람의 화면에 그려지는 것이다.
 */
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import type { FirstServerSync } from '../../../storage/server-sync-first'
import type { ServerSyncRecordOwner } from '../../../storage/server-sync-owners'
import { switchServerSyncOwner, type OwnerSwitchDeps } from '../owner-switch'

const h = nexonIdHashHex
const DONE: FirstServerSync = { queuedAt: '2026-11-24T00:00:00.000Z', pulled: true }

interface Setup {
  first?: FirstServerSync | null
  previous: string[]
  queue?: [string, string, ServerSyncRecordOwner][]
  device?: string[]
  subKeys?: string[]
  discard?: boolean
}

function setup(options: Setup) {
  const order: string[] = []
  const owners = new Map((options.queue ?? []).map(([, recordId, owner]) => [recordId, owner]))
  const save = jest.fn(async () => {
    order.push('save')
  })
  const deps: OwnerSwitchDeps = {
    getFirstSync: jest.fn(async () => (options.first === undefined ? DONE : options.first)),
    enqueueAll: jest.fn(async () => {
      order.push('enqueue')
    }),
    queue: jest.fn(async () => {
      order.push('queue')
      return (options.queue ?? []).map(([recordType, recordId]) => ({ recordType, recordId }))
    }),
    ownerOf: jest.fn(async (_table: string, recordId: string) => owners.get(recordId) ?? { kind: 'unknown' }),
    previousMapleIds: jest.fn(async () => options.previous),
    loginSubKeyMapleIds: jest.fn(async () => options.subKeys ?? []),
    deviceMapleIds: jest.fn(async () => options.device ?? []),
    ask: jest.fn(async (count: number) => {
      order.push(`ask ${count}`)
      return options.discard ?? true
    }),
    discard: jest.fn(async (entries) => {
      order.push(`discard ${entries.map((one: { recordId: string }) => one.recordId).join(',')}`)
    }),
    forgetOwners: jest.fn(async (owners) => {
      order.push(`forget ${JSON.stringify(owners)}`)
    }),
    markSignIn: jest.fn(async (previous: readonly string[]) => {
      order.push(`mark ${previous.join(',')}`)
    }),
  }
  return { deps, order, save }
}

it('같은 사람이면 묻지 않고, 새 계정에 없는 메이플 ID 의 기록만 비운 뒤 저장하고 첫 받기를 표시한다', async () => {
  const { deps, order, save } = setup({
    previous: [h('maple-1')],
    queue: [
      ['bossProfitEntries', 'entry-1', { kind: 'mapleId', mapleId: 'maple-1' }],
      ['partyAppointments', 'appointment-1', { kind: 'person' }],
      ['cashbookEntries', 'cash-gone', { kind: 'unknown' }],
      ['cashbookEntries', 'cash-marked', { kind: 'mapleId', mapleId: '#hash-sub' }],
    ],
    device: ['maple-1', 'maple-old', '#hash-sub'],
  })

  expect(await switchServerSyncOwner({ mapleIds: ['maple-1'], login: false }, save, deps)).toBe(true)

  // `#` 메이플 ID 는 다른 기기에서 등록한 부계정일 수 있어 같은 사람이면 서버의 목록을 기다린다.
  expect(order).toEqual(['queue', `forget ${JSON.stringify({ mapleIds: ['maple-old'], person: false })}`, 'save', `mark ${h('maple-1')}`])
  expect(deps.ask).not.toHaveBeenCalled()
})

it('다른 사람이면 앞 사람의 대기 줄 수로 묻고, 버리면 그 줄을 버리고 앞 사람의 기록을 비운 뒤 저장한다', async () => {
  const { deps, order, save } = setup({
    previous: [h('maple-old')],
    queue: [
      ['bossProfitEntries', 'entry-old', { kind: 'mapleId', mapleId: 'maple-old' }],
      ['bossProfitEntries', 'entry-new', { kind: 'mapleId', mapleId: 'maple-new' }],
      ['partyAppointments', 'appointment-1', { kind: 'person' }],
      ['cashbookEntries', 'cash-gone', { kind: 'unknown' }],
      ['cashbookEntries', 'cash-marked', { kind: 'mapleId', mapleId: '#hash-x' }],
    ],
    device: ['maple-old', 'maple-new', '#hash-x'],
  })

  expect(await switchServerSyncOwner({ mapleIds: ['maple-new'], login: false }, save, deps)).toBe(true)

  expect(order).toEqual([
    'queue',
    'ask 4',
    'discard entry-old,appointment-1,cash-gone,cash-marked',
    `forget ${JSON.stringify({ mapleIds: ['maple-old', '#hash-x'], person: true })}`,
    'save',
    `mark ${h('maple-old')}`,
  ])
})

// 남은 기록은 앞 계정으로 다시 로그인하면 올라간다.
it('`그만두기` 면 아무것도 버리거나 비우지 않고 저장하지 않는다', async () => {
  const { deps, order, save } = setup({
    previous: [h('maple-old')],
    queue: [['bossProfitEntries', 'entry-old', { kind: 'mapleId', mapleId: 'maple-old' }]],
    device: ['maple-old'],
    discard: false,
  })

  expect(await switchServerSyncOwner({ mapleIds: ['maple-new'], login: false }, save, deps)).toBe(false)

  expect(order).toEqual(['queue', 'ask 1'])
})

it('같은 사람이어도 새 계정에 없는 메이플 ID 의 대기 줄은 앞 사람의 것으로 묻는다', async () => {
  const { deps, save } = setup({
    previous: [h('maple-1')],
    queue: [['bossProfitEntries', 'entry-9', { kind: 'mapleId', mapleId: 'maple-9' }]],
  })

  await switchServerSyncOwner({ mapleIds: ['maple-1'], login: false }, save, deps)

  expect(deps.ask).toHaveBeenCalledWith(1)
})

// 같은 넥슨 ID 로 다시 로그인하면 그 로그인에 귀속된 부계정 키가 다시 이어진다.
it('넥슨 로그인은 그 로그인에 귀속된 부계정 키의 메이플 ID 를 새 계정에 더한다', async () => {
  const { deps, save } = setup({
    previous: [h('maple-1')],
    queue: [['bossProfitEntries', 'entry-sub', { kind: 'mapleId', mapleId: 'maple-sub' }]],
    device: ['maple-1', 'maple-sub'],
    subKeys: ['maple-sub'],
  })

  await switchServerSyncOwner({ mapleIds: ['maple-1'], login: true }, save, deps)

  expect(deps.loginSubKeyMapleIds).toHaveBeenCalledWith(['maple-1'])
  expect(deps.ask).not.toHaveBeenCalled()
  expect(deps.forgetOwners).not.toHaveBeenCalled()
})

it('API 키 로그인은 부계정 키를 보지 않는다', async () => {
  const { deps, save } = setup({ previous: [] })

  await switchServerSyncOwner({ mapleIds: ['maple-1'], login: false }, save, deps)

  expect(deps.loginSubKeyMapleIds).not.toHaveBeenCalled()
})

// 로그아웃한 채 1.0.15 로 올린 기기는 기록이 대기 표에 없어 앞 사람의 올리지 못한 기록을 물을 수 없다.
it('처음 동기화가 기록을 넣지 않았으면 대기 표를 읽기 전에 넣는다', async () => {
  const { deps, order, save } = setup({ first: null, previous: [] })

  await switchServerSyncOwner({ mapleIds: ['maple-1'], login: false }, save, deps)

  expect(order.slice(0, 2)).toEqual(['enqueue', 'queue'])
})

// 아는 것 없이 비우면 같은 사람의 기록을 잃는다.
it('앞 계정의 메이플 ID 를 모르면 같은 사람으로 본다', async () => {
  const { deps, save } = setup({
    previous: [],
    queue: [['partyAppointments', 'appointment-1', { kind: 'person' }]],
    device: ['#hash-x'],
  })

  await switchServerSyncOwner({ mapleIds: ['maple-1'], login: false }, save, deps)

  expect(deps.ask).not.toHaveBeenCalled()
  expect(deps.forgetOwners).not.toHaveBeenCalled()
})
