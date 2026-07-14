// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterBasicProfile, MapleAccount } from '../../../types'

const { getAuthConfigMock } = vi.hoisted(() => ({
  getAuthConfigMock: vi.fn(),
}))
vi.mock('../../../storage/api-key', () => ({
  getAuthConfig: getAuthConfigMock,
}))

const { fetchCharacterBasicMock } = vi.hoisted(() => ({
  fetchCharacterBasicMock: vi.fn(),
}))
vi.mock('../../../nexon/character', () => ({
  fetchCharacterBasic: fetchCharacterBasicMock,
}))

import { useRepresentativePortraits } from '../use-representative-portraits'

function profile(overrides: Partial<CharacterBasicProfile> = {}): CharacterBasicProfile {
  return { name: '낟낟', level: 293, imageUrl: 'https://example.com/1.png', accessFlag: true, ...overrides }
}

const accounts: MapleAccount[] = [
  {
    accountId: 'account-1',
    characters: [{ ocid: 'ocid-1', name: '낟낟', world: '엘리시움', jobClass: '렌', level: 293 }],
  },
  {
    accountId: 'account-2',
    characters: [
      { ocid: 'ocid-2', name: '내옆에최성일', world: '베라', jobClass: '아크메이지(썬,콜)', level: 211 },
    ],
  },
]

beforeEach(() => {
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('useRepresentativePortraits', () => {
  it('계정별 대표 캐릭터의 character/basic을 조회해 accountId별 imageUrl 맵을 반환한다', async () => {
    fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) =>
      profile({ imageUrl: `https://example.com/${ocid}.png` }),
    )

    const { result } = renderHook(() => useRepresentativePortraits(accounts))

    await waitFor(() => {
      expect(result.current['account-1']).toBe('https://example.com/ocid-1.png')
      expect(result.current['account-2']).toBe('https://example.com/ocid-2.png')
    })

    expect(fetchCharacterBasicMock).toHaveBeenCalledWith('key-1', 'ocid-1')
    expect(fetchCharacterBasicMock).toHaveBeenCalledWith('key-1', 'ocid-2')
  })

  it('여러 캐릭터 중 대표 캐릭터(레벨 최고)의 ocid로만 조회한다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile())

    const multiCharacterAccount: MapleAccount = {
      accountId: 'account-3',
      characters: [
        { ocid: 'low', name: '부캐', world: '엘리시움', jobClass: '나이트로드', level: 150 },
        { ocid: 'high', name: '본캐', world: '엘리시움', jobClass: '렌', level: 293 },
      ],
    }

    renderHook(() => useRepresentativePortraits([multiCharacterAccount]))

    await waitFor(() => {
      expect(fetchCharacterBasicMock).toHaveBeenCalledWith('key-1', 'high')
    })
    expect(fetchCharacterBasicMock).not.toHaveBeenCalledWith('key-1', 'low')
  })

  it('조회가 실패한 계정은 null로 표시한다', async () => {
    fetchCharacterBasicMock.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useRepresentativePortraits([accounts[0]]))

    await waitFor(() => {
      expect(result.current['account-1']).toBeNull()
    })
  })

  it('저장된 인증 정보가 없으면 API를 호출하지 않는다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    renderHook(() => useRepresentativePortraits(accounts))

    await waitFor(() => {
      expect(getAuthConfigMock).toHaveBeenCalled()
    })
    expect(fetchCharacterBasicMock).not.toHaveBeenCalled()
  })
})
