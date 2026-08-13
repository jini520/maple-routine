# Step 7: app-capacitor

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` (원칙·«되돌릴 수 없는 지점»)
- `/docs/foundation/release.md` (**서명·`versionCode`·빌드 커맨드 — 이 step 이 그것들을 옮긴다**)
- `/docs/features/splash.md` (`android/…/SplashActivity` · iOS 스토리보드 · `capacitor.config.ts`)
- `/docs/ADR.md` 에서 **[[ADR-128]] · [[ADR-001]] · [[ADR-025]] · [[ADR-024]]** 만 열어라
- **이전 step 산출물**: `packages/core/src/**` 전체 · `src/` 에 남은 것들 · `@core/*` alias ·
  루트 `package.json` scripts

## 배경

`src/` 에 남은 전부와 네이티브 프로젝트를 `packages/app-capacitor/` 로 옮겨, 세 패키지 구조를 완성한다.

```
packages/
  core/            (완성됨)
  app-capacitor/   ← 이 step
  app-rn/          (step 8)
```

**옮길 것:**

| 대상 | 비고 |
|---|---|
| `src/app/` · `src/components/` · `src/assets/` | 뷰 레이어 |
| `src/App.tsx` · `src/main.tsx` · `src/index.css` | 진입점 |
| `src/storage/adapters/` · `src/native/` | Capacitor 구현 |
| `src/features/screen-stack/` · `src/lib/` 잔여 8개 | RN 에서 삭제될 코드 |
| `src/__tests__/` | DOM 스냅샷 헬퍼 포함 |
| `android/` · `ios/` · `capacitor.config.ts` | **네이티브 프로젝트** |
| `index.html` · `vite.config.ts` · `public/` · `resources/` | 빌드 설정 |

**루트에 남길 것:** `docs/` · `phases/` · `scripts/` · `site/` · `CLAUDE.md` · `PRIVACY.md` ·
루트 `package.json`(워크스페이스 오케스트레이션) · `tsconfig.json`(references) · `.github/`

## 작업

### 1. 서명·식별자를 절대 건드리지 마라 — 최우선

`android/app/build.gradle` 의 `applicationId`, 서명 설정, `versionCode`/`versionName`,
`capacitor.config.ts` 의 `appId`(`com.mapleroutine.app`), iOS `PRODUCT_BUNDLE_IDENTIFIER` —
**한 글자도 바꾸지 마라.**

이유: 이 값들이 바뀌면 기존 사용자에게 **업데이트가 아니라 신규 설치**가 되고 앱 데이터
디렉터리가 새로 만들어진다. 보스 수익 기록·드랍 기록이 전부 사라진다(`migration/data.md` «전제»).

경로가 바뀌므로 **참조**는 고쳐야 한다. 값은 그대로 두고 경로만 고쳐라.

### 2. `git mv` 로 옮겨라

`android/` · `ios/` 는 파일이 많다. `git mv android packages/app-capacitor/android` 처럼 디렉터리
단위로 옮겨라.

### 3. `packages/app-capacitor/package.json` 작성

- `name`: `@maple-routine/app-capacitor`
- `private: true`
- `dependencies` 에 `@maple-routine/core` 와 기존 런타임 의존성(Capacitor 플러그인, react, zustand 등)
- `scripts`: `dev` · `build` · `test` · `lint` · `preview` — **루트에서 쓰던 것과 같은 내용**

### 4. 루트 `package.json` 의 scripts 를 위임으로 바꿔라

**키 이름은 그대로 두고 내용만 위임으로 바꾼다.**

```
"build": "npm run build -w @maple-routine/app-capacitor"
"dev":   "npm run dev -w @maple-routine/app-capacitor"
"lint":  "eslint ."
"test":  "vitest run"     ← 루트에서 저장소 전체를 계속 덮는다(step 0 결정)
```

`npm test` 가 루트에서 `packages/**` 전체 테스트를 도는 구조를 **유지하라.** 이유: 이 task 의
게이트가 "199파일 / 3044개 전부 통과"이고, 테스트가 패키지별로 쪼개지면 그 수를 한 번에 확인할 수 없다.

### 5. 경로 참조를 전수 수정하라

이동으로 깨지는 것들:

- `vite.config.ts` 의 `@core/*` alias 상대 경로 (`packages/app-capacitor` 기준으로 재계산)
- `tsconfig.app.json` 의 `paths`·`include`
- 루트 `tsconfig.json` 의 `references`
- `vitest.setup.ts` 경로
- `capacitor.config.ts` 의 `webDir: 'dist'` — 산출물 위치가 바뀐다
- `scripts/publish-live-update.mjs` 가 참조하는 빌드 산출물·`package.json` 버전 경로 ([[ADR-024]])
- `scripts/build-site.mjs`
- `.github/workflows/*.yml` 의 빌드 경로
- `eslint.config.js` 의 대상 범위

**`scripts/` 와 `.github/` 를 빠뜨리기 쉽다.** 테스트가 안 잡으므로 직접 확인하라.

### 6. OTA 버전 축을 확인하라

`scripts/publish-live-update.mjs` 는 `package.json` 의 `version` 을 OTA 번들 버전으로 쓴다([[ADR-024]]).
이동 후 **어느 `package.json` 을 읽는지** 확실히 하라 — 루트가 아니라
`packages/app-capacitor/package.json` 이어야 한다. 잘못 읽으면 배포 매니페스트의 버전이 틀어진다.

## Acceptance Criteria

```bash
npm install
npm run build      # 루트에서 위임되어 app-capacitor 빌드 — 컴파일 에러 없음
npm test           # 199파일 / 3044개 전부 통과
npm run lint       # 통과
```

산출물과 식별자 확인:

```bash
ls packages/app-capacitor/dist/index.html          # 빌드 산출물이 제자리에 있는가
grep -r "com.mapleroutine.app" packages/app-capacitor/capacitor.config.ts \
  packages/app-capacitor/android/app/build.gradle   # appId 가 그대로인가
git diff HEAD~1 -- '*build.gradle' | grep -E "^[+-].*(versionCode|applicationId|signingConfig)"
  # ← 출력이 있으면 안 된다. 있다면 되돌려라
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **네이티브 동기화를 수동으로 확인하라**(harness 환경에서 실패할 수 있으므로 AC 에 넣지 않았다):
   ```bash
   cd packages/app-capacitor && npx cap sync
   ```
   실패하면 `error` 로 기록하되, 원인이 환경(Android SDK/CocoaPods 미설치)이면 `blocked` 로 기록하고
   사유에 그 사실을 적어라.
3. 아키텍처 체크리스트:
   - `appId` · 서명 설정 · `versionCode` 가 **하나도** 안 바뀌었는가?
   - 루트 `package.json` 의 script **키 이름**이 그대로인가?
   - `scripts/` 와 `.github/workflows/` 의 경로를 전부 고쳤는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
4. 결과에 따라 `phases/rn-core-extraction/index.json` 의 step 7 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "완성된 패키지 구조와 고친 경로 참조 목록"`
   - 실패 → `"status": "error"`, `"error_message"` / 개입 필요 → `"status": "blocked"`, `"blocked_reason"`

## 금지사항

- **`applicationId` / `appId` / `PRODUCT_BUNDLE_IDENTIFIER` / 서명 설정 / `versionCode` 를 바꾸지 마라.**
  이유: 바뀌면 OS 가 업데이트가 아닌 신규 설치로 처리해 **기존 사용자의 보스 수익·드랍 기록이 전부
  사라진다.** 이 task 에서 되돌릴 수 없는 유일한 실수다.
- **`android/` `ios/` 안의 리소스를 "정리"하지 마라.** 특히 `values-night/`(MIUI 강제 다크 대응,
  [[ADR-025]])와 스플래시 관련 리소스. 이유: 실기기에서만 드러나는 문제를 해결한 결과물이고,
  지우면 재현 경로가 없다.
- **루트 `package.json` 의 script 키 이름을 바꾸지 마라.** 이유: step 8 의 AC 와 harness 검증이
  `npm run build` / `npm test` 에 의존한다.
- **테스트를 패키지별로 쪼개지 마라.** 이유: "199파일 / 3044개 전부 통과"라는 게이트를 한 번에 확인할 수 없게 된다.
- **`npm run build` 산출물 경로를 바꾸면서 `publish-live-update.mjs` 를 안 고치지 마라.** 이유: OTA
  배포가 조용히 잘못된 번들을 올린다 — 테스트가 절대 못 잡는 종류의 실패다.
- 기존 테스트를 깨뜨리지 마라.
