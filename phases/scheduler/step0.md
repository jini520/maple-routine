# Step 0: schedule-sync

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "데이터 흐름" 섹션의 "이후 동기화" 부분(캐릭터별 스케줄러 상태 조회 → 실패 시 마지막 캐시 표시 → 캐시 저장), `daily-scheduler`/`weekly-scheduler`가 "로컬에 쓰기 위한 상태를 직접 소유하지 않고 nexon/schedule이 반환하는 동기화 캐시를 읽기 전용으로 구독한다"는 패턴 설명
- `/docs/ADR.md` — 특히 [[ADR-008]](에러 핸들링 정책: 네트워크/5xx/JSON파싱실패는 마지막 캐시 유지, 401/403은 캐시 유지하되 키 무효 안내 후 재호출 중단, 429는 지수 백오프, 여러 캐릭터 동기화는 병렬 금지 순차 호출)
- `src/storage/api-key.ts` — `getAuthConfig(): Promise<NexonAuthConfig | null>`(`{ apiKey: string; selectedAccountId: string | null }`)
- `src/nexon/client.ts`, `src/nexon/errors.ts` — `fetchCharacterList(apiKey): Promise<MapleAccount[]>`, `fetchSchedulerCharacterState(apiKey, ocid): Promise<SchedulerCharacterState>`, 에러 클래스 `NexonAuthError`(401/403)·`NexonRateLimitError`(429)·`NexonNetworkError`(그 외). **주의**: 이 step은 이미 있는 `fetchSchedulerStatesForCharacters`(foundation에서 만든 배치 헬퍼)를 재사용하지 않는다 — 그 함수는 실패한 캐릭터를 결과에서 조용히 스킵하는데, 이 step은 실패한 캐릭터마다 캐시로 폴백해야 해서 캐릭터별 성공/실패를 직접 알아야 한다. 대신 `fetchSchedulerCharacterState`를 캐릭터별로 직접 순차 호출하라.
- `src/storage/scheduler-cache.ts` — 현재 `getCachedSchedulerState(ocid): Promise<SchedulerCharacterState | null>` / `setCachedSchedulerState(ocid, state: SchedulerCharacterState): Promise<void>`. **이번 step에서 이 시그니처를 변경한다** (아래 "작업" 참고) — 관련 테스트(`src/storage/__tests__/scheduler-cache.test.ts`)도 새 시그니처에 맞게 함께 갱신하라.
- `src/types/` — `MapleAccount`/`MapleCharacter`/`SchedulerCharacterState` 등 기존 도메인 타입

## 배경

`ARCHITECTURE.md`는 일간/주간 스케줄러뿐 아니라 주간 보스 수익 계산기·물욕 아이템 화면까지 총 4개 기능이 "캐릭터 목록 조회 + 스케줄 동기화(실패 시 캐시 폴백)"라는 같은 로직을 공유해서 구독한다고 설명한다. 지금까지는 이 공용 로직이 없었다(`onboarding`은 "연동 완료 여부"만 알 뿐 캐릭터 목록을 들고 있지 않다 — 캐릭터명·레벨이 바뀔 수 있어 일부러 캐싱하지 않기로 확정했었다). 이번 step이 그 최초의 공용 모듈이다. **다른 기능(daily-scheduler 등)이 어떻게 이 모듈을 쓸지는 다음 step의 몫이니 이번 step에서는 화면이나 다른 feature 코드를 만들지 마라.**

## 작업

### 1. `storage/scheduler-cache.ts` 확장 — 동기화 시각 추가

캐시된 값에 "언제 성공적으로 동기화됐는지"를 함께 저장하도록 바꿔라. [[ADR-008]]이 "마지막 동기화: n분 전" 표시를 요구하는데, 지금 저장 형식은 시각 정보가 없다.

```ts
export interface CachedSchedulerEntry {
  state: SchedulerCharacterState
  syncedAt: string // ISO 문자열 — 이 state가 성공적으로 동기화된 실제 시각(wire의 date 필드와는 다른, 우리 기기 기준 caching 시각)
}

export async function getCachedSchedulerState(ocid: string): Promise<CachedSchedulerEntry | null>
export async function setCachedSchedulerState(ocid: string, entry: CachedSchedulerEntry): Promise<void>
```
- 기존 손상된 JSON → `null` 반환, 쓰기 실패 → 에러 그대로 전파하는 동작은 그대로 유지하라.
- `src/storage/__tests__/scheduler-cache.test.ts`를 새 시그니처(`{ state, syncedAt }` 객체)에 맞게 고쳐라.

### 2. `src/features/schedule-sync/` 신규 — 공용 동기화 모듈

```ts
export type ScheduleSyncError =
  | { kind: 'invalidApiKey' }  // 401/403
  | { kind: 'rateLimited' }    // 429
  | { kind: 'network' }        // 그 외 네트워크/파싱 실패

export interface CharacterScheduleSync {
  ocid: string
  characterName: string             // getRegisteredCharacters()로 얻은 이름 — state가 null이어도 항상 있음
  state: SchedulerCharacterState | null  // 이번 호출도 실패하고 캐시도 없으면 null
  syncedAt: string | null           // 이 state가 마지막으로 "성공"한 시각(라이브 성공이든 캐시든). 캐시도 없으면 null
  isStale: boolean                  // 이번 호출이 실패해서 캐시(또는 아무것도 없음)를 보여주는 중이면 true
  error: ScheduleSyncError | null   // 이번 호출이 실패했을 때만 채워짐(성공이면 null)
}

export async function getRegisteredCharacters(): Promise<MapleCharacter[]>

export async function syncAllSchedules(): Promise<CharacterScheduleSync[]>
```

**`getRegisteredCharacters()` 규칙**: `getAuthConfig()`로 `apiKey`/`selectedAccountId`를 읽는다. `apiKey`가 없거나 `selectedAccountId`가 없거나, `fetchCharacterList(apiKey)` 결과에서 `selectedAccountId`와 일치하는 계정을 못 찾으면 에러를 던져라(이 함수는 온보딩이 이미 끝난 상태에서만 호출된다는 전제이므로 이 경우들을 위한 별도 상태 설계는 이번 step 범위가 아니다 — 단순히 명확한 에러 메시지와 함께 throw만 하면 된다). 찾으면 그 계정의 `characters` 배열을 그대로 반환한다.

**`syncAllSchedules()` 규칙 — 반드시 지켜라**:
1. `getRegisteredCharacters()`로 캐릭터 목록을 얻는다.
2. 각 캐릭터를 **순차적으로**(동시에 두 개 이상 in-flight 되지 않게) 처리한다.
3. `fetchSchedulerCharacterState(apiKey, ocid)`가 성공하면: `setCachedSchedulerState(ocid, { state, syncedAt: <지금 시각> })`로 캐시를 갱신하고, `{ ocid, characterName, state, syncedAt: <지금 시각>, isStale: false, error: null }`을 결과에 담는다.
4. 실패하면: `getCachedSchedulerState(ocid)`로 폴백을 조회한다. 캐시가 있으면 그 `state`/`syncedAt`을 그대로 쓰고, 없으면 `state: null, syncedAt: null`. 두 경우 모두 `isStale: true`, `error`는 실패 종류를 매핑해서 채운다(`NexonAuthError`→`invalidApiKey`, `NexonRateLimitError`→`rateLimited`, 그 외→`network`).
5. **CRITICAL**: `NexonAuthError`(키 무효)나 `NexonRateLimitError`(호출 한도)는 모든 캐릭터에 동일하게 적용되는 전역 실패다 — 첫 캐릭터에서 이 둘 중 하나가 발생하면, 나머지 캐릭터는 `fetchSchedulerCharacterState`를 **더 호출하지 말고** 곧바로 각자의 캐시 폴백 처리만 수행하라(불필요한 API 재호출로 무효 키를 반복 호출하거나 rate limit을 더 악화시키지 않기 위함, [[ADR-008]]). 그 외 네트워크 에러는 캐릭터마다 독립적으로 처리한다(한 캐릭터의 네트워크 실패가 다른 캐릭터의 시도를 막지 않는다).

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/schedule-sync/`와 `storage/scheduler-cache.ts` 외 다른 파일(화면, 다른 feature)을 만들지 않았는가?
   - 캐릭터 조회가 병렬(`Promise.all` 등)이 아니라 순차인가?
   - 401/403/429 발생 시 나머지 캐릭터에 대해 API를 더 호출하지 않고 캐시 폴백만 하는가?
3. 테스트를 먼저 작성한 뒤(TDD) 구현하라. `src/nexon/client`와 `src/storage/`는 `vi.mock`으로 모킹하라.
   - `src/storage/__tests__/scheduler-cache.test.ts`: 새 `{ state, syncedAt }` 형태로 round-trip/null/손상된 JSON/쓰기실패 전파를 재검증.
   - `src/features/schedule-sync/__tests__/schedule-sync.test.ts`: 전부 성공하는 경우, 일부 캐릭터만 네트워크 에러(캐시 있음/없음 각각), 401/403이 발생하면 이후 캐릭터는 API를 호출하지 않고 캐시 폴백만 하는지, 429도 마찬가지인지.
4. 결과에 따라 `phases/scheduler/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성/수정한 파일과 핵심 규칙을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `app/`이나 다른 `features/*` 디렉토리에 코드를 만들지 마라. 이유: 이번 step은 공용 동기화 모듈만 다루고, 그 소비자(daily-scheduler 등)는 다음 step의 몫이다.
- 캐릭터를 `Promise.all` 등으로 동시에 조회하지 마라. 이유: [[ADR-008]]이 순차 호출을 요구한다.
- 401/403/429가 발생한 뒤에도 나머지 캐릭터에 대해 `fetchSchedulerCharacterState`를 계속 호출하지 마라. 이유: 무효 키/rate limit은 전역 실패라 반복 호출이 무의미하고 오히려 상황을 악화시킨다.
- 기존 테스트를 깨뜨리지 마라(단, `scheduler-cache.test.ts`는 이번 step에서 의도적으로 시그니처 변경에 맞춰 고치는 것이니 예외).
