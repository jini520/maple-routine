const path = require('node:path')

// `@expo/metro-config` 가 `babel-preset-expo` 를 기본으로 걸어 주므로, 그것만이라면 이 파일은 필요 없다.
// 이 파일이 있는 이유는 둘이다. **NativeWind 가 babel 프리셋을 요구하고**, 테스트에서만 동적
// `import()` 를 내려야 한다(아래 `transformDynamicImport`).
//
// `nativewind/babel` 이 하는 일은 `react-native` 에서 가져오는 프리미티브(`View`·`Text`…)를
// `react-native-css` 의 래퍼로 바꿔치기하는 것이다. 그 치환이 없으면 `className` 은 RN 프리미티브가
// 모르는 프롭이라 **조용히 무시된다**. 화면이 스타일 없이 그려질 뿐 에러는 안 난다. 즉 이 파일을
// 지우면 실패가 무음이다.
//
// `babel-preset-expo` 를 먼저 두는 순서가 중요하다. 그 프리셋이 `react-native-worklets/plugin` 을
// 자동으로 붙이는데(reanimated 4 가 쓴다), NativeWind 프리셋도 같은 플러그인을 요구한다. 둘 다
// 얹히면 Babel 이 중복으로 보지 않도록 같은 모듈로 해석돼야 하고, 그건 `expo export` 로 확인했다.

/**
 * 테스트에서만 동적 `import(x)` 를 `Promise.resolve().then(() => require(x))` 로 내린다.
 *
 * jest 는 CJS VM 에서 돌아 네이티브 `import()` 를 만나면
 * *"A dynamic import callback was invoked without --experimental-vm-modules"* 로 죽는다.
 * `@babel/plugin-transform-modules-commonjs` 로는 안 된다. `babel-preset-expo` 가 caller 에
 * `supportsDynamicImport` 를 켜 두어 그 플러그인이 `import()` 를 **일부러 남기기** 때문이다(실측).
 *
 * 그런데 `src/app/prehydrate.ts` 는 **일부러** 동적 import 를 쓴다. 정적으로 바꾸면 탭 스토어가
 * 첫 렌더 전에 평가된다. 소스를 고칠 수 없는 자리라 러너 쪽에서 내려 준다. 이 변환은 `isTest` 일 때만
 * 걸려서 Metro 빌드에는 들어가지 않는다.
 */
function transformDynamicImport({ types: t }) {
  return {
    name: 'dynamic-import-to-require',
    visitor: {
      CallExpression(nodePath) {
        if (nodePath.node.callee.type !== 'Import') return
        nodePath.replaceWith(
          t.callExpression(
            t.memberExpression(
              t.callExpression(
                t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
                [],
              ),
              t.identifier('then'),
            ),
            [
              t.arrowFunctionExpression(
                [],
                t.callExpression(t.identifier('require'), nodePath.node.arguments),
              ),
            ],
          ),
        )
      },
    },
  }
}

module.exports = function babelConfig(api) {
  const isTest = api.env('test')
  api.cache.using(() => process.env.NODE_ENV)

  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    // 아래 오버라이드는 테스트에서만 돈다. 이유는 플러그인 정의 위 주석에.
    // **우리 소스에만** 건다: `node_modules` 의 RN 파일까지 내리면 그쪽이 자기 프리셋으로 이미 처리한
    // 것과 겹쳐 `Unexpected token 'export'` 로 죽는다(실측).
    overrides: isTest
      ? [
          {
            // **절대 경로로 못박는다.** `/src/` 로 잡으면 `node_modules/react-native/src/…` 까지
            // 걸려 그쪽 프리셋 처리와 겹치고 `Unexpected token 'export'` 가 난다(실측).
            test: (filename) =>
              typeof filename === 'string' && filename.startsWith(path.join(__dirname, 'src') + path.sep),
            plugins: [transformDynamicImport],
          },
        ]
      : [],
  }
}
