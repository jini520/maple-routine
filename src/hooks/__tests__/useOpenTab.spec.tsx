// `popToTop` 은 **바닥에서 무동작이 아니다.** 뺄 것이 없으면 라우터가 그 액션을 처리하지 않고
// 위로 넘기고, 아무도 안 받으면 개발 모드에서 `not handled by any navigator` 경고가 뜬다.
// today 위젯 타일을 누를 때 실제로 났다(그 타일이 그룹 층 페이지로 가는 길이다).
import { act, renderHook } from '@testing-library/react-native'

import { StackActions } from '@react-navigation/native'

import { useOpenTab } from '../useOpenTab'

// 팩토리는 import 위로 끌어올려져 밖의 값을 못 본다. `mock` 접두사만 예외다.
const mockNavigate = jest.fn()
const mockLayerDispatch = jest.fn()
const mockGetParent = jest.fn()

jest.mock('../useScreenNavigation', () => ({
  useScreenNavigation: () => ({ navigate: mockNavigate, getParent: mockGetParent }),
}))

/** 층 스택에 라우트가 `depth` 개 쌓여 있는 상태. */
function 층깊이(depth: number): void {
  mockGetParent.mockReturnValue({
    getState: () => ({ routes: Array.from({ length: depth }, (_, index) => ({ key: `r${index}` })) }),
    dispatch: mockLayerDispatch,
  })
}

beforeEach(() => {
  mockNavigate.mockClear()
  mockLayerDispatch.mockClear()
  mockGetParent.mockReset()
  층깊이(1)
})

// **await 해야 한다.** 이 저장소의 렌더는 NativeWind 배선이 비동기로 감싼다. 안 기다리면
// 훅 본문이 한 줄도 안 돌아 모든 단언이 0회 호출로 조용히 실패한다.
async function 열기(page: Parameters<ReturnType<typeof useOpenTab>>[0]): Promise<void> {
  const { result } = await renderHook(() => useOpenTab())
  await act(async () => {
    result.current(page)
  })
}

describe('그룹 층 페이지로 갈 때', () => {
  it('하위 층에 서 있으면 층을 먼저 되돌린다', async () => {
    층깊이(2)

    await 열기('Today')

    expect(mockLayerDispatch).toHaveBeenCalledWith(StackActions.popToTop())
  })

  // 여기가 경고가 나던 자리다. 바닥에서 부르면 아무도 안 받는다.
  it('이미 바닥이면 안 되돌린다', async () => {
    층깊이(1)

    await 열기('Today')

    expect(mockLayerDispatch).not.toHaveBeenCalled()
  })

  it('층 스택을 못 찾아도 던지지 않는다', async () => {
    mockGetParent.mockReturnValue(undefined)

    await expect(열기('Today')).resolves.toBeUndefined()
    expect(mockNavigate).toHaveBeenCalled()
  })
})

describe('하위 층 페이지로 갈 때', () => {
  // 그 이동은 한 단 내려가는 것이라 되돌릴 이유가 없다.
  it('깊이와 무관하게 안 되돌린다', async () => {
    층깊이(2)

    await 열기('Boss')

    expect(mockLayerDispatch).not.toHaveBeenCalled()
  })
})

it('되돌리든 아니든 이동은 언제나 한다', async () => {
  층깊이(2)

  await 열기('Today')

  expect(mockNavigate).toHaveBeenCalledWith(
    'Main',
    {
      screen: 'Groups',
      params: { screen: 'Today' },
    },
    { pop: true },
  )
})

// react-navigation 7 의 `navigate` 는 이동할 화면이 맨 위가 아니면 새로 쌓는다. 하위 페이지(거래 내역 · 컨텐츠 관리 · 보스 관리)에서
// 부르면 `Main` 이 통째로 하나 더 쌓여, 아래에 남은 하위 페이지와 앱 전체가 계속 그려지고 부를수록 느려졌다(아이폰 계측).
it('하위 페이지에서 불러도 새로 쌓지 않고 아래의 `Main` 으로 되돌아간다', async () => {
  await 열기('Cashbook')

  expect(mockNavigate).toHaveBeenCalledWith('Main', expect.anything(), { pop: true })
})
