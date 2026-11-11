// 계정 관리에서 키를 넣기 전의 검증. 하나라도 걸리면 저장하지 않는다. 이미 등록된 계정의 키를 받으면 같은 넥슨 계정이 둘로
// 서고, 다른 계정의 키로 바꾸면 그 계정의 추적 캐릭터와 기록이 엉뚱한 계정에 붙는다.
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import { NexonBadRequestError, NexonRateLimitError } from '../../../nexon/errors'
import type { MapleAccount } from '../../../types'
import { checkApiKey, type CheckApiKeyDeps } from '../validate-key'

const h = nexonIdHashHex

function 메이플ID(accountId: string): MapleAccount {
  return { accountId, characters: [] }
}

function depsOf(accounts: MapleAccount[] | Error, stage: 'developmentStage' | 'undetermined' = 'undetermined') {
  return {
    fetchList: jest.fn(async () => {
      if (accounts instanceof Error) throw accounts
      return accounts
    }),
    probeStage: jest.fn(async () => stage),
  } satisfies CheckApiKeyDeps
}

it('통과하면 받은 목록과 그 메이플 ID 해시를 돌려준다', async () => {
  const deps = depsOf([메이플ID('m-a'), 메이플ID('m-b')])

  await expect(checkApiKey('키', { taken: [h('m-x')], target: null }, deps)).resolves.toEqual({
    outcome: 'ok',
    accounts: [메이플ID('m-a'), 메이플ID('m-b')],
    mapleIdHashes: [h('m-a'), h('m-b')],
  })
})

it('무효 키는 모달로 알리고 개발 단계를 재지 않는다', async () => {
  const deps = depsOf(new NexonBadRequestError('무효 키', 'OPENAPI00005'))

  await expect(checkApiKey('키', { taken: [], target: null }, deps)).resolves.toEqual({ outcome: 'rejected', reason: 'invalid' })
  expect(deps.probeStage).not.toHaveBeenCalled()
})

// 네트워크가 끊겼거나 잠깐 한도에 닿은 것을 키 탓으로 말하면 멀쩡한 키를 버리게 된다.
it('무효 키가 아닌 실패는 모달이 아니라 실패로 넘긴다', async () => {
  await expect(checkApiKey('키', { taken: [], target: null }, depsOf(new NexonRateLimitError('한도')))).resolves.toEqual({
    outcome: 'failed',
    error: { kind: 'rateLimited' },
  })
  await expect(checkApiKey('키', { taken: [], target: null }, depsOf(new Error('offline')))).resolves.toEqual({
    outcome: 'failed',
    error: { kind: 'network' },
  })
})

it('개발 단계 키 · 메이플 ID 가 없는 키를 막는다', async () => {
  await expect(checkApiKey('키', { taken: [], target: null }, depsOf([메이플ID('m-a')], 'developmentStage'))).resolves.toEqual({
    outcome: 'rejected',
    reason: 'developmentStage',
  })
  await expect(checkApiKey('키', { taken: [], target: null }, depsOf([]))).resolves.toEqual({ outcome: 'rejected', reason: 'noMapleId' })
})

it('메이플 ID 가 다른 등록된 계정과 하나라도 겹치면 이미 등록된 계정이다', async () => {
  const deps = depsOf([메이플ID('m-new'), 메이플ID('m-login')])

  await expect(checkApiKey('키', { taken: [h('m-login')], target: null }, deps)).resolves.toEqual({
    outcome: 'rejected',
    reason: 'alreadyRegistered',
  })
})

// 바꾸는 계정은 겹침에서 뺀 채 넘어온다. 그 계정과는 오히려 겹쳐야 같은 넥슨 계정이다.
it('변경 · 입력은 그 계정의 메이플 ID 와 하나도 겹치지 않으면 다른 계정의 키다', async () => {
  const deps = depsOf([메이플ID('m-a'), 메이플ID('m-new')])

  await expect(checkApiKey('키', { taken: [], target: [h('m-a')] }, deps)).resolves.toMatchObject({ outcome: 'ok' })
  await expect(checkApiKey('키', { taken: [], target: [h('m-z')] }, deps)).resolves.toEqual({
    outcome: 'rejected',
    reason: 'otherAccount',
  })
})
