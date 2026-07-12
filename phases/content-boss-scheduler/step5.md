# Step 5: app-routing-cutover

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/App.tsx` — 지금 구현 전체(`TAB_ITEMS`, `BottomTabBar`, `AppShell`의 라우트 정의)
- `src/__tests__/App.test.tsx` — 지금 테스트 전체. 이번 변경에 맞게 갱신해야 한다
- `src/app/content-scheduler/ContentScreen.tsx` — 이전 step(`content-scheduler-screen`)에서 만든 화면
- `src/app/boss-scheduler/BossScreen.tsx` — 이전 step(`boss-scheduler-screen`)에서 만든 화면
- `/docs/UI_GUIDE.md` — "아이콘" 섹션(하단 탭바 아이콘을 `ListChecks`(컨텐츠)/`Swords`(보스)로 제안해 둔 부분)
- `/docs/ADR.md` — [[ADR-013]] 전체(이번 step으로 개편이 완료된다)

## 배경

이번 step에서 실제로 라우팅이 전환되고, 옛 화면(`app/daily`, `app/weekly`)과 옛 store(`features/daily-scheduler`, `features/weekly-scheduler`)가 완전히 미사용 상태가 되어 삭제할 수 있다. 이게 [[ADR-013]] 개편의 마지막 step이다.

## 작업

### 1. `src/App.tsx` 수정

- `DailyScreen`/`WeeklyScreen` import를 제거하고 `ContentScreen`(`./app/content-scheduler/ContentScreen`)·`BossScreen`(`./app/boss-scheduler/BossScreen`) import로 교체한다.
- `lucide-react`에서 `CalendarCheck`/`CalendarRange` 대신 `ListChecks`/`Swords`를 import한다.
- `TAB_ITEMS`를 다음으로 바꾼다:
  ```ts
  const TAB_ITEMS = [
    { to: '/content', label: '컨텐츠', Icon: ListChecks },
    { to: '/boss', label: '보스', Icon: Swords },
  ] as const
  ```
- `AppShell`의 라우트에서 `/daily`→`/content`, `/weekly`→`/boss`로 바꾸고(가드 로직·`Navigate` 패턴은 기존 그대로 유지), `/`와 온보딩 완료 후 리다이렉트 대상도 `/content`로 바꾼다.

### 2. 미사용 코드 삭제

아래가 이제 어디서도 import되지 않는지 먼저 `grep -rl "daily-scheduler\|weekly-scheduler\|app/daily\|app/weekly" src --include="*.tsx" --include="*.ts"`로 확인한 뒤(테스트 파일 자기 자신 제외) 삭제하라:
- `src/app/daily/` 디렉토리 전체(`DailyScreen.tsx`, `__tests__/DailyScreen.test.tsx`)
- `src/app/weekly/` 디렉토리 전체(`WeeklyScreen.tsx`, `__tests__/WeeklyScreen.test.tsx`)
- `src/features/daily-scheduler/` 디렉토리 전체(`store.ts`, `__tests__/store.test.ts`)
- `src/features/weekly-scheduler/` 디렉토리 전체(`store.ts`, `__tests__/store.test.ts`)

### 3. `src/__tests__/App.test.tsx` 갱신

- `useDailySchedulerStore` mock을 `useContentSchedulerStore`(`../features/content-scheduler/store`)와 `useBossSchedulerStore`(`../features/boss-scheduler/store`) mock으로 교체한다. 둘 다 `{ status: 'idle', characters: [], error: null, refresh: vi.fn() }` 형태의 기본값으로 mock하라.
- 경로 리터럴 `/daily`→`/content`, `/weekly`→`/boss`로 바꾼다.
- 탭 라벨 단언 `'일간'`→`'컨텐츠'`, `'주간'`→`'보스'`로 바꾼다.
- 헤딩 텍스트 단언 `'일간 스케줄러'`→`'컨텐츠 스케줄러'`로 바꾼다(`ContentScreen`의 페이지 제목).
- 그 외 테스트 구조(어떤 상황에서 무엇을 검증하는지)는 그대로 유지한다 — 리터럴만 바꾸는 것이 목적이다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. `npm run lint`가 통과한다는 것은 삭제 후 고아 import가 남아있지 않다는 뜻이다.
2. 아키텍처 체크리스트를 확인한다:
   - `grep -rl "daily-scheduler\|weekly-scheduler\|app/daily\|app/weekly" src`가 아무 결과도 반환하지 않는가(테스트 파일이 자기 자신을 참조하는 경우 제외 — 애초에 파일이 삭제됐으므로 결과가 없어야 정상)?
   - `docs/ARCHITECTURE.md`의 디렉토리 구조(`app/content-scheduler`, `app/boss-scheduler`, `features/content-scheduler`, `features/boss-scheduler`)와 실제 `src/` 구조가 일치하는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가(features/*에서 storage/native 직접 접근 없음)?
3. 결과에 따라 `phases/content-boss-scheduler/index.json`의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 삭제 대상 디렉토리(`app/daily`, `app/weekly`, `features/daily-scheduler`, `features/weekly-scheduler`) 외의 다른 기존 기능(온보딩, 사냥 타이머 등 — 아직 화면이 없는 기능 포함)을 건드리지 마라.
- `ContentScreen`/`BossScreen`의 내부 UI나 탭 구조를 바꾸지 마라. 이유: 그건 이전 두 step에서 이미 확정됐다 — 이번 step은 라우팅 배선과 정리(cleanup)만 한다.
- 탭바 아이콘을 `ListChecks`/`Swords` 외의 다른 아이콘으로 바꾸지 마라. 이유: `docs/UI_GUIDE.md`에 이미 이 조합으로 정리해 뒀다(다른 조합이 필요하면 문서를 먼저 고치고 와야 한다).
- 기존 테스트를 깨뜨리지 마라(단, 이번 변경에 맞게 고쳐야 하는 리터럴은 함께 갱신).
