// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterBasicProfile, MapleAccount } from '../../../types'

const { getAuthConfigMock } = vi.hoisted(() => ({ getAuthConfigMock: vi.fn() }))
vi.mock('../../../storage/api-key', () => ({ getAuthConfig: getAuthConfigMock }))

const { fetchCharacterBasicMock } = vi.hoisted(() => ({ fetchCharacterBasicMock: vi.fn() }))
vi.mock('../../../nexon/character', () => ({ fetchCharacterBasic: fetchCharacterBasicMock }))

import { NexonBadRequestError, NexonNetworkError } from '../../../nexon/errors'
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

beforeEach(() => {
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

    await waitFor(() => expect(result.current['account-1']).toBeDefined())
    expect(result.current['account-1'].representative?.ocid).toBe('ocid-next')
    expect(result.current['account-1'].portraitUrl).toBe('https://example.com/next.png')
    expect(result.current['account-1'].allUnavailable).toBe(false)
  })

  it('전원 조회 불가면 대표가 없고 allUnavailable이 true다', async () => {
    fetchCharacterBasicMock.mockRejectedValue(new NexonBadRequestError('조회 불가', 'OPENAPI00003'))

    const { result } = renderHook(() => useAccountProbes(accounts))

    await waitFor(() => expect(result.current['account-1']).toBeDefined())
    expect(result.current['account-1'].representative).toBeNull()
    expect(result.current['account-1'].allUnavailable).toBe(true)
  })

  it('네트워크 실패는 영구로 단정하지 않는다 — 후보 자격을 유지하고 초상화만 비운다', async () => {
    fetchCharacterBasicMock.mockRejectedValue(new NexonNetworkError('offline'))

    const { result } = renderHook(() => useAccountProbes(accounts))

    await waitFor(() => expect(result.current['account-1']).toBeDefined())
    expect(result.current['account-1'].representative?.ocid).toBe('ocid-top')
    expect(result.current['account-1'].portraitUrl).toBeNull()
    expect(result.current['account-1'].allUnavailable).toBe(false)
  })

  it('API 키가 없으면 아무것도 호출하지 않는다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    renderHook(() => useAccountProbes(accounts))

    await waitFor(() => expect(getAuthConfigMock).toHaveBeenCalled())
    expect(fetchCharacterBasicMock).not.toHaveBeenCalled()
  })
})
