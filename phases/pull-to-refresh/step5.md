# Step 5: boss-screen-wiring

이 task는 GitHub 이슈 **#38**(각 탭에서 당겨서 새로고침 제스처로 API 재조회)을 구현한다.

이 step은 **보스 스케줄러 화면 한 파일**에만 제스처를 배선한다. 컨텐츠 화면은 앞 step에서 끝났고, 수익 화면은 다음 step이 담당한다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — TDD, `features/*` 에서 storage·native 직접 접근 금지)
- `/docs/adr/ADR-072.md` (이번 기능의 결정 원장 — 특히 결정 3·4·5·10·11·12·13)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절
- `/docs/features/boss-scheduler.md` (이 화면의 정책)
- `/src/lib/use-pull-to-refresh.ts` (step 2 — `usePullToRefresh({ enabled, isRefreshing, onRefresh })`)
- `/src/components/PullToRefreshBanner/PullToRefreshBanner.tsx` (step 3 — `{ distance, phase }`)
- **`/src/app/content-scheduler/ContentScreen.tsx`** (step 4가 이미 배선한 화면 — **이 배선을 그대로 따라 하라.** 훅 호출 위치, 배너 삽입 위치, props 형태를 일치시킨다)
- `/src/app/boss-scheduler/BossScreen.tsx` (**이번 수정 대상 — 단 한 파일**)
- `/src/app/boss-scheduler/__tests__/BossScreen.test.tsx` (기존 테스트)
- `/src/app/content-scheduler/__tests__/ContentScreen.test.tsx` (step 4가 추가한 제스처 테스트 — 합성 터치 이벤트 헬퍼를 그대로 재사용하라)

## 화면 구조 (작업 전 확인할 것 — 줄 번호는 task 작성 시점 기준이라 밀렸을 수 있다)

- store 구조분해가 `} = useBossSchedulerStore()`(약 `:109`)로 끝나며, `status`·`refresh`·`trackedOcids` 를 이미 꺼내 쓴다.
- `const isEmpty = trackedOcids === null || trackedOcids.length === 0`(약 `:183`).
- `if (isEmpty) { return (...) }` **조기 반환**(약 `:381`) — 훅은 반드시 이 위에서 호출해야 한다.
- 목록 화면의 sticky 헤더 블록: `<div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">`(약 `:414`).
- 그 블록의 **마지막 자식**이 경계 페이드 오버레이(`pointer-events-none absolute inset-x-0 top-full h-8 …`, 약 `:544~552`)다.
- 헤더 새로고침 버튼(`aria-label="새로고침"`)이 이미 있다 — **지우지 마라**(ADR-072 결정 10).

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

- 보스 store의 `refresh` 는 `(ocids, onProgress?)` 시그니처지만 **인자 하나로만** 호출한다(ADR-072 결정 3 — 세 화면이 같은 형태를 쓴다. 수익 store에는 `onProgress` 가 없어 형태를 맞춰야 한다).

### 2. 배너 배치

sticky 헤더 블록 안, **경계 페이드 오버레이 *다음* 형제**로 넣는다(ADR-072 결정 5):

```tsx
<PullToRefreshBanner distance={pullToRefresh.distance} phase={pullToRefresh.phase} />
```

### 3. 테스트 추가

`src/app/boss-scheduler/__tests__/BossScreen.test.tsx` 에 제스처 통합 테스트를 추가한다. step 4가 `ContentScreen.test.tsx` 에 만든 합성 터치 이벤트 헬퍼(`touchEvent`)와 같은 방식을 쓰라 — jsdom에는 `TouchEvent` 생성자가 없다:

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
- 최상단에서 충분히 당겼다 놓으면 store의 `refresh` mock이 호출된다.
- 임계값 미만이면 호출되지 않는다.
- 헤더 새로고침 버튼이 여전히 존재하고 동작한다(회귀 방지).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (기존 BossScreen 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `git status --short` 에 `src/app/boss-scheduler/` 아래 2개 파일(화면 + 테스트)만 있는가?
   - 훅 호출·배너 배치가 `ContentScreen.tsx` 와 **같은 형태**인가? (두 화면이 다르게 생기면 다음에 고칠 때 둘 다 읽어야 한다)
   - store에 새 액션·새 상태를 추가하지 않았는가?
   - 훅이 조기 반환(`if (isEmpty)`)보다 **위**에서 호출되는가?
3. 결과에 따라 `phases/pull-to-refresh/index.json` 의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 헤더 새로고침 버튼을 제거하지 마라. 이유: 이슈 #38이 병존을 명시적으로 요구한다.
- `refresh` 에 `onProgress` 를 넘기지 마라. 이유: 수익 store의 `refresh` 는 인자가 하나뿐이라 세 화면이 같은 호출 형태를 공유하려면 1인자여야 한다(ADR-072 결정 3).
- 배너를 sticky 헤더 밖에 두거나 페이드 오버레이 앞에 두지 마라. 이유: `absolute top-full` 의 기준점이 sticky 헤더이고, 같은 자리를 쓰는 페이드가 뒤에 오면 배너를 덮는다.
- 화면 루트나 목록 블록에 `overflow` 를 추가하지 마라. 이유: 훅이 `window.scrollY` 로 최상단을 판정한다 — 스크롤 컨테이너가 생기면 제스처가 죽는다.
- `src/features/boss-scheduler/store.ts` 를 수정하지 마라.
- 컨텐츠·수익 화면이나 `BossManageScreen.tsx` 를 함께 고치지 마라. 이유: 한 step은 한 모듈만 다루고, 관리 화면은 이번 적용 범위 밖이다(ADR-072 결정 13).
- 기존 테스트를 깨뜨리지 마라.
