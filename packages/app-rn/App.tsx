import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

// 이 화면의 목적은 하나다 — **`packages/core` 가 RN 번들에 들어간다**를 증명하는 것([[ADR-127]] 0단계).
// 그래서 부작용 없는 순수 모듈만 부른다. 저장소·네이티브 포트는 RN 어댑터가 아직 없어(1단계 대상)
// 부르면 반드시 throw 한다.
//
// `boss-crystal-prices` 를 고른 이유: 그 안에서 다시 `@core/data/*.json` 과 `@core/types` 를 부르므로
// **core 내부의 `@core/*` 참조까지** Metro 가 푸는지 한 번에 확인된다(앱 → core 한 겹만이 아니다).
import weeklyBosses from '@core/data/weekly-bosses.json'
import { CRYSTAL_PRICES, DEFAULT_MAX_PARTY_SIZE } from '@core/lib/boss-crystal-prices'
import { formatBytes } from '@core/lib/format-bytes'

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>메이플 루틴 (RN 스캐폴드)</Text>
      <Text style={styles.line}>주간 보스 {weeklyBosses.weekly.length}종</Text>
      <Text style={styles.line}>결정석 가격표 {CRYSTAL_PRICES.length}행</Text>
      <Text style={styles.line}>기본 최대 파티 인원 {DEFAULT_MAX_PARTY_SIZE}명</Text>
      <Text style={styles.line}>formatBytes(1536) = {formatBytes(1536)}</Text>
      <StatusBar style="auto" />
    </View>
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
