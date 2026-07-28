# Step 1: onboarding-flow

**온보딩 경로**에서 "메이플 ID 계정이 정확히 1개면 선택 화면 없이 자동 확정" 규칙을 제거한다(이슈 #60, [[ADR-051]]). 설정(계정 변경) 경로에도 같은 규칙이 복제돼 있지만 그건 step 2에서 다룬다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-051.md` — **step 0에서 작성된 이번 작업의 결정.** 결정 1·2가 이 step의 규칙이다.
- `/docs/adr/ADR-016.md` — 예열(prefetch) 정책과 step 0에서 추가된 정정 문단. **예열 자체는 유지되고, 바뀌는 건 예열이 시작되는 시점뿐이다.**
- `/docs/features/onboarding.md` — step 0에서 갱신된 정책.
- `/src/features/onboarding/state.ts` — 주 수정 대상. `API_KEY_VERIFIED` 리듀서(`:78-96`)에 `event.accounts.length === 1`이면 `status: 'prefetching'` + `selectedAccountId` 즉시 확정 분기(`:81-89`)가 있다.
- `/src/features/onboarding/store.ts` — 주 수정 대상. `finalizeVerifiedAccounts`(`:53-77`)가 리듀서에 이벤트를 보내기 **전에** 계정 1개면 `setSelectedAccountId`를 먼저 저장하고(`:57-69`), 리듀서가 `'prefetching'`으로 갔는지 확인해 예열을 시작한다(`:74-76`). 호출부는 `restoreFromStorage`(`:110`)와 `submitApiKey`(`:129`) 두 곳.
- `/src/features/onboarding/__tests__/state.test.ts` — 갱신 대상.
- `/src/features/onboarding/__tests__/store.test.ts` — 갱신 대상. `계정이 1개면 setSelectedAccountId까지 자동 호출되고...`(`:174`), `계정이 1개면 예열(prefetchAccountData)이 호출되고...`(`:248`) 등이 옛 동작을 고정하고 있다.
- `/src/app/onboarding/OnboardingScreen.tsx` — `'selectingAccount'` 케이스(`:71-81`)가 `AccountSelectionList`를 렌더한다. **이 파일은 수정 대상이 아니다**(계정 1개도 이미 문제없이 렌더된다 — 목록이 1행일 뿐). 분기가 사라지면 자연히 도달한다는 것만 확인하라.

## 작업

### 1. 테스트 먼저 (TDD — CLAUDE.md CRITICAL)

구현보다 **먼저** 아래 기대치로 테스트를 고치고, 실패하는 것을 확인한 뒤 구현하라.

`src/features/onboarding/__tests__/state.test.ts`:
- `API_KEY_VERIFIED`에 계정 **1개**를 줘도 결과가 `status: 'selectingAccount'`, `selectedAccountId: null`, `accounts: [그 1개]` 여야 한다. 계정 2개 이상 케이스와 결과 형태가 동일해야 한다.

`src/features/onboarding/__tests__/store.test.ts`:
- `submitApiKey`가 계정 1개를 받으면 → `setApiKey`는 호출되지만 **`setSelectedAccountId`는 호출되지 않고**, **`prefetchAccountData`도 호출되지 않으며**, 상태는 `'selectingAccount'`, `selectedAccountId`는 `null`이다.
- 이어서 `selectAccount('acc-1')`을 호출하면 그때 비로소 `setSelectedAccountId('acc-1')` → 예열 → `'selectingTrackingMode'`로 간다(계정 2개일 때와 완전히 동일한 경로).
- `restoreFromStorage`(apiKey는 있고 `selectedAccountId`가 `null`인 재개 경로)도 계정 1개일 때 `'selectingAccount'`에서 멈춘다.
- "API 키를 확인했어요" 성공 토스트, 각 에러 종류별 상태 전이 등 **기존 단언은 그대로 유지**한다. 다만 계정 1개 fixture를 쓰면서 예열 완료 토스트("캐릭터 정보를 모두 불러왔어요")까지 단언하던 테스트는 예열 시점이 `selectAccount` 이후로 밀렸으므로 그에 맞게 고쳐라.

### 2. `src/features/onboarding/state.ts`

`API_KEY_VERIFIED`의 `if (event.accounts.length === 1) { ... }` 분기(`:81-89`)를 **통째로 제거**해 항상 `'selectingAccount'`를 반환하게 한다.

- 리듀서 위의 주석(`:79-80`, "계정이 확정되는 즉시(단일 계정 자동 확정)...")을 현행화하라 — 자동 확정이 없어졌다는 사실과 `[[ADR-051]]` 참조가 드러나야 한다.
- `SELECT_ACCOUNT` 케이스 위 주석(`:106`, "다중 계정 중 선택한 경우도 단일 계정과 동일하게 예열을 거친 뒤 완료된다")도 현행화하라 — 이제 **모든** 계정 확정이 이 경로 하나를 지난다.

### 3. `src/features/onboarding/store.ts`

`finalizeVerifiedAccounts`(`:53-77`)에서 선제 저장 블록(`:57-69`)과 `'prefetching'` 확인 후 예열 시작 블록(`:74-76`)을 제거한다. 그러면 함수 본문에 `set((state) => onboardingReducer(state, { type: 'API_KEY_VERIFIED', accounts }))` 한 줄만 남고 `apiKey` 인자도 쓰이지 않게 된다.

- **한 줄짜리 헬퍼는 남기지 말고 제거한 뒤, 두 호출부(`restoreFromStorage` `:110`, `submitApiKey` `:129`)에서 `set(...)`을 직접 호출하라.** 함수 위의 ADR-008 주석(`:50-52`)도 함께 사라진다 — 그 주석이 설명하던 동작 자체가 없어지기 때문이다.
- `runPrefetch`(`:36-48`)는 **그대로 둔다.** `selectAccount`(`:151`)가 계속 쓴다.
- `setSelectedAccountId` import는 **지우지 마라.** `selectAccount`(`:134`)가 계속 쓴다.

**이 step에서 반드시 지켜야 할 규칙:**
- `selectedAccountId`는 **사용자가 "계속하기"를 눌러 `selectAccount`가 호출될 때만** 저장돼야 한다([[ADR-051]] 결정 2). 선제 저장을 다른 형태(예: `API_KEY_VERIFIED` 직후 별도 호출)로 되살리지 마라.
- 저장 실패(`storageWriteFailed`) 처리 경로는 `selectAccount`의 `ACCOUNT_SELECTION_FAILED`(`:135-143`) 하나만 남는다. `API_KEY_REJECTED`로 `storageWriteFailed`를 내보내던 경로가 사라지는 것은 의도된 결과다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음(제거된 헬퍼의 미사용 인자·import 정리 포함)
npm test        # 전체 테스트 통과
npm run lint    # 경고 0
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/*`가 `storage/` 어댑터를 거치는 레이어 규칙을 유지하는가? (CLAUDE.md CRITICAL)
   - [[ADR-051]] 결정 1·2를 정확히 반영했는가? 특히 `selectedAccountId` 저장이 `selectAccount` 한 경로로만 일원화됐는가?
   - [[ADR-016]] 예열 파이프라인(`prefetch.ts`) 자체는 손대지 않았는가?
   - TDD 순서를 지켰는가(테스트 먼저 실패 확인 → 구현)?
3. 결과에 따라 `phases/account-selection-always/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 파일·제거한 분기·`finalizeVerifiedAccounts` 제거 사실·**"설정(features/settings) 경로에는 아직 같은 규칙이 남아 있다 — step 2 범위"** 를 명시하라.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/features/settings/` 아래 파일을 건드리지 마라. 이유: 같은 자동 확정 규칙의 복제본이 거기에도 있지만 step 2의 범위다. 한 step에서 두 모듈을 동시에 고치면 어느 쪽이 회귀를 냈는지 분리되지 않는다.
- `src/app/onboarding/AccountSelectionList.tsx`를 수정하지 마라. 이유: 계정 1개일 때 초기 하이라이트를 지정하는 것은 step 3의 범위다. 이 컴포넌트는 계정 수를 전제하지 않으므로 지금 상태로도 1개짜리 목록을 정상 렌더한다.
- `src/features/onboarding/prefetch.ts`의 예열 로직을 바꾸지 마라. 이유: [[ADR-016]]의 예열 정책은 이번 변경에서 **유지**된다. 바뀌는 것은 예열이 시작되는 시점뿐이다.
- `OnboardingScreen.tsx`의 화면 분기를 새로 만들지 마라. 이유: `'selectingAccount'` 케이스가 이미 존재하고, 리듀서 분기만 없애면 계정 1개도 그 케이스에 도달한다.
- 기존 테스트를 깨뜨리지 마라(단, 위 "작업 1"에 적힌 자동 확정 전제 테스트들은 새 정책에 맞춰 **의도적으로 갱신**하는 것이라 예외다).
