import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

// NativeWind 배선의 **유일한 진입점**([[ADR-127]] 3단계). Metro 가 이 import 를 보고 Tailwind 를
// 돌려 RN 스타일시트를 주입한다 — 없으면 `className` 이 조용히 아무것도 안 한다.
import './global.css'

// 이 화면의 목적은 둘이다 — **`packages/core` 가 RN 번들에 들어간다**([[ADR-127]] 0단계)와
// **부팅 배선이 실제로 돈다**(1단계). 앞엣것은 부작용 없는 순수 모듈로, 뒤엣것은 포트를 실제로
// 거치는 호출 하나로 확인한다.
//
// `boss-crystal-prices` 를 고른 이유: 그 안에서 다시 `@core/data/*.json` 과 `@core/types` 를 부르므로
// **core 내부의 `@core/*` 참조까지** Metro 가 푸는지 한 번에 확인된다(앱 → core 한 겹만이 아니다).
//
// 포트 쪽으로 `ColorSchemePort` 를 고른 이유: **동기이고, 저장소·네이티브 권한이 필요 없고, 실패해도
// 무해하다.** 저장소·광고를 부르면 번들만 만드는 검증에서는 확인할 수 없고, 실패했을 때 원인이
// 배선인지 어댑터인지 갈리지 않는다. 주입이 안 됐다면 이 한 줄이 렌더에서 곧바로 던진다
// (`index.ts` 의 `installPorts()`).
// 테마는 step 1 에서 붙었다. 여기에 `ThemeProvider` 를 두는 것은 화면을 만드는 것이 아니라 **번들이
// 실제로 이 경로를 타는지** 확인하는 것이다 — `@core/lib/theme-registry` 는 core 안에서
// `import.meta.glob` 모듈을 부르므로, 치환(`core-shims.js`)이 Metro 쪽에서도 서지 않으면 이 화면이
// **부팅에서** 죽는다. jest 만으로는 그 절반(jest 매퍼)밖에 확인되지 않는다.
import weeklyBosses from '@core/data/weekly-bosses.json'
import { CRYSTAL_PRICES, DEFAULT_MAX_PARTY_SIZE } from '@core/lib/boss-crystal-prices'
import { formatBytes } from '@core/lib/format-bytes'
import { getColorSchemePort } from '@core/native/ports'
import { useThemeAppearance } from './src/theme/context'
import { ThemeProvider } from './src/theme/ThemeProvider'

/** 토큰이 `className` 으로 풀리는지 눈으로 확인하는 줄 — 색을 하드코딩하지 않는다. */
function ThemeProbe() {
  const { theme, definition } = useThemeAppearance()

  return (
    <View className="mt-2 rounded-lg border border-panel-border bg-surface px-4 py-2">
      <Text className="text-sm text-text-muted">
        테마 {theme} ({definition.mode})
      </Text>
    </View>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <View style={styles.container}>
        <Text style={styles.title}>메이플 루틴 (RN 스캐폴드)</Text>
        <Text style={styles.line}>주간 보스 {weeklyBosses.weekly.length}종</Text>
        <Text style={styles.line}>결정석 가격표 {CRYSTAL_PRICES.length}행</Text>
        <Text style={styles.line}>기본 최대 파티 인원 {DEFAULT_MAX_PARTY_SIZE}명</Text>
        <Text style={styles.line}>formatBytes(1536) = {formatBytes(1536)}</Text>
        <Text style={styles.line}>ColorSchemePort.get() = {getColorSchemePort().get()}</Text>
        <ThemeProbe />
        <StatusBar style="auto" />
      </View>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  line: {
    fontSize: 14,
  },
})
