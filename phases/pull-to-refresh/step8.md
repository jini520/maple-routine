# Step 8: docs-overlay-guard

이 task는 GitHub 이슈 **#38**(각 탭에서 당겨서 새로고침 제스처로 API 재조회)을 구현했다. step 0~7에서 기능이 완성됐고, 그 뒤 **결함 하나가 계측으로 확인돼** 결정을 하나 추가한다.

이 step은 **문서 전용**이다. `src/` 는 한 줄도 건드리지 않는다(docs-first). 코드 수정은 step 9가 맡는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 구현과 결정 원장을 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — docs-first, 정책을 바꿀 땐 옛 내용을 지우지 말 것)
- `/docs/adr/ADR-072.md` (이번 기능의 결정 원장 — 현재 결정 13개 + 구현 메모 + 남은 검증)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절
- `/src/lib/use-pull-to-refresh.ts` (**결함이 있는 파일** — `handleTouchStart` 가 `event.target` 을 보지 않는다)
- `/src/lib/__tests__/use-pull-to-refresh.test.ts` (현재 테스트 12건)
- `/src/components/CharacterTrackingPicker/CharacterTrackingGrid.tsx` (`max-h-[70vh] overflow-y-auto` — 내부 스크롤러)
- `/src/components/BottomSheet/BottomSheet.tsx` (`overflow-y-auto` — 내부 스크롤러)
- `/src/components/Modal/Modal.tsx` (`overflow-y-auto` — 내부 스크롤러)
- `/src/lib/use-body-scroll-lock.ts` (모달이 여는 동안 `body.overflow` 만 바꾼다 — `window.scrollY` 는 그대로다)

## 확인된 결함 (계측 결과 — 추정이 아니다)

`usePullToRefresh` 는 `document` 에 터치 리스너를 붙이고 **이벤트 타깃을 전혀 보지 않는다**. 추적 시작 조건은 `enabled && !isRefreshing && touches.length === 1 && window.scrollY <= 0` 뿐이다.

모달·바텀시트가 열려 있을 때 `useBodyScrollLock` 은 `document.body.style.overflow = 'hidden'` 만 설정하고 `window.scrollY` 는 바꾸지 않는다. 따라서 페이지가 최상단(`scrollY === 0`)인 상태에서 오버레이가 열리면:

1. 오버레이 내부 스크롤러(`overflow-y-auto`)에서 손가락을 아래로 끄는 동작이 document까지 버블링돼 페이지 당김으로 인식된다.
2. 훅이 `event.preventDefault()` 를 호출해 **오버레이 내부 스크롤이 막힌다**.
3. 손을 떼면 화면 재조회(`refresh`)가 돈다.

jsdom 계측(오버레이 요소에서 `touchstart(0) → touchmove(200) → touchend` 디스패치, `body.overflow='hidden'`, `scrollY=0`)에서 `onRefresh` 호출 1회, `touchmove.defaultPrevented === true` 를 확인했다. 세 화면 모두 이 오버레이들을 자기 트리 안에 렌더하므로 전부 해당된다(`ContentScreen`·`BossScreen` 의 `CharacterTrackingPicker`, `BossProfitScreen` 의 `BossDropSheet`).

## 작업

### 1. `docs/adr/ADR-072.md` 에 결정 14 추가

기존 결정 1~13은 **지우거나 고치지 마라**. 결정 13 다음에 아래를 추가하라.

- **결정 14 — 스크롤 가능한 조상 안에서 시작한 터치는 페이지 당김으로 보지 않는다.** `touchstart` 시점에 `event.target` 에서 위로 올라가며 **자기 스크롤을 가진 조상**(계산된 `overflow-y` 가 `auto`·`scroll` 이고 `scrollHeight > clientHeight`)이 있으면 추적을 시작하지 않는다. 탐색은 문서 스크롤 루트(`document.body`/`documentElement`)에 닿으면 멈춘다 — 페이지 자신은 당김의 대상이지 배제 대상이 아니다.
  - **이유(원인 사슬의 어느 고리를 끊는가)**: 결함의 원인은 "최상단 판정이 틀렸다"가 아니라 **"제스처의 출처를 묻지 않았다"** 다. `window.scrollY <= 0`(결정 2)은 페이지에 대해서는 옳은 판정이지만, 화면 위에 자기 스크롤을 가진 레이어가 떠 있을 때 그 레이어의 스크롤 의도까지 페이지 당김으로 흡수한다. 타깃의 조상 사슬을 보는 것이 그 고리를 끊는다.
  - **대안을 버린 이유**: ① `document.body.style.overflow === 'hidden'` 으로 모달 열림을 추측하는 안은 `useBodyScrollLock` 의 구현 세부에 결합되고, 스크롤 잠금 없이 뜨는 레이어를 놓친다. ② 화면이 `enabled` 에 모달 상태를 나열하는 안(`!isPickerOpen && …`)은 오버레이가 늘어날 때마다 세 화면을 모두 고쳐야 하고 누락이 조용히 회귀가 된다.
  - **`scrollTop` 값으로 조건을 걸지 않는다.** "내부 스크롤러가 이미 최상단이면 페이지 당김으로 넘긴다"는 정교화는 하지 않는다 — 오버레이가 떠 있는 동안 그 뒤 페이지를 새로고침하는 것은 어느 경우에도 사용자의 의도가 아니다.
- 기존 **`## 남은 검증`** 절 위나 아래에 **`## 발견된 결함과 수정`** 절을 신설하고, 위 "확인된 결함" 내용을 계측 결과(호출 1회 · `defaultPrevented === true`)와 함께 기록하라. 언제 발견됐는지(2026-08-01, step 0~7 완료 직후 검증 중)와 어느 step이 고쳤는지(step 9)를 남겨라.
- ADR 말미 상태 문구에 이 수정이 포함됐음을 반영하라(예: `(구현 완료, 2026-08-01, 이슈 #38 · 결정 14는 후속 수정 · iOS 실기기 검증 보류)`).

### 2. `docs/ADR.md` 인덱스 행 동기화

ADR-072 행의 상태 문구를 위 1과 같은 내용으로 맞춘다. 다른 행은 건드리지 마라.

### 3. `docs/foundation/design-system.md` 갱신

`### 당겨서 새로고침(pull-to-refresh)` 절에 **제스처가 무시되는 조건**을 한 줄로 추가하라:

```
제스처 무시: 스크롤 가능한 조상(overflow-y auto|scroll 이고 scrollHeight > clientHeight) 안에서
             시작한 터치 — 모달·바텀시트 내부 스크롤을 페이지 당김이 가로채지 않게 한다([[ADR-072]] 결정 14)
```

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과
npm run lint    # ESLint 통과
git status --short   # docs/ 아래 파일만 변경돼 있어야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `git status --short` 결과에 `src/` 파일이 하나라도 있으면 이 step은 실패다 — 되돌려라.
3. 아키텍처 체크리스트를 확인한다:
   - 기존 결정 1~13의 본문이 그대로인가? (결정 14는 추가이지 대체가 아니다 — 결정 2를 폐기하는 것이 아니다)
   - ADR-072와 `ADR.md` 인덱스의 상태 문구가 일치하는가?
4. 결과에 따라 `phases/pull-to-refresh/index.json` 의 step 8을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (결정 14의 판정 규칙을 요약에 그대로 담아라 — step 9가 이 요약을 컨텍스트로 받아 구현한다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/` 를 수정하지 마라. 이유: docs-first이고, step 9가 이 결정을 읽고 구현한다.
- 결정 2(`window.scrollY <= 0`)를 폐기하거나 고치지 마라. 이유: 그 판정은 페이지에 대해서는 여전히 옳다. 결정 14는 그것을 대체하는 것이 아니라 **출처 검사를 추가**하는 것이다.
- 결함을 "설계 시점에 몰랐던 엣지 케이스"로 축소해 적지 마라. 이유: 모달은 세 화면 모두가 상시 렌더하는 1급 UI이고, 그 안의 스크롤이 막히는 것은 엣지가 아니라 상시 경로다.
- 기존 테스트를 깨뜨리지 마라.
