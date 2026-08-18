# Step 5: widget-grid

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/today.md` 의 「격자」·「배치」절 전문**
- **`/docs/adr/ADR-147.md` 결정 1·2·3 + 정정 1**
- `/docs/adr/ADR-132.md` 정정 30(«치수는 계산한다 — 재는 것이 하나도 없다»)
- 코드: `packages/app-rn/src/lib/bottom-bar-metrics.ts`(**같은 모양의 선례 — 읽고 관례를 따라라**) ·
  `packages/app-rn/src/lib/__tests__/`

## 배경

today 는 위젯 격자다. 이 step 은 **화면도 컴포넌트도 만들지 않고** 그 격자의 순수 함수 셋만 만든다.

## 작업

### 1. `packages/app-rn/src/lib/widget-grid-metrics.ts`

```ts
export interface WidgetGridMetrics {
  colWidthPx: number    // (창폭 − 좌우 16×2 − 간격 12×3) / 4
  rowHeightPx: number   // 76 고정
  gapPx: number         // 12
  padPx: number         // 16
}
export function resolveWidgetGridMetrics(windowWidthPx: number): WidgetGridMetrics
export function tileWidthPx(w: number, m: WidgetGridMetrics): number   // w*col + (w-1)*gap
export function tileHeightPx(h: number, m: WidgetGridMetrics): number  // h*row + (h-1)*gap
```

- **행 높이는 창 폭에서 파생하지 않는다 — 고정 76.** 정사각 셀로 두면 격자가 화면 폭에 **비례해
  길어져** 폴더블 펼침(~700dp)에서 4x2 타일 하나가 화면 절반을 넘는다. 위젯은 폭이 늘면 **넓어지는**
  물건이다. 이 문장을 파일 주석에 박아라.
- **`onLayout` 실측을 쓰지 마라.** 첫 프레임에 0 이라 타일이 한 프레임 접혀 있다
  ([[ADR-132]] 정정 30 이 하단바에서 같은 결론에 도달했다).
- 360dp 에서 `colWidthPx === 73` 이 나와야 한다.

### 2. `packages/app-rn/src/lib/widget-layout.ts`

```ts
export type WidgetHeight = number | 'auto'

export interface WidgetPlacement {
  id: string
  col: number          // 0..3
  row: number
  w: number            // 1..4
  h: WidgetHeight      // 'auto' 는 최소 높이 1 로 배치되고 실측이 그 아래를 민다
}

export interface LayoutViolation { id: string; reason: string }

/** 반환값이 빈 배열이면 유효한 배치다. */
export function validateWidgetLayout(
  layout: readonly WidgetPlacement[],
  sizesById: Readonly<Record<string, readonly { w: number; h: WidgetHeight }[]>>,
): LayoutViolation[]
```

검증 **다섯**:

1. 겹치는 타일이 없다
2. `col + w ≤ 4`
3. 통째로 빈 행이 없다 (중간에 빈 행이 나오면 `row` 를 잘못 적은 것이다)
4. `(w, h)` 가 그 위젯이 선언한 `sizes` 안에 있다
5. **`h === 'auto'` 이면 `w === 4`**

**5번이 이 파일의 핵심이다.** 가로를 다 쓰면 **옆에 아무도 없으므로** 늘어난 만큼 아래 전부가 **같은
값으로** 내려가 겹침이 생길 수 없다. 좁은 타일에 auto 를 허용하면 옆 칸과 아래 칸이 서로 다른 만큼
밀려 좌표가 무너진다. 이유를 주석에 적어라.

### 3. 좌표 → 절대 위치

```ts
export interface ResolvedTile { id: string; leftPx: number; topPx: number; widthPx: number; heightPx: number }

export function resolveWidgetPositions(
  layout: readonly WidgetPlacement[],
  metrics: WidgetGridMetrics,
  /** auto 타일의 실측 높이(px). 없는 id 는 최소 높이로 친다. */
  autoHeightsById: Readonly<Record<string, number>>,
): { tiles: ResolvedTile[]; containerHeightPx: number }
```

- 기본 위치: `left = col * (col폭 + gap)`, `top = row * (행높이 + gap)`.
- **auto 초과분 누적**: auto 타일의 실측 높이가 그 nominal 높이(`h = 1` → 76px)보다 크면, **그 타일보다
  아래(`row` 가 큰) 모든 타일의 `top` 에 차이를 더한다.** 즉
  `top = 적어 둔 top + Σ(위쪽 auto 타일들의 초과분)`.
- 컨테이너 높이는 그 결과의 `max(top + height)`.
- **`row` 를 재계산해 다시 채우지 마라**(자동 패킹). 이유: [[ADR-147]] 결정 2 — 알고리즘이 늘 «어딘가에»
  넣으므로 배치 실수가 실수로 드러나지 않는다.

## 테스트 (먼저 작성한다)

`packages/app-rn/src/lib/__tests__/widget-grid-metrics.test.ts` ·
`packages/app-rn/src/lib/__tests__/widget-layout.test.ts`:

- 360dp → `colWidthPx = 73`, `tileWidthPx(4) = 328`, `tileHeightPx(2) = 164`
- 폭이 두 배가 되어도 `rowHeightPx` 는 76 그대로 (**핵심 회귀 가드**)
- 검증 다섯이 각각 위반을 잡는다 (겹침 · `col+w>4` · 빈 행 · 미선언 크기 · auto인데 `w<4`)
- 유효한 배치는 빈 배열
- auto 실측이 nominal 과 같으면 좌표가 그대로
- auto 실측이 160px 초과분을 만들면 **아래 타일 전부**가 정확히 그만큼 내려간다
- auto 가 둘이면 초과분이 **누적**된다

## 금지사항

- **컴포넌트를 만들지 마라.** 이유: 이 step 은 순수 함수만이고, 그래야 다음 step 이 격자 위에서만 논다.
- **`onLayout`·`useWindowDimensions` 를 이 파일들에서 부르지 마라.** 이유: 순수 함수여야 테스트가
  값 조합만으로 선다. 창 폭은 인자로 받는다.
- **자동 패킹을 넣지 마라.** 이유: 위 3번.
- 기존 테스트를 깨뜨리지 마라.

## Acceptance Criteria

```bash
npm run build                                       # core 타입 검사 포함
npx tsc --noEmit -p packages/app-rn/tsconfig.json   # RN 타입 (루트 tsconfig 는 참조 스텁이라 무의미하다)
npm test                                            # vitest(core·capacitor) + jest(app-rn)
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. 아키텍처 체크리스트:
   - `/docs/foundation/architecture.md` 디렉토리 구조를 따르는가?
   - CLAUDE.md CRITICAL — `features/*` 가 저장소·네이티브를 직접 만지지 않는가([[ADR-003]]·[[ADR-005]])?
   - CLAUDE.md CRITICAL — `src/data/` 의 게임 수치를 임의로 추정하지 않았는가([[ADR-006]])?
   - 새 컴포넌트를 만들었다면 아토믹 계층 자리가 맞는가(`components/__tests__/layer-dependencies.test.ts`)?
3. 결과에 따라 `phases/today-widgets/index.json` 의 해당 step 을 갱신한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 즉시 중단

