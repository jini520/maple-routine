# Step 0: sync-freshness

이 task 는 **페이지 이동 API 호출 정책**을 바꾼다([[ADR-097]], 이슈 #139). 지금은 컨텐츠·보스·보스 수익 세 탭 화면이 마운트될 때마다 같은 `syncSchedules` 를 돌려서, 탭을 한 바퀴 돌면 **같은 응답을 3번** 받는다. 앞으로는 저장된 데이터가 10분보다 오래됐을 때만 조회한다.

이 step 은 그 판정을 하는 **순수 함수 모듈 하나**만 만든다. React·store·storage·DOM 을 일절 건드리지 않는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — **TDD: 테스트를 먼저 쓰고 그 테스트를 통과하는 구현을 쓴다**)
- `/docs/README.md` (문서 인덱스)
- `/docs/adr/ADR-097.md` (이번 task 의 결정 원장 — 특히 **결정 1·2**와 "상수와 자리" 절)
- `/src/lib/pull-to-refresh.ts` (**이 파일의 형태를 그대로 따르라** — 상수 + 순수 판정 함수, 주석은 "왜 이 값인가"를 적는다)
- `/src/lib/__tests__/pull-to-refresh.test.ts` (테스트 형태의 본보기)

## 작업

`src/lib/sync-freshness.ts` 를 신설한다. **테스트를 먼저** 쓰고(`src/lib/__tests__/sync-freshness.test.ts`) 통과하는 구현을 작성하라.

이 프로젝트의 vitest 전역 환경은 `node` 다(`vite.config.ts` 의 `environment: 'node'`). 이 모듈은 순수 함수라 **환경 지시 주석(`// @vitest-environment jsdom`)을 넣지 마라** — node 환경 그대로 돈다.

### 공개 인터페이스

```ts
export const SYNC_TTL_MS = 10 * 60 * 1000

export function isSyncFresh(
  syncedAts: readonly (string | null)[],
  trackedCount: number,
  now: Date,
): boolean
```

`syncedAts` 는 **캐시가 있는 캐릭터들의 동기화 시각**(ISO 8601 문자열)이다. 호출부(스토어)는 추적 캐릭터마다 `storage/scheduler-cache` 를 읽어 캐시가 있는 것만 이 배열에 담고, 추적 캐릭터 총수를 `trackedCount` 로 넘긴다.

### 규칙 (반드시 지켜라)

`isSyncFresh` 는 **"자동 재조회를 건너뛰어도 되는가"** 에 답한다. `true` = 건너뛴다(신선하다).

- `trackedCount <= 0` → `true`. 조회할 대상이 없다(호출부는 그전에 조기 반환하지만 정의를 비워두지 마라).
- `syncedAts.length !== trackedCount` → `false`. **캐시가 없는 캐릭터가 하나라도 있으면 만료로 본다** — 새로 추가된 캐릭터가 조회 없이 빈 채로 남는 것을 막는다.
- 항목 중 하나라도 `null` 이거나 `Date` 로 파싱되지 않으면(`Number.isNaN`) → `false`.
- 판정은 **가장 오래된 값** 기준이다. 그 값 `t` 에 대해 `now - t < SYNC_TTL_MS` 이면 `true`.
  - 경계(`now - t === SYNC_TTL_MS`)는 **만료(`false`)** 다.
  - **미래 시각(`t > now`)은 만료(`false`)** 다. 이유: 기기 시계가 앞으로 튀면 미래 타임스탬프가 캐시에 남는데, 그것을 "신선"으로 읽으면 **영원히 조회하지 않는 상태**가 된다.

### 상수 주석

`SYNC_TTL_MS` 위에 **왜 이 값인가**를 적어라. 다음 두 가지를 반드시 담아라.

- 게임에서 한 사이클을 도는 시간보다 짧아 "방금 한 것이 안 보인다"가 길게 가지 않고, 탭을 오가는 동선(수 초~수 분)은 전부 창 안에 들어온다.
- **이 값은 잠정이고 사용자가 직접 쓰면서 조정한다.** 그래서 **이 파일에서 한 번만 정의하고 어디서도 재선언하지 않는다** — 상수 하나를 고치면 세 화면이 함께 움직여야 한다.

### 테스트에 반드시 포함할 항목

- `trackedCount === 0` → `true`.
- 추적 3명인데 `syncedAts` 가 2개 → `false`(캐시 없는 캐릭터 존재).
- 전부 5분 전 → `true`.
- 하나만 11분 전이고 나머지는 1분 전 → `false`(가장 오래된 것이 기준).
- 정확히 10분 경계 → `false`.
- 미래 시각(예: 1시간 뒤) → `false`.
- 파싱 불가 문자열(`'not-a-date'`) → `false`.
- `null` 포함 → `false`.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (신규 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/foundation/architecture.md` 의 레이어 규칙을 따르는가? (`lib/` 은 범용 유틸 — feature·storage·React 를 import 하지 않는다)
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? (`features/*` 에서 저장소 직접 접근 금지 — 이 모듈은 저장소를 아예 모른다)
3. 결과에 따라 `phases/sync-ttl-gate/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(파일 경로·시그니처·상수값 포함)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **저장소(`storage/`)를 읽지 마라.** 이유: 이 모듈은 순수 판정이고, 값을 읽는 것은 이미 캐시 우선 표시 단계가 하고 있어 중복 조회가 된다.
- **`new Date()` 를 함수 안에서 부르지 마라.** 이유: `now` 를 인자로 받아야 테스트가 시각을 고정할 수 있다.
- **스토어·화면 코드를 이 step 에서 고치지 마라.** 이유: 게이트를 붙이는 것은 step 2~4 의 일이고, 이 step 은 판정 규칙만 확정한다.
- 기존 테스트를 깨뜨리지 마라.
