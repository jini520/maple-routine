# Step 0: rn-test-setup

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` — 원칙·단계·**브랜치 전략**
- `/docs/ADR.md` 에서 **[[ADR-127]]** 만 `/docs/adr/ADR-127.md` 로 열어라. 전체를 올리지 말 것
- `/CLAUDE.md`
- `packages/app-rn/package.json` · `packages/app-rn/tsconfig.json` · `packages/app-rn/app.json` ·
  `packages/app-rn/metro.config.js`
- `packages/app-capacitor/vite.config.ts` (**루트 `vite.config.ts` 가 이 파일을 그대로 re-export 한다** —
  vitest 설정의 진짜 소유자가 여기다)
- 루트 `package.json` · 루트 `vite.config.ts`

## 배경

`packages/app-rn` 에 RN 어댑터를 구현할 준비를 한다. 이 task 는 어댑터를 만들지만, 그 전에
**테스트를 돌릴 자리**가 필요하다.

**러너를 jest 로 간다**(사용자 결정, 2026-08-11). 근거: 전환의 최종 상태는 RN-only 이고 그때
`app-capacitor` 와 함께 vitest 도 걷힌다 — 지금 vitest 에 RN 을 억지로 태우면 나중에 한 번 더 옮겨야 한다.

**여기서 반드시 처리해야 할 것이 하나 있다.** 지금 vitest 는 저장소 전체를 훑는다(테스트 199파일).
`packages/app-rn` 에 `*.test.ts` 가 생기는 순간 vitest 가 그것까지 집어삼키고 **RN 모듈 import 에서
깨진다.** 이전 task 의 step 8 이 *"RN 테스트 파일이 0개라 탐색 결과가 그대로"* 라고 남긴 그 자리다.

## 작업

### 1. `packages/app-rn` 에 jest + jest-expo 도입

- `jest-expo` 프리셋 (Expo SDK 57 에 맞는 버전) · `jest` · `@types/jest` 또는 동등물
- `packages/app-rn/package.json` 에 `"test": "jest"` 스크립트
- 설정은 `jest-expo` 프리셋을 기본으로 하고, **`@core/*` 경로가 풀리게** `moduleNameMapper` 를 맞춰라
  (tsconfig `paths` 와 같은 매핑이어야 한다 — 갈라지면 타입은 통과하는데 테스트에서만 죽는다)

### 2. vitest 탐색에서 `packages/app-rn` 을 제외하라

`packages/app-capacitor/vite.config.ts` 의 `test.exclude` 에 `packages/app-rn/**` 를 추가한다.
루트 `vite.config.ts` 가 이 파일을 re-export 하므로 한 곳만 고치면 양쪽에 적용된다 —
**규칙을 두 벌로 만들지 마라.**

### 3. 루트 `npm test` 가 둘 다 돌게 하라

키 이름 `test` 는 그대로 두고 내용만 바꾼다.

```
"test": "vitest run && npm run test -w @maple-routine/app-rn"
```

순서·연결 방식은 재량이되 **둘 중 하나라도 실패하면 전체가 실패해야 한다.** `&&` 가 아닌 방식을
쓸 거면 그 성질을 유지하라 — 한쪽이 조용히 넘어가면 이 task 의 게이트가 무의미해진다.

### 4. 배선이 실제로 도는지 증명할 테스트 하나

`packages/app-rn` 에 **의미 있는 최소 테스트** 하나를 둔다. `expect(true).toBe(true)` 같은 것 말고,
**`@core/*` import 가 jest 에서 실제로 풀리는지**를 확인하는 것으로 하라 — 그것이 이 step 에서
깨지기 쉬운 유일한 지점이다. 예: `@core/lib` 의 순수 함수를 불러 결과를 단언.

## Acceptance Criteria

```bash
npm install
npm test           # vitest 199파일/3044개 + jest(app-rn) 전부 통과
npm run build      # app-capacitor 빌드 — 영향 없어야 한다
npm run lint       # 0 errors
```

각각 따로도 확인하라:

```bash
npx vitest run 2>&1 | tail -5                      # 199 files / 3044 tests, app-rn 파일이 안 잡혀야 한다
npm run test -w @maple-routine/app-rn              # jest 통과
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - vitest 결과가 **여전히 199파일/3044개**인가? (줄었으면 제외 규칙이 과하게 걸린 것이다)
   - jest 가 app-rn 테스트만 잡는가? (core/app-capacitor 를 집어삼키면 안 된다)
   - `moduleNameMapper` 와 tsconfig `paths` 의 `@core/*` 매핑이 **같은 곳**을 가리키는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/rn-adapters/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "도입한 jest 설정·vitest 제외 규칙 위치·루트 test 스크립트 형태"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- **`packages/core` 나 `packages/app-capacitor` 의 테스트를 jest 로 옮기지 마라.** 이유: 이 task 의
  범위가 아니고, 3044개를 러너 사이로 옮기는 것은 그 자체로 별도 task 다. core 가 vitest 로 도는 것은
  전환 최종 단계에서 정리한다.
- **`vite.config.ts` 규칙을 두 벌로 만들지 마라.** 루트는 app-capacitor 설정을 re-export 하는 구조다.
  이유: 한쪽만 고쳐져도 아무도 모른다(이전 task step 7 이 그 이유로 re-export 를 택했다).
- **루트 `package.json` 의 script 키 이름을 바꾸지 마라.** 이유: 이후 step 의 AC 가 `npm test` ·
  `npm run build` 에 의존한다.
- **어댑터를 구현하지 마라.** 이유: 이 step 은 테스트 자리만 만든다. 어댑터는 step 1 부터다.
- 기존 테스트를 깨뜨리지 마라.
