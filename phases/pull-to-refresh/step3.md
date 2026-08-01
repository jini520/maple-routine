# Step 3: pull-banner

이 task는 GitHub 이슈 **#38**(각 탭에서 당겨서 새로고침 제스처로 API 재조회)을 구현한다.

이 step은 **공용 컴포넌트 하나**만 만든다. 화면(`src/app/*`)은 건드리지 않는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — TDD, 공용 UI는 `components/`)
- `/docs/adr/ADR-072.md` (이번 기능의 결정 원장 — 특히 결정 4·5·6·7)
- `/docs/adr/ADR-061.md` (로딩 표현 통일 — 스피너 2종 규칙. 이 배너는 그 규칙 **안에서** 성립한다)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절 (**이 절의 레시피가 곧 구현이다 — 클래스를 임의로 바꾸지 마라**)
- `/src/lib/pull-to-refresh.ts` (step 1 — `PullPhase`·`resolvePullProgress`·`resolveBandHeightPx`·`PULL_THRESHOLD_PX`)
- `/src/components/mapleLeafPath.ts` (`MAPLE_LEAF_PATH` — 재사용할 단풍잎 path)
- `/src/components/MapleSweepSpinner/MapleSweepSpinner.tsx` (재조회 중에 쓸 스피너, viewBox·비율 참고)
- `/src/components/MapleSpinner/MapleSpinner.tsx` (컴포넌트 작성 관례 — `data-testid`, `aria-hidden`, props 인터페이스 export)
- `/src/components/MapleSweepSpinner/__tests__/MapleSweepSpinner.test.tsx` (jsdom 컴포넌트 테스트의 본보기)

## 작업

`src/components/PullToRefreshBanner/PullToRefreshBanner.tsx` 를 신설한다. **테스트를 먼저 쓰고**(`src/components/PullToRefreshBanner/__tests__/PullToRefreshBanner.test.tsx`, 첫 줄 `// @vitest-environment jsdom`) 통과하는 구현을 작성하라.

### 공개 인터페이스

```ts
import type { PullPhase } from '../../lib/pull-to-refresh'

export interface PullToRefreshBannerProps {
  distance: number
  phase: PullPhase
}

export function PullToRefreshBanner(props: PullToRefreshBannerProps): React.JSX.Element | null
```

### 규칙 (반드시 지켜라)

- `phase === 'idle'` 이면 **`null` 을 반환한다**(DOM에 아무것도 남기지 않는다).
- 루트 요소는 **절대 배치**다. `design-system.md` 레시피 그대로:
  ```
  pointer-events-none absolute inset-x-0 top-full z-[1] overflow-hidden border-b border-border bg-bg
  style={{ height: resolveBandHeightPx(distance, phase) }}
  ```
  - **높이만 변하고 흐름(flow)에는 영향을 주지 않아야 한다**(ADR-072 결정 4). 마진·패딩으로 목록을 밀어내지 마라 — 수익 화면의 `stickyHeaderRef` 실측 높이가 매 프레임 흔들린다.
  - `pointer-events-none` 인 이유: 배너가 목록 위를 덮는 동안에도 그 아래 카드의 탭이 막히면 안 된다.
- 내용 래퍼: `flex h-14 items-center justify-center gap-2`. **`h-14`(56px)는 `PULL_THRESHOLD_PX` 와 같은 값이다** — 주석으로 그 사실을 남겨라. 높이가 고정이라 루트의 `overflow-hidden` 이 위에서부터 드러내는 효과를 낸다.
- 접근성: 루트에 `role="status"` 와 `aria-live="polite"`, `data-testid="pull-to-refresh-banner"`. 단풍잎 SVG와 스피너는 `aria-hidden`(스피너는 자체적으로 이미 그렇다). 문구는 실제 텍스트 노드로 둔다.
- **당기는 중/임계 초과**(`'pulling'` · `'ready'`): 정적 단풍잎 SVG를 그린다.
  - `MAPLE_LEAF_PATH` 를 `fill="currentColor"` 로 채운 `<svg viewBox="0 0 127 130">`, 클래스 `h-5 w-5 text-primary-ink`.
  - `transform: rotate(${resolvePullProgress(distance) * 180}deg)`, `opacity: 0.3 + 0.7 * resolvePullProgress(distance)` 를 인라인 스타일로 준다.
  - **애니메이션 클래스를 붙이지 마라** — 이 잎은 스피너가 아니라 제스처 진행률 표시다(ADR-072 결정 7).
- **재조회 중**(`'refreshing'`): `<MapleSweepSpinner size={24} className="text-primary-ink" />` 를 쓴다. 새 스피너를 만들지 마라(ADR-061 결정 1).
- 문구는 `text-sm text-text-muted` 로, phase에 따라:
  - `'pulling'` → `당겨서 새로고침`
  - `'ready'` → `놓으면 새로고침`
  - `'refreshing'` → `새로고침하고 있어요`
  - **`~중...` 형태를 쓰지 마라**(ADR-061 결정 9 — 말줄임표가 남는 자리는 새로고침 아이콘 옆 `조회 중...` 한 곳뿐이다).
- 새 색·새 토큰을 만들지 마라. `bg-bg`·`border-border`·`text-text-muted`·`text-primary-ink` 만 쓴다.

### 테스트에 반드시 포함할 항목

- `phase='idle'` 이면 아무것도 렌더하지 않는다.
- 세 phase의 문구가 각각 맞다.
- `phase='refreshing'` 이면 `maple-sweep-spinner` testid가 있고, `'pulling'` 에서는 없다.
- `phase='refreshing'` 이면 `distance` 가 0이어도 배너 높이가 `PULL_THRESHOLD_PX` 다(손을 떼서 거리가 0이 된 상태).
- 당김 진행에 따라 높이가 커진다(예: `distance=20` → `distance=40`).
- 임계값을 넘겨 당겨도 잎 회전이 180deg를 넘지 않는다(진행률 클램프).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (신규 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 공용 UI가 `components/<이름>/<이름>.tsx` + `__tests__/` 구조를 따르는가? (기존 `MapleSweepSpinner` 와 동일)
   - `design-system.md` 의 레시피와 클래스가 정확히 일치하는가? 불일치가 있으면 **코드가 아니라 어느 쪽이 옳은지 판단해** 문서를 고칠지 코드를 고칠지 정하고, 문서를 고쳤다면 그 사실을 summary에 남겨라.
   - `features/*`·`storage/`·`native/` 를 import하지 않았는가?
   - 새 스피너 컴포넌트를 만들지 않았는가? (ADR-061 결정 1)
3. 결과에 따라 `phases/pull-to-refresh/index.json` 의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (컴포넌트 경로·props·루트 클래스를 요약에 포함하라 — step 4·5·6이 이 컴포넌트를 sticky 헤더에 꽂는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 배너를 `fixed` 로 배치하지 마라. 이유: sticky 헤더 안에 `absolute top-full` 로 두어야 헤더 높이·안전영역 계산을 다시 하지 않고 헤더 바로 아래에 붙는다.
- 배너가 목록을 밀어내게 만들지 마라(마진·패딩·흐름 자식). 이유: 터치 프레임마다 목록 전체가 리플로우되고, 수익 화면은 `ResizeObserver` 로 헤더 높이를 실측해 중첩 sticky 오프셋에 쓰므로 펼친 카드 헤더가 따라 흔들린다(ADR-072 결정 4).
- 화면 파일(`src/app/**`)을 수정하지 마라. 이유: step 4~6의 범위다.
- 훅(`usePullToRefresh`)을 이 컴포넌트 안에서 호출하지 마라. 이유: 제스처의 활성 조건은 화면마다 다르고(수익은 현재 기간 한정), 배너는 표시만 담당한다.
- 새 색·토큰·SVG 자산을 만들지 마라.
- 기존 테스트를 깨뜨리지 마라.
