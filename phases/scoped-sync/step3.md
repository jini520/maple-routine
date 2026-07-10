# Step 3: weekly-screen-scoped-fetch

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/app/weekly/WeeklyScreen.tsx`, `src/app/weekly/__tests__/WeeklyScreen.test.tsx` — 지금 구현 전체를 읽어라.
- `src/app/daily/DailyScreen.tsx` — 이전 step(`daily-screen-scoped-fetch`)에서 이미 반영한 패턴(로스터 별도 조회 + 피커에 전달, 추적 목록 로드 후 `refresh(trackedOcids)` 트리거, 필터링 제거). **이번 주간 화면도 완전히 같은 구조로 바꾼다** — 직접 읽고 동일한 패턴을 반복하라.
- `src/features/weekly-scheduler/store.ts` — 이전 step(`scoped-refresh-stores`)에서 바뀐 `refresh(ocids: string[]): Promise<void>`.
- `src/features/schedule-sync/schedule-sync.ts` — `getRegisteredCharacters()`.

## 배경

일간 화면에 적용한 "추적 대상만 동기화" 구조를 주간 화면에도 동일하게 적용한다. 로직은 일간과 완전히 동일하고, 화면에 매핑되는 필드(`weeklyContents`/`bosses` 등)만 다르다.

## 작업

`WeeklyScreen.tsx`를 `DailyScreen.tsx`와 같은 구조로 수정하라:

1. `getRegisteredCharacters()`로 채우는 `roster` 상태를 추가한다(피커용 전체 후보).
2. 인자 없는 `useEffect(() => { refresh() }, [])`를 제거하고, `trackedOcids`가 로드된 뒤 `refresh(trackedOcids)`를 호출하는 `useEffect`로 바꾼다. "새로고침" 버튼도 `refresh(trackedOcids ?? [])`로 바꾼다.
3. `characters.filter(...)`로 만들던 `visibleCharacters`를 제거하고 `characters`를 직접 쓴다. 빈 상태 판정은 `trackedOcids === null || trackedOcids.length === 0` 기준으로 바꾼다.
4. `CharacterTrackingPicker`의 `allCharacters`를 `characters` 대신 `roster`로 바꾼다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 추적 목록이 비어있을 때 캐릭터별 스케줄 API가 호출되지 않는가?
   - 피커가 `roster`(전체 후보)를 보여주는가?
3. `WeeklyScreen.test.tsx`를 이번 변경에 맞게 갱신한 뒤(TDD) 구현을 맞춰라. `getRegisteredCharacters`도 `vi.mock`으로 모킹하라. 최소한 다음을 검증하라:
   - 추적 목록이 로드되면 그 배열 그대로 `refresh`가 호출된다.
   - 피커를 열면 `getRegisteredCharacters`로 얻은 전체 후보가 보인다.
   - 추적 목록을 바꿔 저장하면 새 목록으로 `refresh`가 다시 호출된다.
4. 결과에 따라 `phases/scoped-sync/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 계정의 전체 캐릭터에 대해 스케줄 동기화를 트리거하지 마라.
- 피커 후보 목록을 동기화된 `characters`에서 뽑지 마라.
- 기존 테스트를 깨뜨리지 마라(단, 이번 변경에 맞게 고쳐야 하는 테스트는 함께 갱신).
