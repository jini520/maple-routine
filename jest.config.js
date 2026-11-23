// jest 설정. 이 저장소의 테스트 러너는 jest 하나다.
//
// **경로 alias 를 두지 않는다.** 모든 import 가 상대 경로라 tsc·Metro·jest 가 같은 파일을 찾는다.
// alias 를 더하면 세 도구에 매핑을 따로 적어야 하고, 하나가 어긋나면 도구마다 다른 파일을 본다.
// 아래 `moduleNameMapper` 의 `game-data/initial` 줄은 alias 가 아니라 테스트에서만 모듈을 fixture 로 바꾸는 줄이다.
//
// NativeWind 배선은 두 파일로 나뉜다. `globalSetup` 이 `global.css` 를 실행당
// 한 번 컴파일하고, `setupFilesAfterEnv` 가 그 결과를 테스트마다 주입한다. 나눈 이유는 컴파일이
// 비동기라 `setupFiles`(동기)에 못 들어가고, 매 테스트 파일마다 다시 하면 느리기 때문이다.
//
// `testMatch` 를 **파일 이름으로** 좁힌다. `jest-expo` 기본값은 `**/__tests__/**/*.[jt]s?(x)` 라
// 그 디렉터리에 둔 **보조 파일까지 테스트 스위트로 집어** *"must contain at least one test"* 로
// 빨개진다(`src/navigation/__tests__/harness.tsx`). 보조 파일을 밖으로 빼는 대신 규칙을 좁힌 이유는
// 그 파일이 테스트 전용이라 소스 트리에 있으면 어디에도 안 어울리기 때문이고, 이 저장소의 테스트가
// 이미 전부 아래 세 이름 형태라 잃는 것이 없기 때문이다.
//
// **ESM 만 내보내는 의존성(`ESM_ONLY_DEPS`) 때문에 프리셋을 고친다.** Metro 는 ESM 을 그대로 먹지만
// jest 는 `SyntaxError: Unexpected token 'export'` 로 죽는다(실측). 두 곳이 각각 다른 이유로 막는다.
//
// ① `transformIgnorePatterns`: `node_modules` 는 기본 제외이고, **하나라도 걸리면 제외**라 항목을
//    더해서 예외를 만들 수 없다. 프리셋 패턴의 부정 룩어헤드 안에 이름을 끼워 넣는 것이 유일한 방법.
// ② `transform`: 프리셋의 babel 패턴이 `\.[jt]sx?$` 라 **`.mjs` 는 애초에 트랜스포머가 없다**.
//    `lucide-react-native` 는 `exports` 맵의 `react-native` 조건에 `.mjs` 만 두어서, ①만 고치면
//    여전히 같은 자리에서 죽는다(실측).
//
// 둘 다 프리셋의 값에 의존하므로, 프리셋이 그 문자열을 바꾸면 **다시 같은 SyntaxError 로 시끄럽게**
// 깨진다(조용히 통과하지 않는다).
//
// CJS 빌드로 매핑하는 안(`moduleNameMapper`)도 되지만, 그러면 **jest 는 CJS·Metro 는 ESM** 을 보게
// 된다. 같은 소스의 두 빌드라 실질 차이는 없어도, 위 alias 와 같은 이유로 두 도구가 같은 파일을 보게
// 두려고 그쪽을 고르지 않았다.
const expoPreset = require('jest-expo/jest-preset')

/** ESM 만 내보내는 의존성. jest 가 트랜스폼해야 한다. */
const ESM_ONLY_DEPS = ['lucide-react-native', '@noble/hashes']

const NEGATIVE_LOOKAHEAD = '(?!('

module.exports = {
  preset: 'jest-expo',
  // 저장소 전체를 훑으면 시작에 10초가 걸린다(ios/build · .claude/worktrees 까지 33만 파일). 테스트와 소스가
  // 있는 세 곳만 훑는다. .claude/worktrees/ 의 사본이 함께 도는 것도 이것으로 막힌다.
  roots: ['<rootDir>/src', '<rootDir>/scripts', '<rootDir>/ota'],
  // 워커는 끝난 테스트 파일의 vm 컨텍스트를 놓아주지 않아 힙이 파일마다 는다. 한도가 없으면 전체 실행 끝에 워커가
  // 제때 끝나지 못해 강제 종료된다. 파일을 끝낸 워커의 힙이 이 값을 넘으면 다음 파일 전에 새 워커로 바꾼다.
  workerIdleMemoryLimit: '512MB',
  // `*.test.*` 와 `*.spec.*` 는 러너가 아니라 테스트의 성격을 나눈 이름이다. `.mjs` 는 `[jt]s` 글롭에
  // 안 걸려서 따로 적는다. `scripts/` 의 **배포 스크립트가 ESM 파일**이다.
  testMatch: ['**/*.test.[jt]s?(x)', '**/*.spec.[jt]s?(x)', '**/*.test.mjs'],
  // reanimated 4 가 `react-native-worklets` 위에 서 있고 그 패키지의 `.native.*` 변형이 jest 에서
  // 즉시 죽는다. 프리셋의 해석기를 대체하는 것이 아니라 **겹친다**(`jest.resolver.js`).
  resolver: '<rootDir>/jest.resolver.js',
  globalSetup: '<rootDir>/jest.global-setup.js',
  // `react-native-gesture-handler` 의 네이티브 모듈 목. 프리셋의 `setupFiles` **뒤에** 붙인다
  // (`GestureHandlerRootView` 가 렌더 시 `RNGestureHandlerModule.install()` 을 부르는데, 목이
  // 없으면 *"install is not a function"* 으로 죽는다). 라이브러리가 공식으로 주는 파일이다.
  setupFiles: [...expoPreset.setupFiles, require.resolve('react-native-gesture-handler/jestSetup')],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // 앱은 게임 데이터 표를 빈 값으로 켜고 서버에서 받는다. 테스트는 이 모듈을 fixture 판으로 바꿔 실제 값으로 돈다.
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    '/game-data/initial$': '<rootDir>/src/__fixtures__/game-data/initial.ts',
  },
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.includes(NEGATIVE_LOOKAHEAD)
      ? pattern.replace(NEGATIVE_LOOKAHEAD, `${NEGATIVE_LOOKAHEAD}${ESM_ONLY_DEPS.join('|')}|`)
      : pattern,
  ),
  // `babel-jest` 를 옵션 없이 두면 이 패키지의 `babel.config.js` 를 그대로 쓴다. 우리 소스와 같은
  // 파이프라인이라 프리셋의 babel 옵션을 베낄 필요가 없다.
  transform: { ...expoPreset.transform, '\\.mjs$': 'babel-jest' },
}
