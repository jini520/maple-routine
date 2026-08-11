# Step 5: organisms

## 읽어야 할 파일

- `/docs/README.md` · `/docs/foundation/design-system.md`
- **`/docs/migration/parity-inventory.md` §3**
- `/docs/features/onboarding.md`(피커) · `/docs/features/boss-profit.md`(드롭 시트·연출)
- `/docs/ADR.md` 에서 아래 표의 ADR 만 열어라
- `packages/app-capacitor/src/components/organisms/**` (**옮길 원본 10개**)
- **이전 step 산출물**: `atoms/**` · `molecules/**` · 계층 의존 테스트 · `className` 대체 목록

## 배경 — 이 task 에서 가장 무거운 step 이다

| 컴포넌트 | ADR 계약 |
|---|---|
| `BottomSheet` | 038, 039 |
| `CharacterTrackingPicker` | **016, 017, 043, 053, 062, 067, 086, 107, 114, 115, 122** |
| `CharacterTrackingPicker/CharacterTrackingGrid` | 015, 035, 054, 068, 107 |
| `DropEffectOverlay` | 038, 039, 048, 064, 103 |
| `ErrorBoundary` | 065, 117 |
| `Modal` | 065, 094, 122 |
| `PartySizeModal` | 018, 064, 121, 122 |
| `ProgressModal` | 016 |
| `Toast` (+ `ToastStack`) | 063, 064 |

**`CharacterTrackingPicker` 만 ADR 11개다.** 다른 컴포넌트와 같은 취급을 하지 말고 **단독으로 계획을
세우고 시작하라** — 계정 전환 이력([[ADR-086]])·안전영역([[ADR-107]])·API 키 재입력([[ADR-114]]·
[[ADR-115]]) 같은 서로 다른 축이 한 컴포넌트에 겹쳐 있다.

## 작업

### 1. `BottomSheet` — `vaul` → `@gorhom/bottom-sheet`

[[ADR-039]] 가 정한 동작(스냅 포인트·드래그·닫힘 조건)을 읽고 **그대로 재현하라.** 라이브러리
기본값이 다르면 기본값이 아니라 [[ADR-039]] 를 따른다.

`vitest.setup.ts` 에 `vaul` 때문에 넣은 jsdom 폴리필들이 있다 — RN 에는 불필요하다. **웹 쪽 설정을
건드리지 마라.**

### 2. `Modal` — [[ADR-122]] 모드 분기가 여기 있다

*"같은 토큰이 모드에 따라 반대 역할을 하는 자리"* 가 스크림 위 패널 테두리다. step 1 이 만든 모드
분기 수단을 여기서 쓴다. **테마 이름으로 분기하지 마라.**

### 3. `DropEffectOverlay` — 정적 형태까지만

[[ADR-048]]·[[ADR-103]] 의 드랍 연출이다. `fx-drop-float` 등 `@keyframes` 에 의존하므로 **모션은
step 7**. 여기서는 구조·레이어·props 계약까지만 만들고 미완을 주석·summary 에 적어라.

[[ADR-103]] 이 연출 배율을 2배 → 1.5배로 낮춘 결정이라는 점을 놓치지 마라 — 성능 때문에 내린
판정이고, RN 에서 되살릴 때 그 근거가 유효한지는 step 7 에서 볼 일이다.

### 4. `ErrorBoundary` — [[ADR-117]] 과 얽혀 있다

OTA 적용 경로의 실패 처리와 연결된다([[ADR-065]]·[[ADR-117]]). RN 에는 웹뷰 리로드가 없으므로
**무엇이 대응되고 무엇이 대응되지 않는지 갈라 적어라.** 억지로 옮기지 마라.

### 5. `Toast` — [[ADR-063]] 문구·수명

`toast-shrink` `@keyframes` 로 남은 시간을 그린다. 모션은 step 7, 여기서는 구조까지.

### 6. 필요하면 이 step 을 쪼개라

10개가 한 커밋에 들어가면 실패 시 원인 분리가 안 된다. **`CharacterTrackingPicker` 를 먼저 끝내고
따로 커밋한 뒤 나머지로 가는 것**을 권한다. 쪼갠 경우 그 사실을 summary 에 적어라.

## Acceptance Criteria

```bash
npm test           # vitest 199파일/3044개(증감 0) + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-org-check
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

(`@gorhom/bottom-sheet` 가 `react-native-reanimated`·`react-native-gesture-handler` 를 끌어오므로
네이티브 빌드가 필요하다.)

계층 규칙 — organisms 는 templates 를 import 하지 않아야 한다:

```bash
grep -rnE "from '.*templates/" packages/app-rn/src/components/organisms | grep -v __tests__
```

**iOS**: best-effort. 막히면 `blocked` + 사유.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 10개가 전부 있는가?
   - **`CharacterTrackingPicker` 의 ADR 11개를 하나씩 확인했는가?** summary 에 그 결과가 있는가?
   - `Modal` 의 모드 분기를 **테마 이름으로 하지 않았는가**?
   - `BottomSheet` 가 [[ADR-039]] 동작을 따르는가(라이브러리 기본값이 아니라)?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-components/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 10개·CharacterTrackingPicker ADR 11개 확인 결과·BottomSheet 동작 대조·ErrorBoundary 미대응분·모션 미구현 목록·쪼갰다면 그 사실"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`CharacterTrackingPicker` 를 다른 컴포넌트와 같은 속도로 처리하지 마라.** 이유: ADR 11개가
  서로 다른 축이라, 한꺼번에 훑으면 반드시 몇 개를 놓친다.
- **모션을 여기서 구현하지 마라.** step 7 대상이다.
- **라이브러리 기본값이 ADR 과 다를 때 기본값을 택하지 마라.** 다르면 ADR 을 따르고, 못 따르겠으면
  **summary 에 적어라.**
- **`Modal` 모드 분기를 테마 이름으로 하지 마라.** 이유: [[ADR-064]] 결정 8이 폐기한 수동 목록이 되살아난다.
- **`vitest.setup.ts` 등 웹 테스트 설정을 건드리지 마라.**
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
