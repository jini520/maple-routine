# Step 4: boss-scheduler-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/app/weekly/WeeklyScreen.tsx` — "주간 보스" 섹션 전체(로컬 `StatusDot` 컴포넌트, `BossPortrait` 사용법, `weeklyBossClearCount`/`weeklyBossClearLimitCount` 배지 UI)를 그대로 참고하라. 두 탭(주간/월간) 모두 이 섹션과 시각적으로 동일한 리스트 형태여야 한다(월간 탭에는 n/12 배지만 없다)
- `src/features/boss-scheduler/store.ts` — 이전 step(`boss-scheduler-store`)에서 만든 `useBossSchedulerStore`, `BossCharacterView`
- `src/storage/character-selection.ts` — `getTrackedCharacterOcids('boss')`/`setTrackedCharacterOcids('boss', ocids)`
- `src/components/BossPortrait/BossPortrait.tsx` — props(`portraitSlug`, `difficulty`, `label`)
- `/docs/PRD.md` — "2. 보스 스케줄러" 섹션(특히 n/12 카운트는 주간 탭에만 표시한다는 규칙)
- `/docs/UI_GUIDE.md` — 카드/버튼 컨벤션

## 배경

`BossScreen`은 기존 `WeeklyScreen`의 "주간 보스" 섹션을 독립 화면으로 분리하고, cycle(주간/월간)로 나눠 탭으로 보여준다. `content-scheduler-screen`(이전 step)과 동일한 로컬 탭 패턴을 쓰되 탭 이름만 "주간"/"월간"이다.

## 작업

`src/app/boss-scheduler/BossScreen.tsx`를 새로 작성하라. `WeeklyScreen.tsx`의 구조(추적 목록 로드 → roster 로드 → `refresh(trackedOcids)` → 빈 상태/로딩/에러/로드 분기 → 캐릭터 관리 피커, 로컬 `StatusDot` 컴포넌트 정의)를 그대로 따르되:

1. 스토어는 `useBossSchedulerStore`(`weeklyBosses`/`monthlyBosses`를 동시에 갖는 `BossCharacterView`), 추적 목록은 `getTrackedCharacterOcids('boss')`/`setTrackedCharacterOcids('boss', ocids)`를 쓴다.
2. 로컬 상태 `activeTab: 'weekly' | 'monthly'`(기본값 `'weekly'`). 탭 전환 UI는 `content-scheduler-screen`(이전 step)에서 만든 것과 동일한 스타일(pill 버튼 2개)로 맞춰라 — 라벨만 "주간"/"월간".
3. 캐릭터 선택 드롭다운은 탭과 무관하게 화면에 하나만 렌더링한다.
4. 로드된 상태에서:
   - `activeTab === 'weekly'`면 `selected.weeklyBosses.filter((b) => b.isRegistered)`를 `WeeklyScreen`의 보스 리스트와 동일한 형태(`StatusDot` + `BossPortrait` + 이름 + 난이도)로 렌더링하고, 그 위에 `selected.weeklyBossClearCount`/`weeklyBossClearLimitCount`가 둘 다 `null`이 아닐 때만 "n/12" 배지를 보여준다(`WeeklyScreen`의 기존 배지 UI 그대로).
   - `activeTab === 'monthly'`면 `selected.monthlyBosses.filter((b) => b.isRegistered)`를 동일한 리스트 형태로 렌더링하되 **n/12 배지는 렌더링하지 않는다**([[ADR-013]] — 월간 보스는 12마리 제한과 무관).
   - 그 탭의 등록된 보스가 0개이고 `!selected.isStale`이면 "표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요" 빈 상태를 그 탭 영역에만 보여준다.
5. 페이지 제목은 "보스 스케줄러", 새로고침 버튼·동기화 시각 표시·에러 배너·전체 빈 상태는 `WeeklyScreen`과 동일한 문구·스타일을 재사용하라.

TDD 원칙에 따라 `src/app/boss-scheduler/__tests__/BossScreen.test.tsx`를 먼저 작성하라. `WeeklyScreen.test.tsx`의 모킹 패턴을 참고해도 된다. 최소한 다음을 검증하라:
- 추적 목록이 `null`이면 빈 상태 안내만 보인다.
- 기본 탭은 주간이고, `weeklyBosses` 중 등록된 것만 보이며 n/12 배지가 있으면 표시된다.
- "월간" 탭으로 전환하면 `monthlyBosses` 중 등록된 것만 보이고, n/12 배지는 어떤 값이 있어도 렌더링되지 않는다.
- 탭을 전환해도 선택된 캐릭터가 유지된다.
- 캐릭터 관리 피커로 저장하면 `setTrackedCharacterOcids('boss', ocids)`가 호출된다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `useBossSchedulerStore`만 구독하고 `weekly-scheduler` store를 import하지 않는가?
   - 월간 탭에서 n/12 배지가 렌더링되지 않는가(코드상 조건에 `activeTab === 'weekly'`가 걸려 있는가)?
3. 결과에 따라 `phases/content-boss-scheduler/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `src/app/weekly/`를 수정하거나 삭제하지 마라. 이유: `App.tsx`가 아직 이 화면으로 라우팅하고 있다 — 교체는 마지막 step(`app-routing-cutover`)에서 한다.
- `App.tsx`를 수정하지 마라. 이유: 라우팅 전환은 마지막 step의 책임이다.
- 일간 탭을 만들지 마라. 이유: [[ADR-007]]·[[ADR-013]]에서 `bossDaily`는 계속 무시하기로 확정했다 — 이번 개편이 그 정책을 뒤집는 게 아니다.
- 월간 탭에 n/12 배지(또는 그 비슷한 카운터)를 표시하지 마라. 이유: 월간 보스는 12마리 제한과 무관한 값이다.
- 기존 테스트를 깨뜨리지 마라.
