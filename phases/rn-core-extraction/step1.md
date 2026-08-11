# Step 1: core-pure

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` (원칙·단계)
- `/docs/migration/parity-inventory.md` §4 (`core` 로 이식할 대상)
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-006]]** 두 개만 `/docs/adr/` 에서 열어라
- `/docs/foundation/game-data.md` (**`src/data/` 를 만지므로 필수**)
- **이전 step 산출물**: 루트 `package.json`(workspaces) · `packages/core/` · `tsconfig.app.json`·
  `vite.config.ts` 의 `@core/*` alias · 루트 `tsconfig.json` references

이전 step 에서 만들어진 설정을 꼼꼼히 읽고, alias 가 어떻게 매핑돼 있는지 이해한 뒤 작업하라.

## 배경

의존이 가장 얕은 세 디렉터리를 `packages/core` 로 옮긴다. 이 셋은 DOM API 도 `@capacitor/*` 도
참조하지 않는 것이 측정으로 확인됐다(2026-08-11 전수 검사).

| 이동 대상 | 소스 파일 | 비고 |
|---|---|---|
| `src/data/` → `packages/core/src/data/` | 13 | 게임 레퍼런스 데이터 + 릴리스 노트 |
| `src/types/` → `packages/core/src/types/` | 9 | |
| `src/nexon/` → `packages/core/src/nexon/` | 8 | Nexon Open API 클라이언트 |

각 디렉터리의 `__tests__/` 도 **함께** 옮긴다(data 10개 · nexon 6개).

## 작업

### 1. `git mv` 로 옮겨라

`mv` 나 복사+삭제가 아니라 **반드시 `git mv`** 를 써라. 이유: 히스토리 추적이 유지돼야 이후에
`git log --follow` 로 각 파일의 결정 이력을 따라갈 수 있고, 이 저장소는 그 이력이 ADR 과 함께
설계 근거를 이룬다.

### 2. import 경로를 `@core/*` 로 갱신하라

옮긴 파일들을 참조하던 **모든** 곳을 고쳐야 한다. 상대 경로(`../../data/...`)를 `@core/data/...` 로
바꾼다. 참조 지점을 빠짐없이 찾으려면:

```bash
grep -rn "from '.*\(data\|types\|nexon\)/" src --include='*.ts' --include='*.tsx'
```

옮긴 파일들 **내부의** 상호 참조(예: `nexon/*.ts` 가 `types/*.ts` 를 import)도 함께 정리하라.

### 3. `scripts/` 의 깨진 경로를 고쳐라 — **놓치기 쉬움**

아래 두 스크립트가 `../src/` 를 상대 경로로 import 한다. 이동하면 **조용히 깨진다**(테스트가 안 잡는다).

| 파일 | 깨지는 import |
|---|---|
| `scripts/theme-gen.ts` | `../src/data/job-themes.json` · `../src/lib/theme-derive` · `../src/types/theme` |
| `scripts/publish-live-update.mjs` | `../src/data/release-notes.ts` |

`theme-gen.ts` 의 `../src/lib/theme-derive` 는 **이 step 에서 옮기지 않는다**(step 2 대상)이므로
그대로 두고, `data`·`types` 참조만 고쳐라.

`scripts/` 는 `tsconfig.node.json` 이 담당한다 — alias 를 쓰려면 그쪽에도 `paths` 가 필요할 수 있다.
필요 없다면 상대 경로(`../packages/core/src/...`)로 두어도 된다. **동작하는 쪽을 택하라.**

### 4. `packages/core/package.json` 의 exports 정리

`@core/*` alias 로 접근하므로 exports 맵이 반드시 필요하지는 않다. 이미 동작한다면 건드리지 마라.

## Acceptance Criteria

```bash
npm run build      # tsc -b && vite build — 컴파일 에러 없음
npm test           # vitest run — 197개 전부 통과 (이 step 이전과 동일한 수)
npm run lint       # ESLint 통과
```

스크립트가 깨지지 않았는지 별도로 확인하라:

```bash
npx vite-node scripts/theme-gen.ts   # 정상 실행되거나 인자 부족 안내로 끝나야 한다.
                                      # "Cannot find module" 이 나오면 경로를 못 고친 것이다
node --experimental-strip-types -e "import('./scripts/publish-live-update.mjs')" 2>&1 | head -5
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `packages/core` 안에 DOM API 나 `@capacitor/*` 참조가 새로 생기지 않았는가?
     (`grep -rE "document\.|window\.|@capacitor" packages/core/src` 가 비어야 한다)
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/rn-core-extraction/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 디렉터리와 파일 수, 고친 scripts/ 경로를 한 줄로"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/data/` 안의 게임 수치·보스 목록·드랍 테이블 값을 단 하나도 바꾸지 마라. 이동만 해라.**
  이유: [[ADR-006]] — 그 값들의 진실은 게임 안에 있고, AI 가 임의로 추정해 고치면 사용자가 잘못된
  수익 계산을 보게 된다. 오타처럼 보이는 것도 고치지 마라.
- **파일 내용을 리팩터링하지 마라. import 경로만 고쳐라.** 이유: 이 step 이 실패했을 때 원인이
  "이동"인지 "수정"인지 갈려야 한다.
- **`mv` 나 복사+삭제를 쓰지 마라. `git mv` 를 써라.** 이유: 히스토리가 끊기면 각 파일의 결정 이력을
  `git log --follow` 로 못 따라간다.
- **`src/lib/` 은 이 step 에서 건드리지 마라.** 이유: step 2 의 대상이고, 두 이동이 한 커밋에 섞이면
  실패 원인이 갈리지 않는다.
- 기존 테스트를 깨뜨리지 마라.
