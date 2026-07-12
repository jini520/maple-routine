# Step 3: weekly-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — [[ADR-007]](주간 화면도 완전 읽기 전용, `weekly_boss_clear_count`/`weekly_boss_clear_limit_count`는 캐릭터당 주간 보스 최대 12마리 처치 제한을 나타냄), [[ADR-011]](보스 목록은 난이도 무관 표기가 아니라 이번 화면은 API가 주는 난이도별 항목을 그대로 보여준다는 점에 유의 — ADR-011의 "난이도 무관 통합"은 물욕 아이템 화면 얘기지 이 주간 스케줄러 화면 얘기가 아니다)
- `src/features/weekly-scheduler/store.ts` — `useWeeklySchedulerStore`(이전 task `scheduler`). `WeeklyCharacterView`(`{ ocid, characterName, weeklyContents, bosses: MatchedBoss[], weeklyBossClearCount, weeklyBossClearLimitCount, isStale, syncedAt, error }`)
- `src/lib/boss-matching.ts` — `MatchedBoss`(`{ apiName, difficulty, cycle, isRegistered, isComplete, matchedBossName, portraitSlug }`)
- `src/components/BossPortrait/BossPortrait.tsx` — 이전 step(`boss-portrait`)에서 만든 컴포넌트. `{ portraitSlug, difficulty, label }` props.
- `src/features/schedule-sync/format.ts` — 이전 step(`daily-screen`)에서 만든 `formatScheduleSyncError`/`formatSyncedAt`. 이 화면도 그대로 재사용한다(새로 만들지 마라).
- `src/app/daily/DailyScreen.tsx` — 이전 step에서 만든 일간 화면. 이번 주간 화면도 같은 구조(마운트 시 `refresh()`, 새로고침 버튼, `isStale` 캐릭터별 안내, 로딩/에러/빈 상태 분기)를 따른다 — 화면을 직접 읽고 같은 패턴을 반복하라.
- `src/App.tsx` — `/weekly` 라우트의 placeholder. 이 step이 채운다.

## 배경

주간 화면은 일간 화면과 거의 같은 골격(마운트 시 동기화, 새로고침 버튼, 캐릭터별 stale 안내)에 `weeklyContents`(퀘스트) + `bosses`(보스, 초상화 포함) + "n/12" 카운터가 추가된다.

## 작업

`src/app/weekly/WeeklyScreen.tsx`:

```ts
export function WeeklyScreen(): React.JSX.Element
```

- `useWeeklySchedulerStore()` 구독, 마운트 시 1회 `refresh()`, 상단에 새로고침 버튼 — `DailyScreen`과 동일한 로딩/에러/`isStale` 안내 패턴을 따른다.
- `status === 'loaded'`일 때 캐릭터별로:
  - 캐릭터명
  - `weeklyContents` 목록(퀘스트류): 이름 + 등록 여부 + 진행도
  - 보스 목록(`bosses`): 각 `MatchedBoss`를 `<BossPortrait portraitSlug={boss.portraitSlug} difficulty={boss.difficulty} label={boss.matchedBossName ?? boss.apiName} />`와 함께 등록 여부(`isRegistered`)·완료 여부(`isComplete`)를 표시한다. `matchedBossName`이 `null`이면(참조 테이블에 없는 콘텐츠) `label`은 API 원본 이름(`apiName`) 그대로 쓰이므로 화면이 깨지지 않는다 — 별도 "알 수 없는 콘텐츠" 문구를 추가로 덧붙여도 되고 안 붙여도 된다(재량).
  - `weeklyBossClearCount`/`weeklyBossClearLimitCount`가 둘 다 `null`이 아니면 "n/12" 형태로 카운터를 보여준다(둘 중 하나라도 `null`이면 표시하지 않는다 — 동기화 실패로 값을 모르는 상태).
  - `weeklyContents`와 `bosses`가 둘 다 비어 있고 `isStale`도 아니면(게임 내 스케줄러에 아무것도 등록 안 함) `DailyScreen`과 같은 방식으로 빈 상태 안내를 보여준다.

`src/App.tsx`의 `/weekly` placeholder를 이 `WeeklyScreen`으로 교체하라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `WeeklyScreen`이 `useWeeklySchedulerStore`만 구독하고 `nexon/`·`storage/`·`lib/boss-matching`을 직접 import하지 않는가(매칭은 이미 스토어가 끝내둔 결과를 쓰기만 하는가)?
   - `formatScheduleSyncError`/`formatSyncedAt`을 새로 만들지 않고 기존 걸 재사용했는가?
   - 보스 항목마다 `BossPortrait`를 올바른 `portraitSlug`/`difficulty`/`label`로 렌더링하는가?
3. `src/app/weekly/__tests__/WeeklyScreen.test.tsx`(`// @vitest-environment jsdom`)에 테스트를 먼저 작성한 뒤(TDD) 구현하라. `useWeeklySchedulerStore`를 `vi.mock`으로 모킹해:
   - 마운트 시 `refresh`가 1번 호출된다.
   - 보스 목록이 렌더링되고 `matchedBossName`이 있으면 그 이름이, `null`이면 `apiName`이 라벨로 쓰인다.
   - `weeklyBossClearCount`/`weeklyBossClearLimitCount`가 둘 다 있으면 "n/12" 형태 텍스트가 보이고, 하나라도 `null`이면 안 보인다.
   - 특정 캐릭터가 `isStale: true`이면 그 캐릭터 영역에 에러 안내가 보인다.
4. 결과에 따라 `phases/scheduler-ui/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 분기를 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `formatScheduleSyncError`/`formatSyncedAt`을 중복해서 새로 만들지 마라. 이유: `daily-screen` step에서 이미 만든 공용 헬퍼를 재사용해야 한다.
- 사용자가 주간 콘텐츠·보스를 앱 안에서 체크/등록하는 UI를 넣지 마라. 이유: [[ADR-007]]이 완전 읽기 전용으로 확정했다.
- 보스 항목에 난이도를 숨기거나 같은 보스의 여러 난이도를 하나로 합치지 마라. 이유: 그 "난이도 무관 통합" 규칙은 물욕 아이템 화면([[ADR-011]]) 얘기이지 이 주간 스케줄러 화면과는 무관하다 — 여기서는 API가 준 난이도별 항목을 그대로 보여준다.
- 기존 테스트를 깨뜨리지 마라.
