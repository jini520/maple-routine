# Step 8: drop-screens

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/boss-profit.md`**
- **`/docs/migration/parity-inventory.md` §2.5**
- `/docs/ADR.md` 에서 아래 표의 ADR 만 열어라
- `packages/app-capacitor/src/app/boss-profit/DropHistoryScreen.tsx` · `DropPriceScreen.tsx` ·
  `DropPricePad.tsx` (**옮길 원본 3개**)
- **`packages/app-capacitor/src/index.css`** — `valuable-drop-glow` · `valuable-drop-spin` ·
  `valuable-drop-row-pulse` (**3단계가 4단계로 넘긴 `@keyframes` 셋**)
- `packages/app-rn/src/__tests__/keyframes-parity.test.ts` (**그 셋을 «화면 몫» 으로 적어 둔 표**)
- **이전 step 산출물**: step 6 의 하위 9개 · step 7 의 화면 · `src/components/**`

## 배경 — 이 step 이 4단계의 마지막이고, **남은 모션 셋을 닫는다**

| 파일 | ADR 계약 |
|---|---|
| `DropHistoryScreen` | 010, 045, 046, 062, 069, 071, 077, 120 |
| `DropPriceScreen` | 046, 063, 124 |
| `DropPricePad` | 046, 121 |

3단계 step 7 이 `@keyframes` 7종 중 넷을 옮기고 **셋을 여기로 넘겼다.** 갈린 기준은 난이도가
아니라 *"그 애니메이션이 붙는 요소가 어느 계층에 사는가"* 였다 — 이 셋은 전부
`app/boss-profit/*` 의 카드·행에만 붙어 컴포넌트 계층에 쓰는 자리가 하나도 없었다.

## 작업

### 1. `@keyframes` 셋을 Reanimated 로 — **3단계가 세운 방식을 그대로 따르라**

- **View 스타일은 Reanimated CSS API, SVG 속성은 `useAnimatedProps`** (3단계가 확정한 두 갈래).
- **`setInterval`/`setTimeout` 으로 프레임을 만들지 마라.** RN 을 고른 이유가 UI 스레드
  애니메이션이다 — JS 스레드에서 프레임을 만들면 웹뷰보다 나쁘다.
- **`useReducedMotion()` 을 배선하라**(웹의 `motion-reduce:animate-none` 짝). 3단계가 9곳에 했다.
- **지속시간·이징을 손으로 적지 마라.** `keyframes-parity.test.ts` 가 `index.css` 를 **읽어**
  대조하는 방식을 만들어 뒀다 — 셋을 그 표의 «화면 몫» 에서 «이식» 쪽으로 옮기고 같은 방식으로 잇는다.

이 step 이 끝나면 **`keyframes-parity.test.ts` 의 «화면 몫» 이 비어야 한다.** 안 비면 왜인지 적어라.

### 2. [[ADR-045]]·[[ADR-046]]·[[ADR-071]] — 고가 드랍 표식

`ValuableDropBadge`(molecule)가 3단계에 있고, 그때 *"모션은 이 배지에 없다 — `@keyframes` 셋은 전부
카드·행 쪽"* 이라고 적어 뒀다. **여기가 그 카드·행이다.** 배지를 다시 만들지 말고 **배치하고
모션을 그 주변에 건다.**

### 3. [[ADR-124]] 가 `DropPriceScreen` 에 걸려 있다

**가격 미입력은 0원이 아니다.** 이 화면은 사용자가 값을 넣는 자리라 그 구분이 가장 직접적으로
드러난다 — 빈 칸을 `0` 으로 저장하거나, `0` 을 빈 칸으로 보여주지 마라. step 6·7 과 같은 계약이다.

### 4. `DropPricePad` — [[ADR-121]] 숫자 입력

RN 키보드로 갈리는 것을 확인하라(숫자 키패드 타입 · 소수점 · 큰 수). `PartySizeStepper` 와 같은
[[ADR-121]] 이지만 **다른 결정**이다 — 해당 절을 읽어라.

### 5. [[ADR-010]] — 히스토리 보존 범위

`DropHistoryScreen` 이 «전 기간» 을 본다. 데이터는 SQLite 에 있고 어댑터는 1단계에 있다.
**쿼리를 화면에서 새로 짜지 말고** core 가 주는 것을 써라.

### 6. 4단계를 닫는 문서 작업

이 step 이 마지막이므로 다음을 함께 하라:

- `docs/migration/parity-inventory.md` §2 의 각 표에 **«확인» 열**을 3단계 §3 과 같은 형식으로 채워라
  (step 0~8 이 각자 적은 결과를 모은다).
- `docs/migration/README.md` 에 **«4단계 결과»** 를 3단계 절들과 같은 형식으로 쓰고,
  **5단계(실기기 검증·롤아웃)로 넘어가는 데 필요한 것**을 적어라.
- `docs/adr/ADR-128.md` 의 상태 줄을 **«단계 0~4 구현 완료»** 로 갱신하라.

## Acceptance Criteria

```bash
npm test           # vitest 증감 0 + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-drop-check
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

`@keyframes` 가 남김없이 처리됐는지:

```bash
grep -c "@keyframes" packages/app-capacitor/src/index.css   # 7
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 3개가 다 있는가? 각 행의 ADR 을 전부 읽고 확인했는가?
   - **`keyframes-parity.test.ts` 의 «화면 몫» 이 비었는가?** 안 비었으면 이유를 적었는가?
   - `setInterval`/`setTimeout` 로 프레임을 만들지 않았는가?
   - `useReducedMotion()` 이 배선됐는가?
   - **[[ADR-124]] 가 가격 입력 화면에서 지켜지는가?**
   - 4단계 마무리 문서 셋을 다 했는가?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-screens/index.json` 의 step 8 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 3개·모션 셋 처리·keyframes 표 상태·ADR-124 처리·문서 갱신 결과·5단계로 넘길 것"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`setInterval`/`setTimeout` 으로 애니메이션을 만들지 마라.** 이유: JS 스레드 프레임은 웹뷰보다
  나쁘다. RN 을 고른 이유가 UI 스레드 애니메이션이다.
- **지속시간·이징을 손으로 베껴 적지 마라.** 원본(`index.css`)을 읽어 대조하는 장치가 이미 있다.
- **빈 값을 `0` 으로 저장하거나 `0` 을 빈 칸으로 보여주지 마라.** ([[ADR-124]])
- **`ValuableDropBadge` 를 다시 만들지 마라.** 3단계에 있다.
- **"애니메이션이 예전과 같다"고 summary 에 쓰지 마라.** 육안 대조는 사람 몫이다.
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.

---

## 재개 안내 (2026-08-13 추가 — 실행이 중단됐다가 이어짐)

**코드는 다 있고 통과한다.** 앞선 실행이 아래를 만든 뒤(커밋 전, 작업 트리) 중단됐다:

- `DropHistoryScreen` · `DropPriceScreen` · `DropPricePad` (+ 각 테스트)
- `ValuableRowBackground.tsx` · `valuable-row-glow.ts` (모션 셋의 두 번째 호출부)
- `keyframes-parity.test.ts` · `BossDropSheet` · `BossProfitBossRow` · `RootNavigator` · `icons.ts` 수정

확인했다: **jest 109스위트/1382개 전부 통과 · `tsc --noEmit` 통과 ·
`keyframes-parity.test.ts` 의 `screenLayer` 가 비었다.** `degraded` 칸이 새로 생겨
`valuable-drop-spin` 이 [[ADR-045]] 의 기설계 폴백(정적 골드 테두리)으로 갔다는 것도 적혀 있다.

### 남은 것은 **문서와 마무리**뿐이다 (본문 «작업 6»)

1. `docs/migration/README.md` 에 **«4-8단계 결과»** 를 쓴다 — 4-0~4-7 이 이미 그 형식으로 있으니
   그대로 따르라. 모션 셋이 어디로 갔는지(둘은 이식, `valuable-drop-spin` 은 degrade)와 그 근거,
   육안 대조 목록을 담아라.
2. `docs/migration/README.md` 에 **«4단계 결과»**(단계 전체를 닫는 절)를 쓰고,
   **5단계(실기기 검증·롤아웃)로 넘어가는 데 필요한 것**을 적어라.
3. `docs/migration/parity-inventory.md` §2.5 의 세 화면(`DropHistoryScreen`·`DropPriceScreen`·
   `DropPricePad`) **«확인» 열**을 채워라(§2.6 등 앞 절과 같은 형식).
4. **`docs/adr/ADR-128.md` 의 상태 줄을 «단계 0~4 구현 완료» 로 갱신하라.** 지금 «0~3» 이다.
   `docs/ADR.md` 인덱스 줄도 함께 보라.
5. `phases/rn-screens/index.json` 의 step 8 을 `completed` 로.

**코드를 다시 쓰지 마라.** 이미 통과했고, 다시 쓰면 통과한 것을 되돌릴 위험만 있다.
정말로 틀린 것을 발견하면 고치되 그 사실을 summary 에 적어라.
