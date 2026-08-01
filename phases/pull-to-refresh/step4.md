# Step 4: content-screen-wiring

이 task는 GitHub 이슈 **#38**(각 탭에서 당겨서 새로고침 제스처로 API 재조회)을 구현한다.

이 step은 **컨텐츠 스케줄러 화면 한 파일**에만 제스처를 배선한다. 보스·수익 화면은 다음 step이 담당한다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — TDD, `features/*` 에서 storage·native 직접 접근 금지)
- `/docs/adr/ADR-072.md` (이번 기능의 결정 원장 — 특히 결정 3·4·5·10·11·12·13)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절
- `/docs/features/content-scheduler.md` (이 화면의 정책)
- `/src/lib/pull-to-refresh.ts` (step 1 — 순수 함수·상수)
- `/src/lib/use-pull-to-refresh.ts` (step 2 — `usePullToRefresh({ enabled, isRefreshing, onRefresh })`)
- `/src/components/PullToRefreshBanner/PullToRefreshBanner.tsx` (step 3 — `{ distance, phase }` 를 받는 배너)
- `/src/app/content-scheduler/ContentScreen.tsx` (**이번 수정 대상 — 단 한 파일**)
- `/src/app/content-scheduler/__tests__/ContentScreen.test.tsx` (기존 테스트 · `mockStore` 헬퍼)

## 화면 구조 (작업 전 확인할 것 — 줄 번호는 task 작성 시점 기준이라 밀렸을 수 있다)

- store 구조분해가 `} = useContentSchedulerStore()`(약 `:698`)로 끝나며, 여기서 `status`·`refresh`·`trackedOcids` 를 이미 꺼내 쓴다.
- `const isEmpty = trackedOcids === null || trackedOcids.length === 0`(약 `:752`).
- `if (isEmpty) { return (...) }` **조기 반환**(약 `:890`) — 훅은 반드시 이 위에서 호출해야 한다.
- 목록 화면의 sticky 헤더 블록: `<div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">`(약 `:922`).
- 그 블록의 **마지막 자식**이 경계 페이드 오버레이(`pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm`, 약 `:1008~1016`)다.
- 헤더 새로고침 버튼(`aria-label="새로고침"`, `onClick={() => refresh(trackedOcids ?? [])}`)이 이미 있다 — **지우지 마라**(ADR-072 결정 10).

## 작업

### 1. 훅 호출

`const isEmpty = ...` 선언 **바로 다음**(조기 반환보다 위)에 훅을 호출한다:

```tsx
const pullToRefresh = usePullToRefresh({
  enabled: !isEmpty,
  isRefreshing: status === 'loading',
  onRefresh: () => refresh(trackedOcids ?? []),
})
```

- `enabled: !isEmpty` 인 이유: 빈 상태에서는 목록 UI 자체가 없고 조기 반환된 JSX에는 배너도 없다(ADR-072 결정 13).
- `isRefreshing` 은 **`status === 'loading'`** 이다. 다른 로딩 플래그를 만들지 마라(ADR-072 결정 12).
- `refresh` 는 **인자 하나로만** 호출한다(ADR-072 결정 3 — 세 화면이 같은 형태를 쓴다).

### 2. 배너 배치

sticky 헤더 블록 안, **경계 페이드 오버레이 *다음* 형제**로 배너를 넣는다(ADR-072 결정 5 — DOM 순서로 배너가 페이드 위에 온다):

```tsx
<PullToRefreshBanner distance={pullToRefresh.distance} phase={pullToRefresh.phase} />
```

배너는 `phase === 'idle'` 이면 스스로 `null` 을 반환하므로 조건부 렌더로 감싸지 마라.

### 3. 테스트 추가

`src/app/content-scheduler/__tests__/ContentScreen.test.tsx` 에 제스처 통합 테스트를 추가한다. 기존 테스트 파일의 `mockStore` 헬퍼와 렌더 방식을 그대로 재사용하라.

jsdom에는 `TouchEvent` 생성자가 없으므로 합성 이벤트를 만들어 `document` 에 보낸다:

```ts
function touchEvent(type: string, clientY?: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: clientY === undefined ? [] : [{ clientY }],
  })
  return event
}
```

테스트 항목:
- 추적 캐릭터가 있는 상태에서 최상단(`window.scrollY = 0`)에서 아래로 충분히 당겼다 놓으면 store의 `refresh` mock이 호출된다.
- 임계값 미만으로 당겼다 놓으면 `refresh` 가 호출되지 않는다.
- 헤더 새로고침 버튼이 여전히 존재하고 클릭하면 `refresh` 를 호출한다(회귀 방지 — ADR-072 결정 10).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (기존 ContentScreen 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `git status --short` 에 `src/app/content-scheduler/` 아래 2개 파일(화면 + 테스트)만 있는가? 다른 화면·store·공용 모듈을 건드렸다면 되돌려라.
   - store에 새 액션·새 상태를 추가하지 않았는가? (ADR-072 결정 3)
   - 훅이 조기 반환(`if (isEmpty)`)보다 **위**에서 호출되는가? (React 훅 규칙 — 아래에 두면 빈 상태에서 훅 개수가 달라져 런타임 에러가 난다)
   - `features/*` 에서 storage·native에 직접 접근하지 않았는가? (CLAUDE.md CRITICAL)
3. 결과에 따라 `phases/pull-to-refresh/index.json` 의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (훅 호출 위치·배너 삽입 위치·추가한 테스트를 요약에 포함하라 — step 5·6이 같은 패턴을 반복한다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 헤더 새로고침 버튼을 제거하거나 숨기지 마라. 이유: 이슈 #38이 명시적으로 병존을 요구한다(제스처는 추가 수단이다).
- 배너를 sticky 헤더 **밖**(목록 블록이나 화면 루트)에 두지 마라. 이유: `absolute top-full` 은 sticky 헤더를 기준점으로 삼아야 헤더 바로 아래에 붙는다.
- 배너를 경계 페이드 오버레이 **앞**에 두지 마라. 이유: 둘이 같은 자리(`top-full`)를 쓰므로 앞에 두면 페이드가 배너 위를 덮어 흐리게 만든다.
- 화면 루트나 목록 블록에 `overflow` 를 추가하지 마라. 이유: 이 앱은 문서 전체가 스크롤되고 훅이 `window.scrollY` 로 최상단을 판정한다. 스크롤 컨테이너가 생기면 제스처가 죽는다.
- `src/features/content-scheduler/store.ts` 를 수정하지 마라.
- 보스·수익 화면을 함께 고치지 마라. 이유: step 5·6의 범위이고, 한 step은 한 모듈만 다룬다.
- 기존 테스트를 깨뜨리지 마라.
