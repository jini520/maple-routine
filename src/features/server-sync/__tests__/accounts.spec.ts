// 기록을 보내기 전에 서버가 계정을 알게 하는 단계. 서버는 기록의 메이플 ID 가 보낸 신원의 계정에 없으면 거절한다.
import { apiKeyHashHex } from '../../../lib/crypto/api-key-hash'
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import type { ServerAccountsState } from '../../../storage/server-accounts'
import type { NexonAuthConfig } from '../../../types/auth'
import { prepareServerAccounts, type PrepareAccountsDeps } from '../accounts'

const LOGIN: NexonAuthConfig = {
  login: { type: 'login', id: 'acc-login', session: 'S' },
  mainKeyId: null,
  apiKeys: [
    { type: 'key', id: 'acc-sub', label: '', value: '부-키', loginId: 'acc-login' },
    { type: 'key', id: 'acc-other', label: '', value: '남의-키', loginId: 'acc-다른-로그인' },
  ],
}

function depsOf(config: NexonAuthConfig | null, byAccount: Record<string, string[]>, state?: ServerAccountsState) {
  let saved: ServerAccountsState = state ?? { reported: {}, registered: [] }
  const deps = {
    config: jest.fn(async () => config),
    mapleIdsByAccount: jest.fn(async () => new Map(Object.entries(byAccount))),
    getState: jest.fn(async () => structuredClone(saved)),
    setState: jest.fn(async (next: ServerAccountsState) => {
      saved = next
    }),
    report: jest.fn(async (_headers: Record<string, string>, ids: readonly string[]) => ({ outcome: 'sent' as const, mapleIds: [...ids] })),
    register: jest.fn(async () => 'registered' as const),
    listSubAccounts: jest.fn(async () => ({ outcome: 'listed' as const, subAccounts: [{ apiKeyHashes: ['s1'], mapleIds: ['h3'] }] })),
    setSubAccountList: jest.fn(async () => undefined),
  } satisfies PrepareAccountsDeps
  return { deps, saved: () => saved }
}

const h = nexonIdHashHex

// 부계정의 기록은 그 키의 신원으로 보내므로, 키의 계정도 그 키로 알려야 서버가 받는다.
it('계정마다 그 계정의 신원으로 메이플 ID 해시를 알리고, 서버가 돌려준 목록을 계정마다 적는다', async () => {
  const { deps, saved } = depsOf(LOGIN, { 'acc-login': ['m1', 'm2'], 'acc-sub': ['m3'], 'acc-other': ['m9'] })

  await prepareServerAccounts(deps)

  expect(deps.report).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, [h('m1'), h('m2')])
  expect(deps.report).toHaveBeenCalledWith({ 'x-api-key-hash': apiKeyHashHex('부-키') }, [h('m3')])
  // 다른 로그인의 부계정은 지금 밝힐 수 없다.
  expect(deps.report).toHaveBeenCalledTimes(2)
  expect(saved().reported).toEqual({ 'acc-login': [h('m1'), h('m2')], 'acc-sub': [h('m3')] })
})

it('서버가 이미 아는 메이플 ID 뿐이면 다시 알리지 않고, 하나라도 새로 생기면 알린다', async () => {
  const known: ServerAccountsState = { reported: { 'acc-login': [h('m1'), h('m2')] }, registered: ['acc-login:' + apiKeyHashHex('부-키')] }
  const { deps } = depsOf({ ...LOGIN, apiKeys: [] }, { 'acc-login': ['m2'] }, known)
  await prepareServerAccounts(deps)
  expect(deps.report).not.toHaveBeenCalled()

  const { deps: again } = depsOf({ ...LOGIN, apiKeys: [] }, { 'acc-login': ['m2', 'm4'] }, known)
  await prepareServerAccounts(again)
  expect(again.report).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, [h('m2'), h('m4')])
})

it('알리기가 실패하면 적지 않아 다음 회차에 다시 알린다', async () => {
  const { deps, saved } = depsOf({ ...LOGIN, apiKeys: [] }, { 'acc-login': ['m1'] })
  deps.report.mockResolvedValueOnce({ outcome: 'no-response' } as never)

  await prepareServerAccounts(deps)

  expect(saved().reported).toEqual({})
})

// 연동 때 등록하지 못한 키와, 이 기능 전부터 로그인과 함께 남아 있던 키가 여기서 등록된다.
it('지금 로그인의 부계정 키를 세션으로 등록하고, 등록한 키는 로그인마다 적어 다시 보내지 않는다', async () => {
  const { deps, saved } = depsOf(LOGIN, { 'acc-sub': ['m3'], 'acc-other': ['m9'] })

  await prepareServerAccounts(deps)

  expect(deps.register).toHaveBeenCalledTimes(1)
  expect(deps.register).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, apiKeyHashHex('부-키'), [h('m3')])
  expect(saved().registered).toEqual(['acc-login:' + apiKeyHashHex('부-키')])

  const { deps: again } = depsOf(LOGIN, { 'acc-sub': ['m3'] }, saved())
  await prepareServerAccounts(again)
  expect(again.register).not.toHaveBeenCalled()
})

it('메이플 ID 를 아직 모르는 키는 미루고, 같은 넥슨 ID 거절은 적고, 한도 · 실패는 적지 않는다', async () => {
  const noIds = depsOf(LOGIN, {})
  await prepareServerAccounts(noIds.deps)
  expect(noIds.deps.register).not.toHaveBeenCalled()

  const same = depsOf(LOGIN, { 'acc-sub': ['m3'] })
  same.deps.register.mockResolvedValueOnce('same_account' as never)
  await prepareServerAccounts(same.deps)
  expect(same.saved().registered).toEqual(['acc-login:' + apiKeyHashHex('부-키')])

  for (const outcome of ['limit', 'failed'] as const) {
    const run = depsOf(LOGIN, { 'acc-sub': ['m3'] })
    run.deps.register.mockResolvedValueOnce(outcome as never)
    await prepareServerAccounts(run.deps)
    expect(run.saved().registered).toEqual([])
  }
})

it('로그인이 없으면 등록하지 않고 메인 키의 계정만 알린다', async () => {
  const config: NexonAuthConfig = { login: null, mainKeyId: 'acc-main', apiKeys: [{ type: 'key', id: 'acc-main', label: '', value: '메인-키', loginId: null }] }
  const { deps } = depsOf(config, { 'acc-main': ['m1'] })

  await prepareServerAccounts(deps)

  expect(deps.register).not.toHaveBeenCalled()
  expect(deps.report).toHaveBeenCalledWith({ 'x-api-key-hash': apiKeyHashHex('메인-키') }, [h('m1')])
})

// 앱은 서버가 준 부계정만 부른다. 회차마다 받아 둬야 다른 기기에서 지운 부계정을 이 기기도 그만 부른다.
it('부계정을 등록한 뒤 그 로그인의 부계정 목록을 받아 적고, 못 받으면 적지 않는다', async () => {
  const { deps } = depsOf(LOGIN, { 'acc-sub': ['m3'] })
  await prepareServerAccounts(deps)
  expect(deps.listSubAccounts).toHaveBeenCalledWith({ Authorization: 'Bearer S' })
  expect(deps.register.mock.invocationCallOrder[0]).toBeLessThan(deps.listSubAccounts.mock.invocationCallOrder[0]!)
  expect(deps.setSubAccountList).toHaveBeenCalledWith({ loginId: 'acc-login', subAccounts: [{ apiKeyHashes: ['s1'], mapleIds: ['h3'] }] })

  const { deps: failed } = depsOf(LOGIN, {})
  failed.listSubAccounts.mockResolvedValueOnce({ outcome: 'failed' } as never)
  await prepareServerAccounts(failed)
  expect(failed.setSubAccountList).not.toHaveBeenCalled()

  const { deps: keyOnly } = depsOf({ login: null, apiKeys: [], mainKeyId: null }, {})
  await prepareServerAccounts(keyOnly)
  expect(keyOnly.listSubAccounts).not.toHaveBeenCalled()
})
