# Step 7: widget-shell

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/today.md` 의 「배치」·「위젯 규약」절**
- **`/docs/adr/ADR-147.md` 결정 2·3·5 + 정정 1·13**
- `/docs/adr/ADR-094.md`(아토믹 계층) · `/docs/foundation/design-system.md`(카드 토큰)
- 코드: `packages/app-rn/src/components/atoms/Card/Card.tsx` ·
  `packages/app-rn/src/components/__tests__/layer-dependencies.test.ts` ·
  `packages/app-rn/src/navigation/routes.ts`
- **step 5 산출물**: `lib/widget-grid-metrics.ts` · `lib/widget-layout.ts`

## 배경

격자 함수(step 5)와 뷰모델(step 6)이 섰다. 이제 그 둘을 잇는 **껍데기**를 만든다. **위젯은 전부
stub 이다** — 이 step 이 검증할 것은 «격자가 실제로 서는가» 뿐이고, 내용이 있으면 그 판정이 흐려진다.

## 작업

### 1. 위젯 규약 — `packages/app-rn/src/app/today/widgets/types.ts`

```ts
export type WidgetId =
  | 'representative-character' | 'remaining-schedule' | 'weekly-boss-profit'
  | 'top-valuable-item' | 'crystal-limit' | 'reset-countdown'
  | 'unpriced-drops' | 'valuable-drought'

export interface WidgetProps { w: number; h: number; data: TodayViewModel }

export interface WidgetDefinition {
  id: WidgetId
  sizes: readonly { w: number; h: WidgetHeight }[]
  target?: TabRouteName          // 없으면 누를 수 없는 타일
  Component: React.ComponentType<WidgetProps>
}
```

### 2. 레지스트리 — `widgets/registry.ts`

여덟 위젯의 `sizes`·`target`·stub 컴포넌트. 선언 크기는 **[[ADR-147]] 정정 13 의 매트릭스 전부**를
담는다(v1 배치가 안 쓰는 크기도 포함 — 사용자 확정: 나중 편집 기능을 위해 남긴다).

| id | sizes | target |
|---|---|---|
| `representative-character` | 4x1 · 4x2 · 2x2 | `Settings` |
| `remaining-schedule` | 4×auto | `Content` |
| `weekly-boss-profit` | 4x3 · 4x2 · 2x2 · 2x1 | `Profit` |
| `top-valuable-item` | 2x1 · 4x2 · 2x2 · 1x1 | `Profit` |
| `crystal-limit` | 2x1 · 4x1 · 2x2 · 1x1 | `Profit` |
| `reset-countdown` | 2x1 · 2x2 · 4x1 · 1x1 | 없음 |
| `unpriced-drops` | 2x1 · 2x2 · 1x1 | `Profit` |
| `valuable-drought` | 4x1 · 2x2 · 2x1 | `Profit` |

### 3. 기본 배치 — `widgets/layout.ts`

```
(0,0)  4x1     representative-character
(0,1)  2x1     reset-countdown          (2,1) 2x1  crystal-limit
(0,2)  4×auto  remaining-schedule
(0,3)  4x3     weekly-boss-profit
(0,6)  2x1     top-valuable-item        (2,6) 2x1  unpriced-drops
(0,7)  4x1     valuable-drought
```

- `4×auto` 의 nominal `h` 는 **1**(캐릭터 1명 = 최소 높이). 그래서 좌표가 `(0,3)` 에서 바로 이어진다.

### 4. `packages/app-rn/src/app/today/WidgetGrid.tsx`

- `useWindowDimensions()` 로 창 폭을 얻어 `resolveWidgetGridMetrics` 에 넘긴다.
- auto 타일의 높이는 **그 타일에만** `onLayout` 을 걸어 잰다. 측정 전에는 nominal 로 그린다.
  - **auto 가 아닌 타일에는 `onLayout` 을 걸지 마라** — 그 값들은 계산으로 나오고, 재면 첫 프레임에 0 이다.
- `resolveWidgetPositions` 결과대로 절대 배치.
- 타일 컨테이너는 **`Card` atom** 을 쓴다(`rounded-[14px] border-border bg-surface`).
- `target` 이 있으면 `Pressable` 로 감싸 그 탭으로 보낸다. **[[ADR-132]] 결정 9 의 광고 게이트를 탄다** —
  today 에서 나가는 것은 전부 «그룹 이동» 이다. 기존 탭 이동이 게이트를 태우는 자리를 읽고 같은 경로를 써라.

### 5. 배치 검증을 테스트가 강제한다

`validateWidgetLayout(TILE_LAYOUT, sizesFromRegistry)` 가 **빈 배열**임을 단언하는 테스트를 둔다.
좌표를 손으로 적기로 한 이상 그 실수는 반드시 나고, **이 테스트가 그것을 잡는 유일한 장치**다.

## 테스트 (먼저 작성한다)

- `TILE_LAYOUT` 이 검증 다섯을 전부 통과한다(빈 배열)
- 레지스트리의 모든 위젯이 `TILE_LAYOUT` 에 정확히 한 번 등장한다
- `WidgetGrid` 스냅샷 — 여덟 타일이 예상 좌표에 선다(stub 내용)
- auto 타일이 측정 전에는 nominal 높이로 그려진다
- `target` 이 없는 위젯(`reset-countdown`)은 `Pressable` 로 감싸지지 않는다

## 금지사항

- **위젯 내용을 그리지 마라.** stub 은 `testID` 와 id 텍스트면 충분하다. 이유: 이 step 이 검증할 것은
  격자이고, 내용이 섞이면 실패 원인이 흐려진다.
- **auto 가 아닌 타일에 `onLayout` 을 걸지 마라.** 이유: 위 4번.
- **`components/` 에 새 컴포넌트를 만들지 마라.** 이유: `WidgetGrid` 는 today 전용이라 화면 폴더가
  제자리다. 여러 화면이 쓰게 되면 그때 `components/` 로 올린다(아토믹 계층 테스트가 그 경계를 지킨다).
- **`TILE_LAYOUT` 을 저장소에 쓰거나 읽지 마라.** 이유: v1 은 코드 상수다([[ADR-147]] 결정 2) —
  저장 스키마도 마이그레이션도 이번 범위가 아니다.
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

