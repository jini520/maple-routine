// NativeWind(Tailwind v3) 설정 — `withNativeWind` 가 이 파일을 찾아 Tailwind CLI 에 넘긴다.
//
// **색 토큰은 여기 없다.** 34종이 테마마다 달라 step 1(theme-system)이 붙인다. 지금 여기 있는 것은
// **테마와 무관한 축**뿐이고, 그 값은 손으로 적지 않고 웹이 쓰는 Tailwind v4 의 `theme.css` 에서
// 판다(`tailwind-v4-axes.cjs` — 왜 그런 다리가 필요한지도 거기 적혀 있다).
const { theme } = require('../../tailwind-v4-axes.cjs')

module.exports = {
  // `global.css` 의 `@source` 가 아니라 여기서 스캔 범위를 정한다(v3 방식). `android/`·`ios/` 를
  // 안 훑도록 두 갈래만 적는다.
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // `extend` 가 아니라 **교체**다 — `extend` 로 더하면 v3 의 옛 계단(`rounded-sm` = 2px)이 남아
  // 웹과 다른 값이 그대로 산다.
  theme,
}
