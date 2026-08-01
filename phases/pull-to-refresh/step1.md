# Step 1: pull-gesture-core

이 task는 GitHub 이슈 **#38**(각 탭에서 당겨서 새로고침 제스처로 API 재조회)을 구현한다.

이 step은 **순수 함수 모듈 하나**만 만든다. React·DOM·store를 일절 건드리지 않는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — TDD: 테스트를 먼저 쓰고 통과하는 구현을 쓴다)
- `/docs/README.md` (문서 인덱스)
- `/docs/adr/ADR-072.md` (이번 기능의 결정 원장 — 특히 수치 절과 결정 2·12)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절 (배너 레시피 — 이 모듈이 그 배너에 넣을 값을 계산한다)
- `/src/lib/swipe-dismiss.ts` (**이 파일의 형태를 그대로 따르라** — 임계값 상수 + 순수 판정 함수, 주석은 "왜 이 값인가"를 적는다)
- `/src/lib/__tests__/swipe-dismiss.test.ts` (테스트 형태의 본보기)

## 작업

`src/lib/pull-to-refresh.ts` 를 신설한다. **테스트를 먼저 쓰고** 통과하는 구현을 작성하라(`src/lib/__tests__/pull-to-refresh.test.ts`).

이 프로젝트의 vitest 전역 환경은 `node` 다(`vitest.config.ts`). 이 모듈은 순수 함수라 **환경 지시 주석(`// @vitest-environment jsdom`)을 넣지 마라** — node 환경 그대로 돈다.

### 공개 인터페이스

```ts
export const PULL_RESISTANCE = 0.5
export const PULL_THRESHOLD_PX = 56
export const PULL_MAX_PX = 80

export type PullPhase = 'idle' | 'pulling' | 'ready' | 'refreshing'

export function resolvePullDistance(rawDeltaY: number): number
export function resolvePullPhase(distance: number, isRefreshing: boolean): PullPhase
export function shouldTriggerRefresh(distance: number): boolean
export function resolvePullProgress(distance: number): number
export function resolveBandHeightPx(distance: number, phase: PullPhase): number
```

### 규칙 (반드시 지켜라)

- `resolvePullDistance(rawDeltaY)` — 손가락이 아래로 움직인 원시 거리(px)를 배너가 쓸 당김 거리로 바꾼다.
  - `rawDeltaY <= 0` 이면 `0`(위로 움직인 것은 당김이 아니다).
  - 그 외에는 `rawDeltaY * PULL_RESISTANCE` 를 `PULL_MAX_PX` 로 상한 클램프.
- `resolvePullPhase(distance, isRefreshing)` —
  - `isRefreshing` 이 true면 **distance와 무관하게 항상 `'refreshing'`**. 이유: 재조회가 시작된 뒤 손을 떼면 distance가 0으로 돌아가는데, 그때 배너가 닫혔다 다시 열리면 안 된다.
  - `distance <= 0` → `'idle'`
  - `distance >= PULL_THRESHOLD_PX` → `'ready'`
  - 그 외 → `'pulling'`
- `shouldTriggerRefresh(distance)` — `distance >= PULL_THRESHOLD_PX`. `resolvePullPhase` 의 `'ready'` 판정과 **같은 경계**를 써야 한다(경계를 두 벌 만들지 마라 — 한쪽만 고치면 "놓으면 새로고침"이 뜬 채로 아무 일도 안 일어난다).
- `resolvePullProgress(distance)` — 단풍잎 회전·불투명도에 쓸 0~1 진행률. `distance / PULL_THRESHOLD_PX` 를 0~1로 클램프한다(임계값을 넘겨 더 당겨도 1을 넘지 않는다).
- `resolveBandHeightPx(distance, phase)` — 배너 높이(px).
  - `phase === 'refreshing'` → `PULL_THRESHOLD_PX`(완전히 펼친 높이 고정).
  - `phase === 'idle'` → `0`.
  - 그 외 → `distance` 를 0~`PULL_MAX_PX` 로 클램프.

### 주석

각 상수 위에 **왜 그 값인가**를 한 줄씩 적어라(`swipe-dismiss.ts` 와 같은 어투). `PULL_THRESHOLD_PX` 에는 "배너가 완전히 펼쳐진 높이(`h-14`)와 같은 값이다 — 배너가 다 열린 순간이 곧 임계값 도달이라 별도 신호 없이도 읽힌다"를 남겨라.

### 테스트에 반드시 포함할 항목

- 위로 움직인 델타(`-30`)는 당김 거리 0이다.
- 감쇠가 적용된다(`100` → `50`).
- 상한에서 멈춘다(`1000` → `PULL_MAX_PX`).
- 경계 정확히(`distance === PULL_THRESHOLD_PX`)에서 `'ready'` 이고 `shouldTriggerRefresh` 가 true다.
- `isRefreshing` 이 true면 `distance` 가 0이어도 `'refreshing'` 이다.
- `resolveBandHeightPx` 가 `'refreshing'` 에서 `PULL_THRESHOLD_PX` 를 준다(손을 떼서 distance가 0이어도).
- `resolvePullProgress` 가 임계값 초과에서도 1을 넘지 않는다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (신규 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 범용 유틸은 `lib/` 에 둔다는 규칙(`CLAUDE.md`)을 따랐는가?
   - React import·DOM 접근·store import가 하나도 없는가? (있으면 이 step의 범위를 벗어난 것이다)
   - 테스트 파일에 `// @vitest-environment jsdom` 을 넣지 않았는가?
3. 결과에 따라 `phases/pull-to-refresh/index.json` 의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (export한 상수·함수 시그니처를 요약에 포함하라 — 다음 step이 이 모듈을 그대로 쓴다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- React 훅·DOM 이벤트 리스너를 이 파일에 쓰지 마라. 이유: step 2가 그 레이어를 담당하고, 순수 함수로 분리해야 node 환경에서 경계값을 빠르게 검증할 수 있다(`swipe-dismiss.ts` 와 같은 분업).
- `shouldTriggerRefresh` 의 임계값을 `resolvePullPhase` 와 다른 상수로 두지 마라. 이유: 배너 문구("놓으면 새로고침")와 실제 동작이 어긋난다.
- 상수를 export하지 않고 파일 안에 가두지 마라. 이유: step 3의 배너가 `h-14`(=56px)와 `PULL_THRESHOLD_PX` 가 같은 값임을 근거로 쓰고, 테스트도 이 상수로 경계를 검증한다.
- 기존 파일(`swipe-dismiss.ts` 등)을 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
