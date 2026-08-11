# Step 6: rn-system

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-009]] · [[ADR-104]] · [[ADR-025]] · [[ADR-117]]** 만 열어라
- `/docs/features/theme.md`(색 구성 판정) · `/docs/features/splash.md`
- `packages/core/src/native/ports.ts` — **`ColorSchemePort` · `KeyboardPort` · `StatusBarPort` ·
  `SplashScreenPort` 계약**
- `packages/core/src/native/{status-bar,keyboard,splash-screen}.ts` (포트를 부르는 곳)
- `packages/app-capacitor/src/native/adapters/capacitor-{color-scheme,keyboard,status-bar,splash-screen}.ts`
  (**참조 구현 4종**)

## 배경

RN 내장 API 로 감싸는 얇은 어댑터 넷을 한 번에 만든다. 각각이 몇 줄이라 step 을 쪼개면 지시가 본문보다
길어진다.

| 포트 | RN 대응 |
|---|---|
| `ColorSchemePort` | `Appearance.getColorScheme()` |
| `KeyboardPort` | `Keyboard.addListener('keyboardDidShow'/'keyboardDidHide')` |
| `StatusBarPort` | `StatusBar.setBarStyle()` |
| `SplashScreenPort` | `react-native-bootsplash` 또는 `expo-splash-screen` |

## 작업

### 1. `ColorSchemePort`

```ts
get(): 'light' | 'dark'   // 동기다
```

`Appearance.getColorScheme()` 은 `null` 을 돌려줄 수 있다 — 그때는 **`'light'` 로 폴백**하라
(`capacitor-color-scheme.ts` 가 `matchMedia` 없을 때 하는 것과 같은 판단).

**구독 API 를 추가하지 마라.** 포트 주석이 이유를 적어 뒀다 — 저장된 테마가 없을 때의 1회성 판정에만
쓰고 실행 중 OS 설정 변경을 따라가지 않는 것이 현재 정책이다([[ADR-104]]).

### 2. `KeyboardPort`

```ts
addVisibilityListener(onChange: (visible: boolean) => void): Promise<() => void>
```

RN `Keyboard` 이벤트 두 개를 붙이고 **해제 함수를 돌려줘라.** 해제가 실제로 리스너를 떼는지 확인하라 —
안 떼면 화면 전환마다 리스너가 쌓인다.

Android 는 `keyboardDidShow`/`keyboardDidHide` 가 `windowSoftInputMode` 설정에 따라 안 올 수 있다.
안 오는 환경이면 **거짓 신호를 만들지 말고** 그냥 안 부르는 쪽이 낫다.

### 3. `StatusBarPort`

```ts
setStyle(isDarkTheme: boolean): Promise<void>
```

**인자 이름이 `isDarkTheme` 이고 이는 "테마가 어두운가"다.** 상태바 글리프는 그 반대 명암이어야 읽힌다
— `capacitor-status-bar.ts` 가 어느 쪽으로 매핑하는지 **읽고 그대로 따르라.** 뒤집으면 어두운 배경에
어두운 글자가 된다.

### 4. `SplashScreenPort`

```ts
hide(): Promise<void>
show(): Promise<void>
```

`capacitor-splash-screen.ts` 는 **네이티브 스플래시 + DOM 커버 두 장**을 다룬다([[ADR-117]] 결정 4).
RN 에는 DOM 커버가 없다 — **네이티브 스플래시만** 다루면 된다.

`show()` 는 원래 "리로드 직전에 화면을 덮는" 용도였다(OTA 적용·캐시 초기화). RN 에는 웹뷰 리로드가
없으므로 **부를 곳이 없을 수 있다.** 라이브러리가 다시 띄우는 것을 지원하지 않으면 **no-op 으로 두되
왜 no-op 인지 주석에 적어라.** 여기서의 no-op 은 "이 플랫폼에 그 개념이 없다"라서 정당하다 —
step 7 의 미구현 포트와는 성격이 다르다.

### 5. jest 로 테스트할 것

- `Appearance.getColorScheme()` 이 `null` 일 때 `'light'` 폴백
- `KeyboardPort` 해제 함수가 리스너를 떼는지
- `setStyle(true)` / `setStyle(false)` 가 각각 어느 RN 값으로 가는지 (**Capacitor 매핑과 같은지**)

## Acceptance Criteria

```bash
npm test           # vitest 3044 + jest 전부 통과
npm run build
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

**iOS**: best-effort. 막히면 `blocked` + 사유.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 상태바 명암 매핑이 Capacitor 구현과 **같은 방향**인가?
   - `ColorSchemePort` 에 구독 API 를 추가하지 않았는가?
   - `SplashScreenPort.show()` 가 no-op 이라면 그 이유가 주석에 있는가?
   - `packages/core` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-adapters/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "4개 어댑터 경로·상태바 매핑 방향·splash show() 처리 방식"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **상태바 명암 매핑을 추측으로 정하지 마라.** `capacitor-status-bar.ts` 를 읽고 같은 방향으로 하라.
  이유: 뒤집으면 어두운 배경에 어두운 글자가 되어 상태바가 안 보인다 — 실기기에서만 드러난다.
- **`ColorSchemePort` 에 구독 API 를 추가하지 마라.** 이유: 부를 곳이 없는 인터페이스는 구현마다 죽은
  코드가 된다(포트 주석의 판단). 필요해지면 그때 추가한다.
- **`SplashScreenPort` 에 DOM 커버 개념을 흉내 내지 마라.** 이유: RN 에 웹뷰 리로드가 없어 그 커버가
  풀려는 문제 자체가 존재하지 않는다.
- **`packages/core` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
