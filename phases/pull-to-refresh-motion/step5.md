# Step 5: profit-screen-motion

이슈 **#38**(당겨서 새로고침)의 인디케이터 표현을 "목록이 손가락을 따라 내려감"으로 바꾸는 task다([[ADR-073]]).

이 step은 **보스 수익 화면 한 파일**에 목록 이동을 배선한다. 이 화면은 **중첩 sticky 카드 헤더**([[ADR-047]])를 가진 유일한 화면이라 확인할 것이 하나 더 있다.

## 읽어야 할 파일

- `/CLAUDE.md` (프로젝트 규칙 — TDD)
- `/docs/adr/ADR-073.md` (**특히 결정 1·2·3·4·6과 `위험 분석` 절 — 이 화면이 그 분석의 대상이다**)
- `/docs/adr/ADR-047.md` (펼친 캐릭터 카드 헤더의 중첩 sticky·`stickyHeaderHeight` 실측)
- `/docs/adr/ADR-072.md` (결정 2 — 제스처는 `window.scrollY <= 0` 에서만 시작된다. 이것이 위험 분석의 근거다)
- `/src/lib/pull-to-refresh.ts` (`resolveContentOffsetPx`·`PULL_SETTLE_TRANSITION`)
- **`/src/app/content-scheduler/ContentScreen.tsx`** · **`/src/app/boss-scheduler/BossScreen.tsx`** (앞 step들의 배선 — **같은 형태를 따르라**)
- `/src/app/boss-profit/BossProfitScreen.tsx` (**이번 수정 대상 — 단 한 파일**)
- `/src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` (기존 제스처 테스트 6건 — 과거 기간 비활성 회귀 포함)

## 화면 구조 (작업 전 확인할 것 — 줄 번호는 밀렸을 수 있다)

```
<div className="-mt-[var(--sa-top)] space-y-4">
  <div ref={stickyHeaderRef} className="sticky top-0 z-10 bg-bg px-4 …">   ← 고정, 손대지 않는다
    … 제목·탭·기간 네비·총 수익 헤드라인 …
    <PullToRefreshIndicator … />        ← 경계 페이드가 없는 화면이라 마지막 자식
  </div>

  <div className="space-y-2 px-4 pb-4">     ← ★ 이 블록이 내려간다 (조건부가 아니다)
    … 백필 로딩 카드 · 조회 불가 안내 · CharacterAccordion 목록 …
  </div>
</div>
```

`CharacterAccordion` 은 `stickyTop={stickyHeaderHeight}` 를 받아 펼친 카드 헤더를 **중첩 sticky** 로 페이지 헤더 아래에 붙인다.

## 안전 근거 (이미 분석됨 — 다시 조사하지 말고 그대로 따르라)

`transform` 은 `position: sticky` 후손의 시각적 위치를 함께 옮긴다. 그러나 **제스처는 `window.scrollY <= 0` 에서만 시작되므로**([[ADR-072]] 결정 2) 당김이 일어나는 순간엔 어떤 카드 헤더도 아직 멈춰(stuck) 있지 않다 — 페이지 최상단에서는 모든 카드 헤더가 자기 자연 위치에 있다. 두 메커니즘이 겹칠 창이 없다. 여기에 [[ADR-073]] 결정 3(오프셋 0이면 `transform` 미적용)이 더해져 **스크롤 중인 평상시 DOM은 이 기능 도입 전과 동일**하다.

따라서 이 화면에서도 **다른 두 화면과 같은 배선**을 쓴다. 이 화면만 다른 방식(예: 래퍼 추가, `stickyTop` 보정)을 쓰지 마라.

## 작업

### 1. 목록 블록에 이동 배선

훅 호출부 근처에서 오프셋을 한 번 계산한다. **주의: 훅 호출은 빈 상태 조기 반환보다 위에 있지만, 목록 블록은 그 아래에 있다.** 오프셋 계산은 둘 중 어디에 두어도 되지만 앞 두 화면과 같은 자리에 두는 쪽을 택하라.

```tsx
const pullOffset = resolveContentOffsetPx(pullToRefresh.distance, pullToRefresh.phase)
```

목록 블록(`<div className="space-y-2 px-4 pb-4">`)에:

```tsx
style={{
  transform: pullOffset > 0 ? `translateY(${pullOffset}px)` : undefined,
  transition: pullToRefresh.isDragging ? 'none' : PULL_SETTLE_TRANSITION,
}}
```

**핵심 규칙**(앞 step들과 동일):

- 오프셋 0이면 `transform` 은 `undefined`([[ADR-073]] 결정 3). **이 화면에서는 특히 중요하다** — 상시 `transform` 이 걸리면 중첩 sticky의 기준이 바뀔 수 있다.
- `transition` 은 항상 건다. 드래그 중에만 `'none'`.
- 오프셋은 인디케이터와 같은 함수·같은 인자([[ADR-073]] 결정 6).
- 새 래퍼 `<div>` 를 만들지 말고 기존 목록 블록에 style을 얹는다.
- `stickyHeaderRef` 가 붙은 헤더 블록에는 아무것도 걸지 마라.
- **`stickyHeaderHeight` 계산·`CharacterAccordion` 의 `stickyTop` 을 보정하지 마라.** 이유: 당김 중에는 멈춘 헤더가 없으므로 보정할 대상이 없고, 보정을 넣으면 평상시 스크롤에서 오프셋이 틀어진다.
- 앞 step들과 같은 `data-testid` 를 목록 블록에 부여하라.

### 2. 테스트 추가

기존 제스처 테스트 6건(**과거 기간 비활성 회귀 2건 포함**)은 그대로 두고, 앞 step들과 같은 이동 항목을 추가하라:

- 쉬는 상태에서 목록 블록에 `transform` 인라인 스타일이 없다(가장 중요).
- 현재 기간에서 당기는 중 `translateY(<0보다 큰 px>)` 가 걸리고 `transition` 이 `'none'` 이다.
- 재조회 중(store `status: 'loading'`) `translateY(56px)` 이고 `transition` 이 `'none'` 이 아니다.
- **과거 기간에서는 같은 제스처로도 목록에 `transform` 이 걸리지 않는다**(제스처가 꺼져 있으므로 — [[ADR-072]] 결정 9 회귀 방지).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (기존 BossProfitScreen 테스트 포함)
npm run lint    # ESLint 통과
```

**AC 보강 — 변이 검증**: `transform` 삼항을 무조건 적용(`translateY(${pullOffset}px)`)으로 잠시 바꾸면 "쉬는 상태에 transform 없음" 테스트가 실패하는지 확인하고 되돌려라.

## 검증 절차

1. 위 AC 커맨드와 변이 검증을 수행한다.
2. 아키텍처 체크리스트:
   - `git status --short` 에 `src/app/boss-profit/` 아래 2개 파일만 있는가?
   - `stickyHeaderHeight`·`stickyTop` 관련 코드가 그대로인가? (`git diff` 로 확인)
   - 배선 형태가 앞 두 화면과 같은가?
3. 결과에 따라 `phases/pull-to-refresh-motion/index.json` 의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "..."` (중첩 sticky 관련해 무엇을 건드리지 않았는지도 요약에 남겨라)
   - 실패 3회 → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 중단

## 금지사항

- 오프셋이 0일 때 `transform` 을 남기지 마라. 이유: 이 화면은 중첩 sticky를 쓰는 유일한 화면이라, 상시 `transform` 이 걸리면 기준이 바뀔 위험이 가장 크다.
- `stickyHeaderHeight` 나 `stickyTop` 을 당김 오프셋만큼 보정하지 마라. 이유: 당김 중에는 멈춘 헤더가 없어 보정 대상이 없고, 보정하면 평상시 스크롤에서 카드 헤더가 어긋난다.
- 이 화면만 다른 배선 방식을 쓰지 마라. 이유: 세 화면이 다르게 생기면 다음에 고칠 때 셋 다 읽어야 한다.
- 과거 기간 게이팅(`enabled: !isEmpty && isCurrentPeriod`)을 건드리지 마라([[ADR-072]] 결정 9는 유효하다).
- 이 화면에 경계 페이드 오버레이를 추가하지 마라([[ADR-047]] 결정 6).
- 컨텐츠·보스 화면이나 `DropHistoryScreen.tsx` 를 함께 고치지 마라.
- 기존 테스트를 깨뜨리지 마라.
