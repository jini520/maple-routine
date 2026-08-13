# Step 0: workspace-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` (**이 task 전체의 원칙·단계. 반드시 읽어라**)
- `/docs/ADR.md` 에서 **[[ADR-128]] 한 개만** `/docs/adr/ADR-128.md` 로 열어라. 전체를 컨텍스트에 올리지 말 것
- `/CLAUDE.md`
- `package.json` · `vite.config.ts` · `tsconfig.json` · `tsconfig.app.json` · `tsconfig.node.json` · `vitest.setup.ts` · `eslint.config.js`

## 배경

이 저장소를 npm workspaces 모노레포로 바꾸는 첫 단계다. 최종 목표 구조는 이렇다.

```
packages/
  core/            플랫폼 독립 로직. DOM 도 Capacitor 도 모른다
  app-capacitor/   현재 Capacitor 앱 (계속 배포한다)
  app-rn/          새 React Native 앱
```

**이 step 에서는 뼈대만 만든다. 파일은 한 개도 옮기지 않는다.**

지금 소스에는 **path alias 가 없고 전부 상대 경로 import** 다. 이 상태로 디렉터리를 옮기면 import 가
대량으로 깨져서 diff 에서 실수를 찾을 수 없다. 그래서 이동을 시작하기 **전에** alias 를 먼저 깐다.

## 작업

### 1. 루트 `package.json` 에 workspaces 추가

```json
"workspaces": ["packages/*"]
```

**기존 `scripts` 의 키 이름(`dev` `build` `test` `lint` `preview` 등)을 절대 바꾸지 마라.** 이후 모든
step 의 Acceptance Criteria 와 harness 검증이 이 이름에 의존한다. 내용(우변)은 이후 step 에서 바뀔 수
있지만 이름은 이 task 가 끝날 때까지 고정이다.

### 2. `packages/core` 뼈대 생성

- `packages/core/package.json`
  - `name`: `@maple-routine/core`
  - `private: true`, `type: "module"`
  - `main`/`exports` 는 소스를 직접 가리킨다(빌드 산출물이 아니라 TS 소스). 이 모노레포는 core 를
    별도 빌드하지 않고 각 앱의 번들러가 소스를 직접 컴파일한다 — 빌드 단계를 하나 만들면 이후 8개
    step 마다 그 단계가 실패 지점으로 추가된다
- `packages/core/src/` (빈 디렉터리. `.gitkeep` 등으로 커밋되게 할 것)
- `packages/core/tsconfig.json` — 루트 `tsconfig.app.json` 의 컴파일러 옵션을 상속하되 `include` 는
  자기 `src` 만

### 3. path alias `@core/*` 도입

**세 곳에 같은 매핑을 넣어야 한다. 하나라도 빠지면 이후 step 에서 조용히 실패한다.**

| 위치 | 넣을 것 |
|---|---|
| `tsconfig.app.json` | `compilerOptions.paths` 에 `"@core/*": ["./packages/core/src/*"]` (+ `baseUrl` 필요시) |
| `vite.config.ts` | `resolve.alias` 에 동일 매핑 (절대 경로로 해석되게 `fileURLToPath` 사용) |
| 루트 `tsconfig.json` | `references` 에 `packages/core` 추가 |

**vitest 는 `vite.config.ts` 의 `resolve.alias` 를 공유하므로 별도 설정이 필요 없다.** 다만 테스트
탐색 범위에 `packages/**` 가 포함되는지 확인하라 — 지금은 루트 하나의 vitest 설정이 저장소 전체를
덮고 있고, 이 task 가 끝날 때까지 그 구조를 유지한다(패키지별 vitest 설정을 만들지 마라).

### 4. eslint 가 `packages/` 를 커버하게

`eslint.config.js` 의 대상 범위에 `packages/**/*.{ts,tsx}` 가 포함되게 하라. `ignores` 에 `packages`
가 걸려 있지 않은지 확인할 것.

### 5. `npm install` 로 workspace 링크 생성

`node_modules/@maple-routine/core` 가 `packages/core` 로 심링크되는지 확인하라.

## Acceptance Criteria

```bash
npm install
npm run build      # tsc -b && vite build — 컴파일 에러 없음
npm test           # vitest run — 197개 전부 통과
npm run lint       # ESLint 통과
```

**이 step 은 「동작 변화 0」이다.** 아무 파일도 옮기지 않았으므로 테스트 결과가 이 step 이전과
완전히 동일해야 한다. 통과 개수가 줄었다면 설정이 뭔가를 깨뜨린 것이다.

추가로 alias 가 실제로 동작하는지 확인하라:

```bash
# packages/core/src 에 임시 파일을 만들고 src/ 에서 @core/ 로 import 되는지 tsc 로 확인한 뒤
# 반드시 삭제할 것 (커밋에 남기지 마라)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `/docs/foundation/architecture.md` 의 디렉토리 구조 원칙을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙(`features/*` 가 저장소·네이티브에 직접 접근 금지)을 위반하지 않았는가?
   - `/docs/migration/README.md` 원칙 1(어댑터 시그니처 고정)을 건드리지 않았는가?
3. 결과에 따라 `phases/rn-core-extraction/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(생성한 파일 경로와 alias 매핑 포함)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/` 아래 어떤 파일도 옮기거나 이름을 바꾸지 마라.** 이유: 이 step 은 인프라만 세운다. 이동은
  step 1 부터이고, 섞이면 테스트가 깨졌을 때 원인이 "설정 때문"인지 "이동 때문"인지 갈리지 않는다.
- **`package.json` 의 script 키 이름을 바꾸지 마라.** 이유: 이후 8개 step 의 AC 와 harness 검증이
  전부 `npm run build` / `npm test` 라는 이름에 의존한다.
- **패키지별 vitest 설정 파일을 만들지 마라.** 이유: 이 task 내내 테스트는 루트에서 한 번에 돌아야
  하고, 설정이 쪼개지면 "197개 전부 통과"라는 게이트를 확인할 수 없게 된다.
- **core 에 빌드 단계(`tsc` 산출물)를 만들지 마라.** 이유: 각 앱 번들러가 TS 소스를 직접 먹는 구조가
  step 이 9개인 이 task 에서 실패 지점을 하나라도 줄인다.
- **pnpm/yarn/turborepo 로 바꾸지 마라.** 이유: 락파일이 `package-lock.json` 이고, 패키지 매니저 교체는
  이 task 의 범위 밖이며 검증해야 할 변수만 늘린다.
- 기존 테스트를 깨뜨리지 마라.
