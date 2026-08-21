// Metro 설정. **모노레포 배선은 없어졌다**([[ADR-155]] 결정 2) — `core/` 가 프로젝트 루트 안에
// 있으므로 `watchFolders` 로 저장소 루트를 끌어오고 `nodeModulesPaths` 를 둘로 두던 종전 ①·②가
// 통째로 필요 없다(Metro 는 프로젝트 디렉터리 밖의 파일을 기본으로 안 읽는데, 이제 밖이 아니다).
//
// `@core/*` alias 자체는 여기 없다 — **`tsconfig.json` 의 `paths` 하나가 tsc 와 Metro 양쪽을 다 푼다**
// (Expo 의 `experiments.tsconfigPaths`, `app.json` 에 명시해 뒀다). 그래서 "타입은 통과하는데
// 런타임에 죽는" 어긋남이 원리적으로 불가능하다 — 선언이 한 벌이라 갈라질 자리가 없다.
// `babel-plugin-module-resolver` 로 같은 매핑을 한 벌 더 두는 안은 실측으로 폐기했다(그 플러그인을
// 통째로 지워도 번들이 그대로 나왔다 = 애초에 tsconfig 쪽이 풀고 있었다).
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const { resolveCoreShim } = require('./core-shims')
const { CSS_ENTRY, INLINE_REM } = require('./nativewind.config')

const config = getDefaultConfig(__dirname)

// Vite 전용 API 를 쓰는 core 모듈을 RN 구현으로 갈아끼운다(표와 근거는 `core-shims.js`).
// 체인을 끊지 않는 것이 요점이다 — 아래 `withNativeWind` 도 `resolveRequest` 를 감싸는데,
// 그쪽은 기존 것을 물려받아 부르므로(`react-native-css-interop/dist/metro/index.js`) 이 훅을
// **먼저** 걸어야 둘이 함께 산다.
const upstreamResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shim = resolveCoreShim(moduleName)
  if (shim !== undefined) return { type: 'sourceFile', filePath: shim }
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform)
}

// NativeWind 를 **맨 마지막에** 씌운다([[ADR-128]] 3단계). 이 래퍼는 트랜스포머를 갈아끼우고
// 설정을 새로 만들어 돌려주므로, 위 해석기 훅을 마친 객체를 넘겨야 한다 — 순서를 뒤집어 래퍼 결과에
// `config.resolver` 를 통째로 대입하면 그쪽이 심어 둔 것이 지워진다. 순서가 곧 계약이다.
module.exports = withNativeWind(config, {
  input: CSS_ENTRY,
  inlineRem: INLINE_REM,
})
