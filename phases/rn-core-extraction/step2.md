# Step 2: core-lib

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` — 특히 «삭제되는 화면 전환 machinery» 표
- `/docs/migration/parity-inventory.md` §4
- `/docs/ADR.md` 에서 **[[ADR-128]] · [[ADR-120]]** 두 개만 열어라
- **이전 step 산출물**: `packages/core/src/{data,types,nexon}/` · `@core/*` alias 설정 ·
  `scripts/theme-gen.ts`(경로가 일부만 고쳐진 상태)

이전 step 이 어떤 방식으로 옮기고 import 를 고쳤는지 읽고 **같은 방식**을 따르라.

## 배경

`src/lib/` 49개 중 **41개를 `packages/core/src/lib/` 로 옮긴다.** 나머지 8개는 남긴다.

**남기는 8개** (옮기지 마라):

| 파일 | 이유 |
|---|---|
| `stack-transition.ts` | DOM 의존. [[ADR-120]] 화면 전환 machinery — RN 에서 **삭제**될 코드다 |
| `use-stack-location.ts` | 〃 |
| `use-swipe-back.ts` | 〃 |
| `use-pull-to-refresh.ts` | 〃 |
| `use-body-scroll-lock.ts` | 〃 |
| `use-measured-height.ts` | 〃 |
| `use-delayed.ts` | DOM 의존 |
| `use-system-back.ts` | **`@capacitor/*` 를 직접 import 한다.** step 4(native-ports)의 대상 |

곧 지워질 코드를 공유 패키지에 심으면 안 되고, 플러그인을 직접 import 하는 파일은 `core` 의
"Capacitor 를 모른다"는 불변식을 깬다.

**옮길 41개를 직접 세지 말고 아래 명령으로 확정하라** — 목록을 손으로 관리하면 틀린다.

```bash
for f in $(find src/lib -name '*.ts' -o -name '*.tsx' | grep -v __tests__); do
  grep -qE "document\.|window\.|getBoundingClientRect|ResizeObserver|matchMedia|@capacitor" "$f" || echo "$f"
done
```

## 작업

### 1. 위 명령이 출력한 41개를 `git mv` 로 옮겨라

`packages/core/src/lib/` 로. 대응하는 `src/lib/__tests__/` 의 테스트 파일도 함께 옮긴다 — **옮긴
파일의 테스트만** 옮겨라. 남는 8개의 테스트는 `src/lib/__tests__/` 에 남는다.

### 2. import 경로를 `@core/lib/*` 로 갱신하라

```bash
grep -rn "from '.*lib/" src --include='*.ts' --include='*.tsx'
```

**남는 8개가 옮긴 41개를 import 하는 경우가 있다.** 그 방향은 정상이다(app 이 core 를 참조).
반대 방향 — 옮긴 파일이 남는 8개를 import — 이 있으면 그 파일은 애초에 순수하지 않다는 뜻이므로
**옮기지 말고 남겨라.** 이동 후 `packages/core` 안에 `../../src/` 같은 경로가 생기면 잘못된 것이다.

### 3. `scripts/theme-gen.ts` 의 남은 경로를 고쳐라

step 1 에서 `data`·`types` 만 고쳤다. 이번에 `../src/lib/theme-derive` 가 깨진다 — `theme-derive.ts`
는 순수 함수라 이 step 의 이동 대상이다.

## Acceptance Criteria

```bash
npm run build      # tsc -b && vite build — 컴파일 에러 없음
npm test           # vitest run — 197개 전부 통과 (이 step 이전과 동일한 수)
npm run lint       # ESLint 통과
```

core 오염 검사 — **비어 있어야 한다**:

```bash
grep -rE "document\.|window\.|getBoundingClientRect|ResizeObserver|matchMedia|@capacitor" packages/core/src
grep -rn "\.\./\.\./src/" packages/core/src
```

스크립트 확인:

```bash
npx vite-node scripts/theme-gen.ts   # "Cannot find module" 이 나오면 안 된다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `packages/core` 에 DOM/Capacitor 참조가 없는가? (위 grep 두 개가 비었는가)
   - `/docs/foundation/architecture.md` 의 레이어 규칙을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/rn-core-extraction/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 lib 파일 수와 남긴 8개를 한 줄로"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **위 8개 파일을 `packages/core` 로 옮기지 마라.** 이유: 7개는 [[ADR-120]] 의 화면 전환 machinery 로
  RN 전환 시 **삭제**될 코드이고, `use-system-back.ts` 는 Capacitor 를 직접 import 해서 core 의
  불변식을 깬다. 곧 지울 코드를 공유 패키지에 심으면 두 앱이 함께 그것을 물게 된다.
- **`use-delayed.ts` 를 "고쳐서" 옮기지 마라.** `window.setTimeout` → `setTimeout` 처럼 사소해 보여도,
  이 step 은 이동만 하는 step 이다. 이유: 실패 시 원인이 "이동"인지 "수정"인지 갈려야 한다. 정말
  필요하면 별도 step 에서 한다.
- **파일 내용을 리팩터링하지 마라. import 경로만 고쳐라.**
- **`mv` 나 복사+삭제를 쓰지 마라. `git mv` 를 써라.**
- **`src/storage/` `src/native/` `src/features/` 를 건드리지 마라.** 이유: 각각 step 3·4·6 의 대상이다.
- 기존 테스트를 깨뜨리지 마라.
