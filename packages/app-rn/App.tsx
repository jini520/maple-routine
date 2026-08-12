import { reloadAppAsync } from 'expo'
import { SafeAreaProvider } from 'react-native-safe-area-context'

// NativeWind 배선의 **유일한 진입점**([[ADR-128]] 3단계). Metro 가 이 import 를 보고 Tailwind 를
// 돌려 RN 스타일시트를 주입한다 — 없으면 `className` 이 조용히 아무것도 안 한다.
import './global.css'

import { AppShell } from './src/app/AppShell'
import { ErrorBoundary } from './src/components/organisms/ErrorBoundary/ErrorBoundary'
import { ThemeProvider } from './src/theme/ThemeProvider'

/**
 * 앱 루트 — 프로바이더 셋과 에러 경계만 두르고, 부팅 순서는 `src/app/AppShell.tsx` 가 갖는다
 * (웹도 `App` / `AppShell` 이 같은 식으로 갈려 있다).
 *
 * ## 감싸는 순서가 계약이다
 *
 *   `SafeAreaProvider` → `ThemeProvider` → `ErrorBoundary` → `AppShell`
 *
 * - `SafeAreaProvider` 가 가장 밖인 것은 bottom-tabs·native-stack 이 그 값을 읽기 때문이고
 *   (탭바가 홈 인디케이터를 피하는 자리), `ThemeProvider` 가 그 안인 것은 내비게이션 테마
 *   (`useNavigationTheme`)가 테마 컨텍스트를 읽기 때문이다.
 * - **`ErrorBoundary` 가 프로바이더 «안»인 것은 웹과 갈리는 자리다.** 웹은 라우터 **밖**에 뒀다
 *   ([[ADR-065]] 결정 5 — 라우팅 자체가 터져도 폴백이 뜨게). RN 에서 그 자리에 두면 폴백이
 *   `ThemeProvider` 밖이 되고, 색이 `var(--color-*)` 라 **스타일 속성이 통째로 사라진다**
 *   (3-1단계 실측 — NativeWind 는 못 찾은 변수를 조용히 버린다). 빈 화면을 없애려고 만든 폴백이
 *   글자도 배경도 없는 화면이 되므로, 그 결정이 지키려던 것을 지키려면 안쪽이어야 한다.
 *
 *   대가는 **두 프로바이더 자신의 렌더 예외는 못 잡는다**는 것이다. 감수하는 근거: `ThemeProvider`
 *   는 모듈 스코프 스토어의 값을 `vars()` 로 내리는 순수 래퍼이고 그 스토어의 초기값이 기본
 *   테마라 값이 없어서 던질 자리가 없으며(`theme/appearance-store.ts`), `SafeAreaProvider` 는
 *   라이브러리 루트다. 라우팅(`AppNavigation`)은 여전히 경계 **안**이라 웹이 실제로 겨눈 것은
 *   그대로 잡힌다.
 *
 * ## '다시 시작' 은 `reloadAppAsync()` 다
 *
 * `ErrorBoundary` 가 재시작 수단을 필수 프롭으로 받는 이유는 *"RN 에는 `location.reload()` 의 짝이
 * 없다"* 였는데(3-5단계), **`expo` 가 그 짝을 준다.** `reloadAppAsync()` 는 `expo-modules-core` 의
 * API 로 *"release·debug 빌드 모두에서 동작하고, 업데이트가 있어도 새 업데이트를 쓰지 않고 지금
 * 도는 것과 같은 JS 번들을 다시 실행한다"* — `Updates.reloadAsync()` 와 갈리는 지점이 정확히
 * 그것이라, [[ADR-128]] 결정 7 의 OTA 재설계를 기다릴 필요가 없다. `location.reload()` 와 같은
 * 뜻이고 같은 한계다(같은 예외가 결정적으로 재현되면 다시 폴백으로 돌아온다 — 그때의 탈출구는
 * [[ADR-065]] 결정 5 가 적은 대로 앱 밖에 있다).
 */
export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary onRestart={() => void reloadAppAsync('ErrorBoundary 폴백의 다시 시작')}>
          <AppShell />
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
