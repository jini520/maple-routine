import { reloadAppAsync } from 'expo'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { SafeAreaProvider } from 'react-native-safe-area-context'

// NativeWind 배선의 **유일한 진입점**. Metro 가 이 import 를 보고 Tailwind 를 돌려 RN 스타일시트를
// 주입한다. 없으면 `className` 이 조용히 아무것도 안 한다.
import './global.css'

import { AppShell } from './src/app/AppShell'
import { ErrorBoundary } from './src/components/organisms/ErrorBoundary/ErrorBoundary'
import { ThemeProvider } from './src/theme/ThemeProvider'
import { InputCardHost } from './src/components/organisms/InputCard/InputCardHost'
import { QueryCacheProvider } from './src/app/QueryCacheProvider'

/**
 * 앱 루트. 프로바이더와 에러 경계만 두르고, 부팅 순서는 `src/app/AppShell.tsx` 가 갖는다.
 *
 * ## 감싸는 순서가 계약이다
 *
 *   `GestureHandlerRootView` → `SafeAreaProvider` → `KeyboardProvider` → `ThemeProvider`
 *   → `QueryCacheProvider` → `BottomSheetModalProvider` → `ErrorBoundary` → `AppShell`
 *
 * - `GestureHandlerRootView` 가 가장 밖인 것은 라이브러리 요구사항이다(`flex: 1` 필수). 제스처는 그 안에서만 돈다.
 * - `BottomSheetModalProvider` 가 없으면 시트가 에러 없이 조용히 안 열린다. 실기기에서 드롭 아이템 기록 시트가 안
 *   열려 찾았다(2026-08-13). `ThemeProvider` **안**인 것은 시트 스킨이 테마 토큰을 쓰기 때문이다.
 * - `SafeAreaProvider` 가 바깥쪽인 것은 bottom-tabs · native-stack 이 그 값을 읽기 때문이고(탭바가 홈 인디케이터를
 *   피하는 자리), `ThemeProvider` 가 그 안인 것은 내비게이션 테마(`useNavigationTheme`)가 테마 컨텍스트를 읽기 때문이다.
 * - **`ErrorBoundary` 는 프로바이더 안이다.** 밖에 두면 폴백이 `ThemeProvider` 밖이 되고, 색이 `var(--color-*)` 라
 *   **스타일 속성이 통째로 사라진다**(NativeWind 는 못 찾은 변수를 조용히 버린다). 빈 화면을 없애려고 만든 폴백이
 *   글자도 배경도 없는 화면이 된다.
 *
 *   대가는 **바깥 프로바이더 자신의 렌더 예외는 못 잡는다**는 것이다. `ThemeProvider` 는 모듈 스코프 스토어의 값을
 *   `vars()` 로 내리는 순수 래퍼이고 그 스토어의 초기값이 기본 테마라 던질 자리가 없다(`theme/appearance-store.ts`).
 *   라우팅(`AppNavigation`)은 경계 **안**이라 라우팅에서 터진 예외는 잡힌다.
 *
 * ## '다시 시작' 은 `reloadAppAsync()` 다
 *
 * `reloadAppAsync()` 는 `expo-modules-core` 의 API 로 release · debug 빌드 모두에서 돌고, 새 업데이트가 있어도 쓰지 않고
 * 지금 도는 JS 번들을 다시 실행한다. `Updates.reloadAsync()` 와 다른 점이 이것이다. 같은 예외가 결정적으로 재현되면
 * 다시 폴백으로 돌아온다.
 */
export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* 입력 카드가 키보드 높이를 여기서 받는다. 없으면 높이가 0 에 머물러 카드가 키보드 뒤에 깔린다. */}
        <KeyboardProvider>
          <ThemeProvider>
            {/* 쿼리 캐시. 테마 안인 것은 저장된 캐시를 올리는 동안 잠금 화면을 테마로 그리기 때문이다. */}
            <QueryCacheProvider>
              <BottomSheetModalProvider>
                <ErrorBoundary onRestart={() => void reloadAppAsync('ErrorBoundary 폴백의 다시 시작')}>
                  <AppShell />
                </ErrorBoundary>
              </BottomSheetModalProvider>
            </QueryCacheProvider>
            {/*
              입력 카드는 프로바이더 **뒤**에 선다. 시트는 그 프로바이더가 자기 자식들 뒤에 그리므로,
              시트 안에서 그린 카드는 무엇으로 감싸도 시트 위로 못 올라간다. 여기 두면 그 전부를
              덮으면서 평범한 터치 트리 안에 있어 카드의 누르개가 산다.
            */}
            <InputCardHost />
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
