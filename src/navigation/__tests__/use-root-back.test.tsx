// 탭 최상위의 뒤로가기 — [[ADR-120]] 결정 18(**묻지 않고 백그라운드로**).
//
// 훅에서 시작해 포트를 지나 네이티브 모듈까지 **한 사슬로** 검사한다. 훅만 따로 보면 "불렀다"까지만
// 알 수 있고, 어느 포트에 무엇이 들어갔는지가 뒤바뀌어도 통과한다.
import { act, render } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import { setBackGesturePort, __resetNativePortsForTest } from '@core/native/ports'

import { useRootBackToBackground, type RootBackNavigation } from '../use-root-back'
import { registerBarBackHandler, resetBarStoreForTests } from '../bar-store'
import { rnBackGesturePort } from '../../native/adapters/rn-back-gesture'

// `mock` 접두사는 jest 규칙이다 — `jest.mock()` 팩토리는 호이스팅돼 모듈 평가보다 먼저 돌기 때문에
// 바깥 변수 참조를 막고, 그 접두사만 예외로 둔다.
const mockMoveToBackground = jest.fn(async () => {})

jest.mock('../../../modules/app-background', () => ({
  __esModule: true,
  default: { moveToBackground: () => mockMoveToBackground() },
}))

/** 등록된 `hardwareBackPress` 리스너를 잡아 눌러 보기 위한 스파이. */
function captureBackHandler(): () => boolean | null | undefined {
  let handler: (() => boolean | null | undefined) | undefined
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation(((_event: string, callback: () => boolean | null | undefined) => {
      handler = callback
      return { remove: jest.fn() }
    }) as unknown as typeof BackHandler.addEventListener)

  return () => {
    if (handler === undefined) throw new Error('hardwareBackPress 리스너가 등록되지 않았다')
    return handler()
  }
}

function Harness({ navigation }: { navigation: RootBackNavigation }): null {
  useRootBackToBackground(navigation)
  return null
}

beforeEach(() => {
  mockMoveToBackground.mockClear()
  resetBarStoreForTests()
  __resetNativePortsForTest()
  setBackGesturePort(rnBackGesturePort)
})

afterEach(() => {
  jest.restoreAllMocks()
  resetBarStoreForTests()
  __resetNativePortsForTest()
})

describe('useRootBackToBackground ([[ADR-120]] 결정 18)', () => {
  it('더 pop 할 것이 없으면 백그라운드로 보내고 뒤로가기를 삼킨다', async () => {
    const pressBack = captureBackHandler()
    await render(<Harness navigation={{ isReady: () => true, canGoBack: () => false }} />)

    // `true` 를 돌려주는 것이 곧 "기본 동작(액티비티 종료)을 막았다"이다 — 이 값이 `false` 로
    // 바뀌면 앱이 끝나고 다음 실행이 콜드 스타트가 된다(결정 18 이 거부한 바로 그 대가).
    expect(pressBack()).toBe(true)
    expect(mockMoveToBackground).toHaveBeenCalledTimes(1)
  })

  // 하위 페이지가 열려 있으면 react-navigation 이 pop 한다. 우리가 `false` 를 돌려줘야 그쪽 차례가
  // 온다 — 여기서 `true` 를 돌려주면 **뒤로가기가 통째로 먹통**이 되고, 백그라운드로 나가 버린다.
  it('pop 할 것이 있으면 가로채지 않는다', async () => {
    const pressBack = captureBackHandler()
    await render(<Harness navigation={{ isReady: () => true, canGoBack: () => true }} />)

    expect(pressBack()).toBe(false)
    expect(mockMoveToBackground).not.toHaveBeenCalled()
  })

  it('컨테이너가 준비되기 전에는 판정하지 않는다', async () => {
    const pressBack = captureBackHandler()
    await render(<Harness navigation={{ isReady: () => false, canGoBack: () => false }} />)

    expect(pressBack()).toBe(false)
    expect(mockMoveToBackground).not.toHaveBeenCalled()
  })

  it('언마운트하면 리스너를 뗀다', async () => {
    const remove = jest.fn()
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((() => ({ remove })) as unknown as typeof BackHandler.addEventListener)

    const view = await render(
      <Harness navigation={{ isReady: () => true, canGoBack: () => false }} />,
    )
    // effect 정리는 커밋의 일부라 `act` 를 한 번 흘려보내야 반영된다.
    await act(async () => {
      view.unmount()
    })

    expect(remove).toHaveBeenCalledTimes(1)
  })
})

// [[ADR-132]] 결정 10 — 판정이 «화면 스택 → 바 기록 → 백그라운드» 3단이 됐다. 바의 층 기록은
// react-navigation 이 모르는 우리 것이라(`bar-store.ts`) `canGoBack()` 에 안 잡히고, 그래서 이 단이
// 없으면 하위 행에서 시스템 뒤로가기가 **위층으로 가는 대신 앱을 백그라운드로 보낸다**.
describe('하단바의 층도 뒤로가기가 처리한다 ([[ADR-132]] 결정 10)', () => {
  it('바가 뒤로 갈 수 있으면 바에게 맡기고 백그라운드로 보내지 않는다', async () => {
    const goBack = jest.fn()
    registerBarBackHandler({ canGoBack: () => true, goBack })

    const pressBack = captureBackHandler()
    await render(<Harness navigation={{ isReady: () => true, canGoBack: () => false }} />)

    expect(pressBack()).toBe(true)
    expect(goBack).toHaveBeenCalledTimes(1)
    expect(mockMoveToBackground).not.toHaveBeenCalled()
  })

  it('바가 그룹 행이면(갈 곳 없음) 예전처럼 백그라운드로 간다', async () => {
    const goBack = jest.fn()
    registerBarBackHandler({ canGoBack: () => false, goBack })

    const pressBack = captureBackHandler()
    await render(<Harness navigation={{ isReady: () => true, canGoBack: () => false }} />)

    expect(pressBack()).toBe(true)
    expect(goBack).not.toHaveBeenCalled()
    expect(mockMoveToBackground).toHaveBeenCalledTimes(1)
  })

  // 순서가 뒤집히면 하위 페이지(드랍 이력 등)가 열려 있을 때 그 화면 대신 바의 층이 먼저 닫힌다 —
  // 사용자가 «화면 스택 먼저» 로 판정한 자리다.
  it('화면 스택이 먼저다 — pop 할 것이 있으면 바는 건드리지 않는다', async () => {
    const goBack = jest.fn()
    registerBarBackHandler({ canGoBack: () => true, goBack })

    const pressBack = captureBackHandler()
    await render(<Harness navigation={{ isReady: () => true, canGoBack: () => true }} />)

    expect(pressBack()).toBe(false)
    expect(goBack).not.toHaveBeenCalled()
    expect(mockMoveToBackground).not.toHaveBeenCalled()
  })
})
