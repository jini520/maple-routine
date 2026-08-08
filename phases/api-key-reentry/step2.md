# Step 2: resume-after-reentry

이 step 은 **"키를 다시 넣으면 뒤 단계를 저장된 값으로 재개한다"** 를 구현한다. 만지는 것은
`src/features/onboarding/` 안뿐이다 — 새 파일 `resume.ts` + `store.ts` + 그 테스트들.
호출부 배선(스케줄러·피커·설정)은 step 3~5 몫이다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-115.md` — **step 0 이 만든 이 phase 의 결정**. 이 step 의 계약은 **결정 4**(저장된
  값으로 재개 · 파생 판정은 함수 하나 · 예열 재실행 금지)와 **결정 5**(계정 목록 대조 가드)다
- `/docs/adr/ADR-086.md` — **결정 1·2**(재개 파생표와 그 근거, 진행 상태 전용 키를 두지 않는 이유,
  `trackingMode` 마이그레이션)
- `/docs/features/onboarding.md` — **"단계 재개"** 절(step 0 이 갱신했다 — 파생표가 이제 부팅과 키
  재입력 두 경로를 덮는다)
- `/src/features/onboarding/store.ts` (전문 — `restoreFromStorage` 84~136행 · `submitApiKey` 138~165행 ·
  `loadAccountsForSelection` 59~75행 · `restartAccountSelection` 195~202행)
- `/src/features/onboarding/state.ts` (전문 — `ResumableOnboardingStatus`, `RESTORE_COMPLETED`,
  `RESTORE_STEP`, `API_KEY_VERIFIED` 리듀서 동작)
- `/src/storage/api-key.ts` · `/src/storage/tracking-mode.ts` · `/src/storage/character-selection.ts`
- `/src/features/onboarding/__tests__/store.test.ts` (전문 — 특히 `restoreFromStorage` 기존 케이스)
- **step 1 이 만든 것**: `src/storage/api-key.ts#removeApiKey` · `store.ts#invalidateApiKey`

## 배경 (이 step 이 고치는 결함)

`restoreFromStorage` 는 저장된 값에서 재개 지점을 파생한다([[ADR-086]] 결정 1). 그런데 그 파생이
**부팅 경로에만** 있다. 키를 다시 넣는 경로(`submitApiKey`)는 성공하면 **무조건** `API_KEY_VERIFIED`
를 던지고, 리듀서가 `selectingAccount` + `selectedAccountId: null` 로 간다(`state.ts:97-106`).

그래서 401 로 키만 지워진 사용자가 키를 다시 넣으면 **계정 선택 → 전체 예열([[ADR-016]]) → 모드 →
캐릭터**를 전부 다시 묻는다. 저장소에는 그 값들이 그대로 남아 있는데도 그렇다.

## 작업

TDD 다 — **테스트를 먼저 쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `src/features/onboarding/resume.ts` 신설 — 재개 파생을 함수 하나로

`restoreFromStorage` 안에 인라인으로 있는 파생 로직을 **그대로** 옮긴다. 동작을 바꾸지 말고
**추출만** 하라(동작 변경은 아래 2번의 호출 지점 추가뿐이다).

```ts
export type ResumeTarget =
  | { status: 'awaitingApiKey' }
  | { status: 'selectingAccount'; apiKey: string }
  | { status: ResumableOnboardingStatus; selectedAccountId: string }
  | { status: 'completed'; selectedAccountId: string }

/**
 * 저장된 값에서 재개 지점을 파생한다([[ADR-086]] 결정 1). 부팅(restoreFromStorage)과
 * 키 재입력(submitApiKey) 두 경로가 이 함수 하나를 공유한다([[ADR-115]] 결정 4).
 */
export async function deriveResumeTarget(): Promise<ResumeTarget>
```

- 판정 순서와 조건은 **현행 `restoreFromStorage` 와 똑같이**: `getAuthConfig()` 가 null → `awaitingApiKey`
  / `selectedAccountId` 가 null → `selectingAccount`(키를 실어 보낸다) / `trackingMode` 가 null 인데
  추적 캐릭터가 있으면 → **`setTrackingMode('auto')` 1회 기록 후** `completed`([[ADR-086]] 결정 2
  마이그레이션 — **이 쓰기를 빼먹지 마라**) / `trackingMode` 가 null → `selectingTrackingMode` /
  추적 캐릭터가 `null` 또는 `[]` → `selectingContentCharacters` / 그 외 → `completed`.
- 뒤 두 단계 판정은 **로컬 읽기뿐**이다 — 여기서 네트워크를 부르지 마라. `selectingAccount` 의
  `character/list` 재조회는 스토어(`loadAccountsForSelection`)가 계속 맡는다. 그래서 `apiKey` 를
  타깃에 실어 보낸다.
- `ResumableOnboardingStatus` 는 `state.ts` 의 기존 타입을 재사용하라 — **새로 만들지 마라**.
- `storage/` 어댑터만 쓴다 — `@capacitor/preferences` 직접 접근 금지(CLAUDE.md CRITICAL).

### 2. `store.ts#restoreFromStorage` — 헬퍼를 쓰도록 치환

`deriveResumeTarget()` 결과에 따라 지금과 **완전히 같은** 전이를 하도록 바꾼다:
`awaitingApiKey` → 아무것도 안 함(조기 반환) / `selectingAccount` → `loadAccountsForSelection(apiKey)` /
`completed` → `RESTORE_COMPLETED` / 나머지 둘 → `RESTORE_STEP`.

**기존 `restoreFromStorage` 테스트가 한 건도 바뀌지 않고 통과해야 한다** — 이 치환은 순수 리팩터링이다.

### 3. `store.ts#submitApiKey` — 성공 후 재개 판정을 태운다

현행 흐름(검증 실패·저장 실패 처리·성공 토스트)은 **그대로 두고**, `setApiKey` 성공 + 성공 토스트
뒤에 아래를 넣는다:

```
target = await deriveResumeTarget()          // setApiKey 뒤라야 authConfig 가 채워져 있다
재개 가능?  target 이 'awaitingApiKey'·'selectingAccount' 가 아니다
            AND accounts 에 target.selectedAccountId 를 가진 계정이 있다   ← 결정 5 대조 가드
  예  → RESTORE_COMPLETED / RESTORE_STEP 으로 곧바로 그 단계로
  아니오 → 지금과 똑같이 API_KEY_VERIFIED(accounts)  (계정 선택부터)
```

핵심 규칙 — **반드시 지켜라**:

- **대조 가드를 빼지 마라**([[ADR-115]] 결정 5). 새로 넣은 키가 **다른 넥슨 계정의 키**일 수 있다.
  저장된 `selectedAccountId` 가 방금 받은 `accounts` 에 없으면 재개하지 않고 계정 선택부터 간다 —
  안 그러면 남의 계정 키로 이전 계정 ocid 추적 목록을 그대로 쓰게 된다. 판정은 **이미 손에 있는
  응답**으로 한다(추가 API 호출 금지).
- **예열(`runPrefetch`)을 부르지 마라.** 재개 경로는 예열을 건너뛴다([[ADR-086]] 결정 1 — 캐시가 이미
  따뜻하고 조회 원장이 중복 호출을 막는다). 예열은 사용자가 계정을 확정한 `selectAccount` 하나뿐이다
  ([[ADR-016]]/[[ADR-051]]).
- **성공 토스트(`'API 키를 확인했어요'`)는 두 갈래 모두에서 그대로 뜬다.** 문구를 바꾸지 마라.
- `target.status === 'awaitingApiKey'` 는 `setApiKey` 직후라 정상적으로는 올 수 없다. 방어적으로
  **기존 흐름(`API_KEY_VERIFIED`)으로 떨어뜨려라** — 여기서 throw 하지 마라.

### 4. 테스트

**`src/features/onboarding/__tests__/resume.test.ts` 신설** — `deriveResumeTarget` 단위 테스트.
[[ADR-086]] 결정 1 표의 5행을 전부 덮고, 마이그레이션 분기(`trackingMode` 없음 + 추적 캐릭터 있음)가
**`setTrackingMode('auto')` 를 실제로 쓰고** `completed` 를 반환하는지 단언하라.

**`src/features/onboarding/__tests__/store.test.ts`** 의 `submitApiKey` describe 에 추가:

1. **재개**: 저장소에 `selectedAccountId`(= 응답 accounts 에 있는 계정) + `trackingMode` +
   추적 캐릭터가 있으면 → status 가 **`completed`** 이고 `selectedAccountId` 가 저장값이며,
   **`selectingAccount` 를 한 번도 거치지 않고**, 예열(`prefetchAccountData`)이 **호출되지 않는다**
2. **대조 가드**: 저장된 `selectedAccountId` 가 응답 accounts 에 **없으면** → 기존대로
   `selectingAccount` 이고 `accounts` 가 응답 그대로다
3. **모드 미선택 재개**: `selectedAccountId` 는 맞는데 `trackingMode` 가 없으면 →
   `selectingTrackingMode`
4. **캐릭터 미선택 재개**: 추적 캐릭터가 `[]` 면 → `selectingContentCharacters`
5. **신규 사용자 회귀**: 저장소가 비어 있으면 → 지금과 똑같이 `selectingAccount` (기존 케이스가 그대로
   통과하는지 확인만 해도 된다)
6. **키 무효화 → 재입력 왕복(통합)**: `completed` 상태에서 `invalidateApiKey()`(step 1) 를 부른 뒤
   `submitApiKey(새 키)` 를 부르면 → 다시 `completed` 로 돌아오고 저장된 `selectedAccountId` 가
   그대로다. **이 케이스가 이슈 #157 의 요구사항 그 자체다.**

기존 `restoreFromStorage` 케이스는 **한 건도 고치지 마라** — 고쳐야 통과한다면 리팩터링이 동작을
바꾼 것이다.

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 없음
npm test                                         # 전부 통과 (baseline 2,570개 / 172파일 + 이 step 순증)
npm run lint                                     # errors 0 (warnings 17 은 baseline)
# features/onboarding 밖의 제품 코드는 건드리지 않는다
git status --porcelain -- src/ | grep -v 'features/onboarding' | wc -l    # 0
test -f src/features/onboarding/resume.ts
# 재개 파생의 진실은 하나다 — 스토어에 파생 조건이 남아 있으면 안 된다
grep -c 'getTrackedCharacterOcids' src/features/onboarding/store.ts       # 0
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. **판별력을 확인하라**(둘 다 하고 결과를 summary 에 적어라):
   - 대조 가드(`accounts.some(...)`)를 `true` 로 고정해보고 테스트 2 가 실제로 실패하는지 본다.
     확인 후 되돌려라.
   - `submitApiKey` 의 재개 분기를 지워 항상 `API_KEY_VERIFIED` 로 가게 해보고 테스트 1·6 이 실패하는지
     본다. 확인 후 되돌려라.
3. 아키텍처 체크리스트:
   - `resume.ts` 가 `storage/` 어댑터만 쓰고 `@capacitor/preferences` 를 직접 import 하지 않는가?
   - 재개 파생 조건이 **한 곳에만** 있는가? (`restoreFromStorage` 와 `submitApiKey` 가 같은 함수를
     부르는가 — [[ADR-115]] 결정 4)
   - [[ADR-086]] 결정 2 마이그레이션 쓰기가 살아 있는가?
   - 재개 경로에서 예열이 돌지 않는가?
4. 결과에 따라 `phases/api-key-reentry/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (`deriveResumeTarget` 시그니처와
     대조 가드 조건을 담아라)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`features/onboarding/` 밖의 제품 코드를 건드리지 마라.** 이유: 호출부 배선은 step 3~5 다.
- **재개 경로에서 예열(`prefetchAccountData`/`runPrefetch`)을 돌리지 마라.** 이유: 캐시가 이미 따뜻하고
  ([[ADR-086]] 결정 1), 예열은 사용자가 계정을 확정한 경로 하나뿐이라는 [[ADR-051]] 규칙을 깬다.
- **대조 가드를 생략하지 마라.** 이유: 다른 계정 키를 넣었을 때 추적 목록·수익 기록이 계정 불일치
  상태가 된다([[ADR-115]] 결정 5).
- **진행 상태 전용 저장 키를 새로 만들지 마라.** 이유: [[ADR-086]] 결정 1 이 명시적으로 거부한 설계다 —
  진실이 둘이 되고 한쪽만 써진 채 앱이 죽는 순간 어긋난다.
- **`restoreFromStorage` 의 동작을 바꾸지 마라** — 이 step 에서 그 함수는 순수 리팩터링 대상이다.
  기존 테스트가 한 건이라도 수정을 요구하면 잘못 옮긴 것이다.
- **`API_KEY_VERIFIED` 리듀서를 고치지 마라.** 이유: 신규 사용자·계정 변경 경로가 그 동작에 의존한다.
  분기는 스토어에서 한다.
- 기존 테스트를 깨뜨리지 마라.
