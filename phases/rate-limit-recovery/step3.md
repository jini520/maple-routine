# Step 3: rate-limit-wiring

이 step 은 **429 를 감지 지점에 배선한다.** 무효 키가 이미 지나는 세 자리에 429 를 더한다.
계정 프로브(#177)는 step 4, `ErrorState` 계약(#178)은 step 5 다.

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(지정한 것만)
- `/docs/adr/ADR-116.md` — **결정 1·2**(429 도 같은 사슬 · 가드는 "키 입력 화면이 아닐 때")
- `/docs/adr/ADR-115.md` — **결정 7**(감지 지점 셋이 진입점 하나를 부른다) · 결정 10
- `/docs/adr/ADR-114.md` — **결정 2**(429 에 재시도 액션을 주지 않는다 — 이 step 에서 유지된다)
- `/src/features/onboarding/use-api-key-invalidation.ts` (전문 — 훅과 `routedErrors` WeakSet)
- `/src/features/schedule-sync/use-sync-error-toast.ts` (전문)
- `/src/features/settings/store.ts` (`refreshAccounts` 의 catch)
- `/src/app/content-scheduler/ContentScreen.tsx` · `/src/app/boss-scheduler/BossScreen.tsx`
  (전역 동기화 error + `rosterError` 두 경로)
- `/src/app/boss-profit/BossProfitScreen.tsx` (로스터 없음)
- `/src/app/onboarding/ContentCharacterStep.tsx` (**온보딩 로스터 — 이번엔 여기도 배선한다**, 아래 참조)
- **step 1·2 산출물**: `noticeApiKeyIssue(kind)` · `apiKeyNotice` · `ApiKeyNoticeModal`

## 작업

TDD 다 — 테스트를 먼저 고치고/쓰고, 그다음 구현.

### 1. 훅을 원인 둘로 넓힌다

`use-api-key-invalidation.ts` 를 **`use-api-key-notice.ts`** 로 옮기고(이름이 무효 키 전용이라):

```ts
export function useApiKeyNotice(error: ScheduleSyncError | null): void
```

- `error.kind === 'invalidApiKey'` → `noticeApiKeyIssue('invalid')`
- **`error.kind === 'rateLimited'` → `noticeApiKeyIssue('rateLimited')`** ← 이 step 이 더하는 것
- 그 외 종류는 아무것도 하지 않는다.
- **모듈 스코프 `WeakSet`(`routedErrors`) 을 그대로 유지하라.** 그것이 막는 것은 멱등이 아니라
  **"화면이 언마운트돼도 살아남는 스토어의 error 객체가 재마운트 때 다시 들어오는 것"** 이다
  ([[ADR-115]] "구현하며 정정한 것" 11 — 실제로 재현된 결함이다). 429 에도 같은 함정이 있다.
- 상단 주석의 근거 문단을 **429 를 포함하도록** 갱신하라(무효 키 전용 서술이 남으면 안 된다).

### 2. `use-sync-error-toast.ts` — 429 토스트를 뗀다

- 훅 맨 위 `useApiKeyNotice(error)` 호출로 교체.
- 지금 `rateLimited` 는 **액션 없는 토스트**를 띄운다. 이제 그 원인은 **모달이 말하므로** 토스트를
  띄우지 마라 — `invalidApiKey` 와 같이 조기 반환시킨다. 같은 사실을 두 번 말하지 않는다.
- **`characterUnavailable`·`network`·나머지는 그대로 둔다**(회귀 가드가 이것을 지킨다).
- `formatScheduleSyncError` 의 `rateLimited` case 는 **지우지 마라** — `assertNever` 소진 가드가 깨지고
  다른 테스트가 6종을 단언한다. 이 훅에서 도달하지 않게 될 뿐이다.

### 3. 화면 배선

- `ContentScreen`·`BossScreen`: 전역 동기화 error 와 `rosterError` 둘 다 이미 훅을 타므로 **이름만
  교체**하면 429 가 자동으로 따라온다. 확인하고 넘어가라.
- `BossProfitScreen`: 전역 error 만. 이름 교체.
- **`ContentCharacterStep`(온보딩 캐릭터 선택)에 `useApiKeyNotice(loadError)` 를 배선하라.**
  - 이것이 **#176 잠금을 실제로 푸는 배선**이다. 지금 이 화면은 로스터 429 를 자기 안에서만 그리고
    아무 데도 알리지 않는다.
  - [[ADR-115]] 시절 이 화면을 **일부러 배선하지 않았던 근거**("온보딩 중에는 status 가 completed 가
    아니라 어차피 no-op")는 **step 1 의 가드 변경으로 무효가 됐다.** 그 이력을 주석으로 남겨라 —
    안 그러면 다음 사람이 "왜 배선했지" 하고 되돌린다.
  - 이 화면은 설정의 계정 변경 모달(`AccountFlowStatus`)도 재사용한다 — 그쪽에서도 같은 배선이 함께
    동작하는지 확인하고 결과를 summary 에 적어라.

### 4. `features/settings/store.ts` — `refreshAccounts` 의 429

- 지금은 `rateLimited` 가 `VERIFY_FAILED` → 모달 안 인라인 카드다. 이제 **`noticeApiKeyIssue('rateLimited')`
  + `RESET`** 으로 무효 키와 같이 처리한다.
- **`changeApiKey` 는 여전히 배선하지 마라**([[ADR-115]] 결정 8) — 그 경로의 실패는 "사용자가 방금 넣은
  키"에 대한 것이라 성질이 다르다. 그 사실을 단언하는 기존 테스트를 유지하라.
- `network`·`storageWriteFailed` 는 그대로 인라인 카드([[ADR-063]]).

### 5. 테스트

- `use-api-key-notice.test.tsx`(이름 변경): 두 kind 가 각각 올바른 인자로 넘어가고, 나머지 종류는
  넘기지 않으며, **같은 객체 재마운트 가드**가 두 kind 모두에서 선다.
- `use-sync-error-toast.test.tsx`: `rateLimited` 케이스를 **뒤집어라** — 토스트를 띄우지 않고 진입점을
  부른다. `network`·`characterUnavailable` 회귀 가드는 그대로 통과해야 한다.
- `ContentScreen`·`BossScreen`·`BossProfitScreen` 테스트: 429 가 진입점을 부르는 케이스 각 1건 +
  **429 가 아닌 실패는 종전대로**라는 회귀 가드.
- `ContentCharacterStep` 테스트: **로스터 429 가 진입점을 부른다**(#176 의 핵심 단언).
- `features/settings/__tests__/store.test.ts`: `refreshAccounts` 429 → 진입점 + `idle` /
  `changeApiKey` 429 → 진입점 **미호출** + `VERIFY_FAILED`.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                     # errors 0
test -f src/features/onboarding/use-api-key-notice.ts
test ! -f src/features/onboarding/use-api-key-invalidation.ts
# 동기화 토스트에서 429 문구가 사라졌다(모달이 말한다)
grep -c 'rateLimited' src/features/schedule-sync/use-sync-error-toast.ts   # 1 (조기 반환 조건 한 자리)
# 온보딩 캐릭터 선택이 배선됐다 — #176 의 핵심
grep -q 'useApiKeyNotice' src/app/onboarding/ContentCharacterStep.tsx
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력**: 훅에서 `rateLimited` 분기를 지우면 **새 케이스만** 실패하고 `network`·
   `characterUnavailable` 회귀는 통과하는가? 확인 후 되돌리고 결과를 summary 에 적어라.
3. **#176 수동 추적**: `selectingContentCharacters` 에서 로스터가 429 로 실패 → `useApiKeyNotice` →
   가드 통과(step 1) → `apiKeyNotice='rateLimited'` → 모달 → `확인` → `RESET` → `awaitingApiKey` →
   키 입력 폼. **끊기는 고리가 있으면 summary 에 적어라.**
4. 아키텍처 체크: 훅이 `ScheduleSyncError` 를 타입으로만 import 하는가 · 순환 import 가 없는가
   (`npm run build` 통과) · `features/` 가 `storage/` 를 우회하지 않는가.
5. `index.json` step 3 갱신.

## 금지사항

- **`use-account-probes.ts` 를 건드리지 마라**(step 4). 이 step 의 배선은 **로스터·동기화**뿐이다.
- **`ErrorState`·`format.ts` 의 429 문구·액션을 건드리지 마라**(step 5).
- **`changeApiKey` 를 배선하지 마라**([[ADR-115]] 결정 8).
- **`routedErrors` WeakSet 을 지우지 마라.** 이유: 재마운트 때 스탈 error 객체가 다시 들어와 모달이
  되살아난다 — 실제로 재현된 결함이다.
- **429 에 재시도 액션을 되살리지 마라**([[ADR-114]] 결정 2 는 유효하다).
- 기존 테스트를 깨뜨리지 마라.
