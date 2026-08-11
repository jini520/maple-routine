# Step 8: rn-scaffold

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` — «의존성 대응표» · 단계 0 게이트
- `/docs/migration/data.md` — **«전제» 절. `appId` 가 왜 고정이어야 하는지**
- `/docs/ADR.md` 에서 **[[ADR-127]]** 만 열어라 (특히 결정 3·5·7)
- **이전 step 산출물**: `packages/core/**` · `packages/app-capacitor/**` · 루트 `package.json`
  (위임 scripts) · 루트 `tsconfig.json`

`packages/core` 가 무엇을 export 하는지, 포트 인터페이스(`@core/storage/ports` ·
`src/native/ports.ts` 상당물)가 어떤 모양인지 먼저 읽어라.

## 배경

React Native 앱의 **뼈대만** 세운다. 화면을 옮기지 않는다 — 그것은 다음 task(단계 3·4) 대상이다.

이 step 의 성공 기준은 하나다: **`packages/app-rn` 이 `packages/core` 를 import 해서 번들이 만들어진다.**

`[[ADR-127]]` 결정에 따라 **Expo bare** 로 간다 — `android/` `ios/` 를 git 에 커밋해 직접 관리한다.
이유: 서명키·`appId` 유지, 기존 네이티브 리소스 재사용, 커스텀 네이티브 모듈(Preferences 어댑터)
작성이 전부 네이티브 프로젝트 직접 통제를 요구하고, 데이터 보존이 걸린 전환에서 변수를 줄여야 한다.

## 작업

### 1. `packages/app-rn` 생성

- Expo 프로젝트로 초기화하되 **네이티브 프로젝트를 생성해 커밋한다**(bare).
  `npx expo prebuild` 로 `android/` `ios/` 를 만든 뒤 `.gitignore` 에서 제외되지 않게 하라.
- `name`: `@maple-routine/app-rn`, `private: true`
- **`appId` / `applicationId` / `PRODUCT_BUNDLE_IDENTIFIER` 를 `com.mapleroutine.app` 으로 설정하라.**
  이것이 기존 사용자 데이터를 이어받는 유일한 조건이다(`migration/data.md` «전제»).

> **주의**: 이 step 에서 만든 RN 앱을 실기기에 설치하지 마라. 같은 `appId` 를 가진 서명이 다른
> 빌드를 설치하면 기존 앱이 밀려나거나 설치가 거부된다. 이 step 의 검증은 **번들 생성까지**다.

### 2. 모노레포에서 Metro 가 `packages/core` 를 찾게 하라

RN 의 Metro 번들러는 모노레포 심링크를 기본으로 못 따라간다. `packages/app-rn/metro.config.js` 에서:

- `watchFolders` 에 저장소 루트(또는 `packages/core`)를 추가
- `resolver.nodeModulesPaths` 에 앱과 루트의 `node_modules` 를 모두 등록
- `resolver.disableHierarchicalLookup` 여부는 실제 해석 결과를 보고 결정하라

**이 설정이 이 step 에서 가장 실패하기 쉬운 지점이다.** 번들이 `Unable to resolve module` 로
죽으면 대부분 여기다.

### 3. `@core/*` alias 를 RN 쪽에도 맞춰라

`packages/app-rn/tsconfig.json` 의 `paths` 와 `metro.config.js` / `babel.config.js`
(`babel-plugin-module-resolver`)의 alias 를 일치시켜라. TypeScript 가 해석하는 경로와 Metro 가
해석하는 경로가 다르면 **타입은 통과하는데 런타임에 죽는다.**

### 4. core 를 실제로 쓰는 최소 화면 하나

`packages/core` 에서 **부작용 없는 순수 함수 하나**를 import 해 화면에 렌더하라. 예: `@core/data` 의
게임 데이터 개수, `@core/lib` 의 순수 포맷 함수 결과.

**저장소나 네이티브 포트를 부르는 코드를 쓰지 마라** — 아직 RN 어댑터가 없어서 반드시 실패한다.
이 화면의 목적은 "core 가 RN 번들에 들어간다"를 증명하는 것뿐이다.

### 5. RN 어댑터는 만들지 마라

`PreferencesPort` / `SqlitePort` / 네이티브 포트의 RN 구현은 **다음 task 대상**이다
(`migration/README.md` 1단계). 여기서 시작하면 이 step 의 게이트가 흐려진다.

### 6. 루트 통합

- 루트 `package.json` 의 `workspaces` 가 `packages/*` 이므로 자동 포함된다. `npm install` 확인
- 루트 `npm test` 가 `packages/app-rn` 때문에 깨지지 않게 하라 — RN 테스트를 아직 안 쓰므로
  vitest 탐색 범위에서 제외하는 것이 가장 단순하다
- 루트 `npm run build` 는 **계속 `app-capacitor` 를 빌드한다.** 바꾸지 마라

## Acceptance Criteria

```bash
npm install
npm run build      # 여전히 app-capacitor 를 빌드 — 컴파일 에러 없음
npm test           # 197개 전부 통과 (RN 추가로 줄거나 늘지 않아야 한다)
npm run lint       # 통과
```

RN 번들이 실제로 만들어지는지 — **이 step 의 핵심 검증**:

```bash
cd packages/app-rn
npx tsc --noEmit -p tsconfig.json                    # 타입 통과
npx expo export --platform android --output-dir /tmp/rn-export-check
# ↑ Metro 가 packages/core 를 해석해 번들을 만들어야 한다.
#   "Unable to resolve module" 이 나오면 metro.config.js 설정 실패다
```

식별자 확인:

```bash
grep -rn "com.mapleroutine.app" packages/app-rn/app.json packages/app-rn/android/app/build.gradle
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `packages/app-rn` 의 `appId` 가 `com.mapleroutine.app` 인가?
   - `packages/core` 를 수정했는가? **했다면 잘못된 것이다** — core 는 이 step 에서 읽기 전용이다
   - `packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
   - 루트 `npm run build` 가 여전히 Capacitor 앱을 빌드하는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/rn-core-extraction/index.json` 의 step 8 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "RN 앱 경로 · Metro 모노레포 설정 방식 · 검증한 번들 커맨드"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - **Android SDK / Xcode / CocoaPods 미설치 등 환경 문제로 `expo prebuild` 나 `expo export` 가
     불가하면 → `"status": "blocked"`, `"blocked_reason"` 에 무엇이 없어서 막혔는지 정확히 적고 즉시 중단**

## 금지사항

- **RN 앱을 실기기나 에뮬레이터에 설치하지 마라.** 이유: `appId` 가 기존 앱과 같고 서명이 달라,
  설치하면 기존 앱이 밀려나거나 설치가 거부된다. 이 step 의 검증은 번들 생성까지다.
- **`packages/core` 나 `packages/app-capacitor` 를 수정하지 마라.** 이유: 이 step 은 신규 패키지
  추가다. 앞 8개 step 이 확보한 "197개 통과" 상태를 건드릴 이유가 없고, 건드리면 실패 원인이
  RN 설정인지 기존 코드인지 갈리지 않는다.
- **저장소·네이티브 포트의 RN 구현을 만들지 마라.** 이유: 다음 task(`migration/README.md` 1단계)
  대상이다. 여기서 시작하면 이 step 의 게이트("core 가 RN 번들에 들어간다")가 흐려진다.
- **화면을 옮기지 마라.** 이유: 단계 3·4 대상이고, 각 화면은 `migration/parity-inventory.md` 의
  ADR 계약 체크리스트를 소진하며 진행해야 한다. 뼈대 단계에서 손대면 그 규율이 무너진다.
- **`expo prebuild` 로 생성된 `android/` `ios/` 를 `.gitignore` 에 넣지 마라.** 이유: bare 로 가기로
  했고([[ADR-127]]), 서명 설정과 커스텀 네이티브 모듈이 거기 들어간다.
- **루트 `npm run build` 를 RN 빌드로 바꾸지 마라.** 이유: Capacitor 앱은 패리티까지 계속 배포된다
  ([[ADR-127]] 결정 3).
- 기존 테스트를 깨뜨리지 마라.
