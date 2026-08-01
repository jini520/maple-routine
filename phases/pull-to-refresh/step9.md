# Step 9: overlay-scroll-guard

이 task는 GitHub 이슈 **#38**(각 탭에서 당겨서 새로고침 제스처로 API 재조회)을 구현했다. step 0~7에서 기능이 완성됐고, step 8이 **확인된 결함**에 대한 결정(ADR-072 결정 14)을 문서에 확정했다. 이 step은 그 결정을 구현한다.

이 step은 **제스처 훅 한 파일 + 그 테스트**만 고친다. 화면(`src/app/*`)·컴포넌트(`src/components/*`)·store는 건드리지 않는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — TDD: 테스트를 먼저 쓰고 통과하는 구현을 쓴다)
- `/docs/adr/ADR-072.md` (**특히 결정 14와 `## 발견된 결함과 수정` 절** — 이 step이 구현하는 결정)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절 (제스처 무시 조건)
- `/src/lib/use-pull-to-refresh.ts` (**이번 수정 대상** — `handleTouchStart` 가 `event.target` 을 보지 않는다)
- `/src/lib/__tests__/use-pull-to-refresh.test.ts` (현재 테스트 12건 — 합성 터치 이벤트 헬퍼가 여기 있다)
- `/src/lib/pull-to-refresh.ts` (순수 함수 — 임계값·감쇠)
- `/src/components/CharacterTrackingPicker/CharacterTrackingGrid.tsx` · `/src/components/BottomSheet/BottomSheet.tsx` · `/src/components/Modal/Modal.tsx` (실제 내부 스크롤러들 — 이들이 막히면 안 된다)

## 확인된 결함 (계측 결과 — 추정이 아니다)

오버레이가 열린 상태에서 페이지가 최상단이면, 오버레이 내부 스크롤러에서 손가락을 아래로 끄는 동작이 document까지 버블링돼 페이지 당김으로 인식된다. 그 결과 ① `preventDefault()` 로 **오버레이 내부 스크롤이 막히고** ② 손을 떼면 화면 재조회가 돈다.

jsdom 계측(`body.overflow='hidden'`, `scrollY=0`, 오버레이 요소에서 `touchstart(0) → touchmove(200) → touchend` 디스패치)에서 `onRefresh` 호출 1회, `touchmove.defaultPrevented === true` 를 확인했다.

## 작업

**테스트를 먼저 쓰고** 통과하는 구현을 작성하라.

### 1. `src/lib/use-pull-to-refresh.ts` — 출처 검사 추가

`handleTouchStart` 의 추적 시작 조건에 **"스크롤 가능한 조상이 없을 것"** 을 추가한다(ADR-072 결정 14).

판정 규칙(결정 14 그대로):

- `event.target` 에서 시작해 부모로 올라가며, **계산된 `overflow-y` 가 `auto` 또는 `scroll` 이고 `scrollHeight > clientHeight`** 인 요소가 하나라도 있으면 추적을 시작하지 않는다.
- 탐색은 **문서 스크롤 루트(`document.body` · `document.documentElement`)에 닿으면 멈춘다** — 페이지 자신은 당김의 대상이지 배제 대상이 아니다.
- **`scrollTop` 값으로 조건을 걸지 마라**(예: "내부 스크롤러가 최상단이면 통과"). 오버레이가 떠 있는 동안 뒤 페이지를 새로고침하는 것은 어느 경우에도 사용자 의도가 아니다.
- 계산된 스타일은 `window.getComputedStyle(element).overflowY` 로 읽는다. `event.target` 이 `Element` 가 아닐 수 있으므로(`instanceof Element` 가 아닌 경우) 안전하게 처리하라.
- 이 판정은 **`touchstart` 에서 한 번만** 한다. `touchmove` 마다 조상 사슬을 훑으면 프레임마다 레이아웃 읽기가 발생한다.

판정 함수를 훅 파일 안의 모듈 스코프 헬퍼로 둘지, `src/lib/pull-to-refresh.ts` 로 뺄지는 재량이다. 다만 **`pull-to-refresh.ts` 로 뺄 경우 그 파일이 DOM에 의존하게 되므로 node 환경 테스트가 깨진다** — 그 파일은 순수 함수 전용으로 남기고, DOM을 만지는 헬퍼는 훅 파일에 두는 쪽을 권장한다.

주석으로 **왜 이 검사가 필요한지**(모달·바텀시트 내부 스크롤을 페이지 당김이 가로챈다)를 남겨라.

### 2. `src/lib/__tests__/use-pull-to-refresh.test.ts` — 회귀 테스트 추가

기존 12건을 지우지 말고 추가하라. jsdom은 레이아웃을 계산하지 않아 `scrollHeight`·`clientHeight` 가 둘 다 0이므로, 테스트에서 **`Object.defineProperty` 로 두 값을 심어** 스크롤 가능한 요소를 흉내 내야 한다. `overflow-y` 는 인라인 스타일(`element.style.overflowY = 'auto'`)로 주면 `getComputedStyle` 이 읽는다.

테스트 항목:

- **스크롤 가능한 오버레이 안에서 시작한 당김은 `onRefresh` 를 호출하지 않는다.** (`body.overflow='hidden'`, `scrollY=0`, 오버레이에 `overflowY='auto'` + `scrollHeight > clientHeight` 를 심고 그 요소에서 이벤트를 디스패치)
- **같은 상황에서 `touchmove` 의 기본 동작이 막히지 않는다**(`event.defaultPrevented === false`) — 내부 스크롤이 살아 있어야 한다.
- **오버레이가 스크롤 불가면(`scrollHeight === clientHeight`) 당김이 정상 동작한다** — 검사가 과하게 잡지 않는지 확인.
- **평범한 페이지 요소에서 시작한 당김은 종전대로 동작한다**(기존 동작 회귀 방지).
- `document.body` 자체에서 시작한 당김은 동작한다(스크롤 루트는 배제 대상이 아니다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (기존 use-pull-to-refresh 테스트 12건 + 화면 3곳의 제스처 테스트 포함)
npm run lint    # ESLint 통과
```

**AC 보강 — 변이 검증**: 추가한 가드를 잠시 지우면 새 회귀 테스트가 실제로 실패하는지 확인하고, 확인 후 가드를 되돌려라. 실패하지 않으면 테스트가 결함을 잡지 못하는 것이다.

## 검증 절차

1. 위 AC 커맨드를 실행하고 변이 검증을 수행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `git status --short` 에 `src/lib/use-pull-to-refresh.ts` 와 그 테스트 파일만 있는가? (화면·컴포넌트·store를 건드렸다면 되돌려라)
   - `src/lib/pull-to-refresh.ts` 가 여전히 DOM 무의존 순수 모듈인가? (그 테스트에 jsdom 지시 주석이 붙었다면 잘못된 것이다)
   - 세 화면의 기존 제스처 테스트가 그대로 통과하는가? (그 테스트들은 `document.body` 나 평범한 요소에서 이벤트를 디스패치하므로 가드에 걸리면 안 된다 — 걸린다면 가드가 과하다)
3. 결과에 따라 `phases/pull-to-refresh/index.json` 의 step 9를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (판정 함수의 위치·규칙과 변이 검증 결과를 포함하라)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `document.body.style.overflow === 'hidden'` 으로 모달 열림을 추측하지 마라. 이유: `useBodyScrollLock` 의 구현 세부에 결합되고, 스크롤 잠금 없이 뜨는 레이어를 놓친다(ADR-072 결정 14가 명시적으로 기각한 대안이다).
- 화면(`src/app/**`)의 `enabled` 조건에 모달 상태를 나열하지 마라. 이유: 오버레이가 늘어날 때마다 세 화면을 모두 고쳐야 하고 누락이 조용히 회귀가 된다(같은 결정이 기각한 대안이다).
- `touchmove` 마다 조상 사슬을 훑지 마라. 이유: 프레임마다 강제 레이아웃 계산이 일어난다. 판정은 `touchstart` 한 번이다.
- 내부 스크롤러의 `scrollTop` 을 보고 "최상단이면 페이지 당김으로 넘긴다"를 구현하지 마라. 이유: ADR-072 결정 14가 명시적으로 배제했다.
- `window.scrollY <= 0` 판정(결정 2)을 제거하거나 바꾸지 마라. 이유: 결정 14는 그것을 대체하는 것이 아니라 출처 검사를 **추가**하는 것이다.
- 기존 테스트 12건을 고치거나 지우지 마라. 이유: 그것들이 지키던 계약은 그대로 유효하다.
