// `global.css` 를 **jest 실행당 한 번** Tailwind 로 컴파일해 캐시에 떨궈 둔다. `jest.setup.js` 가
// 그것을 읽어 테스트마다 스타일 컬렉션에 넣는다.
//
// **왜 컴파일까지 하는가**: 안 하면 `className` 이 붙은 컴포넌트가 스타일 없이 렌더돼, 테스트가
// **그 클래스가 무슨 값이 되는지**(`padding` 등)를 단언할 수 없다.
//
// NativeWind 가 주는 `nativewind/test` 의 `render()` 를 쓰지 않는 이유: 그쪽은 **넘긴 JSX 에 직접
// 적힌 `className` 만** 훑어 컴파일한다(`getClassNames` 가 `props.children` 을 따라간다). 우리 테스트는
// 컴포넌트를 렌더하고 그 **안쪽** 클래스가 풀리기를 기대하므로 그 방식으로는 빈 스타일이 된다.
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
  // **native 프리셋으로 컴파일한다**. 안 세우면 NativeWind 가 web 프리셋으로 돈다
  // (`nativewind/dist/tailwind/index.js` 는 값이 없거나 `web` 이면 web 으로 본다). 그러면 jest 가 앱과
  // 다른 값을 본다. `invisible` 이 `visibility` 로 나오고 `shadow` 가 `box-shadow` 로 나오는 식이다.
  process.env.NATIVEWIND_OS = JEST_NATIVEWIND_OS

  const { css } = await postcss([
    tailwindcss({ config: path.join(__dirname, 'tailwind.config.js') }),
  ]).process(readFileSync(INPUT, 'utf8'), { from: INPUT })

  mkdirSync(path.dirname(COMPILED_CSS_PATH), { recursive: true })
  writeFileSync(COMPILED_CSS_PATH, css)
}
