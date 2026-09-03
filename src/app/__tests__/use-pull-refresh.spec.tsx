// 당김 인디케이터가 누구 것인가.
//
// `refreshing = status === 'loading'` 은 사용자의 당김만 세우는 것이 아니라 화면 마운트
// 하이드레이션과 헤더 버튼도 함께 세운다. 그래서 탭을 옮기기만 해도 인디케이터가 프로그램적으로
// 열린다.

import { act, renderHook, waitFor } from '@testing-library/react-native'

import { usePullRefresh } from '../use-pull-refresh'

describe('usePullRefresh', () => {
  it('당기기 전에는 돌지 않는다', async () => {
    const { result } = await renderHook(() => usePullRefresh(async () => undefined))

    expect(result.current.refreshing).toBe(false)
  })

  it('당기면 돌기 시작하고, 회차가 끝나면 멈춘다', async () => {
    let 회차_끝내기 = (): void => undefined
    const 회차 = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          회차_끝내기 = resolve
        }),
    )
    const { result } = await renderHook(() => usePullRefresh(회차))

    await act(async () => {
      result.current.onRefresh()
    })
    expect(회차).toHaveBeenCalled()
    expect(result.current.refreshing).toBe(true)

    await act(async () => {
      회차_끝내기()
    })
    expect(result.current.refreshing).toBe(false)
  })

  // 회차가 실패해도 인디케이터는 닫혀야 한다. 안 닫으면 **상단이 빈 채로 멈춘다** 가 실패 경로에서
  // 그대로 재현된다(실패 자체는 토스트가 말한다).
  it('회차가 실패해도 멈춘다', async () => {
    const { result } = await renderHook(() =>
      usePullRefresh(async () => {
        throw new Error('조회 실패')
      }),
    )

    await act(async () => {
      result.current.onRefresh()
    })

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false)
    })
  })
})
