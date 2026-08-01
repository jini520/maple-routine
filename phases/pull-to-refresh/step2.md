# Step 2: pull-gesture-hook

이 task는 GitHub 이슈 **#38**(각 탭에서 당겨서 새로고침 제스처로 API 재조회)을 구현한다.

이 step은 **제스처 감지 훅 하나 + CSS 두 줄**만 만든다. 화면(`src/app/*`)과 컴포넌트(`src/components/*`)는 건드리지 않는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — TDD: 테스트를 먼저 쓰고 통과하는 구현을 쓴다)
- `/docs/adr/ADR-072.md` (이번 기능의 결정 원장 — 특히 결정 2·8·11·12)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절
- `/src/lib/pull-to-refresh.ts` (**step 1이 만든 순수 함수 모듈 — 이 훅이 그대로 쓴다**)
- `/src/lib/__tests__/pull-to-refresh.test.ts` (step 1의 테스트)
- `/src/lib/use-body-scroll-lock.ts` (이 프로젝트의 훅 작성 관례 — 훅은 `src/hooks/` 가 아니라 **`src/lib/`** 에 산다)
- `/src/lib/__tests__/use-body-scroll-lock.test.ts` (jsdom 훅 테스트의 본보기 — 파일 첫 줄 `// @vitest-environment jsdom`, `renderHook` 사용)
- `/src/index.css` (전역 스타일 — `body` 규칙이 이미 있다)
- `/vitest.config.ts` · `/vitest.setup.ts` (전역 test 환경은 `node`, 컴포넌트/훅 테스트만 파일 주석으로 jsdom을 켠다)

## 작업

### 1. `src/lib/use-pull-to-refresh.ts` 신설

**테스트를 먼저 쓰고**(`src/lib/__tests__/use-pull-to-refresh.test.ts`, 첫 줄에 `// @vitest-environment jsdom`) 통과하는 구현을 작성하라.

#### 공개 인터페이스

```ts
import type { PullPhase } from './pull-to-refresh'

export interface PullToRefreshOptions {
  /** false면 리스너를 아예 붙이지 않고 항상 idle을 반환한다. */
  enabled: boolean
  /** 화면의 재조회 대기 상태(세 화면 공통으로 status === 'loading'). */
  isRefreshing: boolean
  /** 임계값을 넘겨 놓았을 때 호출된다. */
  onRefresh: () => void
}

export interface PullToRefreshState {
  distance: number
  phase: PullPhase
}

export function usePullToRefresh(options: PullToRefreshOptions): PullToRefreshState
```

#### 동작 규칙 (반드시 지켜라)

- **리스너는 `document` 에 붙인다**: `touchstart`(passive 가능), `touchmove`(**반드시 `{ passive: false }`**), `touchend`, `touchcancel`.
  - `touchmove` 가 `{ passive: false }` 여야 하는 이유: 당기는 동안 `preventDefault()` 를 호출해야 하는데, passive 리스너에서 부르면 브라우저가 무시하고 콘솔 경고를 낸다.
- **추적 시작 조건**(`touchstart`) — 아래를 **전부** 만족할 때만 추적을 시작한다:
  - `enabled === true`
  - `isRefreshing === false` (ADR-072 결정 12 — 재조회 중에는 새 당김을 시작하지 않는다)
  - `event.touches.length === 1` (멀티터치는 핀치/줌이지 당김이 아니다)
  - `window.scrollY <= 0` (ADR-072 결정 2 — `===` 이 아니라 `<=` 다. iOS 러버밴드에서 음수가 될 수 있다)
- **`touchmove`** — 추적 중이 아니면 즉시 반환한다. 추적 중이면:
  - `rawDelta = event.touches[0].clientY - startY`
  - `rawDelta <= 0` 이거나 `window.scrollY > 0` 이면 **추적을 중단**하고 distance를 0으로 되돌린다(사용자가 평범한 스크롤을 하려는 것이다).
  - 그 외에는 `resolvePullDistance(rawDelta)` 로 distance를 갱신하고, distance가 0보다 크면 `event.preventDefault()` 를 부른다.
- **`touchend`** — 추적 중이었고 `shouldTriggerRefresh(distance)` 가 true면 `onRefresh()` 를 호출하고 "내가 트리거했다"를 기억한다. 성공·실패와 무관하게 distance를 0으로 되돌리고 추적을 끝낸다.
- **`touchcancel`** — `onRefresh` 를 부르지 않고 distance만 0으로 되돌린다.
- **배너는 제스처가 시작한 재조회에서만 뜬다**(ADR-072 결정 11). 훅 내부에 "내가 트리거했다" 상태를 두고, `phase` 는 `resolvePullPhase(distance, isRefreshing && didTrigger)` 로 계산한다. `isRefreshing` 이 false로 돌아오면 그 상태를 해제한다.
- **`enabled === false`** 이면 리스너를 붙이지 않고 항상 `{ distance: 0, phase: 'idle' }` 을 반환한다. 재조회 중이어도 배너를 띄우지 않는다.
- **`onRefresh` 는 ref에 담아 최신 값을 읽어라.** 이유: 화면이 `onRefresh: () => refresh(trackedOcids ?? [])` 같은 인라인 화살표 함수를 넘기므로, 의존성에 그대로 넣으면 렌더마다 리스너를 붙였다 떼게 된다.
- **정리(cleanup)에서 모든 리스너를 제거하라.** `document` 전역 리스너를 남기면 화면을 떠난 뒤에도 제스처가 산다.

#### 테스트에 반드시 포함할 항목

jsdom에는 `TouchEvent`·`Touch` 생성자가 없다. 아래 방식으로 합성 이벤트를 만들어라:

```ts
function touchEvent(type: string, clientY?: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: clientY === undefined ? [] : [{ clientY }],
  })
  return event
}
```

`window.scrollY` 는 jsdom에서 읽기 전용이므로 `Object.defineProperty(window, 'scrollY', { value: N, writable: true, configurable: true })` 로 바꿔 쓰고, `afterEach` 에서 0으로 되돌려라. 이벤트는 `act(() => { document.dispatchEvent(...) })` 로 보낸다.

테스트 항목:
- 임계값을 넘겨 당겼다 놓으면 `onRefresh` 가 정확히 1번 호출된다.
- 임계값 미만에서 놓으면 `onRefresh` 가 호출되지 않는다.
- `window.scrollY > 0` 이면 당겨도 `onRefresh` 가 호출되지 않는다.
- `enabled: false` 면 당겨도 호출되지 않고 `phase` 가 항상 `'idle'` 이다.
- `isRefreshing: true` 인 동안 시작한 당김은 `onRefresh` 를 호출하지 않는다(중복 재조회 금지).
- 위로 움직이면(`rawDelta < 0`) 추적이 끊겨, 그 뒤 아래로 크게 움직여도 `onRefresh` 가 호출되지 않는다.
- 손가락이 둘이면(`touches.length === 2`) 추적을 시작하지 않는다.
- `touchcancel` 이 오면 `onRefresh` 가 호출되지 않는다.
- `isRefreshing: true` 지만 제스처로 시작한 것이 아니면(=헤더 버튼) `phase` 가 `'refreshing'` 이 아니다(ADR-072 결정 11).
- 언마운트 뒤 `document` 에 이벤트를 보내도 `onRefresh` 가 호출되지 않는다.

### 2. `src/index.css` 에 러버밴드 억제 추가

ADR-072 결정 8. 기존 `body` 규칙을 지우지 말고, `html, body` 에 `overscroll-behavior-y: none` 이 적용되게 하라. **그 위에 왜 `contain` 이 아니라 `none` 인지 주석 한 줄**을 남겨라(`contain` 은 스크롤 체이닝만 막고 바운스 어포던스는 남긴다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (신규 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 훅이 `src/lib/` 에 있는가? (`src/hooks/` 를 새로 만들지 마라 — 이 프로젝트에 그런 디렉토리는 없다)
   - `features/*` 나 `storage/`·`native/` 를 import하지 않았는가? (CLAUDE.md CRITICAL 규칙)
   - 임계값·감쇠 계산을 훅 안에서 다시 구현하지 않고 `src/lib/pull-to-refresh.ts` 를 import해 쓰는가?
3. 결과에 따라 `phases/pull-to-refresh/index.json` 의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (훅 시그니처와 `enabled`/`isRefreshing` 계약을 요약에 포함하라 — step 4·5·6이 이 계약대로 배선한다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `touchmove` 리스너를 passive로 등록하지 마라. 이유: `preventDefault()` 가 무시되고 콘솔 경고가 뜬다.
- `touchstart` 에서 `preventDefault()` 를 부르지 마라. 이유: 탭·클릭·스크롤이 통째로 죽는다.
- 스크롤 컨테이너 ref를 인자로 받는 API로 설계하지 마라. 이유: 이 앱에는 overflow 스크롤 컨테이너가 없고 문서 전체가 스크롤된다(ADR-072 결정 1·2).
- 화면 파일(`src/app/**`)이나 컴포넌트(`src/components/**`)를 수정하지 마라. 이유: step 3~6의 범위다.
- 외부 pull-to-refresh 라이브러리를 설치하지 마라(ADR-072 결정 1).
- `package.json` 을 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
