# Step 7: rn-port-wiring

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` — 단계 3(내비게이션 + `components/`)에 무엇이 남는지
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-120]] · [[ADR-104]] · [[ADR-064]] · [[ADR-099]]** 만 열어라
- `packages/core/src/native/ports.ts` — **`ThemeAppearancePort` · `SystemBarsPort` ·
  `BackGesturePort` 의 주석을 특히 정독하라**
- `packages/core/src/storage/ports.ts` (주입 계약)
- `packages/app-capacitor/src/main.tsx` (**포트 주입 지점의 참조 구현 — 순서가 중요하다**)
- `packages/app-capacitor/src/native/adapters/index.ts`
- **이전 step 산출물**: `packages/app-rn/src/{storage,native}/adapters/` 의 어댑터 9종

## 배경

이 step 은 두 가지를 한다.

1. **RN 으로 매핑되지 않는 포트 3종**을 명시적 미구현으로 채운다
2. **부팅 배선**을 완성한다 — 어댑터 9종 + 미구현 3종을 주입하는 자리

### 매핑되지 않는 3종과 그 이유

| 포트 | 왜 매핑이 안 되나 | 언제 해결되나 |
|---|---|---|
| `ThemeAppearancePort` | `apply()` 가 **34개 CSS 토큰을 `<style>` 에 주입**하고 `data-theme`·`color-scheme`·`scrollbar-color` 를 문서에 건다. RN 에는 CSS 도 DOM 도 없고, **테마는 side-effect 가 아니라 React 상태로 적용된다** | 단계 3 (뷰 레이어) |
| `SystemBarsPort` | `refreshSafeAreaInsets()` 가 `--safe-area-inset-*` **CSS 변수를 주입**한다. RN 은 `react-native-safe-area-context` 가 값을 컴포넌트로 내려준다 — 주입할 대상이 없다 | 단계 3 |
| `BackGesturePort` | [[ADR-120]] 이 손으로 만든 것을 **react-navigation 네이티브 스택이 OS 수준에서 한다.** 어댑터가 아니라 내비게이션 구조의 문제다 | 단계 3 |

**억지로 구현하지 마라.** 지금 만들면 뷰가 붙는 순간 전부 버려지고, 그 사이에 "구현이 있으니 됐다"는
착시만 남는다.

## 작업

### 1. 미구현 3종을 **던지는 구현**으로 채워라

`packages/app-rn/src/native/adapters/not-implemented.ts` (이름은 재량).

각 포트의 모든 메서드가 **명확한 메시지와 함께 던지게** 하라.

```
ThemeAppearancePort는 RN에서 아직 구현되지 않았습니다 —
테마 적용은 단계 3(뷰 레이어)에서 React 상태로 재설계됩니다. docs/migration/README.md 참고.
```

**조용한 no-op 으로 두지 마라.** 포트 설계 철학이 그렇다(`ports.ts` 주석: *"주입 전 접근은 조용히
넘어가지 않고 던진다 — no-op 으로 두면 '이 플랫폼엔 그 기능이 없다'와 '포트가 없다'가 구분되지 않아,
스플래시가 안 걷히거나 광고가 안 뜨는 것이 정상 동작처럼 보인다"*). 나중에 테마가 안 먹힐 때
**원인이 즉시 드러나야 한다.**

> step 6 의 `SplashScreenPort.show()` no-op 과 혼동하지 마라. 그쪽은 "이 플랫폼에 그 개념이 없다"라
> 정당한 no-op 이고, 이쪽은 "해야 하는데 아직 안 했다"라 던져야 한다.

### 2. 부팅 배선 모듈

`packages/app-rn/src/boot.ts` (이름은 재량). `main.tsx` 의 참조 구현을 읽고 **같은 순서**를 지켜라.

```ts
export function installPorts(): void {
  setPreferencesPort(rnPreferencesPort)
  setSqlitePort(rnSqlitePort)
  setAdsPort(rnAdsPort)
  // ... 9종
  setThemeAppearancePort(notImplementedThemeAppearancePort)
  // ... 미구현 3종
}
```

**순서가 중요하다.** app-capacitor 는 저장소를 처음 만지는 코드보다 **앞에서** 주입한다. RN 앱도
`App.tsx` 가 렌더되기 전에 `installPorts()` 가 끝나야 한다 — `index.ts` 진입점에서 부르는 것이 안전하다.

### 3. `App.tsx` 에서 배선을 실제로 쓰게 하라

지금 `App.tsx` 는 core 의 **순수 모듈만** 부른다(이전 task step 8). 여기에 **포트를 실제로 거치는
호출 하나**를 더해 배선이 도는 것을 증명하라.

권장: `ColorSchemePort` (동기이고, 저장소·네이티브 권한이 필요 없고, 실패해도 무해하다). 화면에
현재 색 구성을 찍어라.

**저장소나 광고를 부르지 마라** — 시뮬레이터 없이 번들만 만드는 검증에서는 확인할 수 없고, 실패하면
원인이 배선인지 어댑터인지 갈리지 않는다.

### 4. jest 로 테스트할 것

- `installPorts()` 후 각 포트의 `get*Port()` 가 던지지 않는가 (12종 전부)
- 미구현 3종의 메서드를 부르면 **던지는가**, 그리고 메시지에 "단계 3" 안내가 있는가
- `__resetNativePortsForTest()` / `__resetStoragePortsForTest()` 로 되돌릴 수 있는가

## Acceptance Criteria

```bash
npm test           # vitest 3044 + jest 전부 통과
npm run build
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
```

**번들 생성 — 이 step 의 핵심 검증**:

```bash
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-export-wiring
```

어댑터 9종이 전부 번들에 들어가야 한다. `Unable to resolve module` 이 나면 배선이 빠진 것이다.

```bash
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

**iOS**: best-effort. 막히면 `blocked` + 사유.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 미구현 3종이 **던지는가**? (조용한 no-op 이 아닌가)
   - 던지는 메시지에 **단계 3 안내**가 있는가?
   - `installPorts()` 가 `App.tsx` 렌더보다 **먼저** 불리는가?
   - `packages/core` 를 수정했는가? **했다면 잘못된 것이다**
   - `packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-adapters/index.json` 의 step 7 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "배선 모듈 경로·주입 순서·미구현 3종 처리 방식·expo export 결과"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

**summary 에 "RN 앱이 동작한다"고 쓰지 마라.** 확인한 것은 번들이 만들어지고 배선이 던지지 않는
것까지다. 실기기 동작은 단계 2의 게이트다.

## 금지사항

- **미구현 3종을 조용한 no-op 으로 두지 마라. 던지게 하라.** 이유: 나중에 테마가 안 먹힐 때 원인을
  못 찾는다. 포트 설계가 이미 이 판단을 하고 있다(`ports.ts` 주석).
- **`ThemeAppearancePort`·`SystemBarsPort`·`BackGesturePort` 를 억지로 구현하지 마라.** 이유: RN 에서
  테마는 side-effect 가 아니라 React 상태이고, 안전영역은 컴포넌트로 내려오며, 뒤로가기는
  react-navigation 이 소유한다. 지금 만든 것은 단계 3에서 전부 버려진다.
- **`App.tsx` 에서 저장소·광고 포트를 부르지 마라.** 이유: 번들만 만드는 검증에서는 확인할 수 없고,
  실패 시 원인이 배선인지 어댑터인지 갈리지 않는다.
- **`packages/core` 나 `packages/app-capacitor` 를 수정하지 마라.** 이유: 이 task 는 app-rn 에만
  더한다. 앞선 task 가 확보한 "vitest 3044개 통과" 상태를 건드릴 이유가 없다.
- **화면이나 내비게이션을 만들지 마라.** 이유: 단계 3 대상이고, 각 화면은
  `migration/parity-inventory.md` 의 ADR 계약 체크리스트를 소진하며 진행해야 한다.
- 기존 테스트를 깨뜨리지 마라.
