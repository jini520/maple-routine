// jest 모듈 해석기 — **둘을 겹쳐야 한다.**
//
// ① `@react-native/jest-preset` 의 해석기: `react-native` 패키지의 `exports` 맵을 걷어내 하위 경로를
//    jest 가 mock 할 수 있게 한다(jest-expo 프리셋이 원래 쓰던 것). 빼면 RN 내부 모듈을 못 찾는다.
// ② `react-native-worklets` 의 해석기: 그 패키지 안에서는 `.native.*` 확장자를 **후보에서 뺀다**.
//    reanimated 4 는 worklets 위에 서 있고, `NativeWorklets.native.ts` 는 평가 시점에 네이티브
//    모듈(`loadUnpackers`)을 만져 jest 에서 즉시 죽는다(실측) — 같은 디렉터리의 `NativeWorklets.ts`
//    가 그 자리를 대신한다.
//
// jest 는 `resolver` 를 **하나만** 받으므로 ②의 `defaultResolver` 자리에 ①을 끼워 넣어 잇는다.
// 순서가 이것인 이유: ②는 "어떤 확장자를 볼지"를 정하고 ①은 "그 뒤에 실제로 어떻게 찾을지"를
// 정한다 — 반대로 겹치면 ②의 확장자 조정이 버려진다.
//
// `@gorhom/bottom-sheet`([[ADR-039]] 의 RN 짝) 때문에 들어왔지만, 대상은 그 패키지가 아니라
// **reanimated 를 쓰는 모든 코드**다 — step 7(animations)이 그 위에 선다.
const reactNativeResolver = require('@react-native/jest-preset/jest/resolver')
const workletsResolver = require('react-native-worklets/jest/resolver')

// ①은 자기 `options.defaultResolver` 를 다시 부르므로, 그 자리에 **jest 의 원래 해석기**를 남겨
// 둬야 한다 — 여기에 ① 자신을 넣으면 무한 재귀가 된다.
module.exports = (request, options) =>
  workletsResolver(request, {
    ...options,
    defaultResolver: (innerRequest, innerOptions) =>
      reactNativeResolver(innerRequest, { ...innerOptions, defaultResolver: options.defaultResolver }),
  })
