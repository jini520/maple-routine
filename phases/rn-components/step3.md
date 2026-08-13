# Step 3: atoms

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- **`/docs/foundation/design-system.md`** (기본 컴포넌트 정의 — 정독)
- **`/docs/migration/parity-inventory.md` §3** (컴포넌트별 ADR 계약표)
- `/docs/ADR.md` 에서 아래 표의 ADR 만 열어라. 전체를 올리지 말 것
- `packages/app-capacitor/src/components/atoms/**` (**옮길 원본 9개**)
- `packages/app-capacitor/src/components/__tests__/layer-dependencies.test.ts` (계층 의존 강제 규칙)
- **이전 step 산출물**: NativeWind 설정 · `ThemeProvider` · 스냅샷 관례 · 내비게이션 골격

## 배경

아토믹 4계층의 맨 아래부터 옮긴다. **의존 방향이 테스트로 강제**돼 있어(atoms ← molecules ←
organisms ← templates) 역순으로 가면 매 step 이 깨진다.

| 컴포넌트 | ADR 계약 |
|---|---|
| `AnimatedMeso` | 046, 087 |
| `Badge` | 094 |
| `Button` (+ `variants.ts`) | 094 |
| `Card` | 094 |
| `DifficultyBadge` | — |
| `MapleSpinner` | — |
| `MapleSweepSpinner` | 061 |
| `ProfitIcon` | 066 |
| `ProgressBar` | 061, 094 |

**한 컴포넌트를 끝냈다는 것은** 화면에 같은 것을 그리는 것에 더해 **그 행의 ADR 을 전부 다시 읽고
해당 동작이 새 코드에 있음을 확인했다**는 뜻이다(`migration/README.md` 원칙 2).

## 작업

### 1. 아토믹 계층 규칙을 RN 에서도 지켜라

`packages/app-rn/src/components/atoms/` 에 둔다. 배치·명명은 `app-capacitor` 를 그대로 따르라.

**계층 의존 테스트를 RN 쪽에도 만들어라.** 웹 쪽 `layer-dependencies.test.ts` 를 읽고 같은 규칙을
강제하는 테스트를 두어라 — 이 규율이 없으면 단계 4에서 화면이 붙을 때 계층이 무너진다.

### 2. 애니메이션이 있는 둘은 **골격만**

`MapleSweepSpinner`([[ADR-061]])와 `AnimatedMeso`([[ADR-087]])는 CSS `@keyframes`·전환에 의존한다.
**여기서는 정적 형태와 props 계약까지만** 만들고, 실제 모션은 **step 7(animations)** 에서 붙여라.

움직이지 않는다는 사실을 주석에 적고 summary 에도 적어라. **움직이는 것처럼 보이게 흉내 내지 마라.**

### 3. `className` 은 되도록 그대로

NativeWind 를 고른 이유가 이것이다. 웹에서 쓰던 유틸리티 클래스가 RN 에서 안 먹는 경우에만 대체하고,
**대체한 목록을 summary 에 남겨라** — step 4~6 이 같은 문제를 만난다.

### 4. RN 트리 스냅샷

step 0 이 정한 관례대로 각 컴포넌트의 `toJSON()` 스냅샷을 찍는다. 변형(variant)이 있으면 주요 변형별로.

**이 스냅샷은 "예전과 같은가"에 답하지 않는다.** 새 기준선일 뿐이다 — 주석에 적어라.

### 5. 원본을 지우지 마라

`packages/app-capacitor/src/components/atoms/` 는 **그대로 둔다.** 그 앱은 계속 배포된다
(`migration/README.md` 원칙 3).

## Acceptance Criteria

```bash
npm test           # vitest 199파일/3044개(증감 0) + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-atoms-check
```

계층 규칙 확인 — atoms 는 **아무 상위 계층도 import 하지 않아야 한다**:

```bash
grep -rnE "from '.*(molecules|organisms|templates)/" packages/app-rn/src/components/atoms | grep -v __tests__
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 9개가 전부 있는가?
   - 각 컴포넌트의 **ADR 을 전부 읽고 확인했는가**? summary 에 그 결과를 적었는가?
   - 계층 의존 테스트가 RN 쪽에 있고 통과하는가?
   - `packages/core` 나 `packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-components/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 9개·ADR 확인 결과·대체한 className 목록·모션 미구현 2개"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

**"디자인이 예전과 같다"고 쓰지 마라.** 화면이 없어 볼 수 없다. 확인한 것은 렌더 트리와 타입까지다.

## 금지사항

- **`packages/app-capacitor` 의 원본을 지우거나 고치지 마라.** 이유: 그 앱은 패리티까지 계속 배포된다.
- **`MapleSweepSpinner`·`AnimatedMeso` 의 모션을 여기서 구현하지 마라.** 이유: step 7 이 `@keyframes`
  8종을 한꺼번에 다룬다. 여기서 따로 만들면 두 벌이 되고 판정 기준도 갈린다.
- **움직여야 할 것을 정적인 채로 두고 "완료"라고 쓰지 마라.** 이유: 단계 4에서 화면이 붙을 때
  아무도 그것이 미완인 줄 모른다. 주석과 summary 양쪽에 적어라.
- **계층 의존을 어기지 마라**(atoms 가 molecules 이상을 import). 이유: 테스트로 강제되는 규칙이고,
  무너지면 단계 4에서 되돌리기가 훨씬 비싸다.
- **`packages/core` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
