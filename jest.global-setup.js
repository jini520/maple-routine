// `global.css` 를 **jest 실행당 한 번** Tailwind 로 컴파일해 캐시에 떨궈 둔다. `jest.setup.js` 가
// 그것을 읽어 테스트마다 스타일 컬렉션에 넣는다([[ADR-128]] 3단계).
//
// **왜 컴파일까지 하는가**: 안 하면 `className` 이 붙은 컴포넌트도 스타일 없이 렌더돼, 스냅샷에
// 클래스 이름만 남고 **그 클래스가 무슨 값이 되는지는 하나도 안 남는다.** 그러면 `p-4` 를 `p-5` 로
// 바꿔도 스냅샷이 초록이다 — 회귀를 잡으라고 만든 기준선이 정작 스타일 회귀를 못 잡는다.
//
// NativeWind 가 주는 `nativewind/test` 의 `render()` 를 쓰지 않는 이유: 그쪽은 **넘긴 JSX 에 직접
// 적힌 `className` 만** 훑어 컴파일한다(`getClassNames` 가 `props.children` 을 따라간다). step 3~6
// 은 컴포넌트를 렌더하고 그 **안쪽** 클래스가 풀리기를 기대하므로 그 방식으로는 빈 스타일이 된다.
// 그래서 앱이 실제로 쓰는 `tailwind.config.js` 로 전체를 한 번 컴파일한다.
//
// `globalSetup` 인 이유는 이 컴파일이 **비동기**이고 무겁기 때문이다. `setupFilesAfterEnv` 에서
// `beforeAll` 로 돌리면 테스트 파일 수만큼 반복된다.
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const path = require('node:path')

const postcss = require('postcss')
const tailwindcss = require('tailwindcss')

const { COMPILED_CSS_PATH, CSS_ENTRY, JEST_NATIVEWIND_OS } = require('./nativewind.config')

const INPUT = path.join(__dirname, CSS_ENTRY)

module.exports = async function compileGlobalCssForJest() {
  // **native 프리셋으로 컴파일한다**([[ADR-179]] 정정 1). 안 세우면 NativeWind 가 web 프리셋으로
  // 도는데(`nativewind/dist/tailwind/index.js` — 값이 없거나 `web` 이면 web), 그러면 jest 가 앱과
  // 다른 값을 본다. `invisible` 이 `visibility` 로 나오고 `shadow` 가 `box-shadow` 로 나오는 식이다.
  process.env.NATIVEWIND_OS = JEST_NATIVEWIND_OS

  const { css } = await postcss([
    tailwindcss({ config: path.join(__dirname, 'tailwind.config.js') }),
  ]).process(readFileSync(INPUT, 'utf8'), { from: INPUT })

  mkdirSync(path.dirname(COMPILED_CSS_PATH), { recursive: true })
  writeFileSync(COMPILED_CSS_PATH, css)
}
