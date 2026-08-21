// Metro 설정. **모노레포 배선도 core 치환도 없다**([[ADR-155]] 결정 2·3) — 앱이 저장소 루트로
// 올라오고 `core/` 가 `src/` 로 녹으면서 «프로젝트 밖의 패키지» 라는 전제가 통째로 사라졌다.
// 종전에는 `watchFolders`·`nodeModulesPaths` 로 저장소 루트를 끌어오고, Vite 전용 API 를 쓰는 core
// 모듈을 RN 구현으로 갈아끼우는 `resolveRequest` 훅을 걸었다(그 표는 [[ADR-129]] 이후 줄곧 비어
// 있었다). 이제 남은 것은 NativeWind 뿐이다.
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const { CSS_ENTRY, INLINE_REM } = require('./nativewind.config')

const config = getDefaultConfig(__dirname)

// NativeWind 를 씌운다([[ADR-128]] 3단계). 이 래퍼는 트랜스포머를 갈아끼우고 설정을 새로 만들어
// 돌려주므로, 결과에 `config.resolver` 를 통째로 대입하지 말 것 — 그쪽이 심어 둔 것이 지워진다.
module.exports = withNativeWind(config, {
  input: CSS_ENTRY,
  inlineRem: INLINE_REM,
})
