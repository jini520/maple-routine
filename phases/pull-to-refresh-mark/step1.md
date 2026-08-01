# Step 1: indicator-ring

이슈 **#38**(당겨서 새로고침)의 인디케이터 마크를 바꾸는 task다([[ADR-074]]) — 문구를 없애고 단풍잎 로고 링(진행률 드로잉 → 회전)으로 교체한다.

이 step은 **인디케이터 컴포넌트 한 파일 + 그 테스트**를 고치고, 세 화면 테스트의 **문구 단언만** 기계적으로 갱신한다. 화면 코드·훅·순수 로직은 건드리지 않는다.

## 읽어야 할 파일

- `/CLAUDE.md` (프로젝트 규칙 — TDD: 테스트를 먼저 쓰고 통과하는 구현을 쓴다)
- `/docs/adr/ADR-074.md` (**이번 변경의 결정 원장 — 결정 1~7 전부**)
- `/docs/adr/ADR-061.md` (스피너 2종 규칙과 이번에 신설된 PTR 예외)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절 (**이 절의 레시피가 곧 구현이다**)
- `/src/components/PullToRefreshIndicator/PullToRefreshIndicator.tsx` (**수정 대상**)
- `/src/components/PullToRefreshIndicator/__tests__/PullToRefreshIndicator.test.tsx` (현행 14건)
- `/src/components/MapleSpinner/MapleSpinner.tsx` (**재조회 구간에 쓸 컴포넌트** — `size` prop, `data-testid="maple-spinner"`)
- `/src/components/mapleLeafPath.ts` (`MAPLE_LEAF_PATH`)
- `/src/lib/pull-to-refresh.ts` (`resolveContentOffsetPx`·`resolvePullProgress`·`PullPhase`)
- `/src/app/content-scheduler/__tests__/ContentScreen.test.tsx` · `/src/app/boss-scheduler/__tests__/BossScreen.test.tsx` · `/src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` (각 파일에 `expect(screen.getByText('당겨서 새로고침'))` 단언이 **한 줄씩** 있다)

## 작업

**테스트를 먼저 쓰고** 통과하는 구현을 작성하라.

### 1. `PullToRefreshIndicator` 수정

바뀌지 않는 것: props(`{ distance, phase }`), `phase === 'idle'` 이면 `null`, 루트의 `pointer-events-none absolute inset-x-0 top-full z-[1] overflow-hidden`, 높이 `resolveContentOffsetPx(distance, phase)`, 내용 래퍼 `flex h-full items-center justify-center`, `data-testid="pull-to-refresh-indicator"`.

바뀌는 것:

1. **문구를 전부 제거한다**([[ADR-074]] 결정 1). `MESSAGE` 상수와 `<span>` 을 지운다. 내용 래퍼의 `gap-2` 도 자식이 하나뿐이니 뺀다.
2. **루트를 접근성 트리에서 숨긴다**([[ADR-074]] 결정 7). `role="status"` 와 `aria-live="polite"` 를 제거하고 `aria-hidden="true"` 를 붙인다. 이유는 코드 주석으로 남겨라 — 문구가 없으면 빈 라이브 리전이 되고, 재조회 상태는 헤더의 `조회 중...` 이 이미 알린다([[ADR-061]] 결정 8).
3. **당김 구간(`'pulling'`·`'ready'`)의 마크를 외곽선 링 드로잉으로 바꾼다**([[ADR-074]] 결정 2·3). 채움 잎과 회전·불투명도 변화를 없앤다.
   ```
   <svg viewBox="0 0 127 130"> 안의 <path>:
     d={MAPLE_LEAF_PATH}
     fill="none"  stroke="currentColor"  strokeWidth={9}  strokeLinecap="round"
     pathLength={300}
     strokeDasharray="300 300"
     strokeDashoffset={300 * (1 - resolvePullProgress(distance))}
   ```
   `pathLength={300}` 은 `MapleSpinner` 와 같은 정규화 값이다 — 같은 경로를 같은 척도로 다뤄야 두 구간의 링이 같은 굵기·같은 궤적으로 보인다.
   `data-testid="pull-to-refresh-leaf"` 는 유지한다.
4. **재조회 구간(`'refreshing'`)은 `<MapleSpinner size={28} />`** 로 바꾼다([[ADR-074]] 결정 4·5). `MapleSweepSpinner` import를 제거한다.
5. **두 구간의 마크 크기를 28px로 맞춘다**([[ADR-074]] 결정 6). 당김 구간 svg의 크기 지정 방식은 재량이나(`width`/`height` 속성 또는 클래스), **`MapleSpinner size={28}` 이 만드는 실제 크기와 눈으로 같아야 한다.** `MapleSpinner` 는 `width={size} height={size * (130 / 127)}` 로 그린다 — 당김 구간도 같은 비율을 쓰라. 손을 떼는 순간 마크가 커지거나 작아지면 이 결정이 깨진 것이다.
6. 색은 `text-primary-ink` 를 유지한다. 새 색·토큰을 만들지 마라.

파일 상단 주석에서 문구·스윕을 설명하던 부분을 새 결정에 맞게 고쳐라(옛 설명을 남겨두면 다음 사람이 코드와 주석 중 어느 쪽이 맞는지 묻게 된다).

### 2. 인디케이터 테스트 갱신

문구 단언 3건(`당겨서 새로고침`·`놓으면 새로고침`·`새로고침하고 있어요`)은 **삭제**하고, 아래로 대체·보강하라. 나머지 기존 항목(idle 무렌더 / 높이 / `pointer-events-none` / `bg-bg`·`border-b` 부재 / `h-full` 등)은 유지한다.

- **문구가 하나도 렌더되지 않는다** — 세 문구 각각에 대해 `queryByText(...)` 가 `null` 이다(회귀 방지: 문구가 되살아나면 잡힌다).
- 루트에 `aria-hidden="true"` 가 있고 `role="status"` 가 없다.
- `'pulling'` 에서 링 `path` 의 `fill` 이 `none` 이고 `stroke` 가 `currentColor` 다(채움으로 되돌아가면 잡힌다).
- **진행률 0에서 `strokeDashoffset` 이 300, 임계값(56px)에서 0이다.** 중간값(예 28px)에서 150이다.
- 임계값을 넘겨 더 당겨도 `strokeDashoffset` 이 음수가 되지 않는다(진행률 클램프).
- `'pulling'` 링에 애니메이션 클래스가 없다(스스로 움직이지 않는다 — 손가락의 함수다).
- `'refreshing'` 에서 `maple-spinner` testid가 있고 `maple-sweep-spinner` 는 없다.
- **당김 구간과 재조회 구간의 마크 너비가 같다**([[ADR-074]] 결정 6 회귀 방지 — 손을 떼는 순간 크기가 튀지 않는다).

### 3. 세 화면 테스트의 문구 단언 갱신 (기계적)

각 파일에 한 줄씩 있는 `expect(screen.getByText('당겨서 새로고침')).toBeInTheDocument()` 를 인디케이터 존재 단언으로 바꾼다:

```ts
expect(screen.getByTestId('pull-to-refresh-indicator')).toBeInTheDocument()
```

**그 한 줄 외에 화면 테스트를 고치지 마라.** 이 기계적 수정을 이 step에 포함하는 이유는 매 step이 `npm test` 를 통과해야 하기 때문이다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과
npm run lint    # ESLint 통과
```

**AC 보강 — 변이 검증**: `strokeDashoffset` 을 상수 `0`(항상 완성된 링)으로 잠시 바꾸면 진행률 테스트가 실제로 실패하는지 확인하고, 확인 후 되돌려라.

## 검증 절차

1. 위 AC 커맨드와 변이 검증을 수행한다.
2. 아키텍처 체크리스트:
   - `grep -rn "MapleSweepSpinner" src/components/PullToRefreshIndicator/` 가 무결과인가?
   - `grep -rn "당겨서 새로고침\|놓으면 새로고침\|새로고침하고 있어요" src/` 결과에 **구현 파일이 없는가**(테스트의 부재 단언과 `pull-to-refresh.ts` 주석은 남아도 된다)?
   - `git status --short` 에 인디케이터 2파일 + 화면 테스트 3파일, 총 5개만 있는가? 화면 **구현** 파일이 있으면 되돌려라.
   - 새 색·토큰·SVG 자산을 만들지 않았는가?
   - `MapleSweepSpinner` 컴포넌트 자체를 삭제하지 않았는가? (다른 자리에서 쓰고 있다)
3. 결과에 따라 `phases/pull-to-refresh-mark/index.json` 의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "..."` (링 드로잉 속성값·크기 지정 방식·제거한 것들을 요약에 담아라)
   - 실패 3회 → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 중단

## 금지사항

- `MapleSweepSpinner` 컴포넌트 파일을 삭제하지 마라. 이유: 콜드 스타트·백필 등 다른 자리에서 쓰고 있고, [[ADR-061]]의 배분은 그 자리들에서 유효하다.
- 당김 구간 링에 애니메이션 클래스(`animate-maple-trail` 등)를 붙이지 마라. 이유: 그 링은 스스로 움직이는 스피너가 아니라 손가락 위치의 함수다. 붙이면 진행률이 안 읽힌다.
- 당김 구간과 재조회 구간의 마크 크기를 다르게 두지 마라. 이유: 손을 떼는 순간 마크가 튀어 한 동작이 두 개로 끊겨 보인다([[ADR-074]] 결정 4·6).
- 문구를 "접근성용"으로 시각적 숨김(`sr-only`) 처리해 남기지 마라. 이유: [[ADR-074]] 결정 7이 이 자리를 시각 전용으로 정했고, 재조회 상태는 헤더가 이미 알린다.
- 화면 **구현** 파일(`src/app/**/*.tsx` 중 테스트가 아닌 것)을 수정하지 마라. 이유: props가 그대로라 고칠 것이 없다.
- 훅·순수 로직(`src/lib/*`)을 수정하지 마라.
- 기존 테스트를 이유 없이 줄이지 마라(문구 단언 3건은 부재 단언으로 **대체**하는 것이다).
