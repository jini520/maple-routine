# Step 3: content-screen-motion

이슈 **#38**(당겨서 새로고침)의 인디케이터 표현을 "목록이 손가락을 따라 내려감"으로 바꾸는 task다([[ADR-073]]).

이 step은 **컨텐츠 스케줄러 화면 한 파일**에만 목록 이동을 배선한다.

## 읽어야 할 파일

- `/CLAUDE.md` (프로젝트 규칙 — TDD)
- `/docs/adr/ADR-073.md` (**특히 결정 1·2·3·4·6과 `위험 분석` 절**)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절 (확정 레시피)
- `/src/lib/pull-to-refresh.ts` (`resolveContentOffsetPx`·`PULL_SETTLE_TRANSITION`)
- `/src/lib/use-pull-to-refresh.ts` (`{ distance, phase, isDragging }`)
- `/src/components/PullToRefreshIndicator/PullToRefreshIndicator.tsx`
- `/src/app/content-scheduler/ContentScreen.tsx` (**이번 수정 대상 — 단 한 파일**)
- `/src/app/content-scheduler/__tests__/ContentScreen.test.tsx` (기존 제스처 테스트 `describe('당겨서 새로고침 (ADR-072)')` 4건)

## 화면 구조 (작업 전 확인할 것 — 줄 번호는 밀렸을 수 있다)

```
return (
  <div className="-mt-[var(--sa-top)] space-y-4">
    <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
      … 제목·드롭다운·새로고침 버튼·탭 …
      <div className="pointer-events-none absolute inset-x-0 top-full h-8 …" />   ← 경계 페이드
      <PullToRefreshIndicator distance={…} phase={…} />                            ← step 2가 넣음
    </div>

    {characters.length > 0 && selected !== null && (
      <div className="space-y-4 px-4 pb-4">     ← ★ 이 블록이 내려간다
        … 카드 목록 …
      </div>
    )}

    {trackingModals}                             ← 모달은 절대 움직이지 않는다
  </div>
)
```

## 작업

### 1. 목록 블록에 이동 배선

훅 호출부(`const pullToRefresh = usePullToRefresh({...})`) 근처에서 오프셋을 한 번 계산한다:

```tsx
const pullOffset = resolveContentOffsetPx(pullToRefresh.distance, pullToRefresh.phase)
```

그리고 목록 블록(`<div className="space-y-4 px-4 pb-4">`)에 스타일을 건다:

```tsx
style={{
  transform: pullOffset > 0 ? `translateY(${pullOffset}px)` : undefined,
  transition: pullToRefresh.isDragging ? 'none' : PULL_SETTLE_TRANSITION,
}}
```

**핵심 규칙 (반드시 지켜라)**

- **오프셋이 0이면 `transform` 을 `undefined` 로 둔다**([[ADR-073]] 결정 3). `translateY(0px)` 를 넣지 마라 — 그것만으로도 containing block·stacking context가 생겨 평상시 DOM이 지금과 달라진다. `?? 'none'` 같은 폴백도 넣지 마라.
- **`transition` 은 오프셋과 무관하게 항상 건다.** 재조회가 끝나 오프셋이 56 → 0이 될 때 복귀 애니메이션이 이 속성 위에서 돈다. 전환 속성만으로는 어떤 컨텍스트도 생기지 않는다.
- **드래그 중에는 `'none'`**([[ADR-073]] 결정 4). 손가락이 붙어 있는 동안 전환이 걸리면 목록이 늦게 따라와 감각이 죽는다.
- 오프셋은 **인디케이터가 쓰는 것과 같은 함수·같은 인자**여야 한다([[ADR-073]] 결정 6). 자체 산식을 만들지 마라.
- 새 래퍼 `<div>` 를 만들지 마라 — 기존 목록 블록에 style을 얹는다. 이유: 래퍼를 끼우면 화면 루트의 `space-y-4` 가 적용되는 대상이 바뀌어 헤더와 목록 사이 간격이 달라진다.
- **`{trackingModals}` 를 이동 대상에 넣지 마라.** 이유: 모달·진행률 오버레이가 손가락을 따라 흔들린다.
- 헤더(`sticky` 블록)에는 아무것도 걸지 마라([[ADR-073]] 결정 1 — 헤더는 고정이다).

### 2. 테스트 추가

기존 `describe('당겨서 새로고침 (ADR-072)')` 4건은 그대로 두고(제스처 계약은 유효하다) 이동 관련 항목을 추가하라. 합성 터치 이벤트 헬퍼는 그 파일에 이미 있다.

- 쉬는 상태에서 목록 블록에 **`transform` 인라인 스타일이 없다**(`element.style.transform === ''`). — [[ADR-073]] 결정 3 회귀 방지. 이 테스트가 가장 중요하다.
- 임계값 미만으로 당기는 중 목록 블록에 `translateY(<0보다 큰 px>)` 가 걸린다.
- 당기는 중 `transition` 이 `'none'` 이다.
- 손을 떼고 재조회가 도는 동안(store `status: 'loading'`) 목록 블록이 `translateY(56px)`(= `PULL_THRESHOLD_PX`)에 있고 `transition` 이 `'none'` 이 아니다.
- `{trackingModals}` 영역(피커가 열린 상태)에는 transform이 걸리지 않는다 — 목록 블록에만 걸린다.

목록 블록을 테스트에서 집는 방법은 재량이다(예: 카드 텍스트로 찾은 뒤 `closest('.px-4')`, 또는 목록 블록에 `data-testid="pull-content"` 를 부여). **testid를 새로 부여하는 쪽을 권장한다** — 클래스 문자열에 의존한 셀렉터는 스타일을 손볼 때마다 깨진다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (기존 ContentScreen 테스트 포함)
npm run lint    # ESLint 통과
```

**AC 보강 — 변이 검증**: `transform: pullOffset > 0 ? … : undefined` 를 `transform: \`translateY(${pullOffset}px)\`` 로 잠시 바꾸면 "쉬는 상태에 transform 없음" 테스트가 실제로 실패하는지 확인하고, 확인 후 되돌려라.

## 검증 절차

1. 위 AC 커맨드와 변이 검증을 수행한다.
2. 아키텍처 체크리스트:
   - `git status --short` 에 `src/app/content-scheduler/` 아래 2개 파일만 있는가?
   - 목록 블록 외에 `transform` 을 건 곳이 없는가? (헤더·모달 제외 확인)
   - store·훅·공용 컴포넌트를 건드리지 않았는가?
3. 결과에 따라 `phases/pull-to-refresh-motion/index.json` 의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "..."` (오프셋 계산 위치·스타일 형태·부여한 testid를 요약에 담아라 — step 4·5가 같은 패턴을 반복한다)
   - 실패 3회 → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 중단

## 금지사항

- 오프셋이 0일 때 `transform: translateY(0px)` 또는 `transform: 'none'` 을 남기지 마라. 이유: 그것만으로 containing block·stacking context가 생겨 `position: sticky`·`position: fixed` 후손의 기준이 바뀐다([[ADR-073]] 결정 3).
- `transition` 을 조건부로 빼지 마라(드래그 중 `'none'` 인 것과 아예 없는 것은 다르다). 이유: 복귀 애니메이션이 사라진다.
- 목록 블록을 새 `<div>` 로 감싸지 마라. 이유: 화면 루트의 `space-y-4` 적용 대상이 바뀌어 간격이 달라진다.
- 헤더나 `{trackingModals}` 를 이동시키지 마라. 이유: 헤더는 고정이 계약이고([[ADR-073]] 결정 1), 모달이 흔들리면 조작이 어려워진다.
- `margin-top`·`padding-top`·`height` 로 목록을 밀어내지 마라. 이유: 터치 프레임마다 리플로우가 발생한다([[ADR-073]] 결정 2).
- 보스·수익 화면을 함께 고치지 마라. 이유: step 4·5의 범위다.
- 기존 테스트를 깨뜨리지 마라.
