# Step 6: templates

## 읽어야 할 파일

- `/docs/README.md` · `/docs/foundation/design-system.md`
- **`/docs/migration/parity-inventory.md` §3** (templates 표)
- `/docs/ADR.md` 에서 **[[ADR-077]] · [[ADR-085]] · [[ADR-088]] · [[ADR-092]] · [[ADR-094]] ·
  [[ADR-098]] · [[ADR-099]] · [[ADR-112]] · [[ADR-120]] · [[ADR-123]] · [[ADR-047]]** 만 열어라
- `packages/app-capacitor/src/components/templates/**` (**옮길 원본 4개**)
- `packages/app-rn/src/native/adapters/not-implemented.ts` (`SystemBarsPort` 가 던지고 있다)
- **이전 step 산출물**: `atoms/` `molecules/` `organisms/` · 내비게이션 골격 · `ThemeProvider`

## 배경

| 컴포넌트 | ADR 계약 | RN 에서 |
|---|---|---|
| `PageHeader` | 047, 077, 085, 088, 094, 098, 112, 123 | 그대로 옮긴다 |
| `ScreenScroll` | 077, 088, 098, 099, 120 | `ScrollView`/`FlashList` 로 |
| `StackScreen` | 077, 092, 094, 120 | **대부분 삭제** — 네이티브 스택이 대체 |
| `ThemeHeaderBackdrop` | 088 | 그대로 옮긴다 |

**이 step 이 `SystemBarsPort` 를 해소한다.** 지금 RN 구현이 *"단계 3에서 재설계된다"* 며 던지고 있다 —
`refreshSafeAreaInsets()` 가 `--safe-area-inset-*` **CSS 변수를 주입**하던 것인데, RN 은
`react-native-safe-area-context` 가 값을 **컴포넌트로 내려준다.** 주입할 대상이 없다.

## 작업

### 1. 안전영역을 CSS 변수에서 컴포넌트로

`SafeAreaProvider`/`useSafeAreaInsets` 로 바꾼다. 웹에서 그 값을 읽던 자리([[ADR-098]]·[[ADR-107]] 등)를
찾아 대응시켜라.

`SystemBarsPort` 의 두 메서드를 각각 판단하라:

- `refreshSafeAreaInsets()` — RN 에는 대상이 없다. **없앨지, no-op 으로 둘지, 계속 던지게 둘지**
  정하고 근거를 적어라
- `setNavigationBarStyle(isDarkTheme)` — 하단 시스템 내비 바 명암. RN 에서 되는 수단이 있으면
  구현하고, 없으면 그 사실을 적어라

**포트 인터페이스를 바꾸지 마라**(`packages/core`).

### 2. `ScreenScroll` — [[ADR-099]] 가 정한 "스크롤의 소유자"

*"스크롤의 소유자를 문서에서 화면으로 옮긴다"* 가 그 결정이다. RN 은 원래 화면이 스크롤을 소유하므로
**구조가 자연스럽게 맞는다.** 다만 그 결정에 딸린 것들을 놓치지 마라:

- 스크롤 인디케이터 색 — 웹에서는 `scrollbarColor` 로 풀었고(실기기에서 흰 인디케이터 관측),
  RN 에서는 `indicatorStyle` prop 이다. **모드에 따라 갈려야 한다**
- 헤더 스페이서 동기화([[ADR-112]]·[[ADR-123]])

리스트 성능이 문제되는 화면은 단계 4에서 `FlashList` 로 갈 수 있다. **여기서 미리 최적화하지 마라** —
어느 화면이 무거운지는 화면이 붙어야 안다.

### 3. `StackScreen` — 대부분 버린다

[[ADR-120]] 의 포털 오버레이 구현이다. 네이티브 스택이 그 일을 하므로 **옮기지 마라.** 다만 그
컴포넌트가 갖고 있던 것 중 **화면 구성 책임**([[ADR-094]] 3단계 구조)이 있으면 그것만 남겨라.

무엇을 버리고 무엇을 남겼는지 summary 에 적어라.

### 4. `PageHeader` — ADR 8개

가장 무거운 template 이다. [[ADR-085]](헤더 콘텐츠)·[[ADR-088]](배경)·[[ADR-112]]·[[ADR-123]](스페이서
동기화)·[[ADR-047]](스티키 동작)이 겹친다. 하나씩 확인하라.

### 5. 계층 규칙

templates 는 최상위다 — atoms·molecules·organisms 를 쓸 수 있다. 반대 방향이 없는지 테스트가 잡는다.

## Acceptance Criteria

```bash
npm test           # vitest 199파일/3044개(증감 0) + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-tpl-check
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

`SystemBarsPort` 처리 확인:

```bash
grep -n "SystemBars" packages/app-rn/src/native/adapters/not-implemented.ts
grep -n "setSystemBarsPort" packages/app-rn/src/boot.ts
```

**iOS**: best-effort. 막히면 `blocked` + 사유.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 4개가 처리됐는가(`StackScreen` 은 "대부분 버림"도 처리다)?
   - `PageHeader` 의 ADR 8개를 하나씩 확인했는가?
   - 스크롤 인디케이터가 **모드에 따라 갈리는가**? ([[ADR-099]])
   - `SystemBarsPort` 를 어떻게 했는지 근거가 있는가?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-components/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "4개 처리 결과·SystemBarsPort 판단과 근거·StackScreen 에서 버린 것과 남긴 것·안전영역 대응"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`StackScreen` 의 포털 오버레이 구현을 옮기지 마라.** 이유: 네이티브 스택이 OS 수준에서 하는
  일이고, 옮기면 둘이 싸운다([[ADR-120]] 구현은 폐기 대상이다).
- **리스트를 미리 최적화하지 마라**(`FlashList` 전면 도입 등). 이유: 어느 화면이 무거운지는 단계 4에서
  화면이 붙어야 안다. 미리 하면 근거 없는 복잡도만 남는다.
- **`SystemBarsPort` 를 조용한 no-op 으로 만들지 마라.** 이유: 없앨 거면 없애고, 남길 거면 이유를
  말하며 던지게 하라. 조용한 no-op 은 "안 되는 것"과 "안 부른 것"을 구분 못 하게 한다.
- **포트 인터페이스를 바꾸지 마라**(`packages/core`).
- **모션을 여기서 구현하지 마라.** step 7 대상이다.
- 기존 테스트를 깨뜨리지 마라.
