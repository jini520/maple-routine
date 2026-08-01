# Step 2: pull-indicator

이슈 **#38**(당겨서 새로고침)의 인디케이터 표현을 "불투명 배너 + 고정 목록"에서 "목록이 손가락을 따라 내려감"으로 바꾸는 task다([[ADR-073]]).

이 step은 **표시 컴포넌트를 교체**한다. 목록을 실제로 움직이는 배선은 step 3~5가 맡는다.

## 읽어야 할 파일

- `/CLAUDE.md` (프로젝트 규칙 — TDD, 공용 UI는 `components/`)
- `/docs/adr/ADR-073.md` (**특히 결정 6·7·9**)
- `/docs/adr/ADR-072.md` (결정 6·7의 문구·스피너 규칙은 살아 있다. 결정 4·5·7의 배너 형태만 폐기됐다)
- `/docs/adr/ADR-061.md` (스피너 2종 규칙 — 이 변경도 그 안에서 성립해야 한다)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절 (**이 절의 레시피가 곧 구현이다**)
- `/src/lib/pull-to-refresh.ts` (step 1 — `resolveContentOffsetPx`·`resolvePullProgress`·`PullPhase`)
- `/src/components/PullToRefreshBanner/PullToRefreshBanner.tsx` (**교체 대상 — 현행 배너**)
- `/src/components/PullToRefreshBanner/__tests__/PullToRefreshBanner.test.tsx` (현행 테스트 12건)
- `/src/components/MapleSweepSpinner/MapleSweepSpinner.tsx` · `/src/components/mapleLeafPath.ts`
- `/src/app/content-scheduler/ContentScreen.tsx` · `/src/app/boss-scheduler/BossScreen.tsx` · `/src/app/boss-profit/BossProfitScreen.tsx` (배너를 import·렌더하는 세 곳)

## 작업

**테스트를 먼저 쓰고** 통과하는 구현을 작성하라.

### 1. `PullToRefreshBanner` → `PullToRefreshIndicator` 교체

`src/components/PullToRefreshIndicator/PullToRefreshIndicator.tsx` 를 만들고 `src/components/PullToRefreshBanner/` 디렉토리(컴포넌트 + 테스트)를 **삭제**한다. 이름을 바꾸는 이유: 더 이상 불투명한 띠(banner)가 아니라 벌어진 틈 안의 표시기다.

```ts
import type { PullPhase } from '../../lib/pull-to-refresh'

export interface PullToRefreshIndicatorProps {
  distance: number
  phase: PullPhase
}

export function PullToRefreshIndicator(props: PullToRefreshIndicatorProps): React.JSX.Element | null
```

**현행 배너에서 바뀌는 것은 딱 두 가지다** — 나머지(문구 3종, 잎 회전·불투명도 식, `MapleSweepSpinner` 24px, `role="status"`, `pointer-events-none`, `phase==='idle'` 이면 `null`)는 그대로 가져가라.

1. **루트에서 배경과 테두리를 없앤다.** `border-b border-border bg-bg` 를 제거한다. 목록이 내려가 생긴 틈은 이미 페이지 배경이라 덮을 것이 없다([[ADR-073]] 결정 7). 남는 루트 클래스:
   ```
   pointer-events-none absolute inset-x-0 top-full z-[1] overflow-hidden
   ```
   높이는 `style={{ height: resolveContentOffsetPx(props.distance, props.phase) }}` — **step 3~5가 목록에 거는 오프셋과 같은 함수·같은 인자다**([[ADR-073]] 결정 6). 이 값을 다른 식으로 계산하지 마라.
2. **내용 래퍼를 고정 높이에서 `h-full` 로 바꾼다.** 현행 `flex h-14 items-center justify-center gap-2` → `flex h-full items-center justify-center gap-2`. 이유: 인디케이터가 **현재 벌어진 틈의 세로 중앙**에 있어야 틈이 커질수록 함께 내려온다. 고정 `h-14` 는 위에서부터 드러나는 옛 배너의 어법이다. 틈이 작을 때 내용이 넘치는 것은 루트의 `overflow-hidden` 이 잘라준다.

`data-testid` 는 `pull-to-refresh-indicator` 로 바꾸고, 잎의 `data-testid="pull-to-refresh-leaf"` 는 유지한다.

### 2. 세 화면의 import·태그명 갱신 (기계적 수정만)

`ContentScreen.tsx`·`BossScreen.tsx`·`BossProfitScreen.tsx` 에서 `PullToRefreshBanner` import와 태그를 `PullToRefreshIndicator` 로 바꾼다. **props·배치·주변 JSX는 건드리지 마라** — 목록 이동 배선은 step 3~5의 범위다.

이 기계적 수정을 이 step에 포함하는 이유는 **매 step이 `npm run build` 를 통과해야 하기 때문**이다. 컴포넌트만 개명하고 화면을 두면 빌드가 깨진 채로 커밋된다.

배너를 언급하던 주변 주석(`ADR-072 결정 5: 배너와 위 페이드가 …`)의 '배너'를 '인디케이터'로 고치는 것까지는 허용한다.

### 3. 테스트

`src/components/PullToRefreshIndicator/__tests__/PullToRefreshIndicator.test.tsx` 를 만든다. 삭제하는 배너 테스트 12건의 항목을 **그대로 이어받되**, 아래를 반영·추가하라:

- `phase='refreshing'` 이고 `distance=0` 일 때 높이가 `PULL_THRESHOLD_PX` 다(정착 위치).
- **루트에 배경·테두리 클래스가 없다**(`bg-bg`·`border-b` 부재 — 회귀 방지: 배너로 되돌아가면 이 테스트가 잡는다).
- 내용 래퍼가 `h-full` 이다(고정 `h-14` 가 아니다).
- 나머지: idle 무렌더 / 3문구 / 스피너 유무 / 당김에 따른 높이 증가 / 진행률 클램프(회전 ≤ 180deg) / 잎에 애니메이션 클래스 없음 / `pointer-events-none` / 접근성(`role="status"`).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (세 화면의 기존 제스처 테스트 포함)
npm run lint    # ESLint 통과
```

세 화면의 기존 제스처 테스트가 `pull-to-refresh-banner` testid를 참조하고 있다면 새 testid로 갱신하라(개명에 따른 최소 수정).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `grep -rn "PullToRefreshBanner" src/` 가 무결과인가? `src/components/PullToRefreshBanner/` 디렉토리가 사라졌는가?
   - 인디케이터 높이가 `resolveContentOffsetPx` 로만 계산되는가? (자체 산식이 없는가)
   - 새 색·토큰·SVG 자산을 만들지 않았는가?
   - 화면 파일의 diff가 **import·태그명·주석 문구뿐**인가? (목록 이동 배선이 섞였다면 step 3~5로 미뤄라)
3. 결과에 따라 `phases/pull-to-refresh-motion/index.json` 의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "..."` (새 컴포넌트 경로·props·루트 클래스·testid를 요약에 담아라 — step 3~5가 이 컴포넌트와 같은 오프셋 값을 목록에 건다)
   - 실패 3회 → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 중단

## 금지사항

- 인디케이터에 배경·테두리를 남기지 마라. 이유: 목록이 내려가 생긴 틈이 곧 페이지 배경이라, 그 위에 또 불투명 면을 깔면 경계선이 두 겹으로 보인다([[ADR-073]] 결정 7).
- 인디케이터 안에서 높이를 자체 산식으로 계산하지 마라. 이유: 목록 오프셋과 어긋나면 인디케이터가 카드 위에 겹치거나 빈 띠가 남는다([[ADR-073]] 결정 6).
- 이 step에서 목록에 `transform` 을 걸지 마라. 이유: step 3~5가 화면별로 한다(수익 화면은 중첩 sticky 때문에 확인할 것이 더 있다).
- 새 스피너를 만들지 마라([[ADR-061]] 결정 1).
- `~중...` 문구를 쓰지 마라([[ADR-061]] 결정 9).
- 훅·순수 로직(`src/lib/*`)을 수정하지 마라. 이유: step 1에서 끝났다.
- 기존 테스트를 이유 없이 줄이지 마라 — 배너 테스트의 항목은 인디케이터 테스트로 이어받는다.
