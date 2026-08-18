# Step 4: drought-headline-pools

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/item-drop.md`**
- **`/docs/adr/ADR-147.md` 정정 6·10·14**
- `/docs/adr/ADR-071.md`(드롭 획득 히스토리)
- 코드: `packages/core/src/lib/drop-history.ts` 의 `VALUABLE_DROUGHT_TIERS` ·
  `VALUABLE_DROUGHT_LATE_HEADLINES` · `getValuableDroughtTier` ·
  `formatValuableDroughtHeadline` · `VALUABLE_DROUGHT_LATE_HEADLINE_COUNT` ·
  그 `__tests__/` · **호출부** `packages/app-rn/src/app/boss-profit/DropHistoryScreen.tsx`

## 배경

지금 구조는 **마지막 단계(4주+)에만 문구 풀**이 있고 0~3주는 한 줄 고정이다. today 의 「아이템 드롭
가뭄」 위젯이 붙으면 같은 문구를 자주 보게 되므로 **전 단계를 풀로** 바꾼다.

**기존 다섯 줄은 사용자가 직접 지정한 것**이다(그 파일 주석 — *"문구는 사용자가 직접 지정했다"*,
*"앞 둘은 사용자 지정"*). **지우지 말고 풀에 남긴다.** 이 step 은 더하는 것이지 갈아 치우는 것이 아니다.

## 작업

### 1. 타입을 풀로 넓힌다

```ts
// VALUABLE_DROUGHT_TIERS 의 각 항목
{ maxWeeks: number; headlines: readonly string[] }   // headline: string | null 이었다
```

`formatValuableDroughtHeadline(weeksSince: number, index = 0): string` — 인자 둘이 그대로 남되
`lateIndex` 가 **모든 단계에 적용되는 `index`** 가 된다. 범위를 벗어난 값은 지금처럼 감싼다
(`((index % n) + n) % n`) — 호출부가 경계를 신경 쓰지 않아도 되는 성질을 유지한다.

`VALUABLE_DROUGHT_LATE_HEADLINE_COUNT`(마지막 단계 개수)는 **단계별 개수를 묻는 함수로 바꾼다**:

```ts
export function valuableDroughtHeadlineCount(weeksSince: number): number
```

- 화면이 «이 단계의 풀 크기» 를 알아야 무작위 인덱스를 고를 수 있다. 마지막 단계만 알려 주던
  상수로는 이제 모자란다.
- **`Math.random()` 을 이 파일에 두지 마라.** 그 파일이 이미 이유를 적어 뒀다 — 순수 함수가 아니게
  되고 테스트가 값을 고정할 수 없다. 화면이 **마운트당 한 번** 고른다.

### 2. 확정 문구 (사용자 선택 2026-08-17)

| 단계 | 풀 |
|---|---|
| 0주 | `와따리! ㅇㄱㄱㄷ`(기존) · `완전 럭키비키잖아` · `폼 미쳤다` |
| 1주 | `그래, 그럴 수 있지`(기존) · `다음 주엔 되겠지` |
| 2주 | `어?! 슬슬 쫌 그래!?`(기존) · `슬슬 킹받는데` · `이게 맞나?` |
| 3주 | `선넘네?!`(기존) · `이게 억까지 뭐야` |
| 4주+ | 기존 다섯 줄 그대로 (`이건 아니지...` · `적당히 해!` · `제발 한 번만...` · `이제 기대도 안 해` · `내가 뭘 잘못했나`) |

- **순서를 지켜라** — 기존 문구가 각 풀의 첫 항목이다. 그러면 `index = 0` 일 때 지금과 같은 문구가
  나와 기존 스냅샷이 최소한으로 흔들린다.

### 3. 호출부

`DropHistoryScreen.tsx` 가 `VALUABLE_DROUGHT_LATE_HEADLINE_COUNT` 로 인덱스를 고르던 자리를
`valuableDroughtHeadlineCount(weeksSince)` 로 바꾼다. **마운트당 한 번** 고르는 성질은 그대로.

### 4. 용어 — 「물욕」을 새로 들이지 마라

[[ADR-147]] 정정 14: **화면에 보이는 한국어에서 「물욕」을 쓰지 않는다**(→ 「아이템 드롭」).
실측 결과 **지금 앱의 사용자 노출 문구에는 그 말이 한 번도 안 나온다** — `drop-history.ts` **주석**
두 줄과 설계 문서에만 있다.

- **영문 식별자는 바꾸지 마라** — `VALUABLE_DROUGHT_*` · `isValuableDrop` · `summarizeValuableDrought` ·
  `valuable-drops.json`. 코어 API 이름을 함께 바꾸면 [[ADR-038]]·[[ADR-071]] 이 건 계약이 이름만 다른
  두 벌이 된다.
- 이 step 에서 **새로 쓰는 한국어 문자열에만** 규칙이 걸린다.

## 테스트 (먼저 작성한다)

- 각 단계에서 `index = 0` 이면 **기존 문구**가 나온다(회귀 가드)
- 각 단계의 풀 크기가 `valuableDroughtHeadlineCount` 와 일치한다
- 인덱스가 범위를 벗어나도 감싸진다(음수 포함)
- `getValuableDroughtTier` 의 경계값(0·1·2·3·4)이 지금과 같다
- 4주+ 는 다섯 줄 그대로다

## 금지사항

- **기존 다섯 줄을 지우거나 바꾸지 마라.** 이유: 사용자가 직접 지정한 문구다.
- **`Math.random()` 을 `drop-history.ts` 에 넣지 마라.** 이유: 위 1번.
- **영문 식별자를 리네임하지 마라.** 이유: 위 4번.
- **`getValuableDroughtTier` 의 경계값(`maxWeeks`)을 조정하지 마라.** 이유: 그 파일이 *"경계값은 아직
  사용자 확인 전"* 이라고 적어 뒀다 — 확인 전 값을 이 step 에서 임의로 확정하지 않는다.
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

