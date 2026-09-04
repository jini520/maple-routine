// 이 층이 지키는 계약을 적는다. **1겹을 내리는 신호가 시계가 아니라 이 층이 그려졌다는 사실**이다.
//
// 순서가 요점이라 테스트도 순서를 본다. 그려지기 전에 내리면 그 사이가 빈다.
import { act, fireEvent, render } from '@testing-library/react-native'

import { hideSplashScreen } from '../../native/splash-screen'
import { BOOT_SPLASH_HOLD_MS, BootSplash } from '../BootSplash'

jest.mock('../../native/splash-screen', () => ({
  hideSplashScreen: jest.fn(async () => {}),
}))

const mockedHide = jest.mocked(hideSplashScreen)

beforeEach(() => {
  jest.useFakeTimers()
  mockedHide.mockReset()
  mockedHide.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.useRealTimers()
})

type Rendered = Awaited<ReturnType<typeof render>>

/**
 * RN 은 실제 측정이 있을 때만 `onLayout` 을 부른다. 이 환경에서는 손으로 쏜다.
 *
 * `await` 가 빠지면 안 된다. 이 버전의 `fireEvent` 는 비동기라 `act` 스코프를 열어 두고,
 * 안 닫힌 스코프가 **뒤따르는 테스트의 쿼리까지** 무너뜨린다(증상은 `없는 testID` 로 나온다).
 */
async function layout(view: Rendered): Promise<void> {
  await fireEvent(view.getByTestId('boot-splash'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  })
}

describe('BootSplash', () => {
  // 그려지기 전에 내리면 1겹이 걷힌 자리에 아무것도 없다. 그 구간이 검정으로 보인다.
  it('그려지기 전에는 네이티브 스플래시를 내리지 않는다', async () => {
    await render(<BootSplash />)

    expect(mockedHide).not.toHaveBeenCalled()
  })

  it('그려진 사실(onLayout)이 네이티브 스플래시를 내린다', async () => {
    const view = await render(<BootSplash />)

    await layout(view)

    expect(mockedHide).toHaveBeenCalledTimes(1)
  })

  // 회전·키보드 등으로 레이아웃은 여러 번 온다. 내리는 것은 한 번이면 된다.
  it('레이아웃이 다시 와도 다시 내리지 않는다', async () => {
    const view = await render(<BootSplash />)

    await layout(view)
    await layout(view)

    expect(mockedHide).toHaveBeenCalledTimes(1)
  })

  // 최소 표시 시간의 보장이 1겹에서 이 층으로 옮겨 왔다. 1겹은 OS 가 언제 걷을지 모르지만
  // 이 층은 우리가 통제한다.
  it('1겹이 사라진 뒤 최소 표시 시간을 채우고 걷힌다', async () => {
    const view = await render(<BootSplash />)
    await layout(view)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(BOOT_SPLASH_HOLD_MS - 1)
    })
    expect(view.queryByTestId('boot-splash')).not.toBeNull()

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1)
    })
    expect(view.queryByTestId('boot-splash')).toBeNull()
  })

  // 시간이 흘러도 넘겨받지 못했으면 안 걷는다. 걷으면 1겹이 아직 떠 있는 채로 이 층만 사라져
  // 최소 표시 시간의 보장이 사라진다.
  it('넘겨받기 전에는 시간이 흘러도 걷히지 않는다', async () => {
    const view = await render(<BootSplash />)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(BOOT_SPLASH_HOLD_MS * 10)
    })

    expect(view.queryByTestId('boot-splash')).not.toBeNull()
    expect(mockedHide).not.toHaveBeenCalled()
  })

  // 재는 시작점이 내려 달라고 부른 때가 아니라 사라진 때다. 요청한 때부터 세면 그 시간의
  // 일부를 1겹에 가려진 채로 보낸다(릴리스 계측에서 600ms 중 320ms 가 그랬다). 애니메이션이
  // 붙으면 그만큼이 안 보이고 시작한다.
  it('1겹이 아직 안 사라졌으면 최소 표시 시간을 세지 않는다', async () => {
    mockedHide.mockReturnValue(new Promise(() => {}))
    const view = await render(<BootSplash />)
    await layout(view)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(BOOT_SPLASH_HOLD_MS * 2)
    })

    expect(view.queryByTestId('boot-splash')).not.toBeNull()
  })

  // 상한이 없으면 `hideSplashScreen()` 이 끝내 안 끝날 때 앱이 브랜드색에 갇힌다. 트리 밖
  // 실패 안전 타이머도 같은 함수를 기다리므로 그쪽이 대신 받아 주지 못한다.
  it('1겹이 끝내 안 사라져도 상한이 지나면 걷힌다', async () => {
    mockedHide.mockReturnValue(new Promise(() => {}))
    const view = await render(<BootSplash />)
    await layout(view)

    // 두 번에 나눠 감는다. 상한이 풀린 **뒤에야** 최소 표시 시간 타이머가 걸리므로, 한 번에
    // 감으면 그 타이머가 이미 지나간 시각에 걸려 안 터진다.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(BOOT_SPLASH_HOLD_MS * 10)
    })
    await act(async () => {
      await jest.advanceTimersByTimeAsync(BOOT_SPLASH_HOLD_MS)
    })

    expect(view.queryByTestId('boot-splash')).toBeNull()
  })

  // **배경색만** 1겹과 같으면 된다. 색이 갈리면 넘겨받는 순간이 깜빡임으로 드러난다.
  // 로고는 이 층이 더하는 것이다. 1겹은 로고 없는 단색이고, 로고가 나타나는 것이 곧
  // 애니메이션의 시작점이 된다. 값의 원천은 `app.json` 의 `expo-splash-screen` 블록이다.
  it('배경은 1겹과 같은 색이고, 로고는 이 층이 더한다', async () => {
    const view = await render(<BootSplash />)

    const root = view.getByTestId('boot-splash')
    expect(root).toHaveStyle({ backgroundColor: '#F58B0F' })
    expect(root).toHaveStyle({ alignItems: 'center', justifyContent: 'center' })

    expect(view.getByTestId('boot-splash-logo')).toHaveStyle({ width: 200 })
  })

  // 화면을 덮지 못하면 아래의 앱 콘텐츠가 비쳐 두 겹인 것이 드러난다.
  it('화면 전체를 덮는다', async () => {
    const view = await render(<BootSplash />)

    expect(view.getByTestId('boot-splash')).toHaveStyle({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    })
  })
})
