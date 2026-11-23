// 기록을 보내기 전에 서버가 계정을 알게 하는 단계. 서버는 기록의 메이플 ID 가 보낸 신원이 쓸 수 있는 것이 아니면 거절한다.
// 1.0.15 서버에서 세션은 그 로그인에 등록한 부계정의 메이플 ID 까지 쓸 수 있어, 부계정 키의 신원으로 따로 알리지 않는다.
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
  } satisfies PrepareAccountsDeps
  return { deps, saved: () => saved }
}

const h = nexonIdHashHex

it('메인 신원으로 메인 계정의 메이플 ID 해시만 알리고, 서버가 돌려준 목록을 적는다', async () => {
  const { deps, saved } = depsOf(LOGIN, { 'acc-login': ['m1', 'm2'], 'acc-sub': ['m3'], 'acc-other': ['m9'] })

  await prepareServerAccounts(deps)

  expect(deps.report).toHaveBeenCalledTimes(1)
  expect(deps.report).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, [h('m1'), h('m2')])
  expect(saved().reported).toEqual({ 'acc-login': [h('m1'), h('m2')] })
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
it('지금 로그인의 부계정 키를 세션으로 메이플 ID 해시만 실어 등록하고, 등록한 키는 로그인마다 적어 다시 보내지 않는다', async () => {
  const { deps, saved } = depsOf(LOGIN, { 'acc-sub': ['m3'], 'acc-other': ['m9'] })

  await prepareServerAccounts(deps)

  expect(deps.register).toHaveBeenCalledTimes(1)
  expect(deps.register).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, [h('m3')])
  expect(saved().registered).toEqual(['acc-login:' + apiKeyHashHex('부-키')])

  const { deps: again } = depsOf(LOGIN, { 'acc-sub': ['m3'] }, saved())
  await prepareServerAccounts(again)
  expect(again.register).not.toHaveBeenCalled()
})

it('메이플 ID 를 아직 모르는 키는 미루고, 같은 넥슨 ID 거절은 적고, 그 밖의 거절과 실패는 적지 않는다', async () => {
  const noIds = depsOf(LOGIN, {})
  await prepareServerAccounts(noIds.deps)
  expect(noIds.deps.register).not.toHaveBeenCalled()

  const same = depsOf(LOGIN, { 'acc-sub': ['m3'] })
  same.deps.register.mockResolvedValueOnce('same_account' as never)
  await prepareServerAccounts(same.deps)
  expect(same.saved().registered).toEqual(['acc-login:' + apiKeyHashHex('부-키')])

  for (const result of ['registered_elsewhere', 'has_sub_accounts', 'login_is_sub_account', 'failed']) {
    const other = depsOf(LOGIN, { 'acc-sub': ['m3'] })
    other.deps.register.mockResolvedValueOnce(result as never)
    await prepareServerAccounts(other.deps)
    expect(other.saved().registered).toEqual([])
  }
})

// 무효가 된 키는 지우지 않고 계정 관리에 남는다. 그 키로는 더 부르지도 등록하지도 않는다.
it('무효 표시가 붙은 부계정 키는 등록하지 않는다', async () => {
  const config: NexonAuthConfig = {
    ...LOGIN,
    apiKeys: [{ type: 'key', id: 'acc-sub', label: '', value: '부-키', loginId: 'acc-login', invalid: { untrackedOcids: [] } }],
  }
  const { deps } = depsOf(config, { 'acc-login': ['m1'], 'acc-sub': ['m3'] })

  await prepareServerAccounts(deps)

  expect(deps.register).not.toHaveBeenCalled()
  expect(deps.report).toHaveBeenCalledTimes(1)
  expect(deps.report).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, [h('m1')])
})

// 같은 키로 늘 같은 값을 보내야 서버가 넥슨 계정 줄을 새로 만들었다가 합치지 않는다.
it('로그인이 없으면 등록하지 않고, 메인 키의 계정을 그 메이플 ID 해시 신원으로 알린다', async () => {
  const config: NexonAuthConfig = { login: null, mainKeyId: 'acc-main', apiKeys: [{ type: 'key', id: 'acc-main', label: '', value: '메인-키', loginId: null }] }
  const { deps } = depsOf(config, { 'acc-main': ['m2', 'm1'] })

  await prepareServerAccounts(deps)

  expect(deps.register).not.toHaveBeenCalled()
  expect(deps.report).toHaveBeenCalledWith({ 'x-maple-id-hash': h('m1') }, [h('m2'), h('m1')])
})
