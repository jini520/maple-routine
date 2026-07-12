# Step 2: weekly-scheduler

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "데이터 흐름" 섹션의 "src/data/ 참조 테이블로 보스명·난이도 표기 정규화" 부분(24~26번째 줄 근처 `nexon/schedule` 설명 포함), `weekly-scheduler`가 "퀘스트+보스"를 다룬다는 설명
- `/docs/ADR.md` — [[ADR-006]](weekly-bosses.json이 이제 "API 응답을 우리 한글 표기와 매핑하기 위한 참조 테이블" 역할), [[ADR-007]](공백 방향이 일정하지 않아 양쪽 다 공백 제거 후 비교해야 함, "시즌 보스 메이린" 같은 apiAlias 예외, 완전 읽기 전용)
- `src/data/weekly-bosses.json` — 실제 스키마를 직접 읽어라. `weekly`/`eventWeekly`/`monthly` 세 배열 각각 `{ boss: string, difficulties: string[], portraitSlug?: string, apiAlias?: string, status?: string, note?: string }` 형태다. 예: 메이린 항목은 `"apiAlias": "시즌 보스 메이린"`을 갖고 있다 — API의 `content_name`은 "메이린"이 아니라 "시즌 보스 메이린"으로 온다.
- `src/features/schedule-sync/` — `syncAllSchedules()`와 `CharacterScheduleSync` 타입(이전 step)
- `src/types/scheduler.ts` — `WeeklyContent`, `BossContent`(`{ name, difficulty, cycle, isRegistered, isComplete }`), `BossDifficulty`, `BossCycle`

## 배경

이번 step은 두 가지를 만든다: (1) API가 준 보스 콘텐츠를 우리 데이터(`weekly-bosses.json`)와 이름으로 매칭하는 공용 순수 함수, (2) 그걸 활용해 주간 콘텐츠+보스를 노출하는 Zustand 스토어. **매칭 로직은 `nexon/`이 아니라 `lib/`에 둔다** — foundation에서 `nexon/`이 `src/storage/`나 `src/data/`를 몰라야 레이어가 독립적으로 테스트 가능하다는 원칙으로 설계했고, 이번에도 그 원칙을 유지한다. `ARCHITECTURE.md`의 `nexon/schedule` 항목이 "보스명 정규화까지 한다"고 서술한 부분은 실제로는 `lib/`에 있는 게 맞으므로, 이번 step에서 그 설명을 정정하라(아래 "작업" 4번 참고).

**보스 매칭 규칙**:
- API의 `content_name`(공백 포함, 예: "검은 마법사")과 우리 데이터의 `boss` 필드(예: "검은마법사")는 공백 유무 방향이 보스마다 다르다 — **양쪽 다 공백을 전부 제거한 뒤 비교**하라(한쪽으로 가정하면 틀린다, [[ADR-007]] 확인 사항).
- 공백 제거 비교로도 못 잡는 예외(현재는 메이린뿐)는 `apiAlias` 필드도 같은 방식(공백 제거)으로 비교 대상에 추가하라 — `boss` 필드든 `apiAlias` 필드든 공백 제거 후 일치하면 매칭된 것으로 본다.
- `weekly`/`eventWeekly`/`monthly` 세 배열 전부를 매칭 대상으로 삼아라(월간 보스 "검은마법사"도 포함).
- 매칭 안 되면(참조 테이블에 없는 신규 콘텐츠 등) 매칭 실패로 처리하고 원문 `content_name`을 그대로 보존한다 — 에러를 던지지 마라([[ADR-008]] "매핑 안 되는 항목은 원문 그대로 '알 수 없는 콘텐츠'로 표시").

## 작업

### 1. `src/lib/boss-matching.ts` — 순수 매칭 함수

```ts
export interface MatchedBoss {
  apiName: string                  // API 원본 content_name
  difficulty: BossDifficulty
  cycle: BossCycle
  isRegistered: boolean
  isComplete: boolean
  matchedBossName: string | null   // weekly-bosses.json 기준 정식 한글 보스명. 매칭 실패 시 null
  portraitSlug: string | null      // 매칭 성공 + portraitSlug 있으면 그 값, 아니면 null
}

export function matchBossContent(content: BossContent): MatchedBoss
```
- `src/data/weekly-bosses.json`을 import해서 참조 테이블로 쓴다.
- 위 "보스 매칭 규칙"을 그대로 구현하라.

### 2. `src/features/weekly-scheduler/store.ts`

```ts
export interface WeeklyCharacterView {
  ocid: string
  characterName: string
  weeklyContents: WeeklyContent[]
  bosses: MatchedBoss[]
  weeklyBossClearCount: number | null       // state가 null이면 알 수 없으므로 null
  weeklyBossClearLimitCount: number | null
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export type WeeklySchedulerStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface WeeklySchedulerState {
  status: WeeklySchedulerStatus
  characters: WeeklyCharacterView[]
  error: ScheduleSyncError | null
}

export interface WeeklySchedulerStore extends WeeklySchedulerState {
  refresh(): Promise<void>
}

export const useWeeklySchedulerStore: /* zustand의 create<WeeklySchedulerStore>()(...) 결과 */
```

`refresh()` 규칙은 `daily-scheduler`의 `refresh()`와 동일한 구조를 따른다(`syncAllSchedules()` 호출 → 성공 시 캐릭터별로 매핑, 개별 캐릭터 실패가 전체 `status`를 `'error'`로 만들지 않음, `syncAllSchedules()` 자체가 throw할 때만 전체 `'error'`). 차이점은 매핑 내용뿐이다: `state.weeklyContents`를 그대로 쓰고, `state.bossContents`의 각 항목을 `matchBossContent`로 변환해 `bosses`에 담는다. `state`가 `null`이면 `weeklyContents: []`, `bosses: []`, `weeklyBossClearCount: null`, `weeklyBossClearLimitCount: null`.

### 3. `daily-scheduler`와의 중복을 어떻게 다룰지

`refresh()`의 "syncAllSchedules 호출 → 상태 분기" 뼈대가 `daily-scheduler`와 거의 같다. 지금 이 두 번째 사례가 생겼다고 바로 공용 훅으로 추출하지 마라 — 정확히 같은 모양인지, 세 번째 소비자(보스수익·물욕템)가 실제로 나타났을 때 다시 판단해도 늦지 않다. 지금은 각자 독립적으로 작성하라.

### 4. `docs/ARCHITECTURE.md` 정정

"데이터 흐름" 섹션에서 `src/data/ 참조 테이블로 보스명·난이도 표기 정규화(영↔한글, 양쪽 공백 제거 후 비교, apiAlias 예외 매핑)` 문장 뒤에, 난이도 영↔한글 변환은 `nexon/normalize.ts`가 이미 하고 있고 보스명 매칭(공백 제거 비교, apiAlias)은 `lib/boss-matching`(`nexon/`이 아님, `features/weekly-scheduler`가 소비)이 한다는 취지로 정정하는 짧은 문장을 추가하라(2026-07-11 날짜로, 기존 문서 스타일대로 `~~취소선~~` + 정정 문구 형식을 따라라). 문서 전체를 재작성하지 말고 해당 문장만 최소로 고쳐라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/nexon/`이 `src/data/`나 `src/lib/boss-matching`을 import하지 않는가(레이어 분리 유지)?
   - `matchBossContent`가 양쪽 공백 제거 비교 + `apiAlias` 예외를 정확히 구현했는가?
   - `weekly`/`eventWeekly`/`monthly` 세 배열 전부가 매칭 대상인가(월간 보스 누락 없는가)?
   - `ARCHITECTURE.md` 정정이 최소 변경으로 반영됐는가?
3. 테스트를 먼저 작성한 뒤(TDD) 구현하라.
   - `src/lib/__tests__/boss-matching.test.ts`: 공백 유무가 다른 경우(API에 공백 더 많음/데이터에 공백 더 많음 양쪽 다) 매칭되는지, "시즌 보스 메이린" → "메이린" apiAlias 매칭되는지, 월간 보스("검은 마법사" API 표기 → "검은마법사" 데이터)가 매칭되는지, 참조 테이블에 없는 콘텐츠명이 `matchedBossName: null`로 처리되는지(에러를 던지지 않는지).
   - `src/features/weekly-scheduler/__tests__/store.test.ts`: `schedule-sync`를 모킹해 `daily-scheduler`와 동일한 패턴(전체 성공/일부 캐릭터 실패/전체 실패)을 검증하되, `bosses` 필드가 `matchBossContent` 결과로 채워지는지도 확인.
4. 결과에 따라 `phases/scheduler/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성/수정한 파일과 핵심 매칭 규칙을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `src/nexon/` 안에서 `src/data/`나 `lib/boss-matching`을 import하지 마라. 이유: `nexon/`은 게임 레퍼런스 데이터를 몰라야 독립적으로 테스트 가능하다(foundation 때부터의 원칙).
- 공백 제거 비교 시 "API 쪽에 공백이 더 있다"거나 그 반대로 한쪽 방향만 가정하지 마라. 이유: [[ADR-007]] 확인 사항 — 보스마다 방향이 다르다.
- `app/weekly/` 화면을 만들지 마라. 이유: 화면은 별도 task다.
- `docs/ARCHITECTURE.md`를 정정 목적 외로 재작성하거나 다른 섹션까지 고치지 마라. 이유: 이번 step은 이 특정 서술 하나만 바로잡으면 된다.
- 기존 테스트를 깨뜨리지 마라.
