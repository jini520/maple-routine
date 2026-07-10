# Step 2: daily-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — [[ADR-007]](일간 화면은 완전 읽기 전용), [[ADR-008]](네트워크 실패 시 마지막 캐시 표시 + "마지막 동기화: n분 전 · 새로고침" 안내, 자동 재시도 없이 사용자가 새로고침 버튼을 눌러야 재시도)
- `src/features/daily-scheduler/store.ts` — `useDailySchedulerStore`(이전 task `scheduler`에서 완성). `DailyCharacterView`(`{ ocid, characterName, dailyContents, isStale, syncedAt, error }`), `DailySchedulerStatus`(`'idle' | 'loading' | 'loaded' | 'error'`), `refresh(): Promise<void>`
- `src/features/schedule-sync/schedule-sync.ts` — `ScheduleSyncError`(`{ kind: 'invalidApiKey' | 'rateLimited' | 'network' }`)
- `src/App.tsx` — 이전 step(`app-shell`)에서 만든 `/daily` 라우트의 placeholder. 이 step이 그 안을 채운다.
- `src/app/onboarding/error-message.ts` — 참고용. `OnboardingError`를 문구로 바꾸는 기존 헬퍼 패턴(이번 step은 `ScheduleSyncError`용으로 비슷한 걸 새로 만든다).

## 배경

일간 스케줄러는 완전 읽기 전용이다 — 사용자가 체크하는 UI는 없고, 캐릭터별 `dailyContents`를 보여주기만 한다. 캐릭터 단위로 동기화 실패가 있을 수 있으므로([[ADR-008]]), 그 캐릭터에만 "마지막 동기화: n분 전 · 새로고침 필요" 같은 안내를 붙인다.

## 작업

### 1. `src/features/schedule-sync/format.ts` — 공용 표시 헬퍼 (다음 step인 weekly-screen도 재사용한다)

```ts
export function formatScheduleSyncError(error: ScheduleSyncError): string
export function formatSyncedAt(syncedAt: string | null): string
```
- `formatScheduleSyncError`: `invalidApiKey`→"API 키가 유효하지 않습니다", `rateLimited`→"잠시 후 다시 시도해주세요", `network`→"네트워크 오류가 발생했습니다" 정도(정확한 워딩은 재량).
- `formatSyncedAt`: `null`이면 "동기화 기록 없음". 아니면 현재 시각과의 차이를 "n분 전"/"n시간 전" 형태로(분 단위 미만은 "방금 전" 등, 세부 구간은 재량).

### 2. `src/app/daily/DailyScreen.tsx`

```ts
export function DailyScreen(): React.JSX.Element
```
- `useDailySchedulerStore()`로 `status`/`characters`/`error`/`refresh`를 구독한다.
- 마운트 시 1회 `refresh()`를 호출한다(`useEffect` 의존성 배열 빈 배열).
- **상단에 항상 "새로고침" 버튼**을 둔다. 클릭하면 `refresh()`를 다시 호출한다([[ADR-008]] — 자동 재시도 없이 사용자가 눌러야 재시도).
- `status === 'idle' | 'loading'` → 로딩 표시.
- `status === 'error'` → `error`를 `formatScheduleSyncError`로 표시.
- `status === 'loaded'` → 캐릭터별로:
  - 캐릭터명(`characterName`)
  - `dailyContents` 목록: 각 항목의 이름 + 등록 여부(`isRegistered`) + 진행도(`nowCount`/`maxCount`)
  - `isStale`가 `true`이면 그 캐릭터 영역에 `formatScheduleSyncError(error)` + `formatSyncedAt(syncedAt)`를 안내 문구로 보여준다(예: "네트워크 오류가 발생했습니다 · 동기화 기록 없음" 또는 "... · 5분 전 데이터").
  - `dailyContents`가 빈 배열이고 `isStale`도 아니면(게임 내 스케줄러에 아무것도 등록 안 한 신규 캐릭터), 에러가 아니라 "게임에서 스케줄러에 등록해주세요" 같은 빈 상태 안내를 보여준다([[ADR-008]] 확정: 이건 정상적인 빈 상태이지 에러가 아니다).

`src/App.tsx`의 `/daily` placeholder를 이 `DailyScreen`으로 교체하라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `DailyScreen`이 `useDailySchedulerStore`만 구독하고 `nexon/`·`storage/`를 직접 import하지 않는가?
   - "게임에 등록 안 함"(빈 배열, 에러 아님)과 "동기화 실패"(isStale)를 구분해서 다르게 보여주는가?
   - 새로고침 버튼이 항상 존재하는가?
3. `src/features/schedule-sync/__tests__/format.test.ts`(node 환경)와 `src/app/daily/__tests__/DailyScreen.test.tsx`(`// @vitest-environment jsdom`)에 테스트를 먼저 작성한 뒤(TDD) 구현하라. `useDailySchedulerStore`를 `vi.mock`으로 모킹해:
   - 마운트 시 `refresh`가 1번 호출된다.
   - "새로고침" 버튼 클릭 시 `refresh`가 다시 호출된다.
   - `status: 'loaded'`이고 특정 캐릭터가 `isStale: true`이면 그 캐릭터 영역에 에러 문구가 보인다.
   - `dailyContents: []`이고 `isStale: false`인 캐릭터는 에러 문구가 아니라 빈 상태 안내가 보인다.
4. 결과에 따라 `phases/scheduler-ui/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 분기를 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 사용자가 일간 콘텐츠를 앱 안에서 체크/등록하는 UI를 넣지 마라. 이유: [[ADR-007]]이 완전 읽기 전용으로 확정했다.
- "게임에 아무것도 등록 안 한 빈 상태"를 에러처럼 표시하지 마라. 이유: [[ADR-008]]이 이건 정상 상태라고 명시한다.
- `refresh()`를 폴링(setInterval 등)으로 자동 재시도하게 만들지 마라. 이유: [[ADR-008]]이 배터리 소모 방지를 위해 사용자가 직접 눌러야 재시도하는 방식으로 확정했다.
- 기존 테스트를 깨뜨리지 마라.
