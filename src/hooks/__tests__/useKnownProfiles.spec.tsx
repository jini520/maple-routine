// 이름·레벨·얼굴 표를 어디서 모으는가.
//
// 가르기 전에는 이 규칙 둘이 컨트롤러 안에 있어서 직접 물을 자리가 없었다. **캐시가 이긴다**와
// **miss 는 적지 않는다**가 그것이고, 뒤엣것은 어기면 **아직 모른다** 가 **그런 것은 없다** 로
// 굳는다.
import { renderHook, waitFor } from '@testing-library/react-native'

import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getScheduleProbeLedger } from '../../storage/schedule-probe-ledger'
import type { CharacterPickerEntry } from '../../types'
import { useKnownProfiles, type KnownProfiles } from '../useKnownProfiles'

jest.mock('../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: jest.fn(),
}))
jest.mock('../../storage/schedule-probe-ledger', () => ({
  getScheduleProbeLedger: jest.fn(),
}))

const 캐시읽기 = getCachedCharacterBasic as jest.MockedFunction<typeof getCachedCharacterBasic>
const 원장읽기 = getScheduleProbeLedger as jest.MockedFunction<typeof getScheduleProbeLedger>

function 캐시본(name: string, level: number) {
  return {
    profile: { name, level, imageUrl: `https://cache/${name}`, world: '엘리시움' },
    cachedAt: '2026-09-03T00:00:00.000Z',
  } as Awaited<ReturnType<typeof getCachedCharacterBasic>>
}

function 후보(ocid: string, name: string, level: number): CharacterPickerEntry {
  return { ocid, name, level, imageUrl: `https://roster/${name}`, world: '스카니아' }
}

async function 표(input: { ocids: string[]; fallbackEntries?: CharacterPickerEntry[] }) {
  const view = await renderHook<
    KnownProfiles,
    { ocids: string[]; fallbackEntries: CharacterPickerEntry[] }
  >(({ ocids, fallbackEntries }) => useKnownProfiles({ ocids, fallbackEntries }), {
    initialProps: { ocids: input.ocids, fallbackEntries: input.fallbackEntries ?? [] },
  })
  return view
}

beforeEach(() => {
  jest.clearAllMocks()
  캐시읽기.mockResolvedValue(null)
  원장읽기.mockResolvedValue({ unavailable: false } as Awaited<ReturnType<typeof getScheduleProbeLedger>>)
})

describe('두 곳에서 모은다', () => {
  it('캐시에 있으면 그 값을 쓴다', async () => {
    캐시읽기.mockResolvedValue(캐시본('낟낟', 294))
    const { result } = await 표({ ocids: ['a1'] })

    await waitFor(() => expect(result.current.knownProfiles.get('a1')?.name).toBe('낟낟'))
    expect(result.current.knownProfiles.get('a1')?.level).toBe(294)
  })

  it('캐시가 모르면 이미 받아 둔 후보가 채운다', async () => {
    const { result } = await 표({ ocids: ['a1'], fallbackEntries: [후보('a1', '젓눈', 278)] })

    await waitFor(() => expect(result.current.knownProfiles.get('a1')?.name).toBe('젓눈'))
    expect(result.current.knownProfiles.get('a1')?.imageUrl).toBe('https://roster/젓눈')
  })

  it('둘 다 있으면 **캐시가 이긴다**', async () => {
    캐시읽기.mockResolvedValue(캐시본('낟낟', 294))
    const { result } = await 표({ ocids: ['a1'], fallbackEntries: [후보('a1', '옛이름', 1)] })

    await waitFor(() => expect(result.current.knownProfiles.get('a1')?.name).toBe('낟낟'))
    expect(result.current.knownProfiles.get('a1')?.imageUrl).toBe('https://cache/낟낟')
  })

  it('요구하지 않은 후보도 표에 들어간다. 이미 온 응답을 버리지 않는다', async () => {
    const { result } = await 표({ ocids: ['a1'], fallbackEntries: [후보('b9', '남는캐', 200)] })

    await waitFor(() => expect(result.current.knownProfiles.get('b9')?.name).toBe('남는캐'))
  })
})

describe('아직 모르는 것과 그런 것은 없는 것을 가른다', () => {
  it('양쪽 다 모르면 **표에 안 들어간다**. 그것이 아직 모른다 의 모양이다', async () => {
    const { result } = await 표({ ocids: ['a1'] })

    await waitFor(() => expect(캐시읽기).toHaveBeenCalledWith('a1'))

    expect(result.current.knownProfiles.has('a1')).toBe(false)
  })

  it('**miss 는 적지 않는다.** 캐시가 늦게 채워지면 그 값이 잡힌다', async () => {
    const { result, rerender } = await 표({ ocids: ['a1'] })
    await waitFor(() => expect(캐시읽기).toHaveBeenCalledWith('a1'))

    // 그 사이에 캐시가 채워졌다. 같은 ocid 를 다시 요구하면 이번에는 읽어 온다.
    캐시읽기.mockResolvedValue(캐시본('늦게온이름', 250))
    await rerender({ ocids: ['a1', 'a2'], fallbackEntries: [] })

    await waitFor(() => expect(result.current.knownProfiles.get('a1')?.name).toBe('늦게온이름'))
  })

  it('캐시 읽기가 던져도 표가 선다', async () => {
    캐시읽기.mockRejectedValue(new Error('캐시 실패'))
    const { result } = await 표({ ocids: ['a1'], fallbackEntries: [후보('a1', '젓눈', 278)] })

    await waitFor(() => expect(result.current.knownProfiles.get('a1')?.name).toBe('젓눈'))
  })
})

describe('조회 불가', () => {
  it('원장이 표시한 캐릭터가 집합에 들어간다', async () => {
    원장읽기.mockResolvedValue({ unavailable: true } as Awaited<
      ReturnType<typeof getScheduleProbeLedger>
    >)
    const { result } = await 표({ ocids: ['a1'] })

    await waitFor(() => expect(result.current.unavailableOcids.has('a1')).toBe(true))
  })

  it('표시가 없으면 비어 있다', async () => {
    const { result } = await 표({ ocids: ['a1'] })

    await waitFor(() => expect(원장읽기).toHaveBeenCalled())
    expect(result.current.unavailableOcids.size).toBe(0)
  })

  it('원장이 던져도 조회 불가로 몰지 않는다', async () => {
    원장읽기.mockRejectedValue(new Error('원장 실패'))
    const { result } = await 표({ ocids: ['a1'] })

    await waitFor(() => expect(원장읽기).toHaveBeenCalled())
    expect(result.current.unavailableOcids.size).toBe(0)
  })
})

describe('회차', () => {
  it('같은 ocid 를 다시 요구해도 다시 읽지 않는다', async () => {
    캐시읽기.mockResolvedValue(캐시본('낟낟', 294))
    const { result, rerender } = await 표({ ocids: ['a1'] })
    await waitFor(() => expect(result.current.knownProfiles.get('a1')?.name).toBe('낟낟'))

    await rerender({ ocids: ['a1'], fallbackEntries: [] })

    expect(캐시읽기).toHaveBeenCalledTimes(1)
  })

  it('같은 ocid 가 두 번 들어와도 한 번만 읽는다', async () => {
    await 표({ ocids: ['a1', 'a1'] })

    await waitFor(() => expect(캐시읽기).toHaveBeenCalledWith('a1'))

    expect(캐시읽기).toHaveBeenCalledTimes(1)
  })
})
