// `react-native-webview` 의 테스트 대역 — **네이티브 모듈이 없어서** 필요하다.
//
// 그 패키지는 import 되는 순간 `TurboModuleRegistry.getEnforcing('RNCWebViewModule')` 을 부르는데
// (`lib/NativeRNCWebViewModule.js`), jest 에는 네이티브 바이너리가 없으므로 **모듈을 읽는 것만으로
// `Invariant Violation` 이 난다.** 화면을 렌더하지 않아도 `RootNavigator` 가 import 하는 것만으로
// 스위트 전체가 죽는다(실측 — 그 자리에서 내비게이션 테스트 둘이 먼저 빨개졌다).
//
// `jest.mock()` 호출 없이 자동으로 적용된다. jest 는 node 패키지 이름과 같은 파일이 `roots`
// (기본값 `<rootDir>`) 안의 `__mocks__/` 에 있으면 그것을 쓴다 — 그래서 이 대역을 켜는 것을
// 테스트 파일마다 기억할 필요가 없고, 새 테스트가 처방침 화면을 건드려도 그냥 통과한다.
//
// **대역은 프롭을 그대로 흘려보낸다.** `testID` 는 물론 `onLoad`·`onError` 도 그 `View` 에 얹히므로
// RNTL 이 `fireEvent(el, 'load')` 로 로드 성공·실패를 그대로 재현할 수 있다 — 이 화면에서 검사할
// 것이 정확히 그 두 신호가 만드는 상태 전이(`loading` → `loaded`/`failed`)다.
const React = require('react')
const { View } = require('react-native')

function WebView(props) {
  return React.createElement(View, props)
}

module.exports = { WebView, default: WebView, __esModule: true }
