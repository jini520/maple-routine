# Step 1: invalidate-entry

이 step 은 **키 무효화 진입점 하나**를 만든다. 파일은 둘 + 그 테스트다:
`src/storage/api-key.ts` · `src/features/onboarding/store.ts`.
호출부 배선(스케줄러·피커·설정)은 step 3~5 몫이니 **여기서는 아무도 이 함수를 부르지 않는다.**

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-115.md` — **step 0 이 만든 이 phase 의 결정**. 이 step 의 계약은 **결정 1**(토스트
  문구·액션 없음) · **결정 2**(상태를 뒤집으면 App 가드가 라우터로 보낸다) · **결정 3**(apiKey 만
  삭제) · **결정 6**(멱등 가드)이다
- `/docs/foundation/error-resilience.md` — 401/403 행(step 0 이 갱신했다)
- `/src/storage/api-key.ts` (전문 — `getAuthConfig`/`setApiKey`/`setSelectedAccountId`/`clearAuthConfig`)
- `/src/storage/keys.ts` (`STORAGE_KEYS`)
- `/src/storage/__tests__/api-key.test.ts` (전문 — 기존 테스트 형식·Preferences 모킹 방식)
- `/src/features/onboarding/store.ts` (전문 — 특히 `reset()` 이 `clearAuthConfig` 를 쓰는 것과
  `useToastStore` 사용 형태)
- `/src/features/onboarding/state.ts` (전문 — `initialOnboardingState`, `RESET` 이벤트)
- `/src/features/onboarding/__tests__/store.test.ts` (전문 — 스토어 테스트의 모킹·초기화 형식)
- `/src/features/toast/store.ts` (`showError` 시그니처)
- `/src/App.tsx` **269행·295~344행** (`isCompleted` 가드 — 왜 라우터 호출이 필요 없는지)

## 작업

TDD 다 — **테스트를 먼저 쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `src/storage/api-key.ts` — `removeApiKey()` 추가

```ts
export async function removeApiKey(): Promise<void>
```

- `STORAGE_KEYS.apiKey` **하나만** 제거한다.
- **`selectedAccountId` 를 건드리지 마라**([[ADR-115]] 결정 3). 그 값은 키 재입력 후의 재개(step 2)가
  쓴다. `clearAuthConfig()` 가 둘 다 지우는 것은 연결 해제용이라 그런 것이고, 이 함수는 다른 목적이다.
- 파일에 이미 있는 `Preferences.remove` 형태를 그대로 따르라.
- 두 함수의 차이를 짧은 주석으로 남겨라 — 나중에 누가 `clearAuthConfig` 로 갈아끼우면 재개가 조용히
  깨진다.

### 2. `src/features/onboarding/store.ts` — `invalidateApiKey()` 추가

`OnboardingStore` 인터페이스에 추가하고 구현한다:

```ts
// 저장된 키가 넥슨에서 무효화됐을 때(401/403) 부르는 유일한 진입점.
invalidateApiKey(): Promise<void>
```

구현 계약 — **아래 4개는 설계 의도라 벗어나면 안 된다**:

1. **멱등 가드가 맨 앞이고, `await` 보다 먼저다.**
   ```
   if (get().status !== 'completed') return
   ```
   `completed` 가 아니면 아무 일도 하지 않는다. 이 한 줄이 두 가지를 동시에 막는다 —
   여러 화면·여러 캐릭터의 동시 401(토스트·이동이 1회로 접힌다)과, 키 입력 화면에서 다시 나는 401
   (그때 status 는 `awaitingApiKey`/`verifyingApiKey`/`error` 라 **재이동 루프가 구조적으로 불가능**하다,
   [[ADR-115]] 결정 6).

2. **상태 전이를 `await` 전에 동기로 끝내라.** 가드와 `set` 사이에 `await` 가 하나라도 있으면 동시
   호출이 둘 다 가드를 통과한다(JS 는 단일 스레드라 **await 가 없으면** 그 구간이 원자적이다).
   전이는 **기존 `RESET` 이벤트를 재사용**한다:
   ```
   set((state) => onboardingReducer(state, { type: 'RESET' }))
   ```
   **새 이벤트를 만들지 마라** — `RESET` 의 결과(`initialOnboardingState`)가 원하는 것과 정확히 같고,
   같은 결과를 내는 이벤트를 하나 더 두면 리듀서의 진실이 둘이 된다. 무효화와 연결 해제의 차이는
   리듀서가 아니라 **저장소에 무엇을 지우는가**(`removeApiKey` vs `clearAuthConfig`)에 있고, 그 차이는
   이미 스토어 메서드가 갖는다.

3. **토스트는 액션 없이 문구만.**
   ```
   useToastStore.getState().showError('API 키가 더 이상 유효하지 않습니다')
   ```
   **액션 버튼을 붙이지 마라**([[ADR-115]] 결정 1) — 이동이 이미 일어났으므로 누를 것이 없다.
   문구는 **한 글자도 다르면 안 된다**(step 3~5 의 테스트가 이 문자열을 단언한다).

4. **저장소 삭제는 마지막이고, 실패를 삼킨다.**
   ```
   try { await removeApiKey() } catch { /* 아래 이유 */ }
   ```
   삼키는 이유를 주석으로 남겨라: 화면은 이미 키 입력으로 갔고, 삭제가 실패하면 재시작 시 옛 무효
   키가 되살아나 **다시 이 경로를 탈 뿐**이라 막다른 길이 아니다([[ADR-115]] 결정 3 "알려진 열화").
   여기서 rethrow 하면 호출부가 전부 `void` 호출이라 미처리 rejection 이 된다([[ADR-065]] 결정 1 이
   고쳤던 그 결함과 같은 종류다).

**라우터를 부르지 마라.** 상태가 `completed` 를 벗어나는 순간 `App.tsx:295-344` 가드가 모든 라우트를
`<Navigate to="/onboarding" replace>` 로 보낸다([[ADR-115]] 결정 2). `window.location` 은 문서를
리로드해 네이티브 SQLite 커넥션을 stale 하게 만든다([[ADR-050]]).

### 3. 테스트

**`src/storage/__tests__/api-key.test.ts`** 에 추가:

- `removeApiKey()` 가 `apiKey` 키를 제거한다
- **`removeApiKey()` 후에도 `selectedAccountId` 가 저장소에 남는다** — 이 단언이 이 step 의 핵심
  회귀 가드다(누가 `clearAuthConfig` 로 갈아끼우면 여기서 잡힌다)
- `getAuthConfig()` 는 그 뒤 `null` 을 반환한다(apiKey 가 없으면 나머지를 읽지 않는다는 현행 동작 확인)

**`src/features/onboarding/__tests__/store.test.ts`** 에 `invalidateApiKey` describe 를 추가:

1. `completed` 상태에서 부르면 → status 가 `awaitingApiKey` 로 가고, `selectedAccountId`·`accounts`·
   `error`·`prefetchProgress` 가 초기값이며, `showError` 가 **`'API 키가 더 이상 유효하지 않습니다'`**
   로 **액션 인자 없이**(두 번째 인자가 `undefined`) 1회 불린다
2. **저장소에서 `apiKey` 만 지워진다** — `selectedAccountId` 는 남는다
3. **멱등**: `completed` 에서 `invalidateApiKey()` 를 **연달아 2번**(await 없이 동시에도) 불러도
   `showError` 는 1회, `removeApiKey`(또는 Preferences.remove) 도 1회다
4. **`completed` 가 아니면 no-op**: `awaitingApiKey`·`verifyingApiKey`·`error` 각각에서 불러도 상태가
   그대로이고 토스트도 저장소 삭제도 일어나지 않는다 (재이동 루프 차단의 단언)
5. `reset()`(연결 해제)과 **다르다**: `reset()` 은 `selectedAccountId` 까지 지운다는 기존 동작이
   그대로임을 확인한다(회귀 가드 — 두 경로가 섞이지 않았다)

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 없음
npm test                                         # 전부 통과 (baseline 2,570개 / 172파일)
npm run lint                                     # errors 0 (warnings 17 은 baseline)
# 이 step 이 만지는 src 파일은 4개다 (제품 2 + 테스트 2)
git status --porcelain -- src/ | wc -l           # 4
# 아무도 아직 이 함수를 부르지 않는다 — 정의 + 인터페이스 선언뿐
grep -rn 'invalidateApiKey' src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v 'features/onboarding/store.ts' | wc -l   # 0
grep -q 'removeApiKey' src/storage/api-key.ts
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. **판별력을 확인하라**(둘 다 하고 결과를 summary 에 적어라):
   - 멱등 가드(`if (get().status !== 'completed') return`)를 지워보고 테스트 3·4 가 **실제로** 실패하는지
     본다. 실패하지 않으면 그 테스트는 아무것도 담보하지 않는 것이다. 확인 후 되돌려라.
   - `removeApiKey()` 를 `clearAuthConfig()` 로 바꿔보고 `selectedAccountId` 잔존 단언이 실패하는지
     본다. 확인 후 되돌려라.
3. 아키텍처 체크리스트:
   - `features/` 코드가 `@capacitor/preferences` 를 직접 import 하지 않고 `storage/` 어댑터만 쓰는가?
     (CLAUDE.md CRITICAL, [[ADR-003]]·[[ADR-005]])
   - 스토어가 `react-router` 나 `window.location` 을 import 하지 않는가? ([[ADR-115]] 결정 2·[[ADR-050]])
   - 새 리듀서 이벤트를 만들지 않고 `RESET` 을 재사용했는가?
4. 결과에 따라 `phases/api-key-reentry/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (step 2~5 가 이 함수를 부르므로
     **정확한 시그니처와 멱등 가드 조건**을 summary 에 담아라)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`clearAuthConfig()` 를 쓰지 마라.** 이유: `selectedAccountId` 까지 지워 step 2 의 재개를 불가능하게
  만든다. 그 함수는 연결 해제 전용이다.
- **`state.ts` 에 새 이벤트를 추가하지 마라.** 이유: `RESET` 의 결과가 정확히 같다. 같은 결과의 이벤트가
  둘이면 리듀서의 진실이 둘이 된다.
- **`submitApiKey`·`restoreFromStorage` 를 건드리지 마라.** 이유: 재개 로직은 step 2 몫이다. 여기서
  함께 고치면 "무효화만 넣었을 때 무엇이 깨지는가"를 볼 수 없다.
- **호출부를 배선하지 마라** — `use-sync-error-toast.ts`·`app/`·`features/settings/` 는 step 3~5 다.
- **토스트에 액션 버튼을 붙이지 마라.** 이유: 이동이 이미 일어나 누를 것이 없다([[ADR-115]] 결정 1).
- **`removeApiKey()` 의 실패를 사용자에게 알리지 마라.** 이유: 화면은 이미 옳은 곳에 있고, 실패해도
  다시 이 경로를 탈 뿐이라 알려도 사용자가 할 수 있는 것이 없다.
- 기존 테스트를 깨뜨리지 마라.
