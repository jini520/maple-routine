# Step 2: settings-state

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md`의 "핵심 기능" 섹션 "6. 설정 화면" 전체
- `/docs/ARCHITECTURE.md`의 "[설정 화면 — ...]" 데이터 흐름 블록
- `src/features/onboarding/state.ts` (이번에 만들 리듀서가 그대로 따라야 할 패턴 — 순수 리듀서 + 이벤트 유니온 타입 스타일. 단, 아래 "작업"에 적힌 대로 상태 이름과 종료 지점은 다르다)
- `src/features/onboarding/__tests__/state.test.ts` (리듀서 단위 테스트 스타일 참고)

## 배경

이 화면은 "이미 연결된 상태"에서 시작한다는 점이 온보딩과 다르다 — 온보딩은 `awaitingApiKey`(키 없음)에서 시작해 `completed`(종료, 더 이상 안 돌아옴)로 끝나지만, 설정 화면은 평상시 아무 작업도 하지 않는 `idle` 상태에서 시작해서, API 키 변경이든 계정 변경이든 작업이 끝나면 다시 `idle`로 돌아온다(반복 가능).

API 키 변경(`changeApiKey`)과 계정 변경(`refreshAccounts`, 키 재입력 없이 저장된 키로 계정 목록만 재조회)은 둘 다 "계정 목록을 가져오는" 동일한 형태의 비동기 작업이라 리듀서 상태는 공유한다 — 실제로 어떤 함수를 호출했는지는 다음 step(`settings-store`)의 책임이고, 이 리듀서는 그 결과(성공/실패/개수)만 안다.

## 작업

`src/features/settings/state.ts` (신규)를 작성하라.

```ts
export type SettingsStatus = 'idle' | 'verifying' | 'selectingAccount' | 'prefetching' | 'error'

export type SettingsError =
  | { kind: 'invalidApiKey' } // 401/403
  | { kind: 'rateLimited' } // 429
  | { kind: 'network' } // 네트워크/5xx/JSON 파싱 실패 등
  | { kind: 'storageWriteFailed' } // 로컬 저장 실패

export interface PrefetchProgress {
  completed: number
  total: number
}

export interface SettingsState {
  status: SettingsStatus
  accounts: MapleAccount[]
  error: SettingsError | null
  prefetchProgress: PrefetchProgress | null
}

export const initialSettingsState: SettingsState = {
  status: 'idle',
  accounts: [],
  error: null,
  prefetchProgress: null,
}

export type SettingsEvent =
  | { type: 'VERIFY_START' }
  | { type: 'ACCOUNTS_VERIFIED'; accounts: MapleAccount[] }
  | { type: 'VERIFY_FAILED'; error: SettingsError }
  | { type: 'SELECT_ACCOUNT'; accountId: string }
  | { type: 'ACCOUNT_SELECTION_FAILED'; error: SettingsError }
  | { type: 'PREFETCH_PROGRESS'; completed: number; total: number }
  | { type: 'PREFETCH_FINISHED' }
  | { type: 'RESET' }

export function settingsReducer(state: SettingsState, event: SettingsEvent): SettingsState
```

전이 규칙 (`src/features/onboarding/state.ts`의 `onboardingReducer`와 이벤트별로 대응되지만 종료 지점이 다름에 유의):

- `VERIFY_START` → `status: 'verifying'`, `error: null` (다른 필드 유지)
- `ACCOUNTS_VERIFIED` — **핵심 규칙**: `accounts.length === 1`이면 `status: 'prefetching'`으로 바로 전이(onboarding과 동일한 자동 확정 규칙, `docs/ADR.md` ADR-016 참고), 아니면 `status: 'selectingAccount'`. 두 경우 모두 `accounts` 필드는 갱신한다.
- `VERIFY_FAILED` → `status: 'error'`, `error` 필드 설정, `accounts`는 유지하지 않고 빈 배열로 초기화하지도 않는다(그대로 유지 — 이전에 목록을 이미 가져온 상태에서 재시도가 실패했을 수도 있으므로 화면에 남은 목록을 지울 이유가 없다)
- `SELECT_ACCOUNT` → `status: 'prefetching'`, `prefetchProgress: null`
- `ACCOUNT_SELECTION_FAILED` → `status: 'error'`, `error` 필드 설정
- `PREFETCH_PROGRESS` → `prefetchProgress: { completed, total }`만 갱신, 다른 필드 유지
- `PREFETCH_FINISHED` → `initialSettingsState`가 아니라 `{ status: 'idle', accounts: [], error: null, prefetchProgress: null }`로 리셋(즉 `initialSettingsState`와 값은 같지만, 의미상 "작업 완료 후 평상 상태로 복귀"임을 코드에서 명확히 하기 위해 별도로 작성해도 되고 `initialSettingsState`를 재사용해도 된다 — 값이 동일하므로 구현은 자유)
- `RESET` → `initialSettingsState`

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/settings/state.ts`가 순수 함수로만 구성되어 있는가(비동기 호출·storage·nexon 클라이언트 import 없음)?
   - `MapleAccount` 타입은 `src/types`에서 import했는가(새로 정의하지 않았는가)?
3. `src/features/settings/__tests__/state.test.ts`(신규)에 위 "전이 규칙" 각 항목에 대응하는 테스트를 작성한다. 특히 다음 케이스를 반드시 포함한다:
   - `ACCOUNTS_VERIFIED`에서 계정이 1개면 `'prefetching'`, 2개 이상이면 `'selectingAccount'`로 갈리는 분기
   - `PREFETCH_FINISHED` 이후 상태가 `initialSettingsState`와 필드별로 동일한지
   - `VERIFY_FAILED` 이후에도 `accounts` 필드가 지워지지 않고 유지되는지
4. 결과에 따라 `phases/settings/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이 step에서는 Zustand 스토어(`features/settings/store.ts`)를 만들지 마라 — 다음 step에서 다룬다.
- `nexon/`, `storage/`를 이 파일에서 import하지 마라 — 순수 리듀서만 작성한다.
- `features/onboarding/state.ts`를 수정하지 마라(참고만 하고 손대지 않는다).
- 기존 테스트를 깨뜨리지 마라.
