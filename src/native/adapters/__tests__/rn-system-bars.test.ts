// `SystemBarsPort` 의 RN 구현. **한 메서드는 네이티브를 부르고 하나는 의도적으로 아무것도 안 한다**는
// 사실 자체가 계약이다.
//
// 계획서(`docs/migration/parity-inventory.md` §5)와 `not-implemented.ts` 는 이 포트를 통째로
// *"3단계에서 채워진다"* 로 적어 두었는데, 실제로는 둘의 사정이 달랐다. 그 갈림을 여기서 고정한다.
// 특히 `refreshSafeAreaInsets` 의 빈 본문은 **읽는 사람이 "구현이 빠졌다"로 오해하기 쉬운 모양**이라,
// 지우거나 던지게 바꾸면 부팅마다 처리되지 않은 거부가 남는다(안전영역은 멀쩡히 도는데도).

// 변수 이름이 `mock` 으로 시작하는 것은 취향이 아니다. jest 가 `jest.mock()` 팩토리에서 바깥 변수를
// 참조하는 것을 막는데 그 접두사만 예외로 둔다(`rn-back-gesture.test.ts` 와 같은 사정).
let mockNativeModule: { setNavigationBarStyle: jest.Mock } | null = null

jest.mock('../../../../modules/app-system-bars', () => ({
  __esModule: true,
  get default() {
    return mockNativeModule
  },
}))

import { rnSystemBarsPort } from '../rn-system-bars'

beforeEach(() => {
  mockNativeModule = { setNavigationBarStyle: jest.fn(async () => {}) }
})

describe('setNavigationBarStyle: 네이티브 한 줄을 그대로 옮겼다', () => {
  // 명암의 방향이 이 어댑터의 전부다. `dark` 를 그대로 넘기고 뒤집는 일은 네이티브가 한다
  // (`setAppearanceLightNavigationBars(!dark)`). 웹뷰 플러그인과 같은 자리, 같은 방향이다.
  // 여기서 한 번 더 뒤집으면 어두운 배경에 어두운 글리프가 되어 바가 통째로 안 보이는데,
  // 그것은 실기기에서만 드러난다.
  it.each([true, false])('isDarkTheme=%s 를 그대로 네이티브에 넘긴다', async (isDark) => {
    await rnSystemBarsPort.setNavigationBarStyle(isDark)

    expect(mockNativeModule?.setNavigationBarStyle).toHaveBeenCalledWith(isDark)
  })

  // iOS 에는 하단 시스템 내비게이션 바가 없어 모듈이 `null` 이다(`platforms: ["android"]`).
  // 웹뷰 구현도 같은 자리에 `if (platform !== 'android') return` 을 두고 있었다. 던지면
  // **테마를 적용할 때마다** 처리되지 않은 거부가 남는다(`applyTheme` 이 매번 부른다).
  it('네이티브 모듈이 없는 플랫폼(iOS)에서는 조용히 아무것도 하지 않는다', async () => {
    mockNativeModule = null

    await expect(rnSystemBarsPort.setNavigationBarStyle(true)).resolves.toBeUndefined()
  })
})

describe('refreshSafeAreaInsets: 할 일이 없다는 것이 결론이다', () => {
  // *"못 한다"* 가 아니라 *"이미 되고 있다"* 다. 이 함수는 웹뷰에서 **유실 복구**용이었다(네이티브의
  // 최초 인셋 주입이 DOM 준비보다 빠르면 값이 사라진다). RN 에는 주입도 유실도 없고,
  // `SafeAreaProvider` 가 회전·접힘·키보드 변화까지 자기 리스너로 다시 내려준다.
  it('던지지 않는다. 안전영역은 정상 동작 중이고 거부는 진짜 고장과 구분을 없앤다', async () => {
    await expect(rnSystemBarsPort.refreshSafeAreaInsets()).resolves.toBeUndefined()
  })

  // 네이티브 모듈에는 이 함수 자체가 없다(`AppSystemBarsModule` 의 함수는 하나뿐). 여기서 무언가를
  // 부르려 든다면 그것은 웹뷰 배관을 흉내 내는 것이다.
  it('네이티브를 부르지 않는다', async () => {
    await rnSystemBarsPort.refreshSafeAreaInsets()

    expect(mockNativeModule?.setNavigationBarStyle).not.toHaveBeenCalled()
  })
})
