# Step 1: notice-generalize

이 step 은 **알림 상태를 원인별로 넓히고 가드를 바꾼다.** 만지는 것은
`src/features/onboarding/state.ts` · `store.ts` + 그 테스트뿐이다.
모달 문구는 step 2, 429 감지 배선은 step 3 이다.

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(슬림 인덱스 — 지정한 것만 열어라)
- `/docs/adr/ADR-116.md` — **step 0 이 만든 이 phase 의 결정**. 이 step 의 계약은 **결정 1**(원인별
  알림 상태)과 **결정 2**(가드를 "키 입력 화면이 아닐 때"로)다
- `/docs/adr/ADR-115.md` — **결정 10**(notice → confirm 구조) · **결정 6**(옛 멱등 가드) · 결정 2·3
- `/src/features/onboarding/state.ts` (전문 — `apiKeyInvalidNotice` · `API_KEY_INVALID_NOTICED` ·
  `RESET` · `initialOnboardingState`)
- `/src/features/onboarding/store.ts` (전문 — `noticeApiKeyInvalid` · `confirmApiKeyInvalid`)
- `/src/features/onboarding/__tests__/state.test.ts` · `/src/features/onboarding/__tests__/store.test.ts`
- `/src/app/ApiKeyInvalidModal.tsx` (**읽기만** — 이 step 에서 고치지 않는다. step 2 몫이다)

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `state.ts` — 알림을 원인별로

```ts
export type ApiKeyNoticeKind = 'invalid' | 'rateLimited'
```

- `OnboardingState.apiKeyInvalidNotice: boolean` → **`apiKeyNotice: ApiKeyNoticeKind | null`**
  (`initialOnboardingState` 는 `null`).
- 이벤트 `API_KEY_INVALID_NOTICED` → **`API_KEY_NOTICED`** 로 바꾸고 `kind: ApiKeyNoticeKind` 를 싣는다.
- 리듀서: `status` 를 **바꾸지 않는다**(그대로 두는 유일한 이벤트라는 성질 유지). 기존 주석의 근거
  ("뒤에 원래 화면이 남아 있어야 사용자가 무엇을 하다 이렇게 됐는지 보면서 이유를 읽는다")를 살려라.
- **이미 알림이 있으면 덮어쓰지 않는다**([[ADR-116]] 결정 2) — 리듀서에서 `state.apiKeyNotice !== null`
  이면 **같은 state 를 그대로 반환**한다. 두 원인 모두 처방이 같아 갈아끼울 실익이 없고, 읽던 문구가
  눈앞에서 바뀌면 안 된다.
- `RESET` 은 지금처럼 `initialOnboardingState` 로 되돌린다(알림도 함께 꺼진다).
- 필드를 바꾸면 리듀서의 객체 리터럴 3곳(`RESTORE_COMPLETED`·`RESTORE_STEP`·`API_KEY_VERIFIED`)이
  타입 오류를 낸다 — **전부 `apiKeyNotice: null`** 이다(그 셋은 화면이 새로 시작하는 전이다).

### 2. `store.ts` — 진입점 시그니처와 가드

```ts
// ADR-116 결정 1: 원인을 받는다. 무효 키(400 OPENAPI00005 · 401/403)와 429 가 같은 사슬을 탄다.
noticeApiKeyIssue(kind: ApiKeyNoticeKind): void
// 모달의 "확인" — 이름·동작 그대로. RESET + removeApiKey.
confirmApiKeyNotice(): Promise<void>
```

- **이름을 바꿔라**: `noticeApiKeyInvalid` → `noticeApiKeyIssue(kind)` ·
  `confirmApiKeyInvalid` → `confirmApiKeyNotice`. 이유: 이제 429 도 탄다 — 이름이 `Invalid` 면
  호출부가 무효 키 전용으로 오독한다. 호출부는 step 2·3 이 고치므로 **여기서는 인터페이스만 바꾸고
  기존 호출부(`use-api-key-invalidation.ts`·`features/settings/store.ts`)는 컴파일이 되도록 최소
  치환만 하라**(`noticeApiKeyIssue('invalid')`).
- **가드를 바꾼다**([[ADR-116]] 결정 2):
  ```
  이미 알림이 있으면(get().apiKeyNotice !== null)        → no-op
  status 가 'awaitingApiKey' 또는 'verifyingApiKey' 면   → no-op   ← 여기가 바뀌는 곳
  그 외                                                  → 알린다
  ```
  - 옛 조건 `status !== 'completed'` 를 **쓰지 마라.** 그것으로는 **온보딩 안에서 잠긴 사용자(#176)를
    구할 수 없다** — 그 잠금은 `selectingContentCharacters` 에서 일어난다.
  - 새 조건이 재이동 루프를 막는 근거: **키 입력 화면(그 두 status)에서는 알리지 않으므로** 폼에서
    실패가 반복돼도 모달이 다시 뜨지 않는다. 그 실패는 폼 자체의 토스트가 맡는다([[ADR-065]] 결정 1).
  - **가드는 `await` 보다 앞이고 함수는 동기다** — 그 구간이 원자적이라 동시 실패가 모달 하나로 접힌다.
- `confirmApiKeyNotice()` 는 지금 `confirmApiKeyInvalid()` 와 **동작이 같다**: 알림이 없으면 no-op,
  있으면 `RESET` → `try { await removeApiKey() } catch {}`. 429 도 키를 지운다(사용자 결정, 결정 1) —
  **원인별로 갈라 처리하지 마라.**

### 3. 테스트

`state.test.ts`:
- `API_KEY_NOTICED` 가 `kind` 를 담고 `status` 를 안 바꾼다(두 kind 각각).
- **이미 알림이 있으면 덮어쓰지 않는다** — `invalid` 위에 `rateLimited` 를 보내도 `invalid` 그대로이고
  **같은 객체가 반환된다**(불필요한 렌더 방지까지 단언).
- `RESET` 이 알림을 끈다.
- 기존 리터럴들의 `apiKeyInvalidNotice` → `apiKeyNotice: null` 로 바꿔라.

`store.test.ts`:
- `noticeApiKeyIssue('invalid')`·`noticeApiKeyIssue('rateLimited')` 각각 알림만 켜고 `status` 는 그대로,
  저장소·토스트는 건드리지 않는다.
- **가드 회귀(이 step 의 핵심)**: `awaitingApiKey`·`verifyingApiKey` 에서는 no-op 이고,
  **`selectingAccount`·`selectingContentCharacters`·`prefetching`·`error` 에서는 알린다.**
  마지막 셋이 이 step 이 고치는 것이다 — 옛 가드에서는 전부 no-op 이었다.
- 연달아 불러도 알림은 1회이고 먼저 뜬 원인이 유지된다.
- `confirmApiKeyNotice()` 는 두 kind 모두에서 `RESET` + `removeApiKey` 1회(`clearAuthConfig` 금지).
- 기존 "무효화 → 키 재입력 왕복" 통합 케이스가 새 이름으로 그대로 통과해야 한다.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                     # errors 0 (warnings 17 은 baseline)
# 이 step 은 features/onboarding 과 최소 치환 대상 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -v 'features/onboarding' | grep -v 'features/settings/store.ts' | wc -l   # 0
grep -c 'apiKeyInvalidNotice' src/features/onboarding/state.ts     # 0
grep -c "status !== 'completed'" src/features/onboarding/store.ts  # 0
grep -q 'noticeApiKeyIssue' src/features/onboarding/store.ts
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력을 확인하라**(둘 다, 결과를 summary 에):
   - 가드를 옛 조건(`status !== 'completed'`)으로 되돌리면 새 가드 테스트 중 **`selectingContentCharacters`
     에서 알린다**가 실패하는가? 실패하지 않으면 #176 을 담보하지 못하는 것이다. 확인 후 되돌려라.
   - 리듀서의 "덮어쓰지 않는다"를 지우면 해당 케이스만 실패하는가? 확인 후 되돌려라.
3. 아키텍처 체크: `features/` 가 `storage/` 어댑터만 쓰는가 · 스토어가 라우터를 모르는가([[ADR-050]]) ·
   리듀서가 `status` 를 안 바꾸는 성질이 유지되는가.
4. `phases/rate-limit-recovery/index.json` 의 step 1 갱신 — summary 에 **새 시그니처와 가드 조건**을
   반드시 담아라(step 2·3 이 이어받는다).

## 금지사항

- **`src/app/` 을 건드리지 마라**(모달은 step 2). 컴파일에 필요한 최소 치환만 예외다.
- **`use-account-probes.ts`·`ErrorState` 를 건드리지 마라**(step 4·5).
- **429 를 무효 키와 다르게 처리하지 마라** — 키 삭제 포함 동작이 같다(결정 1).
- **`status` 를 바꾸는 리듀서로 만들지 마라.** 이유: 뒤에 원래 화면이 남아야 한다(결정 1·[[ADR-115]] 결정 10).
- **알림을 덮어쓰게 만들지 마라.** 이유: 읽던 문구가 눈앞에서 바뀐다.
- 기존 테스트를 깨뜨리지 마라.
