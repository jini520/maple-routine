# ADR-006 테스트 러너와 테스트 작성 규칙

> 🟢 유효
> 옛 번호: ADR-156 · ADR-157 · ADR-179 정정 1
> 관련 소스: `jest.config.js` · `jest.setup.js` · `jest.global-setup.js` · `nativewind.config.js` · `jest.resolver.js` · `jest-extensions.d.ts` · `babel.config.js` · `src/storage/__tests__/fake-preferences.ts` · `src/native/__tests__/fake-native-ports.ts`

## 배경

React Native 로 옮기는 동안 테스트 러너가 둘이었다. 화면 쪽은 `jest-expo`, 웹 시절에 쓴 로직 테스트는
vitest 였다. 앱이 하나로 합쳐진 뒤에도 러너가 둘이면 매처 · 목 API · 설정도 두 벌이고, 새 테스트를 쓸
때마다 어느 쪽에 둘지 골라야 했다.

옮기는 동안에는 컴포넌트마다 렌더 트리 스냅샷도 두었다. 화면을 하나씩 옮기다 다른 화면을 건드려도 알
수 있게 하려는 것이었는데, 옮기기가 끝난 뒤에는 비용만 들었다. 파일 경로가 바뀌어도 깨지고, diff 는
수천 줄이라 아무도 읽지 않고, 날짜를 담은 스냅샷은 주가 바뀌면 깨졌다.

## 결정

### 결정 1. 러너는 jest 하나다

`jest-expo` 프리셋 위에서 모든 테스트를 한 번에 돌린다. 파일 이름의 두 형태는 러너가 아니라 테스트의
성격을 나타낸다.

| 이름 | 성격 |
|---|---|
| `*.spec.ts(x)` | RN 을 렌더하지 않는 순수 로직 · 데이터 · 저장소. node 에서 빨리 돈다 |
| `*.test.ts(x)` | RN 을 렌더하거나 RN 모듈을 목으로 바꾸는 것 |
| `*.test.mjs` | `scripts/` 의 ESM 배포 스크립트 |

두 이름을 하나로 합치지 않은 것은 성격 구분이 여전히 쓸모 있고, 합치려면 파일 백여 개를 다시 건드려야
하기 때문이다.

`jest.config.js` 의 `testMatch` 는 파일 이름으로 좁혀 둔다. 프리셋 기본값은 `__tests__` 안의 모든 파일을
테스트로 잡아서, 그 디렉터리에 둔 도우미 파일이 "테스트가 하나도 없다" 로 실패한다.

### 결정 2. vitest 에만 있던 기능 셋은 `jest.setup.js` 가 만든다

빼 버리면 그 테스트들이 조용히 약해지므로 같은 동작을 jest 위에 만들었다.

- `expect(값, '메시지')`. jest 는 두 번째 인자를 아무 말 없이 버린다. 이 메시지는 `it.each` 안에서 어느
  항목이 틀렸는지 알려 주므로, 실패 메시지 앞에 붙여 주는 래퍼를 둔다.
- `toHaveBeenCalledOnce` · `toHaveBeenCalledExactlyOnceWith` 매처. 두 단언으로 나누면 한 번만 불렸는지를
  빼먹어도 통과한다.

타입은 `jest-extensions.d.ts` 에 함께 적는다. 런타임만 고치면 tsc 가 실패한다.

`jest.setup.js` 는 그 밖에 세 가지를 모든 테스트에 적용한다. 가짜 Preferences 와 아무것도 안 하는 네이티브
포트를 주입하고(포트가 없으면 앱을 렌더하기만 해도 던진다, [[ADR-004]] 결정 2), NativeWind 스타일을
등록하고, 매 테스트 뒤에 토스트 자동 소멸 타이머를 지운다. 토스트를 띄운 채 끝난 테스트가 실제
`setTimeout` 을 남기면 jest 가 끝나지 않기 때문이다.

### 결정 3. 목 팩토리는 몇 번 불려도 같은 목을 돌려준다

jest 는 `jest.mock()` 팩토리가 바깥 변수를 참조하는 것을 막는다(이름이 `mock` 으로 시작하는 변수만
허용한다). 그래서 목 함수는 팩토리 안에서 만들고 `jest.requireMock(경로)` 로 꺼내 쓰거나, `mock` 으로
시작하는 변수를 팩토리 안에서 늦게 채운다.

`jest.resetModules()` 를 쓰는 스펙에서는 팩토리가 다시 불린다. 그때 새 목을 만들면 테스트가 들고 있던
목과 모듈이 쓰는 목이 서로 달라져서, 단언이 엉뚱한 목을 보게 된다. 그래서 팩토리는 같은 목을 돌려준다.

### 결정 4. 동적 `import()` 는 테스트에서만 `require` 로 바꾼다

`features/prehydrate.ts` 는 탭 스토어를 첫 렌더 뒤에 불러오려고 일부러 동적 `import()` 를 쓴다([[ADR-027]]).
jest 는 CommonJS 로 돌아서 네이티브 `import()` 를 만나면 실패한다.

소스를 바꿀 수 없으므로 `babel.config.js` 가 테스트 환경(`api.env('test')`)에서만 `import(x)` 를
`Promise.resolve().then(() => require(x))` 로 바꾼다. 적용 대상은 저장소의 `src/` 절대 경로 아래 파일뿐이다.
`/src/` 를 포함하는 모든 경로로 잡으면 `node_modules/react-native/src/` 까지 바뀌어 `Unexpected token 'export'`
로 실패한다. `@babel/plugin-transform-modules-commonjs` 로는 안 된다. `babel-preset-expo` 가 동적 import 를
일부러 남기도록 설정하기 때문이다. Metro 는 이 변환을 거치지 않으므로 앱 번들에는 영향이 없다.

### 결정 5. DOM 에서 도는 스펙 여섯은 jsdom 환경에 둔다

`@jest-environment jsdom` 과 `@testing-library/react` 로 도는 스펙이 여섯 있다.

- `features/auth/__tests__/use-api-key-notice.spec.tsx`
- `features/boss-profit/__tests__/use-period-error-toast.spec.tsx`
- `features/notice/__tests__/use-notice-delivery.spec.tsx`
- `features/schedule-sync/__tests__/use-sync-error-toast.spec.tsx`
- `hooks/__tests__/useCountUp.spec.tsx`
- `storage/__tests__/pending-notice.spec.ts`

React Native 용 testing-library 로 옮겨 봤다가 되돌렸다. 그쪽 `render` 가 비동기라 케이스마다 `await` 이
붙고, `requestAnimationFrame` 을 손으로 돌리는 `useCountUp` 은 값이 맞지 않았다. 그래서 `react-dom` ·
`jsdom` · `@testing-library/react` 가 devDependency 로 남아 있다.

jsdom 은 Node 의 `TextEncoder` 를 지우므로 `jest.setup.js` 맨 앞에서 다시 채운다. NativeWind 등록이 그것을
쓴다.

### 결정 6. 렌더 트리 스냅샷을 쓰지 않는다

스냅샷으로는 무엇이 달라졌는지만 알 수 있고, 무엇이 맞는지는 알 수 없다. 맞는 값이 정해져 있으면 그 값을
직접 단언한다. 지금 저장소에는 `toMatchSnapshot` 과 `.snap` 파일이 하나도 없다.

### 결정 7. 값을 그대로 비교하는 테스트와 뻔한 테스트는 두지 않는다

상수나 클래스 이름을 그대로 비교하기만 하는 테스트, 빈 상태에서 문구가 나오는지만 보는 테스트, 입력과
출력이 식에서 바로 보이는 테스트는 지운다. 남기는 것은 불변 조건 · 설계 판단 · 버그 재발 방지 · 배선(입력이
어느 인자로 가는가) · 플랫폼 문제 회피 · 상태 전이를 지키는 테스트다. 남긴 테스트가 무엇을 지키는지는
ADR 의 테스트 표에 적는다([[ADR-003]] 결정 2).

### 결정 8. 작업 중에는 바꾼 범위만, 저장소 루트에서 돌린다

전체를 돌리면 스위트가 270 개 가까이라 40초가 넘게 걸리고, 애니메이션이 무거운 스위트에서 가끔 워커가 죽는다. 그래서
작업 중에는 바꾼 디렉터리만 지정해 돌린다. 공용 상수나 유틸을 고쳤다면 그것을 쓰는 경로도 함께 넣는다.
배선 누락은 `npx tsc --noEmit` 이 전역으로 잡는다.

```bash
npx jest src/lib src/app/utility --testPathIgnorePatterns /node_modules/ /.claude/
```

- 저장소 루트에서 돌린다. `src/` 에서 돌리면 Tailwind 의 content 경로가 어긋나 스타일 단언이 한꺼번에
  실패한다. "No utility classes were detected" 경고가 보이면 이 경우다.
- `.claude/worktrees/` 의 사본이 jest 의 rootDir 안에 있어서, 경로를 지정해도 사본까지 함께 돈다.
  `--testPathIgnorePatterns /node_modules/ /.claude/` 로 뺀다.
- 전체 실행(`npm test`)에서 테스트 몇 개가 "Test suite failed to run" 으로 실패하면 먼저 워커 크래시를
  의심한다. 매번 다른 스위트가 실패한다.

### 결정 9. jest 도 앱과 같은 NativeWind native 프리셋으로 스타일을 컴파일한다

`jest.global-setup.js` 가 `global.css` 를 컴파일하기 전에 `process.env.NATIVEWIND_OS` 를 `ios`
(`nativewind.config.js` 의 `JEST_NATIVEWIND_OS`)로 설정한다. Metro 는 플랫폼을 넘겨 주지만 jest 에서는 넘겨 주는 곳이 없어서,
그대로 두면 web 프리셋으로 컴파일된다.

web 과 native 는 같은 클래스를 다른 값으로 만든다. `invisible` 이 `visibility` 대 `opacity` 로, `shadow` 가
`box-shadow` 대 `elevation` 계열로, 리터럴 색이 `rgb(… / var(…))` 대 hex 로 달라진다. 클래스 이름이 같아 테스트는
통과하는데 앱은 다른 화면을 그리고, 테스트가 web 값을 기대값으로 굳히게 된다. `ios` 를 고른 것은 jest 의
`Platform.OS` 가 `ios` 라서, 코드 분기와 스타일이 같은 플랫폼을 보게 하려는 것이다.

두 플랫폼 사이에서 컴파일 결과가 다른 것은 Android 가 그림자에 `elevation` 을 더하는 것 하나뿐이다. 그래서 jest 를
플랫폼마다 두 번 돌리지 않고, 그 차이를 테스트 하나가 컴파일 결과로 직접 확인한다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `src/__tests__/nativewind-preset.test.ts` | 결정 9: jest 가 보는 스타일이 web 프리셋 산물이 아닌지, Android 만 그림자에 `elevation` 을 더하는지, 그 밖의 선언은 두 플랫폼이 같은지 본다. 달라지는 곳이 늘면 여기서 실패한다 |

결정 1 ~ 8 을 따로 지키는 테스트는 없다. 결정 1 ~ 5 가 깨지면 해당 스위트가 실행 단계에서 실패해서 바로 드러난다.

## 번호 기록

- ADR-006 (2026-10-19): 옛 ADR-156 · 157 을 합쳐 처음 작성. 옛 ADR-156 결정 2(광고 모듈 삭제)는 끝난
  작업이라 옮기지 않았고, 결정 3(값만 비교하는 테스트도 남긴다)은 결정 7 로 바뀌었다. 옛 ADR-179 정정 1 은 결정 9 로 옮겼다
