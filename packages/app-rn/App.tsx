import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useOnboardingStore } from '@core/features/onboarding/store'

// NativeWind 배선의 **유일한 진입점**([[ADR-127]] 3단계). Metro 가 이 import 를 보고 Tailwind 를
// 돌려 RN 스타일시트를 주입한다 — 없으면 `className` 이 조용히 아무것도 안 한다.
import './global.css'

import { AppNavigation } from './src/navigation/AppNavigation'
import { ThemeProvider } from './src/theme/ThemeProvider'

/**
 * 앱 루트 — **셸이 아니다.**
 *
 * 웹의 짝은 `AppShell`(573줄)이고 그쪽은 라우팅 외에도 예열·스플래시·OTA·안전영역·키보드·광고
 * 초기화를 전부 들고 있다. 그 배선은 화면을 옮기는 단계(4단계)의 몫이라 여기로 앞당기지 않는다 —
 * 지금 옮기면 아직 없는 화면을 전제한 순서를 굳히게 된다.
 *
 * **딱 하나만 예외로 둔다: `restoreFromStorage()`.** 이것이 없으면 온보딩 분기가 영원히 미완료
 * 쪽에 머물러 탭이 **런타임에 한 번도 안 그려진다** — 이 step 이 세운 골격의 절반이 죽은 코드가
 * 되고, 실기기에서 눈으로 볼 수 있는 것도 온보딩 자리표시자 하나뿐이 된다.
 *
 * 감싸는 순서가 계약이다:
 *   `SafeAreaProvider` → `ThemeProvider` → `AppNavigation`
 * `SafeAreaProvider` 가 가장 밖인 것은 bottom-tabs·native-stack 이 그 값을 읽기 때문이고
 * (탭바가 홈 인디케이터를 피하는 자리), `ThemeProvider` 가 그 안인 것은 내비게이션 테마
 * (`useNavigationTheme`)가 테마 컨텍스트를 읽기 때문이다.
 */
export default function App(): React.JSX.Element {
  const restoreFromStorage = useOnboardingStore((state) => state.restoreFromStorage)

  useEffect(() => {
    void restoreFromStorage()
  }, [restoreFromStorage])

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigation />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
