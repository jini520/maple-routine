// Metro 모노레포 설정. RN 번들러는 프로젝트 디렉터리 **밖**의 파일을 기본으로 읽지 않으므로,
// `packages/core` 를 쓰려면 아래 둘을 직접 알려줘야 한다([[ADR-128]] 결정 3).
//
// `@core/*` alias 자체는 여기 없다 — **`tsconfig.json` 의 `paths` 하나가 tsc 와 Metro 양쪽을 다 푼다**
// (Expo 의 `experiments.tsconfigPaths`, `app.json` 에 명시해 뒀다). 그래서 "타입은 통과하는데
// 런타임에 죽는" 어긋남이 원리적으로 불가능하다 — 선언이 한 벌이라 갈라질 자리가 없다.
// `babel-plugin-module-resolver` 로 같은 매핑을 한 벌 더 두는 안은 실측으로 폐기했다(그 플러그인을
// 통째로 지워도 번들이 그대로 나왔다 = 애초에 tsconfig 쪽이 풀고 있었다).
const path = require('node:path')

const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const { resolveCoreShim } = require('./core-shims')
const { CSS_ENTRY, INLINE_REM } = require('./nativewind.config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// ① 저장소 루트까지 감시·해석 범위를 넓힌다. 없으면 `@core/*` 가 풀려서 나온 경로가 projectRoot
//    밖이라 Metro 가 거기서 죽는다.
config.watchFolders = [workspaceRoot]

// ② npm workspaces 는 의존성을 저장소 루트로 호이스팅하므로 두 곳을 모두 등록한다.
//    (react·react-native 는 지금 전부 루트에 있고, 버전이 충돌해 중첩된 것만 패키지 안에 생긴다.)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// `disableHierarchicalLookup` 는 켜지 않는다. npm workspaces 는 이미 평평하게 호이스팅하고,
// 켜면 버전 충돌로 중첩된 `.../node_modules/<pkg>/node_modules/<dep>` 를 못 찾게 된다.
// 위 둘만으로 `packages/core` 가 해석되는 것을 `expo export` 로 확인했다.

// ③ Vite 전용 API 를 쓰는 core 모듈을 RN 구현으로 갈아끼운다(표와 근거는 `core-shims.js`).
//    체인을 끊지 않는 것이 요점이다 — 아래 `withNativeWind` 도 `resolveRequest` 를 감싸는데,
//    그쪽은 기존 것을 물려받아 부르므로(`react-native-css-interop/dist/metro/index.js`) 이 훅을
//    **먼저** 걸어야 둘이 함께 산다.
const upstreamResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shim = resolveCoreShim(moduleName)
  if (shim !== undefined) return { type: 'sourceFile', filePath: shim }
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform)
}

// ④ NativeWind 를 **맨 마지막에** 씌운다([[ADR-128]] 3단계). 이 래퍼는 트랜스포머를 갈아끼우고
//    설정을 새로 만들어 돌려주므로, 위 ①·② 를 마친 객체를 넘겨야 한다 — 순서를 뒤집어 래퍼 결과에
//    `config.resolver` 를 통째로 대입하면 그쪽이 심어 둔 것이 지워진다. 순서가 곧 계약이다.
module.exports = withNativeWind(config, {
  input: CSS_ENTRY,
  inlineRem: INLINE_REM,
})
