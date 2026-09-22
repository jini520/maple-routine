jest.mock('../fee-context', () => ({ loadFeeContext: jest.fn() }))

import { renderHook, waitFor } from '@testing-library/react-native'

import { loadFeeContext } from '../fee-context'
import { useAutoFee, useMvpGradeStore } from '../store'

const loadMock = loadFeeContext as jest.Mock

const CONTEXT = {
  histories: new Map([['A', [{ startDate: '2026-08-06', grade: 'diamond' }]]]),
  sightings: [{ ocid: 'a1', name: '에이', accountId: 'A', firstSeenOn: '2026-06-01', lastSeenOn: '2026-09-22' }],
  fallbackOcid: 'a1',
}

beforeEach(() => {
  loadMock.mockReset().mockResolvedValue(CONTEXT)
  useMvpGradeStore.setState({ context: null, loading: false })
})

describe('useAutoFee', () => {
  it('처음 쓰면 등급 기록을 읽고, 그 캐릭터 · 날짜의 등급과 요율을 준다', async () => {
    const { result } = await renderHook(() => useAutoFee('a1', '2026-08-10'))

    await waitFor(() => expect(result.current).toEqual({ grade: 'diamond', percent: 3 }))
    expect(loadMock).toHaveBeenCalledTimes(1)
  })

  it('등급이 없으면 일반 명패와 일반 요율이다', async () => {
    const { result } = await renderHook(() => useAutoFee('a1', '2026-07-01'))

    await waitFor(() => expect(result.current).toEqual({ grade: 'normal', percent: 5 }))
  })

  it('캐릭터를 고르기 전에는 없다', async () => {
    const { result } = await renderHook(() => useAutoFee(null, '2026-08-10'))

    await waitFor(() => expect(useMvpGradeStore.getState().context).not.toBeNull())
    expect(result.current).toBeNull()
  })
})

describe('reload', () => {
  it('등급 기록이 바뀐 뒤 다시 읽는다', async () => {
    await useMvpGradeStore.getState().load()
    loadMock.mockResolvedValue({ ...CONTEXT, histories: new Map() })

    await useMvpGradeStore.getState().reload()

    expect(useMvpGradeStore.getState().context?.histories.size).toBe(0)
  })
})
