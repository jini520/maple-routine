// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { CharacterBasicProfile, MapleAccount } from '@core/types'

const { getAuthConfigMock } = vi.hoisted(() => ({ getAuthConfigMock: vi.fn() }))
vi.mock('../../../storage/api-key', () => ({ getAuthConfig: getAuthConfigMock }))

const { fetchCharacterBasicMock } = vi.hoisted(() => ({ fetchCharacterBasicMock: vi.fn() }))
vi.mock('@core/nexon/character', () => ({ fetchCharacterBasic: fetchCharacterBasicMock }))

// 캐시는 목이 아니라 **실제 어댑터**를 쓴다 — ADR-113 결정 2가 정한 것은 "쓴다"가 아니라
// "**그 캐릭터가 속한 계정의 accountId 로** 쓴다"이고, 계정별 인덱스(ADR-086 결정 9)를 통과해야
// 그것을 확인할 수 있다. 인메모리 Preferences 목은 sibling character-basic-fetch.test.ts 관례다.

import { NexonBadRequestError, NexonNetworkError, NexonRateLimitError } from '@core/nexon/errors'
import {
  getAllCachedCharacterBasicOcids,
  setCachedCharacterBasic,
} from '../../../storage/character-basic-cache'
import { useAccountProbes } from '../use-account-probes'

function profile(overrides: Partial<CharacterBasicProfile> = {}): CharacterBasicProfile {
  return { name: '낟낟', level: 293, imageUrl: 'https://example.com/1.png', accessFlag: true, ...overrides }
}

// 최고 레벨(300)이 조회 불가, 그다음(250)이 정상인 계정 — ADR-068 결정 4의 핵심 케이스다.
const accounts: MapleAccount[] = [
  {
    accountId: 'account-1',
    characters: [
      { ocid: 'ocid-top', name: '조회불가최고레벨', world: '베라', jobClass: '렌', level: 300 },
      { ocid: 'ocid-next', name: '정상차상위', world: '엘리시움', jobClass: '비숍', level: 250 },
    ],
  },
]

// 계정 2개 — 캐시 쓰기가 "그 캐릭터가 속한 계정"으로 갈리는지 보려면 계정이 둘 이상이어야 한다.
const twoAccounts: MapleAccount[] = [
  {
    accountId: 'account-1',
    characters: [{ ocid: 'ocid-a1', name: '일번캐', world: '베라', jobClass: '렌', level: 260 }],
  },
  {
    accountId: 'account-2',
    characters: [
      { ocid: 'ocid-b1', name: '이번캐', world: '엘리시움', jobClass: '비숍', level: 280 },
      { ocid: 'ocid-b2', name: '이번부캐', world: '엘리시움', jobClass: '나이트로드', level: 150 },
    ],
  },
]

// renderHook 콜백 안에서 배열 리터럴을 만들면 렌더마다 참조가 바뀌어 effect 가 무한히 재실행된다.
const noAccounts: MapleAccount[] = []

beforeEach(async () => {
  installFakePreferences()
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useAccountProbes', () => {
  it('계정의 전체 캐릭터를 프로브한다 — 표본 1명으로는 계정 전체를 단정할 수 없다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile())

    renderHook(() => useAccountProbes(accounts))

    await waitFor(() => expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(2))
    expect(fetchCharacterBasicMock).toHaveBeenCalledWith('key-1', 'ocid-top')
    expect(fetchCharacterBasicMock).toHaveBeenCalledWith('key-1', 'ocid-next')
  })

  it('최고 레벨이 조회 불가면 조회 가능한 캐릭터 중 최고 레벨을 대표로 세운다', async () => {
    fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
      if (ocid === 'ocid-top') throw new NexonBadRequestError('조회 불가', 'OPENAPI00003')
      return profile({ name: '정상차상위', level: 250, imageUrl: 'https://example.com/next.png' })
    })

    const { result } = renderHook(() => useAccountProbes(accounts))

    await waitFor(() => expect(result.current.probes['account-1']).toBeDefined())
    expect(result.current.probes['account-1'].representative?.ocid).toBe('ocid-next')
    expect(result.current.probes['account-1'].portraitUrl).toBe('https://example.com/next.png')
    expect(result.current.probes['account-1'].verdict).toEqual({ kind: 'queryable' })
  })

  it('전원 조회 불가면 대표가 없고 판정은 allUnavailable이다', async () => {
    fetchCharacterBasicMock.mockRejectedValue(new NexonBadRequestError('조회 불가', 'OPENAPI00003'))

    const { result } = renderHook(() => useAccountProbes(accounts))

    await waitFor(() => expect(result.current.probes['account-1']).toBeDefined())
    expect(result.current.probes['account-1'].representative).toBeNull()
    expect(result.current.probes['account-1'].verdict).toEqual({ kind: 'allUnavailable' })
  })

  // ADR-116 결정 3: 003 이 아닌 실패는 "확인하지 못했다"이지 "괜찮다"가 아니다. 전에는 catch가
  // characterUnavailable만 담고 나머지를 버려서, 아무것도 못 본 캐릭터가 전부 "조회 가능"으로
  // 분류되고 allUnavailable이 **항상 false**가 됐다(위양성이 아니라 위음성 — 이슈 #177).
  describe('판정 불가 (ADR-116 결정 3)', () => {
    it('429는 판정 불가이고 allUnavailable이 false로 위장되지 않는다', async () => {
      fetchCharacterBasicMock.mockRejectedValue(new NexonRateLimitError('429'))

      const { result } = renderHook(() => useAccountProbes(accounts))

      await waitFor(() => expect(result.current.probes['account-1']).toBeDefined())
      expect(result.current.probes['account-1'].verdict).toEqual({
        kind: 'undetermined',
        error: { kind: 'rateLimited' },
      })
    })

    // ADR-068 결정 4 회귀 가드: 대표 후보는 **성공적으로 확인된 캐릭터**뿐이다. 429로 아무것도 못 본
    // 캐릭터가 후보로 남으면 그 ADR이 전수 프로브로 없앤 "조회 불가 캐릭터가 계정 표기가 된다"가
    // 429 경로로 되살아난다.
    it('429로 확인하지 못한 캐릭터는 대표로 뽑히지 않는다', async () => {
      fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
        if (ocid === 'ocid-top') throw new NexonRateLimitError('429')
        return profile({ name: '정상차상위', level: 250, imageUrl: 'https://example.com/next.png' })
      })

      const { result } = renderHook(() => useAccountProbes(accounts))

      await waitFor(() => expect(result.current.probes['account-1']).toBeDefined())
      expect(result.current.probes['account-1'].representative?.ocid).toBe('ocid-next')
      // 확인한 캐릭터가 있어도 못 본 캐릭터가 남았으면 그 계정은 여전히 판정 불가다.
      expect(result.current.probes['account-1'].verdict.kind).toBe('undetermined')
    })

    // 429만이 아니라 003이 아닌 **모든** 실패를 하나로 묶는다(사용자 결정) — 어느 쪽이든 그 계정에
    // 대해 알아낸 것이 없다는 사실은 같다.
    it('네트워크 실패도 판정 불가다', async () => {
      fetchCharacterBasicMock.mockRejectedValue(new NexonNetworkError('offline'))

      const { result } = renderHook(() => useAccountProbes(accounts))

      await waitFor(() => expect(result.current.probes['account-1']).toBeDefined())
      expect(result.current.probes['account-1'].representative).toBeNull()
      expect(result.current.probes['account-1'].portraitUrl).toBeNull()
      expect(result.current.probes['account-1'].verdict).toEqual({
        kind: 'undetermined',
        error: { kind: 'network' },
      })
    })

    it('성공과 003만 있으면 판정 불가가 아니다', async () => {
      fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
        if (ocid === 'ocid-top') throw new NexonBadRequestError('조회 불가', 'OPENAPI00003')
        return profile()
      })

      const { result } = renderHook(() => useAccountProbes(accounts))

      await waitFor(() => expect(result.current.probes['account-1']).toBeDefined())
      expect(result.current.probes['account-1'].verdict).toEqual({ kind: 'queryable' })
    })

    it('retry 는 프로브를 처음부터 다시 돈다', async () => {
      fetchCharacterBasicMock.mockRejectedValue(new NexonNetworkError('offline'))

      const { result } = renderHook(() => useAccountProbes(accounts))

      await waitFor(() => expect(result.current.isSettled).toBe(true))
      fetchCharacterBasicMock.mockResolvedValue(profile())

      act(() => {
        result.current.retry()
      })

      await waitFor(() => expect(result.current.probes['account-1']?.verdict.kind).toBe('queryable'))
      expect(result.current.progress).toEqual({ completed: 2, total: 2 })
    })
  })

  it('API 키가 없으면 아무것도 호출하지 않는다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    renderHook(() => useAccountProbes(accounts))

    await waitFor(() => expect(getAuthConfigMock).toHaveBeenCalled())
    expect(fetchCharacterBasicMock).not.toHaveBeenCalled()
  })

  // ADR-113 결정 2: 전에는 결과를 버렸다 — 캐시 인덱스가 전역이던 시절 다른 계정 캐릭터가
  // 피커의 stub 단계로 새어 나올까 봐서다. ADR-086 결정 9가 인덱스를 계정별로 쪼갠 뒤로는
  // 누출이 구조적으로 불가능하다.
  describe('프로브 결과를 캐시에 쓴다 (ADR-113 결정 2)', () => {
    it('각 캐릭터가 **속한 계정**의 accountId 로 들어간다 — 다른 계정 인덱스를 오염시키지 않는다', async () => {
      fetchCharacterBasicMock.mockResolvedValue(profile())

      const { result } = renderHook(() => useAccountProbes(twoAccounts))

      await waitFor(() => expect(result.current.isSettled).toBe(true))

      await expect(getAllCachedCharacterBasicOcids('account-1')).resolves.toEqual(['ocid-a1'])
      const second = await getAllCachedCharacterBasicOcids('account-2')
      expect([...second].sort()).toEqual(['ocid-b1', 'ocid-b2'])
    })

    it('이미 TTL 안에 캐시된 ocid 는 네트워크를 타지 않는다 — 공유 가드를 통과한다', async () => {
      await setCachedCharacterBasic('account-1', 'ocid-top', {
        profile: profile({ imageUrl: 'https://example.com/cached.png' }),
        cachedAt: new Date().toISOString(),
      })
      fetchCharacterBasicMock.mockResolvedValue(profile())

      const { result } = renderHook(() => useAccountProbes(accounts))

      await waitFor(() => expect(result.current.isSettled).toBe(true))

      expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(1)
      expect(fetchCharacterBasicMock).toHaveBeenCalledWith('key-1', 'ocid-next')
    })
  })

  // ADR-113 결정 4: 완료 판정은 "성공"이 아니라 settle 이다. 성공 기준으로 두면 아래 경로에서
  // 화면이 영원히 로딩이 된다(결정 3이 목록을 이 플래그 뒤로 미루므로).
  describe('settle 판정 (ADR-113 결정 4)', () => {
    it('API 키가 없어 프로브가 시작조차 못 해도 대기가 끝난다', async () => {
      getAuthConfigMock.mockResolvedValue(null)

      const { result } = renderHook(() => useAccountProbes(accounts))

      await waitFor(() => expect(result.current.isSettled).toBe(true))
      expect(fetchCharacterBasicMock).not.toHaveBeenCalled()
    })

    it('계정이 0개여도 대기가 끝나고 진행률은 0/0 이다', async () => {
      const { result } = renderHook(() => useAccountProbes(noAccounts))

      await waitFor(() => expect(result.current.isSettled).toBe(true))
      expect(result.current.progress).toEqual({ completed: 0, total: 0 })
    })

    it('개별 프로브가 전부 실패해도 대기가 끝나고 실패도 진행률을 올린다', async () => {
      fetchCharacterBasicMock.mockRejectedValue(new NexonNetworkError('offline'))

      const { result } = renderHook(() => useAccountProbes(accounts))

      await waitFor(() => expect(result.current.isSettled).toBe(true))
      expect(result.current.progress).toEqual({ completed: 2, total: 2 })
    })
  })

  // ADR-113 결정 5: 시작 시점에 총량을 알 수 있어 진행률을 정확히 그릴 수 있다.
  describe('진행률 (ADR-113 결정 5)', () => {
    it('total 은 전 계정 캐릭터 수의 합이고 첫 렌더부터 정확하다', () => {
      fetchCharacterBasicMock.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useAccountProbes(twoAccounts))

      expect(result.current.progress).toEqual({ completed: 0, total: 3 })
    })

    it('completed 는 계정이 아니라 캐릭터 단위로 오른다', async () => {
      fetchCharacterBasicMock.mockResolvedValue(profile())

      const { result } = renderHook(() => useAccountProbes(twoAccounts))

      await waitFor(() => expect(result.current.isSettled).toBe(true))
      expect(result.current.progress).toEqual({ completed: 3, total: 3 })
    })
  })

  it('accounts 가 바뀌면 이전 실행의 결과를 버리고 다시 대기 상태가 된다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile())

    const { result, rerender } = renderHook(
      (props: { accounts: MapleAccount[] }) => useAccountProbes(props.accounts),
      { initialProps: { accounts } },
    )

    await waitFor(() => expect(result.current.isSettled).toBe(true))
    expect(result.current.probes['account-1']).toBeDefined()

    // 두 번째 목록은 응답이 오지 않게 해 전환 직후 상태를 관찰한다.
    fetchCharacterBasicMock.mockImplementation(() => new Promise(() => {}))
    rerender({ accounts: twoAccounts })

    expect(result.current.isSettled).toBe(false)
    expect(result.current.probes).toEqual({})
    expect(result.current.progress).toEqual({ completed: 0, total: 3 })
  })
})
