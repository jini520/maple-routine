# Step 3: content-scheduler-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/app/daily/DailyScreen.tsx` — 화면 레이아웃·빈 상태·로딩/에러 분기·진행바 카드 UI를 그대로 참고하라(일간 탭 콘텐츠는 이 화면과 시각적으로 동일해야 한다)
- `src/app/weekly/WeeklyScreen.tsx` — "주간 퀘스트" 섹션의 리스트 UI(진행바 없이 `이름 · n/max`만 표시)를 참고하라(주간 탭 콘텐츠는 이 섹션과 시각적으로 동일해야 한다)
- `src/features/content-scheduler/store.ts` — 이전 step(`content-scheduler-store`)에서 만든 `useContentSchedulerStore`, `ContentCharacterView`
- `src/storage/character-selection.ts` — 이전 step(`tracked-character-storage-migration`)에서 만든 `getTrackedCharacterOcids('content')`/`setTrackedCharacterOcids('content', ocids)`
- `src/features/schedule-sync/schedule-sync.ts` — `getRegisteredCharacters()`(캐릭터 관리 피커 후보 목록용)
- `src/features/schedule-sync/format.ts` — `formatScheduleSyncError`, `formatSyncedAt`
- `src/components/CharacterSelectDropdown/CharacterSelectDropdown.tsx`, `src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx` — props는 파일에서 직접 확인하라
- `/docs/PRD.md` — "1. 컨텐츠 스케줄러" 섹션
- `/docs/UI_GUIDE.md` — 카드/버튼/타이포그래피 컨벤션(색상 값 그대로 재사용)

## 배경

`ContentScreen`은 `DailyScreen`+`WeeklyScreen`의 콘텐츠 부분(보스 제외)을 한 화면으로 합친다. 화면 안에 "일간"/"주간" 로컬 탭(라우팅 아님, `useState`)이 있고, 캐릭터 추적 목록·선택된 캐릭터·캐릭터 관리 피커는 탭과 무관하게 화면 전체에서 하나만 존재한다(탭을 바꿔도 유지됨).

## 작업

`src/app/content-scheduler/ContentScreen.tsx`를 새로 작성하라. `DailyScreen.tsx`의 구조(추적 목록 로드 → roster 로드 → `refresh(trackedOcids)` → 빈 상태/로딩/에러/로드 분기 → 캐릭터 관리 피커)를 그대로 따르되:

1. 스토어는 `useContentSchedulerStore`(`ocid`별로 `dailyContents`와 `weeklyContents`를 동시에 갖는 `ContentCharacterView`), 추적 목록은 `getTrackedCharacterOcids('content')`/`setTrackedCharacterOcids('content', ocids)`를 쓴다.
2. 로컬 상태 `activeTab: 'daily' | 'weekly'`를 추가한다(기본값 `'daily'`). 탭 전환 UI는 카드 형태가 아니라 텍스트/pill 버튼 2개(예: "일간"/"주간")로 만들고, 활성 탭은 `#C2410C`, 비활성은 `#8A7362`(UI_GUIDE.md의 텍스트/아이콘 대비 규칙을 따라라).
3. 캐릭터 선택 드롭다운(`CharacterSelectDropdown`)은 탭 전환과 무관하게 화면에 하나만 렌더링한다(선택된 캐릭터가 두 탭에 공통 적용).
4. 로드된 상태에서:
   - `activeTab === 'daily'`면 `selected.dailyContents.filter((c) => c.isRegistered)`를 `DailyScreen`과 동일한 진행바 카드 리스트로 렌더링한다.
   - `activeTab === 'weekly'`면 `selected.weeklyContents.filter((c) => c.isRegistered)`를 `WeeklyScreen`의 "주간 퀘스트" 섹션과 동일한 형태(진행바 없이 `이름 · n/max`)로 렌더링한다.
   - 그 탭의 등록된 항목이 0개이고 `!selected.isStale`이면 "표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요" 빈 상태를 그 탭 영역에만 보여준다(다른 탭에는 영향 없음).
5. 페이지 제목은 "컨텐츠 스케줄러", 새로고침 버튼·동기화 시각 표시·에러 배너·전체 빈 상태(추적 캐릭터 자체가 없을 때)는 `DailyScreen`과 동일한 문구·스타일을 그대로 재사용하라.

TDD 원칙에 따라 `src/app/content-scheduler/__tests__/ContentScreen.test.tsx`를 먼저 작성하라. `src/app/daily/__tests__/DailyScreen.test.tsx`, `src/app/weekly/__tests__/WeeklyScreen.test.tsx`의 모킹 패턴(스토어·storage·schedule-sync `vi.mock`)을 참고해도 된다. 최소한 다음을 검증하라:
- 추적 목록이 `null`이면 빈 상태 안내만 보인다.
- 기본 탭은 일간이고, 일간 탭에는 `dailyContents` 중 등록된 것만 보인다.
- "주간" 탭 버튼을 클릭하면 `weeklyContents` 중 등록된 것만 보이고 `dailyContents`는 안 보인다.
- 탭을 전환해도 선택된 캐릭터(드롭다운 상태)가 유지된다.
- 캐릭터 관리 피커로 저장하면 `setTrackedCharacterOcids('content', ocids)`가 호출된다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `useContentSchedulerStore`만 구독하고 `daily-scheduler`/`weekly-scheduler` store를 import하지 않는가?
   - `getTrackedCharacterOcids`/`setTrackedCharacterOcids` 호출에 항상 `'content'`를 쓰는가?
3. 결과에 따라 `phases/content-boss-scheduler/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `src/app/daily/`, `src/app/weekly/`를 수정하거나 삭제하지 마라. 이유: `App.tsx`가 아직 이 두 화면으로 라우팅하고 있다 — 교체는 마지막 step(`app-routing-cutover`)에서 한다.
- `App.tsx`를 수정하지 마라. 이유: 라우팅 전환은 마지막 step의 책임이다 — 이번 step은 화면 컴포넌트만 만든다(아직 어디서도 import되지 않아도 된다).
- 월간 탭을 만들지 마라. 이유: [[ADR-013]]에서 컨텐츠 스케줄러는 일간/주간 탭만 갖기로 확정했다(월간 주기 일반 콘텐츠 자체가 없음).
- 기존 테스트를 깨뜨리지 마라.
