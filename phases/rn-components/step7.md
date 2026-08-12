# Step 7: animations

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/migration/README.md` «애니메이션이 이 전환의 숨은 비용이다»**
- `/docs/features/boss-profit.md`(드랍 연출) · `/docs/features/theme.md`
- `/docs/ADR.md` 에서 **[[ADR-048]] · [[ADR-061]] · [[ADR-064]] · [[ADR-071]] · [[ADR-073]] ·
  [[ADR-074]] · [[ADR-087]] · [[ADR-102]] · [[ADR-103]]** 만 열어라
- **`packages/app-capacitor/src/index.css`** (`@keyframes` 8종의 원본 — 정독하라)
- **이전 step 산출물**: `atoms/` `molecules/` `organisms/` `templates/` 와 그 안의 **모션 미구현 목록**
  (step 3~6 의 summary 에 쌓여 있다)

## 배경

`@keyframes` 8종을 Reanimated 로 재구현한다. **1:1 변환이 아니라 재구현**이다 — CSS 는 선언 한
덩어리지만 Reanimated 는 명령형 코드이고, *"같아 보이는가"* 는 **눈으로 판정**해야 한다.

`index.css` 의 `@keyframes` (실제 목록은 파일에서 확정하라):

| 키프레임 | 쓰는 곳 | 관련 ADR |
|---|---|---|
| `maple-trail` · `maple-sweep` | 단풍잎 스피너 | 061 |
| `toast-shrink` | `Toast` 남은 시간 | 063, 064 |
| `fx-drop-float` | 드랍 연출 | 048, 103 |
| `valuable-drop-glow` · `valuable-drop-spin` · `valuable-drop-row-pulse` | 고가 드랍 표식 | 045, 046, 071 |
| (그 외 파일에서 확인) | | |

## 작업

### 1. 앞 step 들이 남긴 미완 목록을 먼저 모아라

step 3~6 의 summary 에 *"모션 미구현"* 으로 적힌 것들이 이 step 의 작업 목록이다. **그 목록과
`@keyframes` 목록이 맞는지 대조**하고, 어느 쪽에만 있는 것이 있으면 그것부터 밝혀라.

### 2. Reanimated 로 재구현

`react-native-reanimated` 는 이미 들어와 있을 수 있다(`@gorhom/bottom-sheet` 의존). 버전과 설정을
확인하고, babel 플러그인이 필요하면 step 0 이 만든 `babel.config.js` 에 얹어라.

**UI 스레드에서 돌게 하라.** RN 을 고른 이유 중 하나가 그것이다(`migration/README.md` 의존성 대응표) —
JS 가 바빠도 안 끊기는 것이 웹뷰 대비 이득이다. `useAnimatedStyle`·`withRepeat` 등을 쓰고,
`setInterval` 로 상태를 갱신하는 방식은 **쓰지 마라**(그건 웹뷰보다 나쁘다).

### 3. [[ADR-103]] 의 판정을 존중하라

드랍 연출 배율을 2배 → 1.5배로 낮춘 결정이다. **성능 때문에 내린 판정**이고 근거는 웹뷰 측정이었다.
RN 에서 그 근거가 유효한지는 다르지만, **이 step 에서 되돌리지 마라** — 값을 바꾸려면 측정이
선행돼야 하고 그건 별개 작업이다. 지금은 1.5배를 그대로 옮긴다.

### 4. [[ADR-073]]·[[ADR-074]] — pull-to-refresh 표식

step 4 가 `RefreshControl` 로 되는 부분과 안 되는 부분을 갈라 적었다. 안 되는 부분(커스텀 표식·
임계 동작)을 여기서 다룬다. `RefreshControl` 로 충분하면 **억지로 커스텀을 만들지 마라.**

### 5. 판정은 눈으로 — 그리고 그 사실을 적어라

`expo export` 나 jest 로는 *"같아 보이는가"* 를 알 수 없다. 이 step 의 AC 는 **빌드와 타입까지**이고,
실제 판정은 단계 4에서 화면이 붙은 뒤 두 앱을 나란히 놓고 하는 것이다
(`migration/README.md` «잃는 안전망»).

**summary 에 "애니메이션이 같다"고 쓰지 마라.** 쓸 수 있는 것은 *"구현했고, 육안 대조는 대기"* 까지다.

### 6. 테스트로 잡을 수 있는 것만 잡아라

애니메이션 자체는 스냅샷으로 못 잡는다. 대신 이런 것들은 잡힌다:

- 애니메이션 **on/off 조건**(예: `dropEffect` 설정이 꺼져 있으면 안 돈다 — [[ADR-040]])
- 반복 횟수·지속 시간 상수가 원본과 같은가(`index.css` 에서 읽어 비교)
- 접근성 설정(모션 줄이기)을 존중하는가 — **원본이 그랬다면**

## Acceptance Criteria

```bash
npm test           # vitest 199파일/3044개(증감 0) + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-anim-check
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

`@keyframes` 대조 — 원본 목록과 구현 목록이 맞는지 직접 확인하라:

```bash
grep -c "@keyframes" packages/app-capacitor/src/index.css
```

**iOS**: best-effort. 막히면 `blocked` + 사유.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `@keyframes` 원본 개수와 구현 개수가 맞는가? 안 맞으면 그 차이를 설명했는가?
   - 앞 step 들의 "모션 미구현" 목록이 **전부 해소**됐는가?
   - `setInterval` 로 상태를 갱신하는 방식을 쓰지 않았는가?
   - [[ADR-103]] 의 1.5배를 유지했는가?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-components/index.json` 의 step 7 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "구현한 애니메이션 목록·원본 상수와의 대조·RefreshControl 로 갈음한 것·육안 대조 대기 목록"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`setInterval`/`setTimeout` 으로 상태를 갱신해 애니메이션을 만들지 마라.** 이유: JS 스레드에서
  프레임을 만들면 웹뷰보다 나쁘다. RN 을 고른 이유가 UI 스레드 애니메이션이다.
- **[[ADR-103]] 의 연출 배율(1.5배)을 바꾸지 마라.** 이유: 측정에 근거한 판정이고, 바꾸려면 측정이
  선행돼야 한다. 이 step 은 옮기는 작업이다.
- **`RefreshControl` 로 충분한 것을 커스텀으로 다시 만들지 마라.** 이유: 플랫폼 기본 동작이 사용자
  기대에 맞고, 커스텀은 유지 비용이 든다.
- **"애니메이션이 예전과 같다"고 summary 에 쓰지 마라.** 이유: 화면이 없어 볼 수 없다. 육안 대조는
  단계 4의 몫이고, 과장하면 아무도 다시 안 본다.
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.

---

## 재개 안내 (2026-08-12 추가 — 실행이 중단됐다가 이어짐)

**모션 구현은 대부분 이미 있다.** 앞선 실행이 아래를 고친 뒤 중단됐다(**커밋 전, 작업 트리에만 있다**):

`MapleSpinner` · `MapleSweepSpinner` · `ProgressBar` · `PullToRefreshIndicator` ·
`DropEffectOverlay` · `Toast` · `lib/nativewind-interop.ts`

확인한 것:

- `setInterval`/`setTimeout` 로 프레임을 만드는 코드 **없음** ✅
- [[ADR-103]] 의 1.5배 유지 ✅
- `useReducedMotion()` 이 9곳에 배선됨(웹의 `motion-reduce:animate-none` 짝) ✅
- SVG 속성은 `useAnimatedProps`, View 스타일은 CSS API — 두 갈래인 이유가 파일 주석에 있다

### 남은 일

1. **스냅샷 10개가 낡았다.** 8개 스위트에서 실패하는데 **전부 트리 불일치이고 동작 실패는 하나도
   없다** — 애니메이션 노드가 트리에 들어와서다. 새 트리가 의도한 모양인지 확인한 뒤 갱신하라.
   (`jest -u` 로 한 번에 덮기 전에, 늘어난 노드가 실제로 애니메이션 배선인지 눈으로 보라.)
2. `@keyframes` 원본 8종과 구현 목록을 대조하라. 아직 안 온 것이 있으면 그 사실을 적어라.
3. **문서**: `docs/migration/parity-inventory.md` 의 해당 행들과 `docs/migration/README.md` 의
   «3-7단계 결과» 를 앞 단계들과 같은 형식으로 쓴다.
4. `phases/rn-components/index.json` 의 step 7 을 `completed` 로.

`src/__tests__/anim-probe.test.tsx` 는 `console.log` 만 있고 단언이 없는 조사용 임시 파일이라
지웠다. 필요하면 다시 만들되 **커밋에 남기지 마라.**

**이 단계의 판정은 여전히 눈이다.** "애니메이션이 예전과 같다"고 쓰지 마라 — 화면이 없다.
