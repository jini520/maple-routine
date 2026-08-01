# Step 1: motion-core

이슈 **#38**(당겨서 새로고침)의 인디케이터 표현을 "불투명 배너 + 고정 목록"에서 "목록이 손가락을 따라 내려감"으로 바꾸는 task다([[ADR-073]]). 제스처 감지·활성 조건·재조회 호출은 그대로 둔다.

이 step은 **순수 로직 모듈과 훅**만 고친다. 컴포넌트(`src/components/*`)와 화면(`src/app/*`)은 건드리지 않는다.

## 읽어야 할 파일

- `/CLAUDE.md` (프로젝트 규칙 — TDD: 테스트를 먼저 쓰고 통과하는 구현을 쓴다)
- `/docs/adr/ADR-073.md` (**이번 변경의 결정 원장 — 특히 결정 2·3·4·5·6**)
- `/docs/adr/ADR-072.md` (여전히 유효한 결정 1·2·3·9~14 — 제스처 계약을 바꾸지 마라)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절 (확정 레시피)
- `/src/lib/pull-to-refresh.ts` (**수정 대상** — 현재 `resolveBandHeightPx` 가 있다)
- `/src/lib/__tests__/pull-to-refresh.test.ts` (현재 16건)
- `/src/lib/use-pull-to-refresh.ts` (**수정 대상** — 현재 `{ distance, phase }` 를 반환한다)
- `/src/lib/__tests__/use-pull-to-refresh.test.ts` (현재 17건)

## 작업

**테스트를 먼저 쓰고** 통과하는 구현을 작성하라.

### 1. `src/lib/pull-to-refresh.ts`

- `resolveBandHeightPx(distance, phase)` 를 **`resolveContentOffsetPx(distance, phase)` 로 개명**한다. 계산 규칙은 그대로다(`refreshing` → `PULL_THRESHOLD_PX`, `idle` → 0, 그 외 0~`PULL_MAX_PX` 클램프). 이름을 바꾸는 이유: 이제 이 값이 배너 높이가 아니라 **목록이 내려가는 거리이자 벌어지는 틈의 높이**이고, 둘은 같은 값이어야 한다([[ADR-073]] 결정 6). 옛 이름을 별칭으로 남기지 마라 — 두 이름이 공존하면 다음 사람이 어느 것이 진짜인지 묻게 된다.
- 상수 하나를 추가한다:
  ```ts
  export const PULL_SETTLE_TRANSITION = 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)'
  ```
  손을 뗀 뒤 정착·복귀에 쓰는 전환이다. 주석으로 **드래그 중에는 이 값을 쓰지 않는다**([[ADR-073]] 결정 4 — 전환이 걸리면 목록이 손가락보다 늦게 따라와 감각이 죽는다)를 남겨라.
- 이 파일은 **DOM 무의존 순수 모듈로 유지**한다. 테스트에 `// @vitest-environment jsdom` 을 붙이지 마라.

### 2. `src/lib/use-pull-to-refresh.ts`

반환 타입에 `isDragging` 을 추가한다:

```ts
export interface PullToRefreshState {
  distance: number
  phase: PullPhase
  isDragging: boolean
}
```

- `isDragging` 은 **손가락이 붙어 있고 추적 중일 때만** true다. 화면이 이 값으로 전환을 끈다([[ADR-073]] 결정 4).
- `touchstart` 로 추적을 시작하면 true, `touchend`·`touchcancel`·추적 중단(위로 스크롤·`scrollY > 0`)에서 false.
- **손을 떼면 즉시 false여야 한다** — 재조회가 도는 동안(`phase === 'refreshing'`)에는 드래그가 아니다. 그래야 임계 위치로 정착하는 애니메이션이 전환을 탄다.
- `enabled === false` 일 때는 `{ distance: 0, phase: 'idle', isDragging: false }`.
- **제스처 계약(추적 시작 조건·스크롤 레이어 가드·멱등성·`didTriggerRefresh`)은 한 줄도 바꾸지 마라.** 이번 변경은 반환값에 상태 하나를 더하는 것뿐이다.

### 3. 테스트

기존 테스트를 지우지 말고 추가하라. `resolveBandHeightPx` 를 참조하던 기존 테스트는 새 이름으로 갱신한다(개명이므로 계약 변화가 아니다).

추가 항목:
- `PULL_SETTLE_TRANSITION` 이 `transform` 을 대상으로 하는 문자열이다(오타 회귀 방지).
- 당기는 동안 `isDragging` 이 true다.
- `touchend` 후 `isDragging` 이 false다(임계값을 넘겨 재조회가 시작된 경우에도 false).
- `touchcancel` 후 false다.
- 위로 움직여 추적이 끊기면 false다.
- `enabled: false` 면 항상 false다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음 — 개명 때문에 컴포넌트가 깨지면 여기서 잡힌다
npm test        # 테스트 전량 통과
npm run lint    # ESLint 통과
```

**주의**: `resolveBandHeightPx` 를 쓰는 곳이 `src/components/PullToRefreshBanner/PullToRefreshBanner.tsx` 에 있다. 개명하면 그 파일이 컴파일 에러를 낸다. **이 step에서는 그 import 이름만 최소로 고쳐 빌드를 통과시켜라**(호출부 한 줄). 배너의 배치·스타일 변경은 step 2의 범위이므로 손대지 마라 — 이 step은 "이름을 따라가는 최소 수정"까지만이다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `src/lib/pull-to-refresh.ts` 가 여전히 DOM 무의존인가? (`document`·`window` 참조 grep 무결과)
   - `grep -rn "resolveBandHeightPx" src/` 가 무결과인가? (개명이 완전한가)
   - 훅의 추적 시작 조건·가드가 그대로인가? (`git diff` 로 확인 — 추가된 것은 `isDragging` 관련뿐이어야 한다)
3. 결과에 따라 `phases/pull-to-refresh-motion/index.json` 의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "..."` (새 함수·상수 이름과 `isDragging` 계약을 요약에 담아라)
   - 실패 3회 → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 중단

## 금지사항

- 제스처 감지 계약을 바꾸지 마라(추적 시작 조건, `window.scrollY <= 0`, 스크롤 레이어 가드, 재조회 중 재당김 금지, `didTriggerRefresh`). 이유: 이번 task는 **표현만** 바꾼다. 그 계약들은 [[ADR-072]]에서 살아 있고 테스트 17건이 지키고 있다.
- `resolveBandHeightPx` 를 별칭으로 남기지 마라. 이유: 같은 값에 두 이름이 붙으면 다음 사람이 어느 쪽이 진짜인지 묻게 된다.
- 배너 컴포넌트의 배치·스타일을 고치지 마라(개명에 따른 호출부 한 줄 제외). 이유: step 2의 범위다.
- 화면 파일(`src/app/**`)을 수정하지 마라. 이유: step 3~5의 범위다.
- 기존 테스트를 지우지 마라(개명에 따른 이름 갱신만 허용).
