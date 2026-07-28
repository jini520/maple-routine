# Step 3: screen-wiring

`getCharacterPickerRoster()`를 호출하는 **화면 3곳**에 실제 로딩·실패 상태를 배선한다([[ADR-053]] 결정 3). step 2에서 만든 피커 props에 진짜 값이 들어가고, 온보딩 캐릭터 선택 단계도 같은 처리를 갖는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-053.md` — 이번 작업의 결정. **결정 3**이 이 step의 규칙이다.
- `/docs/adr/ADR-016.md`(step 0 정정 포함) — 캐시 우선 표시.
- `/docs/foundation/error-resilience.md` — 401/429 처리와 "실패를 빈 상태로 위장하지 않는다".
- **이전 step에서 수정된 파일 — 반드시 먼저 읽어라**:
  - `/src/features/schedule-sync/schedule-sync.ts` (step 1 — 웜/콜드 방출 규칙. 콜드에서는 완료 시 1회만 방출되고, 전역 실패 시엔 방출 없이 throw된다)
  - `/src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx` (step 2 — `isLoading`·`loadFailed` 필수 props와 스피너 조건. step 2에서 두 화면에 **임시 값**이 들어가 있다 — 이 step에서 실제 상태로 교체하는 것이 주 작업이다)
- **수정 대상 3곳**:
  - `/src/app/content-scheduler/ContentScreen.tsx` — `roster`·`isPickerOpen` 상태(`:699-700`), 피커 열릴 때 조회하는 `useEffect`(`:715-724`), 피커 렌더 지점
  - `/src/app/boss-scheduler/BossScreen.tsx` — 같은 패턴(`:139-155` 부근)
  - `/src/app/onboarding/ContentCharacterStep.tsx` — `CharacterTrackingGrid`를 **직접** 쓴다(`:41`). 피커 모달이 아니므로 자체 스피너/빈 상태가 필요하다. 마운트 시 1회 조회(`:22-30`)
- 각 화면의 테스트: `/src/app/content-scheduler/__tests__/ContentScreen.test.tsx`, `/src/app/boss-scheduler/__tests__/BossScreen.test.tsx`, `/src/app/onboarding/__tests__/` 아래 `ContentCharacterStep` 관련 테스트. 세 곳 모두 `getCharacterPickerRoster`를 모킹하고 있다.

## 작업

### 1. 테스트 먼저 (TDD — CLAUDE.md CRITICAL)

세 화면 각각에 대해 아래를 작성/갱신하고 실패를 확인한 뒤 구현하라. 모킹된 `getCharacterPickerRoster`가 **resolve되기 전/후**를 제어할 수 있게 pending Promise를 쓰는 형태가 필요하다.

- **조회 중**: 모달을 연(또는 온보딩 단계에 진입한) 직후 `onUpdate`가 아직 호출되지 않았고 Promise도 미완료면 → 스피너가 보인다.
- **콜드 완료**: Promise가 resolve되고 그 전에 `onUpdate`로 목록이 전달됐으면 → 스피너가 사라지고 목록이 보인다.
- **웜 캐시**: Promise가 아직 미완료여도 `onUpdate`로 항목이 이미 전달됐으면 → 스피너 없이 목록이 보인다(캐시 우선 표시 회귀 방지).
- **전역 실패**: Promise가 reject되면 → **스피너가 사라지고** 실패 안내가 보인다(스피너가 영구히 걸리면 안 된다).
- **모달 재개폐**: 피커를 닫았다 다시 열면 로딩·실패 상태가 초기화되고 조회가 다시 시작된다(`ContentScreen`·`BossScreen`만 해당).

### 2. `ContentScreen.tsx`·`BossScreen.tsx` 배선

두 화면은 동일한 패턴이므로 **같은 구조로 미러링**하라.

- `roster` 옆에 `isRosterLoading`·`rosterFailed` 상태를 추가한다.
- 기존 `useEffect(..., [isPickerOpen])` 안에서:
  - 조회 시작 전 `isRosterLoading = true`, `rosterFailed = false`로 초기화
  - `.catch(() => { rosterFailed = true })` — 지금처럼 조용히 삼키지 말고 실패를 상태로 남긴다
  - **`.finally(() => { isRosterLoading = false })`** — 성공·실패 어느 쪽이든 반드시 해제
  - 기존 `cancelled` 가드를 **`catch`와 `finally`에도 동일하게 적용**한다. 언마운트·모달 닫힘 후 setState가 일어나면 안 된다.
- `roster`도 재조회 시작 시 초기화할지 판단하라 — **초기화하지 마라.** 캐시가 있어 이전에 보여주던 목록이 있으면 그대로 두는 편이 [[ADR-016]] 정신에 맞다(스피너 조건이 `entries.length === 0`이므로 자연히 스피너도 안 뜬다).
- `CharacterTrackingPicker`에 step 2의 임시 값 대신 `isLoading={isRosterLoading}` `loadFailed={rosterFailed}`를 넘긴다.

### 3. `ContentCharacterStep.tsx` 배선

이 컴포넌트는 모달이 아니라 온보딩 페이지 단계이고 `CharacterTrackingGrid`를 직접 쓴다. 같은 상태(`isRosterLoading`·`rosterFailed`)를 갖되 **자체적으로** 그리드 자리에 스피너/실패 안내를 그린다.

- 스피너 조건은 피커와 동일하게 `isRosterLoading && roster.length === 0`.
- 이미 `MapleSpinner`를 import해 제출 버튼에 쓰고 있다(`:51`) — 같은 컴포넌트를 재사용하라.
- "계속하기" 버튼의 기존 제약(`selectedOcids.length === 0`이면 비활성)은 **그대로 둔다.** 로딩 중에는 선택이 없어 자연히 비활성이다.
- 온보딩은 직전에 예열([[ADR-016]])이 끝나 캐시가 따뜻하므로 실무상 스피너를 볼 일이 드물다. 그래도 예열이 전부 실패한 경우를 위해 동일 경로를 탄다.

**이 step에서 반드시 지켜야 할 규칙:**
- **`.finally()`로 로딩을 반드시 해제하라.** 401/429는 `getCharacterPickerRoster`가 throw하므로, `catch`에만 해제를 두고 성공 경로를 빠뜨리거나 그 반대가 되면 스피너가 영구히 걸린다.
- **`cancelled` 가드를 `then`/`catch`/`finally` 전부에 적용하라.** 모달을 빠르게 여닫으면 이전 조회의 콜백이 뒤늦게 도착한다.
- **세 화면의 처리 방식을 통일하라.** 한 곳만 다른 구조로 만들면 다음에 고칠 때 한쪽이 누락된다 — 이 이슈가 생긴 원인과 같은 종류의 실수다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음(임시 props가 실제 상태로 교체됨)
npm test        # 전체 테스트 통과
npm run lint    # 경고 0

# 세 호출부 모두 실패를 삼키지 않는지 — 빈 catch가 남아 있으면 안 된다
grep -n "catch(() => {})" src/app/content-scheduler/ContentScreen.tsx src/app/boss-scheduler/BossScreen.tsx src/app/onboarding/ContentCharacterStep.tsx
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. 마지막 `grep`은 **결과가 없어야** 한다.
2. 아키텍처 체크리스트를 확인한다:
   - `app/` 화면이 조회를 소유하고 `components/`는 props만 받는 레이어 규칙을 지켰는가?
   - 세 화면이 **동일한 구조**로 배선됐는가?
   - `.finally()`가 성공·실패 양쪽에서 로딩을 해제하는가? 401/429 reject로 스피너가 걸리지 않는가?
   - `cancelled` 가드가 `then`/`catch`/`finally` 전부에 걸렸는가?
   - 웜 캐시에서 스피너 없이 즉시 목록이 뜨는가? ([[ADR-016]] 회귀 방지)
   - TDD 순서를 지켰는가?
3. 결과에 따라 `phases/picker-roster-loading/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 세 화면의 상태 이름·배선 구조·실패 처리 방식을 명시하라.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- 실패를 `catch(() => {})`로 삼키지 마라. 이유: 이 이슈(#64)의 원인 중 하나가 정확히 그것이다 — 호출부가 결과를 버려 로딩·실패를 알 방법이 없었다.
- 로딩 해제를 `then`에만 두지 마라. 이유: 401/429는 reject 경로로 나가므로 스피너가 영구히 걸린다.
- 재조회 시작 시 `roster`를 `[]`로 초기화하지 마라. 이유: 이미 보여주던 캐시 목록이 사라져 화면이 비고, [[ADR-016]] 캐시 우선 표시가 무력화된다.
- `src/features/schedule-sync/schedule-sync.ts`를 수정하지 마라. 이유: step 1에서 완료됐다. 여기서 방출 규칙을 다시 손대면 어느 step이 회귀를 냈는지 분리되지 않는다.
- `CharacterTrackingPicker.tsx`·`CharacterTrackingGrid.tsx`를 수정하지 마라. 이유: 컴포넌트 쪽은 step 2에서 끝났다. props가 부족하다고 느껴지면 배선을 다시 보라 — 그래도 부족하면 `blocked`로 보고하라.
- 세 화면 중 일부만 배선하고 넘어가지 마라. 이유: 같은 규칙이 여러 곳에 복제돼 있을 때 한 곳만 고치는 것이 이 저장소에서 반복된 실수다(#60의 온보딩/설정 이중 구현, #63의 테이블 목록 이중 관리).
- 기존 테스트를 깨뜨리지 마라.
