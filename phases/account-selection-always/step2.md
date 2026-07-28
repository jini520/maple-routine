# Step 2: settings-flow

**설정 → 계정(메이플 ID) 변경 경로**에서 "계정이 정확히 1개면 선택 화면 없이 자동 확정" 규칙을 제거한다(이슈 #60, [[ADR-051]]). 온보딩 경로의 동일 규칙은 step 1에서 이미 제거됐다 — 이 step은 그 복제본을 정리하는 것이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-051.md` — 이번 작업의 결정. 결정 1·2가 이 step의 규칙이다.
- `/docs/features/settings.md` — step 0에서 갱신된 계정 변경 정책.
- **step 1에서 수정된 파일 — 먼저 읽고 그 패턴을 그대로 미러링하라**:
  - `/src/features/onboarding/state.ts` (`API_KEY_VERIFIED`가 이제 계정 수와 무관하게 `'selectingAccount'`)
  - `/src/features/onboarding/store.ts` (`finalizeVerifiedAccounts`가 제거되고 두 호출부가 리듀서 이벤트를 직접 보냄)
- `/src/features/settings/state.ts` — 주 수정 대상. `ACCOUNTS_VERIFIED`(`:49-64`)에 `event.accounts.length === 1`이면 `status: 'prefetching'`으로 가는 분기(`:51-58`)가 있고, 주석에 "ADR-016과 동일한 자동 확정 규칙"으로 명시돼 있다.
- `/src/features/settings/store.ts` — 주 수정 대상. `finalizeAccounts`(`:44-51`)가 리듀서 전이 후 `get().status === 'prefetching'`이면 `setSelectedAccountId(accounts[0].accountId)` + `runPrefetch`를 실행한다(`:47-50`). 호출부는 `changeApiKey`(`:76`)와 `refreshAccounts`(`:96`) 두 곳.
- `/src/features/settings/__tests__/state.test.ts` — 갱신 대상.
- `/src/features/settings/__tests__/store.test.ts` — 갱신 대상. `성공하면 setApiKey를 호출하고, 계정이 1개면 자동으로 prefetching까지 진행 후 idle로 돌아간다`(`:75`), `setApiKey를 호출하지 않고, 저장된 키로 재조회해 계정이 1개면 prefetching까지 진행한다`(`:147`) 등이 옛 동작을 고정하고 있다.
- `/src/app/settings/AccountFlowStatus.tsx` — `'selectingAccount'` 케이스(`:33-43`)가 `AccountSelectionList`를 카드로 감싸 렌더한다. **수정 대상이 아니다** — 분기가 사라지면 자연히 도달한다는 것만 확인하라.
- `/src/app/settings/__tests__/AccountFlowStatus.test.tsx` — 계정 수 전제가 들어 있으면 갱신하라.

## 작업

### 1. 테스트 먼저 (TDD — CLAUDE.md CRITICAL)

구현보다 **먼저** 아래 기대치로 테스트를 고치고, 실패하는 것을 확인한 뒤 구현하라.

`src/features/settings/__tests__/state.test.ts`:
- `ACCOUNTS_VERIFIED`에 계정 **1개**를 줘도 `status: 'selectingAccount'`, `accounts: [그 1개]` 여야 한다. 계정 2개 이상 케이스와 결과 형태가 동일해야 한다.

`src/features/settings/__tests__/store.test.ts`:
- `changeApiKey`가 계정 1개를 받으면 → `setApiKey`는 호출되지만 **`setSelectedAccountId`·`prefetchAccountData`는 호출되지 않고** 상태가 `'selectingAccount'`에서 멈춘다.
- `refreshAccounts`도 계정 1개일 때 `'selectingAccount'`에서 멈춘다.
- 이어서 `selectAccount('acc-1')`을 호출하면 그때 `setSelectedAccountId('acc-1')` → 예열 → `'idle'`(`PREFETCH_FINISHED`)로 간다. 계정 2개일 때와 완전히 동일한 경로다.
- 에러 전이(`VERIFY_FAILED`·`ACCOUNT_SELECTION_FAILED`)와 `setApiKey` 실패 처리 등 **기존 단언은 그대로 유지**한다.

### 2. `src/features/settings/state.ts`

`ACCOUNTS_VERIFIED`의 `if (event.accounts.length === 1) { ... }` 분기(`:51-58`)를 **통째로 제거**해 항상 `'selectingAccount'`를 반환하게 한다. 주석(`:50`)도 현행화하라 — 자동 확정 규칙이 폐기됐다는 사실과 `[[ADR-051]]` 참조가 드러나야 한다.

### 3. `src/features/settings/store.ts`

`finalizeAccounts`(`:44-51`)의 `if (get().status === 'prefetching') { ... }` 블록(`:47-50`)은 리듀서 분기가 사라지면 **절대 참이 될 수 없는 죽은 코드**가 된다. 블록을 제거하면 함수 본문에 `set((state) => settingsReducer(state, { type: 'ACCOUNTS_VERIFIED', accounts }))` 한 줄만 남고 `apiKey` 인자도 쓰이지 않게 된다.

- **한 줄짜리 헬퍼는 남기지 말고 제거한 뒤, 두 호출부(`changeApiKey` `:76`, `refreshAccounts` `:96`)에서 `set(...)`을 직접 호출하라.**
- `runPrefetch`(`:30-41`)는 **그대로 둔다.** `selectAccount`(`:114`)가 계속 쓴다.
- `setSelectedAccountId` import는 **지우지 마라.** `selectAccount`(`:101`)가 계속 쓴다.
- `get`이 store 팩토리에서 더 이상 쓰이지 않게 되면 시그니처에서 정리하라. 다만 `selectAccount`(`:111`)가 `get().accounts`를 쓰므로 실제로는 계속 필요할 것이다 — 빌드/lint 결과를 보고 판단하라.

**이 step에서 반드시 지켜야 할 규칙:**
- `selectedAccountId`는 사용자가 "계속하기"를 눌러 `selectAccount`가 호출될 때만 저장돼야 한다([[ADR-051]] 결정 2).
- 설정 경로의 상태 머신은 온보딩과 **같은 규칙**을 따라야 한다. step 1에서 온보딩에 적용한 것과 다른 형태로 구현하지 마라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음(제거된 헬퍼의 미사용 인자·import 정리 포함)
npm test        # 전체 테스트 통과
npm run lint    # 경고 0

# 두 경로 모두에서 자동 확정 분기가 사라졌는지 확인 — 결과가 없어야 한다
grep -n "accounts.length === 1" src/features/onboarding src/features/settings -r
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/*`가 `storage/` 어댑터를 거치는 레이어 규칙을 유지하는가? (CLAUDE.md CRITICAL)
   - 온보딩(step 1)과 설정(이 step)이 **동일한 규칙·동일한 구조**로 정리됐는가?
   - [[ADR-016]] 예열 파이프라인 자체는 손대지 않았는가?
   - TDD 순서를 지켰는가?
3. 결과에 따라 `phases/account-selection-always/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 파일·제거한 분기·죽은 블록 제거 사실·**"두 경로(온보딩·설정) 모두 자동 확정 제거 완료, 남은 것은 AccountSelectionList 초기 하이라이트(step 3)"** 를 명시하라.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/features/onboarding/` 아래 파일을 다시 수정하지 마라. 이유: step 1에서 이미 완료됐다. 다시 손대면 어느 step이 회귀를 냈는지 분리되지 않는다.
- `src/app/onboarding/AccountSelectionList.tsx`를 수정하지 마라. 이유: 초기 하이라이트는 step 3의 범위다.
- `src/app/settings/AccountFlowStatus.tsx`에 계정 수 분기를 새로 만들지 마라. 이유: `'selectingAccount'` 케이스가 이미 존재하고, 리듀서 분기만 없애면 계정 1개도 그 케이스에 도달한다.
- `disconnect()`(`:118-120`)나 `reset()`을 건드리지 마라. 이유: 연결 해제 흐름은 이번 변경과 무관하다.
- 기존 테스트를 깨뜨리지 마라(단, 위 "작업 1"의 자동 확정 전제 테스트들은 새 정책에 맞춰 **의도적으로 갱신**한다).
