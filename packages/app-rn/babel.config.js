// 0단계에서 이 파일을 **일부러 지웠다** — `@expo/metro-config` 가 `babel-preset-expo` 를 기본으로
// 걸어 주므로 같은 내용을 다시 적는 파일이었다. 되살리는 이유는 하나뿐이다: **NativeWind 가 babel
// 프리셋을 요구한다.**
//
// `nativewind/babel` 이 하는 일은 `react-native` 에서 가져오는 프리미티브(`View`·`Text`…)를
// `react-native-css` 의 래퍼로 바꿔치기하는 것이다. 그 치환이 없으면 `className` 은 RN 프리미티브가
// 모르는 프롭이라 **조용히 무시된다** — 화면이 스타일 없이 그려질 뿐 에러는 안 난다. 즉 이 파일이
// 없으면 실패가 무음이라, 없애 뒀던 것을 되살릴 값어치가 있다.
//
// `babel-preset-expo` 를 먼저 두는 순서가 중요하다. 그 프리셋이 `react-native-worklets/plugin` 을
// 자동으로 붙이는데(reanimated 4 가 쓴다), NativeWind 프리셋도 같은 플러그인을 요구한다 — 둘 다
// 얹히면 Babel 이 중복으로 보지 않도록 같은 모듈로 해석돼야 하고, 그건 `expo export` 로 확인했다.
module.exports = function babelConfig(api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
  }
}
