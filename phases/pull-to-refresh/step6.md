# Step 6: profit-screen-wiring

이 task는 GitHub 이슈 **#38**(각 탭에서 당겨서 새로고침 제스처로 API 재조회)을 구현한다.

이 step은 **보스 수익 화면 한 파일**에만 제스처를 배선한다. 이 화면은 앞의 두 화면과 달리 **과거 기간에서 제스처를 꺼야 한다** — 이 step의 핵심이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — TDD, `features/*` 에서 storage·native 직접 접근 금지)
- `/docs/adr/ADR-072.md` (이번 기능의 결정 원장 — 특히 **결정 9**(과거 기간 비활성)와 결정 3·4·11·12)
- `/docs/adr/ADR-047.md` (이 화면의 중첩 sticky 구조 — 배너를 절대 배치로 두는 이유)
- `/docs/features/boss-profit.md` (이 화면의 정책 — 기간 모델)
- `/src/lib/use-pull-to-refresh.ts` (step 2 — `usePullToRefresh({ enabled, isRefreshing, onRefresh })`)
- `/src/components/PullToRefreshBanner/PullToRefreshBanner.tsx` (step 3 — `{ distance, phase }`)
- **`/src/app/content-scheduler/ContentScreen.tsx`** · **`/src/app/boss-scheduler/BossScreen.tsx`** (앞 step들이 배선한 두 화면 — **같은 형태를 따르라**)
- `/src/app/boss-profit/BossProfitScreen.tsx` (**이번 수정 대상 — 단 한 파일**)
- `/src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` (기존 테스트 — `CURRENT_WEEKLY_PERIOD_KEY` 상수와 `mockStore` 헬퍼, 과거 기간을 만드는 방식(`periodKey: '2026-07-09'` 같은 과거 키)을 그대로 재사용하라)
- `/src/features/boss-profit/store.ts` (`refresh(ocids)` — **인자가 하나뿐이다**)
- `/src/lib/boss-profit-period.ts` (`isLatestPeriod`)

## 화면 구조 (작업 전 확인할 것 — 줄 번호는 task 작성 시점 기준이라 밀렸을 수 있다)

- store 구조분해가 `} = useBossProfitStore()`(약 `:1231`)로 끝나며, `status`·`refresh`·`trackedOcids`·`tab`·`periodKey` 를 이미 꺼내 쓴다.
- `const isEmpty = trackedOcids === null || trackedOcids.length === 0`(약 `:1252`).
- 그 아래에 `stickyHeaderRef` + `stickyHeaderHeight` `useState` + `ResizeObserver` `useEffect`(약 `:1258~1275`)가 있다.
- `if (isEmpty) { return (...) }` **조기 반환**(약 `:1277`).
- **조기 반환 *아래*** 에 `const now = new Date()` 와 `const isCurrentPeriod = isLatestPeriod(tab, periodKey, now)`(약 `:1300~1302`)가 있다. 헤더 새로고침 버튼은 이 플래그로 노출 여부가 갈린다(약 `:1374`).
- sticky 헤더 블록: `<div ref={stickyHeaderRef} className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">`(약 `:1325`).
- **이 화면에는 경계 페이드 오버레이가 없다**(ADR-047 결정 6 — 주석이 약 `:1492`에 남아 있다). 배너는 sticky 헤더 블록의 마지막 자식으로 들어간다.

## 작업

### 1. `now` · `isCurrentPeriod` 선언을 조기 반환 위로 이동

훅은 조기 반환보다 위에서 호출해야 하는데(React 훅 규칙), `enabled` 조건에 `isCurrentPeriod` 가 필요하다. 따라서:

- `const now = new Date()` 와 `const isCurrentPeriod = isLatestPeriod(tab, periodKey, now)` 두 줄(그 위의 설명 주석 포함)을 **`const isEmpty = ...` 선언 바로 다음으로 옮긴다**.
- 조기 반환 아래의 기존 사용처(`periodLabel`·`isNextDisabled`·`periodQueryable`·헤더 버튼 조건 등)는 **그대로 두고 재선언하지 마라**. 선언을 옮기는 것이지 복제하는 것이 아니다.
- `new Date()` 를 두 번 호출하지 마라. 이유: 두 시각이 기간 경계를 사이에 두고 갈리면 "현재 기간 판정"과 "기간 라벨"이 서로 다른 기간을 가리킬 수 있다.

### 2. 훅 호출

옮긴 선언 다음, 조기 반환보다 위에서 호출한다:

```tsx
const pullToRefresh = usePullToRefresh({
  enabled: !isEmpty && isCurrentPeriod,
  isRefreshing: status === 'loading',
  onRefresh: () => refresh(trackedOcids ?? []),
})
```

- **`enabled` 에 `isCurrentPeriod` 를 반드시 포함한다**(ADR-072 결정 9). 이유: 수익 `refresh` 는 `periodKey` 를 현재 기간으로 강제 리셋하고 라이브 재조회하므로, 과거 기간을 보다가 제스처를 쓰면 보고 있던 기간이 현재 기간으로 튕겨 나간다(#30). 헤더 새로고침 버튼이 현재 기간에서만 보이는 것과 같은 근거다.
- **`canGoPreviousPeriod` 를 쓰지 마라** — 그것은 이전 이동 게이트(#29)이지 "현재 기간 여부"가 아니다.
- `isRefreshing` 은 **`status === 'loading'`** 이다. **`isPeriodLoading` 을 쓰지 마라** — 그것은 과거 기간 백필 전용 플래그다(ADR-072 결정 12).
- `refresh` 는 인자가 하나뿐이다. `onProgress` 를 넘기면 컴파일 에러가 난다.

### 3. 배너 배치

sticky 헤더 블록(`ref={stickyHeaderRef}`)의 **마지막 자식**으로 넣는다:

```tsx
<PullToRefreshBanner distance={pullToRefresh.distance} phase={pullToRefresh.phase} />
```

배너는 `absolute` 라 `stickyHeaderRef` 의 실측 높이(`getBoundingClientRect().height`)를 바꾸지 않는다 — 중첩 sticky 오프셋에 영향이 없어야 한다(ADR-072 결정 4). 배너 때문에 `ResizeObserver` 가 매 프레임 발화하면 배선이 잘못된 것이다.

### 4. 테스트 추가

`src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` 에 제스처 테스트를 추가한다. 앞 step들이 쓴 합성 터치 이벤트 헬퍼를 그대로 쓰라 — jsdom에는 `TouchEvent` 생성자가 없다:

```ts
function touchEvent(type: string, clientY?: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: clientY === undefined ? [] : [{ clientY }],
  })
  return event
}
```

테스트 항목(**과거 기간 회귀 테스트가 이 step의 핵심 산출물이다**):
- **현재 기간**(`periodKey: CURRENT_WEEKLY_PERIOD_KEY`)에서 최상단부터 충분히 당겼다 놓으면 `refresh` mock이 호출된다.
- **과거 기간**(기존 테스트가 쓰는 과거 키, 예 `'2026-07-09'`)에서는 같은 제스처로 `refresh` 가 **호출되지 않는다**.
- 과거 기간에서는 배너(`data-testid="pull-to-refresh-banner"`)가 렌더되지 않는다.
- 헤더 새로고침 버튼의 기존 동작(현재 기간에만 노출)이 그대로다(회귀 방지).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (기존 BossProfitScreen 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `git status --short` 에 `src/app/boss-profit/` 아래 2개 파일(화면 + 테스트)만 있는가?
   - `now`·`isCurrentPeriod` 가 **한 번만** 선언돼 있는가? (`grep -n "const isCurrentPeriod" src/app/boss-profit/BossProfitScreen.tsx` 결과가 1줄이어야 한다)
   - 훅이 조기 반환보다 **위**에서 호출되는가?
   - store에 새 액션·새 상태를 추가하지 않았는가?
3. 결과에 따라 `phases/pull-to-refresh/index.json` 의 step 6을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (과거 기간 게이팅을 어떤 플래그로 걸었는지, 선언을 어디로 옮겼는지를 요약에 포함하라)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 과거 기간에서 제스처를 켜지 마라. 이유: `refresh` 가 `periodKey` 를 현재 기간으로 강제 리셋해 사용자가 보던 과거 기간이 튕겨 나간다(#30, ADR-072 결정 9).
- `isPeriodLoading` 을 `isRefreshing` 으로 넘기지 마라. 이유: 과거 기간 백필 전용 플래그라 pull-to-refresh 표시와 의미가 다르다.
- `canGoPreviousPeriod` 로 활성 조건을 판단하지 마라. 이유: 이전 이동 게이트(#29)이지 현재 기간 여부가 아니다.
- 배너를 흐름(flow) 자식으로 두거나 sticky 헤더 높이에 영향을 주게 만들지 마라. 이유: 이 화면은 `stickyHeaderRef` 실측 높이로 펼친 카드의 중첩 sticky 오프셋을 잡는다(ADR-047) — 당길 때마다 헤더 높이가 변하면 펼친 카드 헤더가 따라 흔들린다.
- 이 화면에 경계 페이드 오버레이를 새로 추가하지 마라. 이유: ADR-047 결정 6이 의도적으로 뺀 것이다.
- `src/features/boss-profit/store.ts` 를 수정하지 마라.
- 컨텐츠·보스 화면이나 `DropHistoryScreen.tsx` 를 함께 고치지 마라. 이유: 한 step은 한 모듈만 다루고, 히스토리 화면은 이번 적용 범위 밖이다(ADR-072 결정 13).
- 기존 테스트를 깨뜨리지 마라.
