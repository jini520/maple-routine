# Step 4: boss-screen-motion

이슈 **#38**(당겨서 새로고침)의 인디케이터 표현을 "목록이 손가락을 따라 내려감"으로 바꾸는 task다([[ADR-073]]).

이 step은 **보스 스케줄러 화면 한 파일**에만 목록 이동을 배선한다. 컨텐츠 화면은 앞 step에서 끝났고, 수익 화면은 다음 step이 담당한다.

## 읽어야 할 파일

- `/CLAUDE.md` (프로젝트 규칙 — TDD)
- `/docs/adr/ADR-073.md` (**특히 결정 1·2·3·4·6**)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절
- `/src/lib/pull-to-refresh.ts` (`resolveContentOffsetPx`·`PULL_SETTLE_TRANSITION`)
- `/src/lib/use-pull-to-refresh.ts` (`{ distance, phase, isDragging }`)
- **`/src/app/content-scheduler/ContentScreen.tsx`** (앞 step이 배선한 화면 — **이 형태를 그대로 따르라**)
- **`/src/app/content-scheduler/__tests__/ContentScreen.test.tsx`** (앞 step이 추가한 이동 테스트 — 같은 방식을 재사용하라)
- `/src/app/boss-scheduler/BossScreen.tsx` (**이번 수정 대상 — 단 한 파일**)
- `/src/app/boss-scheduler/__tests__/BossScreen.test.tsx` (기존 제스처 테스트 4건)

## 화면 구조 (작업 전 확인할 것 — 줄 번호는 밀렸을 수 있다)

컨텐츠 화면과 구조가 같다.

```
<div className="-mt-[var(--sa-top)] space-y-4">
  <div className="sticky top-0 z-10 bg-bg px-4 …">   ← 고정, 손대지 않는다
    … 제목·드롭다운·새로고침 버튼·탭·솔로/파티 필터 …
    <div className="… absolute inset-x-0 top-full h-8 …" />   ← 경계 페이드
    <PullToRefreshIndicator … />
  </div>

  {characters.length > 0 && selected !== null && (
    <div className="space-y-4 px-4 pb-4">     ← ★ 이 블록이 내려간다
      … 보스 카드 목록 …
    </div>
  )}

  {trackingModals}                             ← 움직이지 않는다
</div>
```

## 작업

### 1. 목록 블록에 이동 배선

훅 호출부 근처에서 오프셋을 한 번 계산하고:

```tsx
const pullOffset = resolveContentOffsetPx(pullToRefresh.distance, pullToRefresh.phase)
```

목록 블록에 스타일을 건다:

```tsx
style={{
  transform: pullOffset > 0 ? `translateY(${pullOffset}px)` : undefined,
  transition: pullToRefresh.isDragging ? 'none' : PULL_SETTLE_TRANSITION,
}}
```

**핵심 규칙**(앞 step과 동일 — 어긋나면 두 화면이 다르게 생긴다):

- 오프셋 0이면 `transform` 은 `undefined`([[ADR-073]] 결정 3). `translateY(0px)`·`'none'` 폴백 금지.
- `transition` 은 항상 건다. 드래그 중에만 `'none'`.
- 오프셋은 인디케이터와 같은 함수·같은 인자([[ADR-073]] 결정 6).
- 새 래퍼 `<div>` 를 만들지 말고 기존 목록 블록에 style을 얹는다.
- 헤더·`{trackingModals}` 는 움직이지 않는다.
- 목록 블록을 테스트에서 집을 수 있게 **앞 step과 같은 `data-testid`** 를 부여하라(앞 step의 summary·코드에서 확인할 것).

### 2. 테스트 추가

기존 제스처 테스트 4건은 그대로 두고, 앞 step이 `ContentScreen.test.tsx` 에 추가한 이동 테스트와 **같은 항목**을 추가하라:

- 쉬는 상태에서 목록 블록에 `transform` 인라인 스타일이 없다(가장 중요 — [[ADR-073]] 결정 3 회귀 방지).
- 당기는 중 `translateY(<0보다 큰 px>)` 가 걸린다.
- 당기는 중 `transition` 이 `'none'` 이다.
- 재조회 중(store `status: 'loading'`) `translateY(56px)` 이고 `transition` 이 `'none'` 이 아니다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (기존 BossScreen 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `git status --short` 에 `src/app/boss-scheduler/` 아래 2개 파일만 있는가?
   - 배선 형태(오프셋 계산 위치·스타일 객체·testid)가 `ContentScreen.tsx` 와 **같은가**? 다르면 맞춰라 — 두 화면이 다르게 생기면 다음에 고칠 때 둘 다 읽어야 한다.
   - store·훅·공용 컴포넌트를 건드리지 않았는가?
3. 결과에 따라 `phases/pull-to-refresh-motion/index.json` 의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "..."`
   - 실패 3회 → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 중단

## 금지사항

- 오프셋이 0일 때 `transform` 을 남기지 마라(`translateY(0px)`·`'none'` 포함). 이유: containing block·stacking context가 생겨 평상시 DOM이 달라진다.
- `transition` 을 조건부로 빼지 마라. 이유: 복귀 애니메이션이 사라진다.
- 목록 블록을 새 `<div>` 로 감싸지 마라. 이유: 화면 루트 `space-y-4` 의 적용 대상이 바뀐다.
- 헤더나 모달을 이동시키지 마라.
- `margin`·`padding`·`height` 로 밀어내지 마라. 이유: 프레임마다 리플로우가 난다.
- 컨텐츠·수익 화면이나 `BossManageScreen.tsx` 를 함께 고치지 마라.
- 기존 테스트를 깨뜨리지 마라.
