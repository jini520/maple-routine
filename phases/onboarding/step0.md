# Step 0: onboarding-state

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 `features/*`가 상태·로직을 소유하고 `app/`이 화면을 담당한다는 계층 분리 규칙
- `/docs/ADR.md` — 특히 [[ADR-007]](Nexon Open API 연동 — API 키 인증, 계정(메이플ID) 선택 UI가 필요한 이유, "나중에 계정을 변경할 수 있어야 한다"는 확정 사항)과 [[ADR-008]](에러 핸들링 정책 — 401/403/429/네트워크 실패 구분, 온보딩 중 저장 실패 처리)
- `src/types/character.ts` — `foundation` task에서 정의한 `MapleAccount`(`{ accountId: string; characters: MapleCharacter[] }`) 타입. 이 step에서 그대로 재사용한다.

이전 task(`foundation`)에서 만들어진 타입을 꼼꼼히 읽고 작업하라.

## 배경

이 앱은 Nexon Open API 개인 키를 온보딩 화면에서 입력받아 계정을 연동한다([[ADR-007]]). 하나의 Nexon 계정 안에 여러 "메이플 ID"(계정)가 있을 수 있어, API 키로 조회한 `account_list`가 2개 이상이면 사용자가 그중 하나를 선택하는 화면이 필요하고, 정확히 1개면 선택 화면 없이 그 계정으로 바로 진행한다(확정 사항).

이번 step은 이 온보딩 흐름의 **순수 상태 전이 로직**만 다룬다. `fetch` 호출도, `storage` 접근도, Zustand도 이 step에는 없다 — 입력(이벤트)을 받아 다음 상태를 계산하는 리듀서 함수 하나가 핵심 산출물이다. 실제 비동기 연동(다음 step `onboarding-store`)이 이 리듀서를 가져다 쓴다.

## 작업

`src/features/onboarding/state.ts`를 작성하라(파일명은 재량, 아래 시그니처는 최소 요구사항):

```ts
export type OnboardingStatus =
  | 'awaitingApiKey'
  | 'verifyingApiKey'
  | 'selectingAccount'
  | 'completed'
  | 'error'

export type OnboardingError =
  | { kind: 'invalidApiKey' }        // 401/403
  | { kind: 'rateLimited' }          // 429
  | { kind: 'network' }              // 네트워크/5xx/JSON 파싱 실패 등
  | { kind: 'storageWriteFailed' }   // 로컬 저장 실패

export interface OnboardingState {
  status: OnboardingStatus
  accounts: MapleAccount[]
  selectedAccountId: string | null
  error: OnboardingError | null
}

export const initialOnboardingState: OnboardingState = { /* status: 'awaitingApiKey', accounts: [], selectedAccountId: null, error: null */ }

export type OnboardingEvent =
  | { type: 'RESTORE_COMPLETED'; selectedAccountId: string }
  | { type: 'SUBMIT_API_KEY' }
  | { type: 'API_KEY_VERIFIED'; accounts: MapleAccount[] }
  | { type: 'API_KEY_REJECTED'; error: OnboardingError }
  | { type: 'SELECT_ACCOUNT'; accountId: string }
  | { type: 'ACCOUNT_SELECTION_FAILED'; error: OnboardingError }
  | { type: 'RESET' }

export function onboardingReducer(state: OnboardingState, event: OnboardingEvent): OnboardingState
```

**반드시 지켜야 할 상태 전이 규칙(핵심 설계 의도, 임의로 바꾸지 마라)**:

1. `RESTORE_COMPLETED` → `status: 'completed'`, `selectedAccountId: event.selectedAccountId`, `accounts: []`, `error: null`. (이 앱은 온보딩 완료 여부만 캐시로 판단하고, 계정별 캐릭터 목록 자체는 이 feature의 책임이 아니다 — 필요하면 별도 feature가 다시 조회한다.)
2. `SUBMIT_API_KEY` → `status: 'verifyingApiKey'`, `error: null`. 나머지 필드 유지.
3. `API_KEY_VERIFIED` — **이 이벤트는 신규 API 키 제출과, 앱 재시작 시 저장된 키로 재개(resume)하는 경우 양쪽에 공용으로 쓰인다** (그래서 "계정 1개면 자동 완료" 규칙이 두 경로 모두에 일관되게 적용된다):
   - `event.accounts.length === 1`이면 → `status: 'completed'`, `accounts: event.accounts`, `selectedAccountId: event.accounts[0].accountId`, `error: null` (계정이 정확히 하나뿐이면 선택 화면을 생략하고 자동 확정 — [[ADR-007]] 확정 사항)
   - 그 외(0개 또는 2개 이상)이면 → `status: 'selectingAccount'`, `accounts: event.accounts`, `selectedAccountId: null`, `error: null`
4. `API_KEY_REJECTED` → `status: 'error'`, `error: event.error`. `accounts`/`selectedAccountId`는 변경하지 않는다.
5. `SELECT_ACCOUNT` → `status: 'completed'`, `selectedAccountId: event.accountId`. `accounts`는 유지.
6. `ACCOUNT_SELECTION_FAILED` → `status: 'error'`, `error: event.error`. `accounts`/`selectedAccountId`는 변경하지 않는다(재시도 시 다시 고를 수 있도록).
7. `RESET` → `initialOnboardingState`를 그대로 반환한다. (설정 화면에서 "계정 변경" 시작 시 쓰인다 — [[ADR-007]] "나중에 계정을 변경할 수 있어야 한다")

리듀서는 순수 함수여야 한다 — `Date.now()`, 랜덤값, 외부 I/O를 쓰지 마라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/features/onboarding/`에만 파일을 추가했는가?
   - `fetch`, `@capacitor/*`, `zustand` 등 비동기/외부 의존성을 전혀 쓰지 않았는가?
   - 위 7가지 상태 전이 규칙을 정확히 구현했는가(특히 규칙 3의 "계정 1개 자동완료" 분기)?
3. `src/features/onboarding/__tests__/state.test.ts`에 테스트를 먼저 작성한 뒤(TDD) 구현하라. 위 7가지 전이 규칙 각각에 대해 최소 1개씩 테스트 케이스를 작성하고, 특히 `API_KEY_VERIFIED`는 계정 1개/0개/2개 이상 세 경우 모두 테스트하라.
4. 결과에 따라 `phases/onboarding/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 타입·규칙을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `fetch`나 `src/nexon/`, `src/storage/`를 import하지 마라. 이유: 이 step은 순수 상태 전이 로직만 다루고, 실제 API/저장소 연동은 다음 step(`onboarding-store`)의 몫이다.
- `zustand`나 다른 상태 관리 라이브러리를 설치하지 마라. 이유: 이 step은 프레임워크 독립적인 순수 함수만 다룬다.
- `app/` 디렉토리에 화면 컴포넌트를 만들지 마라. 이유: 이번 `onboarding` task는 `features/onboarding` 상태·로직까지만 다루기로 확정했다(화면은 별도 task).
- 기존 테스트를 깨뜨리지 마라.
