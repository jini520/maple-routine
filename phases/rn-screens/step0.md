# Step 0: app-shell

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- **`/docs/migration/README.md`** — 특히 «4단계», «잃는 안전망», «되돌릴 수 없는 지점»
- **`/docs/migration/parity-inventory.md` §2.1** (최상위 표)
- `/docs/ADR.md` 에서 **[[ADR-128]] · [[ADR-065]] · [[ADR-090]] · [[ADR-107]] · [[ADR-117]] ·
  [[ADR-119]] · [[ADR-126]] · [[ADR-027]] · [[ADR-061]] · [[ADR-125]] · [[ADR-114]] · [[ADR-115]] ·
  [[ADR-116]]** 만 열어라
- **`packages/app-capacitor/src/App.tsx` (573줄 — 정독하라)**
- `packages/app-capacitor/src/app/ApiKeyNoticeModal.tsx` · `UpdatePromptModal.tsx`
- **이전 단계 산출물**: `packages/app-rn/App.tsx` · `src/navigation/**` · `src/theme/**` ·
  `src/components/**`(atoms·molecules·organisms·templates 34개) · `src/boot.ts`

## 배경

3단계가 세운 것은 **골격**이다. `packages/app-rn/App.tsx` 는 지금 셋만 한다 —
`SafeAreaProvider` → `ThemeProvider` → `AppNavigation`, 그리고 `restoreFromStorage()` 하나.

웹의 짝인 `AppShell`(573줄)은 그 외에도 **예열 · 스플래시 · OTA · 안전영역 · 키보드 · 광고 초기화**
를 들고 있다. 3단계가 *"아직 없는 화면을 전제한 순서를 굳히게 된다"* 며 미뤄 둔 것이 이 step 이다.

**순서가 이 파일의 실질이다.** 무엇을 언제 부르는지가 화면보다 중요하다 — 스플래시를 언제 걷는가,
OTA 확인을 언제 하는가, 광고를 언제 초기화하는가가 서로 얽혀 있고, 잘못된 순서는 *"흰 화면"* ·
*"스플래시가 안 걷힘"* · *"광고가 안 뜸"* 으로만 드러난다.

## 작업

### 1. `App.tsx` 를 읽고 **순서를 먼저 표로 뽑아라**

코드를 쓰기 전에, 웹이 무엇을 어떤 순서로 하는지 목록을 만들어라. 각 항목마다 세 가지를 적어라:

- **RN 에 그대로 있는가** (예: 스플래시 — `SplashScreenPort` 가 이미 있다)
- **RN 에서 사라지는가** (예: 웹뷰 리로드 · `--safe-area-inset-*` CSS 변수 주입)
- **RN 에서 다른 것으로 바뀌는가** (예: 키보드 — 웹은 `visualViewport`, RN 은 `KeyboardAvoidingView`)

그 표를 summary 와 커밋 메시지에 남겨라. **이 step 의 산출물 중 가장 오래 쓰이는 것이 그 표다.**

### 2. 포트는 이미 있다 — 새로 만들지 마라

1·2단계가 13개 포트를 다 배선했다(`src/boot.ts`). 스플래시·상태바·키보드·광고·알림은
**부르기만 하면 된다.** 어댑터를 여기서 다시 쓰지 마라.

**`LiveUpdatePort` 는 아직 던진다.** [[ADR-128]] 결정 7 이 OTA 프로토콜 재설계를 별도 ADR 로
미뤄 뒀기 때문이다. 그래서 `UpdatePromptModal` 은 **화면은 만들되 실제 확인 경로를 부르지 마라** —
부르면 부팅이 죽는다. 무엇을 만들었고 무엇이 안 이어졌는지 갈라 적어라.

### 3. `ApiKeyNoticeModal` · `UpdatePromptModal`

- `ApiKeyNoticeModal` — [[ADR-114]]·[[ADR-115]]·[[ADR-116]]. API 키 재입력 경로다.
- `UpdatePromptModal` — [[ADR-027]]·[[ADR-119]]·[[ADR-126]]·[[ADR-117]]. **[[ADR-126]] 결정 1**
  (받기 전엔 모달 안 아코디언 · 받은 뒤엔 개발 노트 화면으로)과 **결정 4**(마지막 실행 번들 버전
  하나로 완료 안내 판정)를 읽어라. 위 2 때문에 데이터가 안 흐르는 부분이 있다.

두 모달은 3단계의 `Modal` organism 위에 선다. **새로 만들지 마라.**

### 4. [[ADR-065]] 전역 에러 바운더리 · [[ADR-117]]

`ErrorBoundary` organism 은 3단계에 있다. 그것을 **어디에 두는가**가 이 step 의 결정이다 —
웹은 웹뷰 리로드로 복구했지만 RN 에는 그 수단이 없다. 3단계가 *"무엇이 대응되고 무엇이 안 되는지"*
를 갈라 적어 뒀으니 읽고, 이 자리에서 **복구 수단이 실제로 무엇인지** 정하고 적어라.

### 5. 웹 테스트는 **명세로 읽고, 이식하지 마라**

`packages/app-capacitor/src/app/__tests__/` 에 2개, 전체로는 43개 파일 15.7k줄이 있다. 전부
jsdom·DOM 기준이라 그대로 못 옮긴다. **읽어서 기대 동작을 뽑아내되, RN 테스트는 새로 써라.**

RN 테스트 관례는 3단계가 확정했다(`migration/README.md` «RN 트리 스냅샷 관례»).

## Acceptance Criteria

```bash
npm test           # vitest 199파일/3046개(증감 0) + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-shell-check
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

**iOS**: best-effort. 막히면 `blocked` + 사유.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 부팅 순서 표를 만들었는가? 세 갈래(그대로·사라짐·바뀜)로 갈랐는가?
   - 포트를 새로 만들지 않았는가? (13개는 이미 배선돼 있다)
   - `LiveUpdatePort` 를 부르지 않았는가? **부르면 부팅이 죽는다**
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-screens/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "부팅 순서 표·모달 둘의 상태·OTA 미연결 범위·ErrorBoundary 배치와 복구 수단"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`LiveUpdatePort` 를 부르지 마라.** 이유: 아직 던지는 구현이고([[ADR-128]] 결정 7 이 별도 ADR 로
  미뤘다), 부팅 경로에서 부르면 앱이 시작하지 못한다.
- **포트를 새로 만들거나 시그니처를 바꾸지 마라.** 이유: [[ADR-128]] 결정 4 — 그것이 core 가
  무수정으로 사는 유일한 조건이다.
- **웹 테스트를 그대로 옮기지 마라.** 이유: jsdom·DOM 기준이라 RN 에서 의미가 없다. 읽어서 명세를
  뽑고 RN 테스트를 새로 써라.
- **화면(`app/`의 나머지)을 여기서 만들지 마라.** 이유: step 2~8 이 각자 ADR 체크리스트를 소진하며
  진행한다. 여기서 손대면 그 규율이 무너진다.
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.

---

## 재개 안내 (2026-08-12 추가 — 실행이 중단됐다가 이어짐)

앞선 실행이 아래를 만든 뒤 중단됐다. **커밋 전, 작업 트리에만 있다.**

- `src/app/AppShell.tsx` · `ApiKeyNoticeModal.tsx`(+테스트·스냅샷) · `UpdatePromptModal.tsx`(503줄, +테스트)
- `src/app/use-keyboard-visible.ts` · `src/boot-splash.ts` · `App.tsx` · `index.ts` 수정
- `core-import-meta.d.ts` · `src/lib/icons.ts` · `TabNavigator.tsx` · `ErrorBoundary.tsx`(주석 정정) 수정

### 반드시 고쳐야 하는 것 — **테스트 하나가 OOM 으로 죽는다**

`src/app/__tests__/UpdatePromptModal.test.tsx` 가 **JavaScript heap out of memory** 로 스위트째
실패한다(단독 실행 `--runInBand` 에서도 재현). 네이티브 스택에 같은 프레임이 반복돼 **무한 재귀
또는 무한 렌더 루프**다. 전체 실행에서는 워커가 SIGTERM 으로 죽어 *"terminated by another
process"* 로 보이는데, **그것은 증상이지 원인이 아니다.**

이미 확인해 배제한 것(다시 보지 마라):

- `renderOverlay` · `flattenStyle`(`components/__tests__/render-atom.tsx`) — **이 step 에서 안 바뀌었고**
  다른 스위트 65개가 같은 헬퍼로 통과한다.
- `ErrorBoundary.tsx` 변경 — **주석뿐이다**(로직 무변경).
- `UpdatePromptModal` 본체에 `useEffect` 가 없고 `useState` 는 175행 한 곳(하위 컴포넌트)뿐이다.

나머지 65 스위트 660개는 통과한다.

### 안 끝난 것

- **`src/__tests__/boot-order.test.ts` 가 없다.** `UpdatePromptModal.test.tsx` 머리 주석이 *"이 모달이
  아직 아무 데도 마운트되지 않는다는 사실은 `boot-order.test.ts` 가 셸 쪽에서 본다"* 고 가리키는데
  그 파일이 아직 없다. **부팅 순서 표(작업 1)를 코드로 고정하는 것이 이 step 의 핵심 산출물이다.**
- 부팅 순서 표를 문서/주석에 남겼는지 확인하고, 없으면 만들어라.
- AC 를 처음부터 끝까지 다시 돌려라(Android `assembleDebug` 포함 — 아직 한 번도 안 돌았다).

### 살릴 만한 발견 하나 — 그대로 유지하라

`ErrorBoundary.tsx` 주석의 **정정**: *"RN 에는 웹뷰 리로드의 짝이 없다"* 가 **사실이 아니다.**
`expo` 의 `reloadAppAsync()` 가 지금 도는 번들을 다시 실행하며 OTA(`Updates.reloadAsync()`)와
무관하다. [[ADR-065]] 결정 5 의 복구 수단이 실제로 존재한다는 뜻이라, 이 step 의 결과에 반드시 적어라.
