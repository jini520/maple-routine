// Metro 설정. Expo 기본 설정에 NativeWind 만 씌운다.
// `watchFolders` · `resolveRequest` 같은 해석 설정은 두지 않는다. 앱이 저장소 루트에 있고 모든 import 가
// 상대 경로라 기본 해석으로 충분하다.
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const { CSS_ENTRY, INLINE_REM } = require('./nativewind.config')

const config = getDefaultConfig(__dirname)

// NativeWind 를 씌운다. 이 래퍼는 트랜스포머를 갈아끼우고 설정을 새로 만들어
// 돌려주므로, 결과에 `config.resolver` 를 통째로 대입하지 말 것. 그쪽이 심어 둔 것이 지워진다.
module.exports = withNativeWind(config, {
  input: CSS_ENTRY,
  inlineRem: INLINE_REM,
})
