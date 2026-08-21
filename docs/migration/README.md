# React Native 전환 (인덱스)

> ## ⚠️ 이 문서는 **완료된 전환의 기록**이다 (2026-08-21)
>
> RN 전환은 끝났고([[ADR-128]]), 마지막 고리인 캐패시터 소스 삭제와 모노레포 해체도 마쳤다
> ([[ADR-154]]·[[ADR-155]]). 그래서 아래 본문에 나오는 **경로는 그때의 것**이다
> (`packages/app-capacitor/…`·`packages/app-rn/…`·`packages/core/src/…`) — 지금 구조는
> 저장소 루트가 앱이고 `core/` 가 그 옆이다. **고치지 않는 이유는 기록이기 때문이다**:
> "그때 무엇을 어디서 어디로 옮겼는가" 가 이 문서의 값이고, 경로를 현재로 덮으면 그 값이 사라진다.
>
> **지금 작업의 근거로 이 문서를 읽지 말 것.** 현재 유효한 것은 `foundation/architecture.md`(레이어) ·
> `foundation/release.md`(빌드·서명) · 각 `features/*.md` 다. 다만 [data.md](./data.md) 는 예외로
> **지금도 도는 코드의 설명**이다 — RN 앱이 캐패시터 시절 저장소를 그대로 읽는 방법이 거기 있다.

**범위**: Capacitor → React Native 전환 전체 — 원칙·전략·단계·검증 게이트. 옮길 대상의 전수 목록은
[parity-inventory.md](./parity-inventory.md), 기존 사용자 데이터 보존은 [data.md](./data.md).

**관련 소스(read/write)**: `src/**` 전체 · `android/` · `ios/` · `capacitor.config.ts` · `package.json`

**관련 ADR**: [[ADR-128]](전환 결정 — 배경·대안·기각 근거) · [[ADR-001]](Capacitor 채택, 이 전환이 뒤집는 결정) ·
[[ADR-002]](Vite React SPA) · [[ADR-003]]·[[ADR-005]](어댑터 레이어 — 전환 비용을 낮춘 원인) ·
[[ADR-120]](화면 스택 — 전환으로 **삭제**되는 코드의 근거)

**관련 문서**: `foundation/architecture.md`(레이어 규칙) · `persistence/`(저장 매체 지도) ·
`foundation/release.md`(서명·versionCode) · `features/ads.md` · `features/live-update.md`

---

## 이 문서가 지키려는 한 문장

> **전환 후 앱은 전환 전과 구별할 수 없어야 한다.**

"대체로 같다"는 실패다. 이 저장소는 3년치 판단이 113개 ADR에 쌓여 있고, 그중 상당수는 화면에
드러나지 않는 **엣지 케이스 처리**다 — 기기 시계를 되돌린 사용자, 월드를 옮긴 캐릭터, 캐시가 지워진
첫 부팅, 롤백된 번들. 새로 짠 화면이 "잘 도는 것처럼 보이는" 것과 그 판단들을 보존하는 것은 다른 일이다.

그래서 이 전환의 이식 단위는 **파일이 아니라 ADR 계약**이다.

---

## 원칙 다섯

### 원칙 1 — 어댑터 인터페이스는 한 글자도 바꾸지 않는다

`storage/*` · `native/*` 의 **함수 시그니처를 고정**하고 구현만 교체한다. 이것이 117개
파일이 무수정으로 사는 유일한 조건이다. 포트 역전으로 손대는 15개도 **밖으로 나가는 시그니처는
그대로** 두어야 한다 — 바뀌면 `features/` 39개가 함께 무너진다. 시그니처를 "이왕 하는 김에" 손대는 순간 이식이 재작성이 된다.

[[ADR-003]]·[[ADR-005]] 가 이미 이 경계를 강제해 뒀다. 전환은 그 경계를 **쓰는** 작업이지 다시 긋는
작업이 아니다.

### 원칙 2 — ADR 계약이 이식 단위다

파일을 옮기는 게 아니라 그 파일에 걸린 ADR을 옮긴다. [parity-inventory.md](./parity-inventory.md) 의
파일별 ADR 목록이 체크리스트이고, **한 파일을 끝냈다는 것은 그 파일의 ADR을 전부 다시 읽고 해당
동작이 새 코드에 있음을 확인했다는 뜻**이다.

가장 무거운 파일은 `app/boss-profit/BossProfitScreen.tsx` — **ADR 32개**가 걸려 있다.

### 원칙 3 — 원본을 지우지 않는다

**데이터**: 기존 SQLite 파일·Preferences를 읽되 복사·변환·삭제하지 않는다([data.md](./data.md)).
**코드**: Capacitor 앱은 패리티 도달까지 계속 배포한다. `packages/core` 를 공유해 로직 수정이 양쪽에
동시 반영되게 한다.

### 원칙 4 — 테스트가 먼저다

CLAUDE.md의 TDD 원칙을 전환에도 적용한다. 화면 하나를 재작성할 때 그 화면의 테스트부터 옮긴다.

다만 **DOM 스냅샷 5개는 이식이 불가능하다**(아래 «잃는 안전망»). 조사 결과 **완전한 대체는 원리적으로
없다** — RN 렌더 트리는 DOM 트리와 구조가 달라 기존 `.snap` 과 대조가 안 되고, 픽셀 스크린샷도 폰트
래스터라이징이 웹뷰와 네이티브가 달라 자동 비교가 실패한다. **"예전과 같은가"는 사람 눈으로만 답한다.**

그래서 둘로 나눈다(사용자 결정, 2026-08-11) — **RN 트리 스냅샷을 새 기준선**으로 잡아 앞으로의 회귀를
막고, **예전과의 대조는 두 앱을 나란히 띄워 사람이 판정**한다. 기계 검증과 육안 검증을 솔직하게 분리하는
것이지, 잃은 것을 되찾는 것이 아니다.

### 원칙 5 — "한 번에 성공해야 하는 것"을 최소화한다

전환 릴리스에는 OTA 안전망이 없다([[ADR-128]] 트레이드오프). 그래서 단발 실행 코드를 최대한 만들지
않는다 — 데이터를 **옮기는** 대신 **그대로 읽는** 선택이 여기서 나온다([data.md](./data.md) 결정 1).

---

## 무엇이 옮겨지고 무엇이 사라지는가

| 구분 | 대상 | 파일/규모 | 처리 |
|---|---|---|---|
| **무수정 이식** | `data/` `types/` `nexon/`(30) · `features/`(39) · `lib/`(41) · `storage/`(7) | **117 / 141 파일** | `packages/core` 로 이동 |
| **포트 역전 후 이식** | `storage/` 14 · `lib/use-system-back` | **15 파일** | 플러그인을 **직접** import 中 — 의존을 뒤집어야 core 로 간다 |
| **수정 이식** | `features/theme/store` · `features/onboarding/store` | 2 파일 | `matchMedia` → `Appearance` |
| **구현 교체** | `storage/*` `native/*` 어댑터 | 2.2k줄 | 시그니처 고정, 구현만 |
| **전면 재작성** | `app/` `components/` | **12.3k줄 / 154 파일** | RN 프리미티브로 |
| **테스트 재작성** | DOM 의존 테스트 | **78 / 197 파일** | `@testing-library/react-native` |
| **테스트 유지** | 로직 테스트 | **119 파일** | 대체로 무수정 |
| **삭제** | 화면 전환 machinery | ~1,100줄 | react-navigation이 대체 |
| **삭제** | `BackGesturePlugin.java` · `SystemBarsPlugin.java` | 328줄 | 프레임워크 내장 |
| **삭제** | `jeep-sqlite` · `sql.js` 웹 폴백 | — | RN엔 웹 타깃 없음 |

### 삭제되는 화면 전환 machinery (상세)

[[ADR-120]] 이 남긴 코드다. RN 네이티브 스택이 같은 일을 OS 수준에서 하므로 **이식하지 않고 버린다.**

| 파일 | 줄 | 대체 |
|---|---|---|
| `lib/stack-transition.ts` | 172 | `createNativeStackNavigator` |
| `features/screen-stack/store.ts` | 85 | react-navigation 내부 상태 |
| `lib/preloaded-screen.tsx` | 67 | 불필요 — `React.lazy` 300ms 스로틀 문제가 없다 |
| `lib/use-stack-location.ts` | 58 | react-navigation이 언마운트를 관리 |
| `lib/use-swipe-back.ts` | — | iOS 엣지 스와이프 기본 동작 |
| `lib/use-system-back.ts` | — | Android 뒤로가기 기본 동작 |
| `lib/use-body-scroll-lock.ts` | — | 불필요 |
| `lib/use-measured-height.ts` | — | ~~`onLayout`~~ → **불필요**(step 6 정정) |
| `lib/use-pull-to-refresh.ts` | — | **`RefreshControl`**([[ADR-130]], step 4 가 갈래를 닫았다) |
| `android/…/BackGesturePlugin.java` | 154 | predictive back 내장 — 단 `moveToBackground` 는 `modules/app-background`(step 2 정정) |
| `android/…/SystemBarsPlugin.java` | 174 | edge-to-edge·인셋 주입은 내장 — 단 내비 바 글리프 명암은 `modules/app-system-bars`(step 6 정정) |

**정정 넷 중 셋이 같은 모양이다** — 계획서가 *"프레임워크가 대신한다"* 로 적은 자리 대부분은 맞았지만
**끝의 한 조각씩이 남았다**(뒤로가기의 `moveToBackground` · 시스템 바의 글리프 명암). 남은 조각은
공교롭게도 둘 다 *"프레임워크가 정해 주지 않는 제품 결정"* 이라 로컬 Expo 모듈로 갔다.
`use-measured-height` 는 반대 방향의 정정이다 — `onLayout` 으로 **대체하는** 것이 아니라 그 훅이
풀던 문제(`fixed` 가 만든 spacer)가 통째로 없어졌고, 실제로 `onLayout` 은 그 계약([[ADR-112]] 의
*"페인트 전 동기 반영"*)을 원리적으로 만족시키지 못한다.

**주의**: 버리는 것은 *구현*이지 *결정*이 아니다. [[ADR-120]] 이 정한 **동작**(스택 깊이에 따른 탭바
동반 이동, 제스처 진행률에 따른 아래 화면 시차, 3버튼과 제스처가 같은 결과로 수렴)은 새 구현에서도
성립해야 한다. react-navigation 기본값이 그것과 다르면 기본값이 아니라 [[ADR-120]] 을 따른다.

---

## 의존성 대응표

| 현재 | RN 대응 | 난이도 | 비고 |
|---|---|---|---|
| `zustand` | 그대로 | 없음 | 전 `features/*/store.ts` 무수정 |
| `react-router-dom` | `@react-navigation/native` + `native-stack` | 중 | 라우트 → 스크린 매핑은 parity-inventory 참고 |
| Tailwind v4 (`index.css` 384줄) | NativeWind 4 (**Tailwind v3**) | 중 | 임의 CSS·pseudo 셀렉터·`@keyframes` 불가. 메이저가 갈리는 이유와 대처는 «3-0단계 결과» |
| `lucide-react` | `lucide-react-native` | 낮음 | `react-native-svg` 필요 |
| `vaul` (BottomSheet) | `@gorhom/bottom-sheet` | 중 | [[ADR-039]] 동작 보존 확인 |
| `@capacitor-community/sqlite` + `jeep-sqlite` + `sql.js` | `op-sqlite` | 중 | **파일 그대로 사용** — [data.md](./data.md) |
| `@capacitor/preferences` | 자체 네이티브 모듈 | 낮음 | **저장소 그대로 사용** — [data.md](./data.md) |
| `@capacitor/local-notifications` | `notifee` | 중 | **재등록 필요** — [data.md](./data.md) 결정 4 |
| `@capacitor-community/admob` | `react-native-google-mobile-ads` | 낮음 | 전면광고 게이트([[ADR-090]]) 무수정 이식 |
| `@capgo/capacitor-updater` | `expo-updates` | 낮음 | 채널·매니페스트 형식 재설계 필요 |
| `@capacitor/network` | `@react-native-community/netinfo` | 낮음 | |
| `@capacitor/keyboard` | `KeyboardAvoidingView` + `react-native-keyboard-controller` | 중 | `autoBackdropColor: 'dom'` 대응 확인 |
| `@capacitor/splash-screen` | `react-native-bootsplash` | 중 | [[ADR-025]] values-night 다크 대응 유지 |
| `@capacitor/status-bar` | `react-native-edge-to-edge` | 낮음 | |
| CSS `@keyframes` (**7종**) | `react-native-reanimated` | **높음** | 단풍잎 스피너·드랍 연출 — 아래 참고 |

### 애니메이션이 이 전환의 숨은 비용이다

`src/index.css` 에 `@keyframes` 가 **7종** 있다 — `toast-shrink` · `maple-trail` · `maple-sweep` ·
`fx-drop-float` · `valuable-drop-glow` · `valuable-drop-spin` · `valuable-drop-row-pulse`.
[[ADR-048]]·[[ADR-103]](드랍 연출) 과 단풍잎 스피너([[ADR-061]])가 여기 산다.

> **"8종"은 틀린 수였다**(3단계 step 7 에서 정정). 이 문단이 원래 일곱을 적고 *"외"* 를 붙여
> 어림잡았는데 실제로는 그 일곱이 전부다. 이제 세는 일을 사람이 하지 않는다 —
> `packages/app-rn/src/__tests__/keyframes-parity.test.ts` 가 **원본 CSS 를 읽어** 이름 목록을
> 「이 단계에서 옮긴 것」과 「화면 계층 몫」으로 남김없이 가르고, 웹에 새 `@keyframes` 가 생기면
> **분류될 때까지 빨개진다**. 조용히 누락되는 것이 이 전환에서 가장 비싼 실패라서다.

CSS 애니메이션은 선언 한 덩어리지만 Reanimated는 **명령형 코드**다. 1:1 변환이 아니라 재구현이고,
"같아 보이는가"를 눈으로 판정해야 한다. 표의 다른 항목과 성격이 다르니 일정에서 따로 잡는다.

---

## 브랜치 전략

**전환 작업은 `main` 으로 직접 가지 않는다.** 통합 브랜치 `rn-migration` 에 모았다가, 전 단계가 끝나고
실기기 동작까지 확인한 뒤에 한 번에 `main` 으로 옮긴다(사용자 결정, 2026-08-11).

```
main
  └── rn-migration            ← 통합 브랜치. 전환 작업은 전부 여기로 모인다
        ├── feat-rn-core-extraction    (단계 0) ✅ merge 됨
        ├── feat-…                     (단계 1) ← rn-migration 에서 분기
        └── feat-…                     (단계 2~)
```

규칙:

- **task 브랜치는 `rn-migration` 에서 분기한다.** harness `execute.py` 는 현재 HEAD 에서
  `feat-{task-name}` 을 만드므로, **실행 전에 `git checkout rn-migration` 을 반드시 먼저 하라.**
  `main` 위에서 실행하면 이전 단계의 산출물이 없는 채로 작업하게 된다
- **머지는 `--no-ff`** — 머지 커밋이 단계의 경계를 기록한다. squash 하지 않는다
- **`main` 으로의 PR 은 전 단계 완료 후 한 번**이다. 중간 단계를 `main` 에 올리면, 그 시점의 `main` 이
  "웹뷰 앱도 RN 앱도 아닌 상태"가 되어 급한 OTA 수정을 낼 수 없게 된다
- `rn-migration` 은 **`main` 의 진행을 주기적으로 받아온다**(`git merge main`). Capacitor 앱은 전환
  기간에도 계속 배포되므로 그쪽 수정이 쌓인다 — 오래 안 받으면 마지막에 한꺼번에 충돌한다

## 단계

각 단계는 **끝났음을 판정할 수 있는 게이트**를 갖는다. 게이트를 통과하지 못한 채 다음 단계로 가지 않는다.

### 0단계 — `packages/core` 추출 + RN 스캐폴딩 ✅ **완료**(2026-08-11)

```
packages/
  core/            141 파일. DOM도 Capacitor도 모른다(포트 역전 후)
  app-capacitor/   현재 앱. 계속 OTA로 배포한다
  app-rn/          새 앱. 패리티까지 조용히
```

- `core` 는 `storage/`·`native/` 의 **인터페이스만** 갖고 구현은 각 앱이 주입한다
- **게이트**: `app-capacitor` 가 `core` 를 물고 기존 테스트가 전부 통과 + 실기기 동작 확인.
  즉 이 단계는 **동작 변화 0** 이어야 한다
- **결과**: vitest 199파일/3044개 증감 0 · `gradlew assembleDebug` 성공(36MB APK, 커스텀 플러그인 2종 dex 포함)

> 이 단계가 전환을 **중단 가능한 프로젝트로 만든다.** 여기서 그만둬도 `core` 분리는 그 자체로 남는
> 이득이다(경계 강제·테스트 속도). RN을 안 가더라도 손해가 아니다.

### 1단계 — 어댑터 구현 교체 ✅ **완료**(2026-08-11, OTA 제외)

- `storage/*` 21파일 · `native/*` 11파일의 RN 구현. **시그니처 고정**(원칙 1)
- **게이트**: `core` 의 로직 테스트가 RN 어댑터 위에서 전부 통과
- **결과**: 포트 13종 중 9종 구현, 4종은 이유를 말하며 던진다(뷰 결합 3 + OTA 1). jest 209개 추가

주입은 `packages/app-rn/src/boot.ts` 의 `installPorts()` 한 함수이고 진입점 `index.ts` 가
`registerRootComponent(App)` 앞에서 부른다. **포트 13종 중 넷은 아직 구현이 아니라 «던지는 구현»** 이다
(`native/adapters/not-implemented.ts`) — 셋은 3단계 몫, `LiveUpdatePort` 는 [[ADR-128]] 결정 7 의 별도
ADR 몫이다. 조용한 no-op 으로 두지 않는 이유와 각 자리의 근거는
[parity-inventory.md](./parity-inventory.md) «부팅 배선».

**테스트 러너는 둘이다**(사용자 결정, 2026-08-11). `packages/app-rn` 은 **jest**(`jest-expo` 프리셋),
`core` 와 `app-capacitor` 는 그대로 **vitest**. RN 을 vitest 에 억지로 태우지 않는 이유는 전환의 최종
상태가 RN-only 이고 그때 `app-capacitor` 와 함께 vitest 도 걷히기 때문이다 — 지금 태우면 나중에 한 번
더 옮겨야 한다. 3,044개를 러너 사이로 옮기는 것은 전환 마지막 단계의 별도 작업이다.

- 루트 `npm test` 가 **둘 다** 돌리고 한쪽만 실패해도 전체가 실패한다
- vitest 는 `packages/app-rn/**` 를 탐색에서 제외한다(`packages/app-capacitor/vite.config.ts` —
  루트 설정이 이 파일을 re-export 하므로 규칙은 한 벌이다). 없으면 vitest 가 RN 테스트를 집어삼킨다
- `@core/*` 는 jest 에서도 **`packages/app-rn/tsconfig.json` 의 `paths` 하나**로 풀린다
  (`jest-expo` 가 그 `paths` 를 `moduleNameMapper` 로 옮긴다 — Metro 와 같은 성질이라 갈라질 자리가 없다).
  단 그 파생이 **cwd 기준**이라 이 패키지의 jest 는 반드시 자기 디렉터리에서 돌려야 한다

### 2단계 — 데이터 보존 ([data.md](./data.md)) ✅ **완료**(2026-08-11, Play 트랙 검증만 남음)

- Preferences·SQLite를 **옮기지 않고 그대로 읽는** 구현
- **결과**: iOS 시뮬레이터·Android 실기기 양쪽 통과([data.md](./data.md) «실측 검증 기록»). **`NULL ≠ 0` 도 확인**([[ADR-124]])
- **게이트**: 실기기에서 **기존 Capacitor 앱을 설치한 뒤 RN 빌드로 업데이트**해, 보스 수익 기록·드랍
  기록·API 키·추적 캐릭터·테마가 전부 그대로 보일 것. Android·iOS 각각

### 3단계 — 내비게이션 + `components/` 34개

- react-navigation 골격 + 4계층 컴포넌트(atoms 9 · molecules 11 · organisms 10 · templates 4)
- **여기서 «던지는 구현» 셋이 전부 채워졌다** ✅ — `ThemeAppearancePort`(테마를 React 상태로, step 1) ·
  `BackGesturePort`(네이티브 스택 + `moveToBackground` 한 메서드는 로컬 모듈, step 2) ·
  `SystemBarsPort`(`setNavigationBarStyle` 은 로컬 모듈, `refreshSafeAreaInsets` 는 의도적 no-op,
  step 6). **남은 «던지는 구현»은 `LiveUpdatePort` 하나**이고 그것은 3단계가 아니라
  [[ADR-128]] 결정 7 의 별도 ADR 몫이다
- **게이트**: [[ADR-120]] 동작(탭바 동반 이동·시차·3버튼 수렴)이 실기기에서 재현될 것

**스타일링은 NativeWind 다**(사용자 결정, 2026-08-11). `components/` 33파일에 `className` 이 163곳
있어 그대로 옮기는 편이 압도적으로 싸다. 대가는 임의 CSS·pseudo 셀렉터·`@keyframes` 를 못 쓰는 것인데,
`@keyframes` 7종은 어차피 Reanimated 재구현 대상이라 새로 잃는 것이 아니다.

**`ThemeAppearancePort` 는 여기서 해소됐다**(아래 «3-1단계 결과»). CSS 변수를 `<style>` 에 주입하던
구조를 React 상태로 옮겼다.

#### 3-0단계 결과 — NativeWind 기반 (2026-08-11, 컴포넌트 이동 없음)

**저장소가 Tailwind 메이저를 둘 문다.** NativeWind 안정판(4.2.6)이 v4 를 **명시적으로 거부하고**
(`"NativeWind only supports Tailwind CSS v3"`), 웹은 이미 v4 로 배포 중이라 어느 쪽도 못 옮긴다.
v5 preview(v4 지원)는 **실측으로 탈락** — `var()` 가 들어간 CSS를 컴파일하다 lightningcss 방문자
API 에서 죽는다(`failed to deserialize … Specifier`, Node 24 · lightningcss 1.27~1.32 전부 동일).
CSS 변수는 테마 시스템의 뼈대라 이 하나로 못 쓴다. 마지막 발행도 안정판보다 3개월 앞선다.

배치는 **루트가 v3, 웹 패키지가 v4** 다. 뒤집힌 것처럼 보이지만 강제된 순서다 — `nativewind` 는
의존성이 하나뿐이라 루트로 호이스팅되고, Node 해석은 **위로만** 걷기 때문에 그가 집는 것은 언제나
루트다. `npm overrides` 로 peer 를 중첩시키는 안은 실측으로 안 먹혔다.

| 자리 | Tailwind | 누가 쓰나 |
|---|---|---|
| `node_modules/` (루트) | **3.4.19** | `nativewind` |
| `packages/app-capacitor/node_modules/` | **4.3.x** | 웹 빌드(`@tailwindcss/vite`) |

- 웹 산출물이 안 바뀌었음은 **빌드 CSS 를 바이트 단위로 대조**해 확인했다(변경 전후 md5 동일).
- 두 배치가 어긋나면 `packages/app-rn/src/__tests__/tailwind-axes.test.ts` 가 빨개진다. 웹이 v3 를
  집는 경우가 특히 위험하다 — `@theme` 이 미지원 at-rule 이 되어 **유틸리티가 거의 안 나온 채 빌드가
  성공**한다.

**테마와 무관한 축은 베끼지 않고 웹의 v4 기본값에서 판다** — `tailwind-v4-axes.cjs`(저장소 루트)가
`tailwindcss/theme.css` 를 읽어 v3 `theme` 조각으로 바꾸고, `packages/app-rn/tailwind.config.js` 가
그것을 `extend` 가 아니라 **교체**로 얹는다. 실제로 갈리는 축은 셋뿐이다(실측):

| 축 | 왜 |
|---|---|
| `spacing` | v4 는 배수로 모든 정수를 만든다. v3 엔 `h-13`(2곳)·`h-22`(1곳)가 **없는 클래스** — 조용히 무시된다 |
| `container` | `max-w-2xs`(288 — 파티 인원 모달 폭 하한, [[ADR-121]])가 v4 에만 있다 |
| `borderRadius` | v4 가 계단 이름을 한 칸 밀었다(v3 `rounded-sm` 2px / v4 4px). 지금 영향 0, step 3~6 의 함정 |

나머지(`fontSize`·`fontWeight`·`leading`·`tracking`·`screens`)는 두 메이저의 값이 **같아** 건드리지
않는다. 같은 것을 파생시키면 파생 코드가 새 오차원이 된다.

**`rem` 은 16 으로 못박는다**(`packages/app-rn/nativewind.config.js`). NativeWind 기본값은 14 인데
웹은 브라우저 기본 16px 로 돈다 — 그대로 두면 rem 을 쓰는 유틸리티 **전부**가 RN 에서만 12.5%
작아진다. 이름은 같은데 값이 다른, 가장 알아채기 어려운 종류의 어긋남이다.

**`babel.config.js` 가 0단계에서 지웠던 자리에 돌아왔다.** NativeWind 가 babel 프리셋을 요구하고,
없으면 `className` 이 **에러 없이 무시**된다. 되살린 이유는 파일 주석에 적혀 있다.

#### 3-1단계 결과 — 테마 시스템 (2026-08-12, 컴포넌트 이동 없음)

**`ThemeAppearancePort` 가 채워졌다**(`packages/app-rn/src/native/adapters/rn-theme-appearance.ts` +
`src/theme/`). 진단은 맞았다 — 어댑터를 잘 짜는 문제가 아니라 **값이 흐르는 방향이 반대**였다.

| 웹뷰가 하던 일 | RN |
|---|---|
| `buildThemeCss` 로 38토큰을 `<style>` 에 주입 | **문자열로 굳히지 않는다** — `ThemeDefinition extends ThemeTokens` 라 값이 이미 객체다. NativeWind `vars()` 로 렌더 트리에 내린다 |
| `data-theme`(눈으로 확인용) | 없다 — 테마 이름이 값으로 흐른다 |
| `data-mode` 선택자 ([[ADR-122]]) | **선택자가 없어 파생 토큰으로** 만든다(아래) |
| `color-scheme`·`scrollbar-color` ([[ADR-099]]) | 스크롤 인디케이터는 RN 에서 **프롭**이라 뷰가 정한다(`useScrollIndicatorStyle`) |

- **`className` 을 그대로 쓸 수 있다.** `tailwind.config.js` 의 색을 값이 아니라 `var(--color-*)` 로
  두어 웹과 **같은 모양**이 됐다(v4 `@theme` 이 만든 유틸리티 + 런타임 변수 주입). 색 이름은 손으로
  적지 않고 `job-themes.json` 키에서 판다([[ADR-064]] 결정 10). v3 기본 팔레트는 **교체로 없앴다** —
  남겨 두면 테마를 안 따라가는 색을 쓰고도 빌드가 성공한다.
- **`vars()` 는 렌더 트리를 따라 상속되고 하위 재선언이 그 서브트리만 덮는다**(실측). 그래서
  `.media-scope`([[ADR-064]] 결정 5)가 `<MediaScope>` 한 컴포넌트로 그대로 옮겨졌다 — 카드 안에서
  같은 레시피(`bg-primary-tint`)가 카드 기준을 보는 성질이 유지된다.
- **테마는 side-effect 가 아니라 렌더 트리의 일부다 — 그 대가는 View 한 개**다. 웹에서는 변수가
  `documentElement` 에 붙어 레이아웃과 무관했지만 RN 에서는 변수를 얹는 요소가 레이아웃 노드가 된다.
- **변수를 못 찾으면 색이 조용히 사라진다**(스타일 속성 자체가 빠진다 — 에러도 경고도 없다). 웹은 그
  자리를 `index.css` `@theme` 기본 블록(머쉬맘)이 메우므로, RN 도 appearance 저장소의 **초기값을 기본
  테마로** 두어 같은 순서를 만든다(첫 페인트 → `restoreFromStorage()` → 갈아탐).
- **[[ADR-122]] 는 값으로 푼다.** 라이트에서만 테두리를 `text` 쪽으로 미는 규칙을
  `--color-panel-border` 파생 토큰으로 미리 계산해, 호출부는 `border-panel-border` 만 쓴다. 분기는
  반드시 `definition.mode` 이고 테마 **이름**은 보지 않는다([[ADR-064]] 결정 8). 색 공간은 `in srgb`
  여야 한다(틴트 파생의 `in oklab` 과 다르다) — ADR 본문 표의 세 확정값을 테스트가 그대로 지킨다.

**막힌 것 하나 — core 가 Vite 를 전제로 쓰여 있다.** `@core/lib/theme-registry` 를 import 하는 것만으로
RN 이 부팅에 실패한다: 그 파일이 부르는 `lib/theme-backgrounds.ts` 가 `import.meta.glob` 으로 에셋
목록을 만드는데 Metro 엔 짝이 없어 **모듈 평가 시점에** 던진다(`__ExpoImportMetaRegistry.glob is not a
function`). core 는 배포 중인 웹과 공유돼 못 고치므로(원칙 3), **앱이 자기 번들러에게 대체 모듈을
알려주는** 방식으로 뒀다 — `packages/app-rn/core-shims.js` 한 표를 Metro 와 jest 가 공유한다.

- 대체 구현은 `null` 을 돌려준다 — 원본이 이미 정의한 정상 경로이고([[ADR-088]] 결정 3), 그래서 색
  38토큰은 그대로 흐르고 **배경만 없다**. 배경을 가진 두 테마(혼테일·검은마법사)가 RN 에서 단색으로
  열린다. RN 은 벽지를 URL 이 아니라 `<Image source={require(...)}>` 로 그려 반환 타입 자체가 웹
  전용이므로, 그 자리는 백드롭을 만들 때 함께 정해진다.
- `tsc` 는 상대 import 를 `paths` 로 못 돌려 core 원본을 계속 따라가므로 `ImportMeta.glob`
  **타입 선언**도 필요했다(`core-import-meta.d.ts`). 그 선언의 부작용이 함정이다 — **치환되지 않은
  glob 모듈을 import 하면 타입·lint 는 초록이고 런타임에만 죽는다.** core 의 glob 모듈 **여덟 개**
  목록을 테스트가 고정해, 하나가 늘면 그때 알게 한다.
- **제대로 된 답은 에셋 해석을 포트로 뒤집는 것**이고 그건 core 인터페이스를 늘리는 별도 결정이다.
  나머지 일곱(`item-icons`·`boss-icons`·`drop-effect-frames`·`daily-quest-*`·`world-emblem`·
  `feature-guides`)은 그 소비자를 옮길 때 같은 처리가 필요하다.

**옮길 때 걸릴 것 하나 더 — 투명도 접미사가 안 먹는다.** v3 는 `var()` 색에 `/60` 을 붙인 유틸리티를
**아예 생성하지 않는다**(실측). 웹에 두 자리 있다(`bg-surface/60`·`bg-secondary/10`) — 컴포넌트를
옮길 때 명시 토큰이나 임의값으로 바꿔야 하고, 그냥 옮기면 **배경이 조용히 없어진다**.

#### 3-2단계 결과 — 내비게이션 (2026-08-12, 화면은 자리표시자)

[[ADR-120]] 이 손으로 만든 화면 스택(~1,100줄 + Java 328줄)을 react-navigation 으로 바꿨다. 화면
재작성은 4단계이므로 각 스크린은 이름만 찍는 자리표시자다.

**버린 것은 구현이지 결정이 아니다.** 라이브러리 기본값이 [[ADR-120]] 과 갈리는 자리는 전부 ADR 을
따랐고, 그 판단이 이 단계의 실질이다.

| [[ADR-120]] 이 정한 것 | react-navigation 기본값 | 택한 것 |
|---|---|---|
| 결정 4 — 탭바가 아래 화면과 **한 덩어리로** 밀려 나간다 | 탭 안에 스택을 두고 탭바를 숨기는 배치가 흔하다 | **하위 페이지를 탭 «위»에 쌓는다.** 밀려나는 것이 탭 화면 + 탭바가 되어 결정 4 가 **구조로** 성립한다. 탭 안 스택 + `tabBarStyle: none` 이면 탭바가 함께 안 밀리고 **제자리에서 사라진다** |
| 결정 5 — 두 플랫폼에 같은 전환 | 안드로이드는 플랫폼 기본 전환 | `animation: 'ios_from_right'`. 웹뷰 앱은 플랫폼을 묻지 않았으므로(`stack-transition.ts`), 기본값을 택하면 **전환 후 안드로이드 사용자에게 앱이 다르게 보인다** |
| 결정 6 — 가장자리 28px·35%·0.4px/ms | `gestureResponseDistance` 를 줄 수 있다 | **주지 않는다.** 그 값들이 UIKit 가장자리 인식기를 손으로 흉내 낸 것이라, 숫자를 다시 얹으면 **흉내가 원본을 덮는다** |
| 결정 18 — 탭 최상위 뒤로가기는 **종료가 아니라 백그라운드** | 더 pop 할 것이 없으면 액티비티 종료 | 네이티브 모듈로 `moveTaskToBack(true)`(아래) |

- **`routes.ts` 는 계획서 §1 을 «데이터»로 옮긴 것**이고 내비게이터가 그 목록에서 파생된다. 손으로
  적으면 계획서 17행과 화면 목록이 두 벌이 되어 하나를 빠뜨려도 아무 데서도 안 드러난다.
- **온보딩 분기는 리다이렉트가 아니라 화면 목록 자체를 갈아 끼운다.** 웹이 라우트마다
  `<Navigate replace>` 로 문을 잠근 것은 URL 로 아무 데나 들어올 수 있었기 때문이고, RN 에는 그
  진입 경로가 없다(딥링크를 두지 않았다). 계약이 요구하는 둘 — 탭에 **도달 불가** · 되돌아갈
  **히스토리 없음** — 을 더 강하게 만족한다(도달할 화면이 존재하지 않는다).
- **전면광고 게이트는 탭 `listeners.tabPress` 로 옮겼다**([[ADR-090]] 결정 3). 이동을 막지 않고
  (`preventDefault()` 없음) 같은 탭 연타는 `isFocused()` 로 거른다. `tab-switch-ad.ts` 는 무수정 —
  30분·60초·시계 되돌림 판정은 core 의 순수 함수 그대로다.

**`BackGesturePort` 는 계획서 예상과 달랐다.** `parity-inventory.md` §5 는 이 포트를 *"삭제 —
네이티브 스택 기본"* 으로 적어 두었고 셋 중 둘은 실제로 그렇게 됐지만, **`moveToBackground` 하나는
남는다.** 내비게이션 라이브러리는 «더 이상 pop 할 것이 없을 때 무엇을 할지»를 정해 주지 않고, 그
자리의 기본값이 정확히 결정 18 이 거부한 종료다(RN 자신의 주석: `ReactActivity.
invokeDefaultOnBackPressed` — *"the fallback logic (finish activity)"*). 끝내면 다음 실행이 콜드
스타트라 스플래시부터 다시 본다. 그래서 Expo 모듈 `app-background`(Kotlin)를 새로 만들었다.

- 나머지 둘(`setEnabled`·`addListeners`)은 **계속 던지되 사유가 갈린다** — *"아직 안 했다"* 가 아니라
  *"이제 네이티브 스택이 소유한다."* 그래서 메시지를 `not-implemented.ts` 가 아니라
  `rn-back-gesture.ts` 가 갖는다. 조용한 no-op 으로 두면 나중에 누군가 `setBackGestureEnabled(true)`
  를 불러 놓고 뒤로가기가 자기 통제 아래 있다고 믿는다.
- `use-root-back` 은 판정을 **`canGoBack()` 하나**로 둔다. `BackHandler` 는 나중에 등록된 리스너부터
  부르고 `true` 를 돌려준 첫 리스너에서 멈추는데, 우리와 react-navigation 중 누가 먼저 등록될지는
  마운트 순서에 달렸다 — 판정이 하나면 **어느 쪽이 먼저 불려도 결과가 같다.** 스택 깊이를 따로 세면
  그 값과 실제 상태가 어긋난 프레임에서 뒤로가기가 두 단계 가거나 아무 일도 안 한다.

**계획서 오류 1건을 정정했다.** §1 의 `/settings/privacy` 는 실제로 `/settings/about/privacy` 다
(`<Route path="privacy">` 가 `about` 의 자식, [[ADR-120]] 결정 11 이 구현 중에 정정한 것) — 이 앱에서
**유일한 2단 스택**이다.

**눈으로 봐야 할 것**(코드로 확인되는 종류가 아니다): 탭바 동반 이동 · 아래 화면 시차 · 3버튼과
제스처의 수렴 · 전환 체감. 340ms·0.12·-30% 같은 개별 수치는 이제 OS/`react-native-screens` 가 갖고
있어 우리가 못 돌린다 — **결정 12 가 요구하는 실기기 확인이 «값 확정»에서 «채택 판정»으로 성격이
바뀌었다.** 결정 18 후반(모달이 떠 있으면 뒤로가기가 닫는다)은 모달이 없어 3-5단계로 넘겼다.

> 이 단계는 실행이 중간에 끊겨 **작업 트리에 남은 산출물을 사람이 검증하고 커밋**했다(AC 전 항목
> 통과 확인: vitest 199파일/3044개 증감 0 · jest 283→318 · Android `assembleDebug`). 그 과정에서
> `expo prebuild` 가 `android/.gitignore` 를 다시 만들며 **키스토어 무시 규칙을 지운 것**이 드러나,
> 규칙을 prebuild 가 안 건드리는 `packages/app-rn/.gitignore` 로 옮겼다([[ADR-091]]).

#### 3-3단계 결과 — atoms 9개 (2026-08-12, **첫 컴포넌트 이동**)

`packages/app-rn/src/components/atoms/` 로 9개가 옮겨졌다. `app-capacitor` 의 원본은 그대로 둔다
(원칙 3). 계층 규칙은 RN 쪽에도 테스트로 세웠다 — 웹판과 다른 점은 **"네 계층이 다 있다"가 아니라
"있는 계층은 아래에서부터 끊기지 않는다"** 로 적은 것뿐이다(계층이 step 4~6 에 차례로 도착하므로,
숫자를 적으면 나중에 그것을 되돌릴 사람이 필요하다).

**`className` 은 대체로 그대로 옮겨졌다.** 아래가 **바꿔야 했던 전부**이고, 셋 다 "웹에서 되던 것이
RN 에서 조용히 안 된다"는 같은 성질을 갖는다 — step 4~6 이 같은 자리를 다시 만난다.

| 자리 | 웹 | RN | 왜 |
|---|---|---|---|
| 버튼·모든 상자 | 글자 유틸을 상자에 함께 걸었다 | **상자/글자 두 벌**로 가른다 | RN 은 글자 스타일이 상자에서 자식 `Text` 로 **상속되지 않는다**(실측). 상자에 남은 `text-*`·`font-*` 는 그 View 의 style 에 앉아 있기만 한다 |
| 모든 인터랙션 | `hover:*` | **뺀다** | 터치 기기에 hover 가 없고 NativeWind 도 네이티브에서 버린다. 눌림 피드백은 `active:` 라는 다른 축이다 |
| `ProgressBar` | `` `bg-${tone}` `` | 정적 클래스 표 | Tailwind 는 소스를 문자열로 훑는다. 웹은 `bg-primary`·`bg-third` 가 다른 파일에 있어 우연히 살았고, RN 은 스캔 범위가 이 패키지뿐이라 그 우연이 없다 — **색 없는 막대**가 된다 |
| `ProgressBar` | `transition-[width]` | **뺀다**(step 7) | NativeWind 의 `transition-*` 은 Reanimated 워클릿을 타는데 그 배선이 아직 없어 **렌더가 즉시 죽는다**(실측) |

**SVG 는 `className` 이 그냥 무시된다 — 배선을 따로 걸어야 한다**(`src/lib/nativewind-interop.ts`).
NativeWind 가 자동으로 가로채는 것은 `react-native` 기본 컴포넌트뿐이라, `Svg` 에 준 클래스는 **모르는
프롭으로 흘러가고 스타일이 안 붙는다**(실측 — 렌더 트리에 `className` 문자열이 그대로 남아 있었다).
`cssInterop` 으로 `style.color` → `color` 프롭을 옮기면 자식의 `currentColor` 가 그 값을 읽어,
**웹과 같은 호출부 API**(`className="text-primary"` 하나로 색이 정해진다)가 유지된다.
`expo-linear-gradient` 도 같은 이유로 등록한다.

**SVG 에서 웹과 갈린 값 셋** — 전부 `react-native-svg` 가 그 기능을 안 갖고 있어서다.

- **`pathLength` 없음** → 단풍잎 둘레를 300 으로 정규화하던 것을 **실측 둘레(601.3157)에 비율을
  곱하는** 방식으로 바꿨다(`components/mapleLeafPath.ts`). 같은 그림의 다른 계산이다.
- **그라디언트 정지점이 `currentColor` 를 못 받는다** → 경고만 찍고 **그라디언트가 통째로 빈다**
  (실측). `MapleSweepSpinner` 의 띠는 색을 `fill="currentColor"` 가, 페이드를 **흰색 알파 램프
  마스크**가 맡도록 갈랐다(흰색은 구체적인 색이라 정지점에 넣을 수 있고, 루미넌스가 1이라 결국
  `stopOpacity` 가 그대로 알파가 된다 — 웹과 같은 램프).
- **`clipPathUnits` 없음** → 웹에서 기본값을 피하려고 명시하던 값인데 RN 에서는 **그것이 유일한
  동작**이라 적을 자리가 없다.

**아직 안 움직이는 것 둘** — `MapleSpinner`(`maple-trail`)·`MapleSweepSpinner`(`maple-sweep`). 둘 다
`@keyframes` 7종에 걸려 있어 step 7 몫이고, 지금 그리는 것은 **그 애니메이션의 0프레임**이다.
반대로 `AnimatedMeso` 는 **모션이 그대로 산다** — 카운트업이 CSS 가 아니라 `@core/lib/use-count-up`
(rAF + `performance.now`)이라 옮길 것이 없었다. step 7 이 함께 처리해야 할 것이 하나 더 있다:
**`motion-reduce:` 의 RN 짝이 없다**(`AccessibilityInfo.isReduceMotionEnabled`). 모션이 없는 지금은
지킬 계약도 없지만, 모션을 붙이는 순간 그 자리가 빈다.

**RN 트리 스냅샷 12장을 새로 떴다**(step 0 관례). 색이 `var()` 라 `ThemeProvider` 밖에서는 스타일이
통째로 빠지므로 스냅샷은 전부 프로바이더로 감싸 찍는다 — 안 감싸면 *"색이 없는 트리"* 를 기준선으로
굳혀서, 나중에 색이 진짜로 빠져도 초록으로 남는다. **이 스냅샷은 여전히 "예전과 같은가"에 답하지
않는다.**

#### 3-4단계 결과 — molecules 11개 (2026-08-12, **에셋 벽에 처음 부딪힘**)

`packages/app-rn/src/components/molecules/` 로 11개가 옮겨졌다(원본은 그대로 — 원칙 3). 각 컴포넌트의
ADR 확인 결과는 [parity-inventory §3](./parity-inventory.md) 의 «확인» 열에 있다.

**이 단계에서 새로 알게 된 것은 대부분 "옮길 수 없는 것"이다.** 셋으로 갈린다.

**① 에셋이 없다 — 셋이 절반만 왔다.** core 는 에셋 목록을 `import.meta.glob` 으로 만드는데
(`boss-icons` · `world-emblem` · `item-icons`), Metro 에는 그 짝이 없다. **`require.context` 는
Metro 엔 있어도 jest 에 없어**(실측: `require.context is not a function`) 이 저장소가 이미 거부한
형태(*"앱은 도는데 테스트만 죽는"* — `core-shims.js`)라 쓸 수 없다. 그래서 step 1 이 만든 치환 표에
셋을 더하고 **URL 만 `null`** 로 둔다(치환 1 → 4). 그 `null` 은 원본이 정의해 둔 폴백 경로라
컴포넌트는 웹과 같은 분기를 탄다 — 보스 초상은 `?` 원, 아이템 아이콘은 회색 원, 월드 엠블럼은 생략.

> **에셋이 아닌 것은 그대로 살렸다** — 보스 크롭 두 표(JSON)와 `isChallengersWorld`([[ADR-031]] 시즌
> 보스 판정)는 대체 구현이 같은 JSON 을 읽어 답하고, 기대값을 JSON 에서 뽑는 테스트가 지킨다.
> `item-icons` 만 통째로 `null` 이다(모듈 전체가 "이름 → 파일 → URL" 한 사슬이라 끝이 없으면 남는
> 것도 없다).

**이미지 분기를 미리 써 두지 않았다.** 죽은 코드라서만이 아니라 **`<Image source>` 에 무엇을 넣을지가
아직 결정되지 않았기 때문**이다 — 웹의 `string` URL 과 달리 RN 정적 에셋은 `require()` 결과(숫자)다.
`BossPortrait` 은 거기에 더해 CSS `background-size: "220% auto"` / `position: "60% 40%"` → RN 기하
변환이 필요한데, 그 계산에는 **그림의 고유 종횡비**가 있어야 해서 에셋이 들어온 뒤에야 쓸 수 있다.
두 결정에는 순서가 있다.

**② 목록을 그릴 방법이 없다 — `CharacterSelectDropdown` 은 닫힌 상태만.** [[ADR-001]] 이 이 컴포넌트에
걸린 이유가 여기서 갈렸다. **웹뷰 사정**(네이티브 `<select>` 메커니즘 · UA 화살표 억제 · `<option>` 에
이미지를 못 넣어 생긴 엠블럼 겹치기)은 RN 에서 문제 자체가 사라지고, **제품 결정**([[ADR-096]] 결정 5
두 크기의 치수 · 선택된 캐릭터의 엠블럼만 · chevron · `onSelect(ocid)`)은 그대로 지킨다. 다만
**RN 에는 `<select>` 의 짝이 없어 앱이 목록을 직접 그려야 하고, 무엇으로 그리는지가 곧 디자인
결정이다**(중앙 모달 · 바텀시트 · 트리거 아래 팝오버 — 셋 다 이 앱의 어법이다). 웹이 그 자리를 OS 에
넘겼으므로 **참고할 옛 디자인이 없다** → step 5(오버레이 계층)와 함께 정한다. 여기서 조용히 새 화면을
만들지 않는다.

**③ `RefreshControl` 과 `PullToRefreshIndicator` 는 겹치는 물건이다.** 갈래를 적어 둔다 —
`RefreshControl` 이 공짜로 주는 것은 [[ADR-072]]·[[ADR-073]] 이 손으로 만든 것 대부분이고(감쇠·임계·
정착·UI 스레드 이동 → [[ADR-073]] 「남은 검증」의 *60fps* 질문이 **사라진다**), 줄 수 없는 것은
정확히 [[ADR-074]] 가 정한 마크다(커스텀 그림 불가 · 당김 진행률을 안 알려줘 **드로잉이 원리적으로
불가능** · 두 구간 연속성). 그래서 컴포넌트는 그대로 옮겨 두고, **고르는 것은 화면 배선(step 6)의
제품 결정**으로 남긴다 — `RefreshControl` 을 고르면 [[ADR-074]] 결정 넷을 폐기하는 새 결정이 필요하다.

> **step 4 가 이 갈래를 닫았다([[ADR-130]]): `RefreshControl`.** 위 표에 없던 사실 하나가 판정을
> 결정했다 — **안드로이드에는 당김 거리 신호 자체가 없다**(iOS 는 `bounces` 로 `contentOffset.y` 가
> 음수가 되지만 안드로이드 `ScrollView` 는 콘텐츠를 안 움직이고 글로우만 그린다). 커스텀은 그
> 플랫폼에서 **옮기기가 아니라 새로 만들기**가 된다. 필요한 새 결정도 함께 썼다.

**새로 대체한 `className` 넷**(step 3 의 목록에 이어서). 넷 다 **에러 없이 조용히 사라지는** 종류다.

| 자리 | 웹 | RN | 왜 |
|---|---|---|---|
| `PartySizeStepper` | `disabled:opacity-40` | **JS 조건** | NativeWind 의 `disabled:` 는 CSS 의사 클래스라 `Pressable disabled` 프롭과 이어져 있지 않다 — 비활성 버튼이 **멀쩡한 색으로 보인다** |
| 숫자 두 자리 | `tabular-nums` | `fontVariant`(`lib/text-styles.ts`) | NativeWind 가 그 클래스를 **스타일 없이 통과시킨다**(실측). 폭이 흔들려도 에러가 안 난다 |
| `EmptyState` 단풍잎 | `fill-primary-ink` | `text-primary-ink` + `fill="currentColor"` | RN style 에 `fill` 이 없다. 색은 `Svg` 의 `color` 프롭에서 온다(step 3 배선) |
| 절대 배치 세로 중앙 | `top-1/2 -translate-y-1/2` | `inset-y-0` + `justify-center` | 퍼센트 `translate` 는 RN 에서 해석이 갈린다. 같은 결과를 **레이아웃만으로** 낸다 |

**아이콘은 `lucide-react-native` 1.24.0**(웹의 `lucide-react` 와 같은 버전 — 그림이 갈리면 같은
아이콘이 두 앱에서 다르게 보인다). 두 가지를 실측으로 정했다.

- **배럴이 아니라 아이콘별 경로로** 가져온다. `import { Users } from 'lucide-react-native'` 는 아이콘
  1,900개를 전부 그래프에 넣고 Metro 는 트리셰이킹을 하지 않는다 — 같은 8개를 쓰는데
  **배럴 3,365 모듈·5.5 MB vs 개별 1,626 모듈·3.7 MB**(1.8 MB 차이, `expo export`). OTA 로 나가는 앱이라
  이 차이가 매 배포의 다운로드 크기다.
- **`className` 은 아이콘마다 `cssInterop` 등록이 필요하다**(`lib/icons.ts` 한 파일에 모았다). 등록을
  빼먹으면 SVG 와 같은 실패 모양 — 색·크기 없는 아이콘이 조용히 그려진다. 덤으로 알게 된 것:
  lucide 의 `Icon` 이 `testID` 를 가로채 `data-testid` 로 바꾸므로 **아이콘에는 `testID` 를 줄 수 없다**
  (지목해야 하면 감싸는 `View` 에 준다).

**jest 설정 두 곳을 고쳤다** — `lucide-react-native` 가 `react-native` 조건에서 **ESM 만** 내보내는데
`transformIgnorePatterns`(node_modules 제외)와 `transform`(`\.[jt]sx?$` 라 `.mjs` 는 트랜스포머가 없다)
둘 다 막고 있었다. CJS 빌드로 매핑하는 대신 프리셋 값을 고친 것은 *"두 도구가 같은 파일을 본다"* 를
지키기 위해서다. **`fireEvent` 는 RNTL 14 에서 Promise 를 돌려준다** — `await` 를 빠뜨리면 act 범위가
겹쳐 **그 뒤 테스트들이 무관해 보이는 이유로 깨진다**(실측, 이 단계에서 한 번 겪었다).

**RN 트리 스냅샷 16장을 새로 떴다.** 이 스냅샷도 여전히 *"앞으로 안 바뀌는가"* 에만 답한다.

#### 3-5단계 결과 — organisms 10개 (2026-08-12, **떠 있는 것을 무엇으로 그리는가**)

`packages/app-rn/src/components/organisms/` 로 10개가 옮겨졌다(원본은 그대로 — 원칙 3). 각 컴포넌트의
ADR 확인 결과는 [parity-inventory §3](./parity-inventory.md) 의 «확인» 열에 있다. **커밋을 둘로
쪼갰다** — `CharacterTrackingPicker`(ADR 11개)를 먼저 끝내고, 나머지 일곱을 뒤에 뒀다.

**이 계층의 벽은 하나다: 웹의 오버레이 넷이 전부 `createPortal(document.body)` + `z-*` 인데 RN 에는
문서도 z-index 도 없다.** `absolute inset-0` 은 **부모 상자에 갇혀** 탭 화면 안에서 열면 탭바조차 못
덮는다. 화면 전체를 덮는 방법은 `react-native` 의 `Modal`(별도 네이티브 윈도우) 하나뿐이라 셋이 그리로
갔고, 그 대가로 **웹이 손으로 만들던 것 둘이 공짜가 됐다** — `useBodyScrollLock` 은 *대체가 아니라
필요 자체가 사라졌고*, [[ADR-039]] 정정 1·2(`pointer-events-auto` · `data-sheet-keep-open`)는 원인이
Radix `dismissable-layer` 였어서 **문제 자체가 없다**.

**`ToastStack` 만 그 길로 갈 수 없다.** 안드로이드에서 `Modal` 은 화면 전체의 터치를 삼키는
다이얼로그다. 그래서 자기가 놓인 자리에 절대 배치로 그리고 마운트 위치는 앱 셸이 정하는데, **남는
한계를 적어 둔다** — `Modal` 이 열려 있는 동안 뜬 토스트는 그 윈도우 뒤에 가린다(웹은 z-60 으로 항상
앞이었다). 실제로 걸리는 자리가 있다: 파티 인원 모달이 열린 채 저장이 실패하면 그 토스트가 안 보인다.
오버레이를 한 루트 호스트로 모으면 풀리지만 그것은 화면 배선의 결정이라 여기서 미리 정하지 않았다.

**터치를 누가 가져가는지가 `stopPropagation` 의 자리를 대신한다.** RN 에는 이벤트 버블링이 없다 —
자식이 responder 를 선언하지 않으면 바깥 `Pressable` 이 받아 모달이 닫힌다. 그래서 두 패널이 웹에서
`onClick={stopClickPropagation}` 을 갖던 **바로 그 자리**에 `onStartShouldSetResponder` 가 선다.
`Toast` 의 스와이프도 같은 축이다 — **`onMove…` 에서만** responder 를 가져오는 것이 요점이고(시작에서
가져가면 안쪽 버튼이 안 눌린다), 웹이 `closest('button')` 로 걸러내던 목적을 규칙이 구조로 해 준다.
`PanResponder` 는 일부러 안 썼다(터치 히스토리에서 제스처를 스스로 계산해, 웹이 갖던 *"시작점 하나와
현재 x"* 라는 단순한 모델을 대신 세운다).

**[[ADR-120]] 결정 18 후반(2단계가 organisms 몫으로 남긴 자리)이 여기서 채워졌다** — 오버레이의
안드로이드 뒤로가기는 `onRequestClose` 로, **스택을 pop 하는 대신 그 오버레이만 닫는다**.

**라이브러리 기본값을 세 자리에서 거부했다**(`BottomSheet`, [[ADR-039]]). 고정 `snapPoints`(그 ADR 의
`max-h-[82vh]` 는 *상한*이지 높이가 아니다) · 전폭(→ `max-w-md` 448 중앙) · 백드롭 기본 알파(→ `bg-scrim`
토큰 + `opacity={1}`, 안 끄면 라이트 테마에서 스크림이 두 겹이 된다). 라이브러리를 바꿔도 *"스킨과
공개 API 는 그대로"* 라는 [[ADR-039]] 의 판단이 그대로 선다.

**[[ADR-122]] 모드 분기는 이 단계에서 값을 쓸 뿐이다.** step 1 이 파생 토큰 `--color-panel-border` 를
만들어 두어 분기가 `theme-vars.ts` 에서 `definition.mode` 로 **딱 한 번** 일어나고, 컴포넌트는
`border-panel-border` 한 클래스를 쓴다 — **테마 이름으로 가르지 않는다**([[ADR-064]] 결정 8 이 폐기한
수동 목록이 CSS 쪽에 되살아나는 것을 막는다). 다만 그 결정의 **두 클래스 중 하나는 짝이 없다**:
`.panel-on-scrim-parent > *` 는 자손 선택자라 RN 에서 부모가 자식 스타일을 정할 방법이 없어, 자식이
직접 그 클래스를 쓰는 것으로 대신했다.

**새로 대체한 `className` 셋**(step 3·4 목록에 이어서).

| 자리 | 웹 | RN | 왜 |
|---|---|---|---|
| `CharacterTrackingGrid` | `grid grid-cols-3 gap-2` | 셀 `w-1/3 p-1` + 줄 `-m-1` | Yoga 에 **CSS Grid 가 없다**. `flex-wrap`+`gap` 으로 옮기면 3열 폭이 `calc((100% − 16px) / 3)` 여야 하는데 그 식을 줄 방법이 없어 **좁은 폭에서 조용히 2열로 접힌다** |
| `PartySizeModal` 닫기 버튼 | `bg-surface/60` | 값에서 `rgba()` | NativeWind(v3 엔진)는 `var()` 색에 **투명도 접미사를 못 만든다**(step 3 이 남긴 함정) — 클래스가 사라지고 배경이 없어진다 |
| `CharacterTrackingGrid` 별 | `fill-primary-ink` | lucide `fill` 프롭에 **테마 값** | `fill` 은 CSS 속성이라 RN 스타일로 안 나간다. 여기서는 `currentColor` 로도 안 된다 — 그 값의 출처는 `Svg` 의 `color` 프롭인데 **lucide 는 색을 `stroke` 로만 넘긴다** |

**`@keyframes` 두 개가 또 밀렸다** — `toast-shrink`(남은 시간 바)와 `DropEffectOverlay` 의 재생·팝인.
Toast 는 구조가 다 서 있어 step 7 이 값만 굴리면 되지만, **드롭 연출은 그 이상이다**: 프레임 에셋이
네 단계 모두 빈 배열이고(에셋 레이어) 재생 루프가 DOM(`new Image()` · `el.complete` ·
`el.style.transform`) 위에 서 있어 통째로 다시 써야 한다. [[ADR-103]] 의 **판정 근거가 성능이 아니라
눈**이라는 사실을 주석에 박아 뒀다(2배 → 사용자 반려 → 1.5배) — 되살릴 때도 «단계별 fps 표 + 한 배율»
구조를 먼저 세우고 값은 실기기에서 확정한다.

**[[ADR-117]] 결정 6 은 셋 중 하나만 대응된다**(`ErrorBoundary`). 웹판의 `hideSplashScreen()` 한
호출이 웹뷰의 사슬 셋을 끊었는데, RN 에는 ⑵ *"폴백이 커버 밑에 그려진다"* 만 남는다 — ⑴ 의 `#boot-cover`
는 `index.html` 의 DOM 이고, ⑶ 의 `isUserInteractionEnabled=false` 는 Capacitor 플러그인의 동작이다.
그래서 **호출은 남되 이유가 하나로 줄었다.** 함께 갈린 것이 하나 더 있다 — **'다시 시작'이 필수
프롭이 됐다.** 웹 기본값 `location.reload()` 의 짝이 RN 에 없고(번들 재실행은 OTA 런타임의 일,
[[ADR-128]] 결정 7), 없는 기본값을 지어내면 같은 예외로 즉시 되돌아오는 버튼이 되어 [[ADR-065]]
결정 5 가 세운 *"선택지가 하나여서 그 하나가 분명해진다"* 를 깬다.

**남은 어긋남 하나를 적어 둔다** — core 의 `ToastAction.icon` 이 `lucide-react`(웹) 타입이라
`lucide-react-native` 아이콘이 **타입상 들어가지 않는다**. 렌더만 하는 `Toast` 는 무사하고, **아이콘을
넘기는 쪽**(설정 열기 토스트 등)이 화면 단계에서 걸린다. 이 단계는 core 무수정이라(원칙 3) 사실만
남긴다 — 푸는 방법은 그 필드를 플랫폼 중립 컴포넌트 타입으로 넓히는 것이다.

**RN 트리 스냅샷 11장을 새로 떴다**(파일 8개 — `CharacterTrackingPicker` 만 상태 둘). 여전히
*"앞으로 안 바뀌는가"* 에만 답한다.

#### 3-6단계 결과 — templates 4개 (2026-08-12, **`position: fixed` 가 없다**)

셋을 옮기고 하나를 버렸다. ADR 확인 결과는 [parity-inventory §3](./parity-inventory.md) 의 «확인»
열에 있다.

**이 계층의 벽은 하나다: 웹 셸 셋이 전부 `position: fixed` 위에 서 있었다.** `PageHeader` 는 고정
헤더 + 실측 spacer, `ScreenScroll` 은 뷰포트 크기 상자, `StackScreen` 은 `fixed inset-0` 오버레이 +
포털이었다. RN 에는 문서도 뷰포트 기준 위치도 없어 셋 다 그대로 옮길 수 없는데, **그 셋이 원래
표현하려던 것은 `fixed` 가 아니라 각각 다른 사실**이었다 — *"헤더는 스크롤과 무관하다"* ·
*"이 화면이 자기 스크롤을 소유한다"* · *"이 화면은 다른 화면 위에 얹혀 있다"*. RN 에는 셋 다 원래
수단이 있다: **형제 뷰 · `ScrollView` 자신 · 네이티브 스택.**

**그래서 이 단계에서 사라진 코드가 옮겨온 코드보다 많다.** 없어진 것은 전부 `fixed`/포털이 만든
문제를 푸는 machinery 였다.

| 사라진 것 | 그것이 풀던 문제 | RN 에서 |
|---|---|---|
| spacer + `useMeasuredHeight`([[ADR-112]]) | `fixed` 헤더가 흐름에서 빠진 자리를 채우고, 그 값이 헤더와 **같은 커밋에** 갱신되게 한다 | 헤더가 흐름 안이라 **맞출 대상이 없다** |
| `StackScreen` 전부([[ADR-120]]) | 오버레이 레이어·전환·스와이프·층 스크림·깊이 스토어 | 네이티브 스택(2단계) |
| `--tab-bar-h` 실측([[ADR-099]] 결정 7) | 스크롤포트를 탭바 위에서 끝낸다 | 탭 내비게이터가 **이미 뺀 상자**를 준다 |
| 안쪽 래퍼의 `-mt-[var(--sa-top)]` | 상자를 내린 만큼 콘텐츠를 되돌린다(spacer 가 흡수) | spacer 가 없으니 되돌릴 것도 없다 |

**[[ADR-112]] 를 흉내 냈다면 그 ADR 이 고친 결함을 되살렸을 것이다.** 그 결정의 핵심은 *"측정
`setState` 가 페인트 **전에** 동기 반영된다"*(`useLayoutEffect`)인데, RN 의 `onLayout` 은 레이아웃
**뒤**에 오는 비동기 통보라 그 계약을 원리적으로 만족시킬 수 없다 — 웹 형태를 그대로 옮겼다면
[[ADR-085]] 결정 1 이 금지한 *"첫 프레임에 spacer 0"* 이 그대로 났다. 형태를 바꾼 것이 계약을
지키는 길이었다.

**대신 새로 생긴 것이 둘이다.** ① `PageHeader` 의 `z-10` 은 이제 *"목록 위에 그린다"* 가 아니라
**"헤더의 삐져나온 자식(페이드·당김 인디케이터)이 뒤 형제인 스크롤 뷰 위에 그려진다"** 를 뜻한다 —
RN 은 형제 순서가 곧 그리는 순서라, 없으면 페이드가 목록 **밑**에 깔려 조용히 사라진다. ②
`ScreenScroll` 에 **`header` 프롭**이 생겼다. 헤더가 형제여야 하니 둘을 나란히 놓는 일을 누군가
해야 하는데, 화면마다 하면 [[ADR-094]] 가 `PageHeader` 로 없앤 복붙이 한 겹 위에서 되살아난다.

**같은 뿌리에서 [[ADR-088]]·[[ADR-123]] 은 오히려 구조로 지켜진다.** 배경 조각의 `z-index: -1` 은
*"헤더 자신의 배경 위, 콘텐츠 아래"* 를 만들려던 것인데 RN 에서는 **첫 자식**이면 같은 결과라 값이
필요 없고, 페이드의 블러 금지는 `backdrop-filter` 자체가 없어 되붙일 방법이 없다.

**웹의 마스크는 값으로 접었다.** 경계 페이드는 색 그라데이션 위에 같은 방향 마스크를 겹쳐 알파가
**(1−t)²** 였는데, RN 에는 마스크가 없어 그 결과를 정지점 다섯으로 직접 적는다. 끝 색을
`transparent`(= 투명 **검정**)로 두지 않고 **알파 0 인 `bg`** 로 둔 것도 짝이 되는 결정이다 —
브라우저는 그라데이션을 미리 곱해진 알파로 보간하지만 네이티브는 그렇지 않아 중간이 어두워진다.

**하나는 RN 이 웹뷰만큼 못 한다** — [[ADR-120]] 결정 19 의 하단 인셋 두 조각. 웹뷰 플러그인은
`tappableElement` 인셋으로 3버튼과 제스처를 갈랐는데(*"높이로 어림잡지 않는다"*)
`react-native-safe-area-context` 는 그 구분을 주지 않는다. 그래서 **플랫폼으로 가르고**(iOS = 홈
인디케이터라 전부 통과 · 안드로이드 = 모르므로 보수적으로 막음) 그 대가를 `bottom-inset.ts` 에
이름과 함께 적어 뒀다 — 되살리려면 `modules/app-system-bars` 에 그 값을 얹으면 되지만 인셋은
변하므로 값 하나가 아니라 **구독**이 필요하다.

**`SystemBarsPort` 가 이 단계에서 해소됐고, 두 메서드의 답이 정반대였다.** `setNavigationBarStyle`
은 뷰 레이어와 무관한 창(window) 설정이라 웹뷰 플러그인의 그 한 줄
(`setAppearanceLightNavigationBars(!dark)`)을 로컬 Expo 모듈로 그대로 옮겼다 — RN·Expo 어디에도 이걸
여는 API 가 없고(`expo-status-bar` 는 상단만), 의존성을 하나 더 들이는 대신 `app-background`
(2단계)와 같은 방식을 썼다. **핵심은 이것이 `core` 가 매 테마 적용마다 부르는 경로라는 것이다** —
던지게 두면 테마를 바꿀 때마다 처리되지 않은 거부가 남는다.

반대로 `refreshSafeAreaInsets` 는 **의도적 no-op** 이다. 그 함수의 존재 이유는 *"못 하는 일"* 이
아니라 **유실 복구**였고(네이티브의 최초 인셋 주입이 DOM 준비보다 빠르면 값이 사라진다), RN 에는
주입도 유실도 없이 `SafeAreaProvider` 가 회전·접힘·키보드까지 스스로 다시 내려준다. 즉 *"이미 되고
있다."* 던지면 **정상 동작을 고장으로 보고**하게 되므로, `not-implemented.ts` 의 기준으로 이쪽은
*"이 플랫폼에 개념이 없다"* 칸이고 그 칸의 처리는 조용한 no-op 이 아니라 **이유가 적힌 no-op** 이다
(그 이유를 테스트가 계약으로 들고 있다).

**RN 트리 스냅샷 3장을 새로 떴고**(`PageHeader` 1 · `ScreenScroll` 2), `withAlpha` 는 두 번째
호출부가 생겨 `lib/color-alpha.ts` 로 뺐다([[ADR-094]] 결정 1).

**남긴 미결 하나** — 당겨서 새로고침을 `RefreshControl` 로 갈지 [[ADR-074]] 의 커스텀 마크로 갈지는
**제품 결정**이라 이 셸이 어느 쪽도 배선하지 않았다(그 갈래표는 step 4 가
`PullToRefreshIndicator` 주석에 적어 뒀고, `RefreshControl` 을 고르면 그 ADR 의 결정 넷을 폐기해야
한다). → **step 4 에서 `RefreshControl` 로 닫혔고**([[ADR-130]]) 이 셸은 `refreshControl` 프롭 하나를
받아 `ScrollView` 로 넘긴다.

#### 3-7단계 결과 — `@keyframes` 7종 (2026-08-12, **눈으로 판정할 것을 숫자로 붙들어 둔다**)

넷을 옮기고 셋은 4단계로 넘겼다. 갈리는 기준은 난이도가 아니라 **그 애니메이션이 붙는 요소가 어느
계층에 사는가** 다.

| 키프레임 | 어디에 | RN 에서 | 상태 |
|---|---|---|---|
| `maple-trail` | `MapleSpinner` | `useAnimatedProps` 로 `strokeDashoffset` | ✅ |
| `maple-sweep` | `MapleSweepSpinner` | `useAnimatedProps` 로 띠 `<Rect>` 의 `y` | ✅ |
| `toast-shrink` | `Toast` 남은 시간 바 | Reanimated **CSS 애니메이션** | ✅ |
| `fx-drop-float` | `DropEffectOverlay` 중앙 아이템 | Reanimated **CSS 애니메이션** | ✅ (렌더는 에셋 대기) |
| `valuable-drop-glow`·`-spin`·`-row-pulse` | `app/boss-profit/*` 의 카드·행 | — | **4단계** |

곁가지 둘도 함께 왔다 — `ProgressBar` 의 `transition-[width]`(CSS 트랜지션)와 `Toast` 의 진입
트랜지션. 그리고 **아무것도 안 고쳤는데 살아난 것이 둘** 있다: `LoadingState` 의 스피너와
`PullToRefreshIndicator` 의 재조회 링은 파일이 한 줄도 안 바뀌었는데 스피너가 돌기 시작하며 따라왔다.

**"8종"은 틀린 수였다.** 이 문서가 일곱을 적고 *"외"* 를 붙여 어림잡았는데 실제로는 그 일곱이
전부다. 고친 것은 숫자가 아니라 **세는 주체**다 — `keyframes-parity.test.ts` 가 `index.css` 를 읽어
목록을 「이 단계 몫」과 「화면 몫」으로 남김없이 가르고, 새 `@keyframes` 가 생기면 분류될 때까지
빨개진다. 지속시간·이징·이동 거리도 같은 방식으로 **원본 파일에서 읽어** 대조한다(`transition-[width]`
는 Tailwind 프리셋 기본값이라 `tailwindcss/theme.css` 를 읽는다 — `tailwind-v4-axes.cjs` 와 같은
방식·같은 이유). 값을 테스트에 손으로 적으면 웹이 바뀌어도 조용히 통과한다.

**이 저장소의 모션은 두 갈래다: View 스타일 = CSS API · SVG 속성 = `useAnimatedProps`.** Reanimated 4
는 `@keyframes` 를 거의 그대로 옮길 수 있는 CSS API 를 갖고 있고 SVG 지원도 코드 안에 들어 있지만
(`css/svg` 의 `initSvgCssSupport`) **패키지 진입점에서 내보내지 않아** 내부 경로를 파고들어야 닿는다
(실측 — `react-native-reanimated/css/svg` 는 해석되지 않는다). 사설 경로에 기대는 대신 SVG 속성에는
문서화된 `useAnimatedProps` 를 쓴다.

**같은 그림을 다른 속성으로 만든 자리가 둘이다.** ① `maple-trail` 은 웹이 `pathLength={300}` 으로
둘레를 정규화해 `-300` 까지 굴렸는데 `react-native-svg` 에 그 속성이 없어 **실측 둘레**까지 굴린다 —
숫자를 맞출 수 없으므로 *"한 주기 = 둘레 한 바퀴"* 라는 **성질**을 대신 지킨다(깨지면 반복이
이어붙는 자리에서 트레일이 튄다). ② `maple-sweep` 은 웹이 띠에 `translateY` 를 걸었지만 RN 은
**`<Rect>` 의 `y` 자체**를 굴린다 — `<G>` 의 transform 은 JS 에서 matrix 로 접혀 나가 UI 스레드
갱신이 그 접기를 건너뛰기 때문이다. 그래서 옮길 대상을 transform 이 아니라 좌표로 골랐다.

**`motion-reduce:` 의 RN 짝이 이 단계에서 붙었다**(step 3 이 남긴 숙제). `useReducedMotion()` 이 4곳에
배선됐고 — 두 스피너는 애니메이션을 아예 안 걸어 0프레임에 머물고, `Toast` 는 남은 시간 바가 통째로
사라지며(줄지 않는 막대는 *"시간이 안 간다"* 로 읽힌다), 드랍 연출은 부유가 빠진다 — 웹의 각
`motion-reduce:` 변형이 남기던 그림과 같다.

**그런데 그 계약을 보는 방법이 바뀌었다.** 웹은 `motion-reduce:animate-none` 이 **클래스 문자열**이라
렌더 결과에서 그대로 읽혔지만 RN 에는 그 문자열이 없고, SVG 속성 애니메이션은 UI 스레드가 갱신하므로
**jest 의 렌더 트리는 켜 놨을 때나 꺼 놨을 때나 문자 단위로 같다**(실측). 그래서 *"반복 애니메이션을
걸었는가"* 를 본다(`components/__tests__/reduced-motion.ts`). 판별력은 구현을 일부러 뒤집어
확인했다 — 가드를 지우고 되감기를 켜자 두 케이스가 실패했고 **스냅샷은 그대로 통과했다**(그 통과가
이 창이 따로 필요한 이유다).

**스냅샷 하나가 애니메이션과 경주하고 있었다.** `Toast` 는 마운트 뒤 한 프레임 미뤄 진입 상태로
가는데(바로 최종 상태를 주면 트랜지션이 재생되지 않는다) 그 프레임이 `render` 의 await 와 경주해
스냅샷이 회차마다 갈렸다 — **전체 실행 3회 중 1회 실패, 단독 실행은 늘 통과**. step 7 이 만든 것이
아니라 원래 있던 성질이고, 그 자리에 실제 트랜지션이 들어오며 드러났다. `flushEnterFrame()` 으로
최종 상태에 고정했다(시작 상태로 고정하려면 이미 예약된 프레임을 **막아야** 하는데 그건 런타임과
싸우는 일이고, 무엇보다 그 한 프레임은 사용자가 보는 그림이 아니다). 그 시작 프레임은 **결정적으로
관측할 수 없다는 것도 확인했다** — 그것을 단언하는 케이스를 써 봤더니 그 케이스가 먼저 깨졌다.

**[[ADR-103]] 의 1.5배는 그대로 옮겼다.** 그 배율은 계측이 아니라 **눈**으로 정해진 값이라(2배 →
사용자 반려 → 1.5배) RN 에서 다시 정하려면 실기기에서 다시 보는 것이 선행돼야 한다. 이 단계는 옮기는
작업이다.

**당겨서 새로고침은 새로 만들지 않았다.** [[ADR-074]] 의 두 구간이 이제 코드 위에서는 둘 다 산다 —
재조회 링은 스피너가 살아나며 따라왔고, 당김 드로잉은 애니메이션이 아니라 **손가락 위치의 함수**라
원래부터 살아 있었다. `RefreshControl` 과의 갈래는 여전히 **제품 결정**이라 step 6 이 남긴 그대로 둔다.
(→ step 4 가 `RefreshControl` 로 닫았다 — [[ADR-130]]. **그래서 이 두 구간은 끝내 눈으로 못 봤다**:
컴포넌트는 남지만 호출부가 0 이 됐고, 고아 확정과 삭제는 step 5·7 뒤다.)

**남은 하나는 시간이 아니라 에셋에 막혔다** — `DropEffectOverlay` 의 재생 엔진과 팝인. RN 의 `Image`
는 **원격 URI 의 고유 크기를 모르고**(`require()` 로 번들에 든 에셋만 스스로 안다) [[ADR-048]] 의
배치는 origin 을 *그 프레임 비트맵 크기 위에서* 되미는 일이라, 에셋이 어떤 모양으로 오는지가
정해지기 전에 배치 코드를 쓰면 그 결정을 코드가 몰래 대신 내리게 된다(크기 표는
`DROP_EFFECT_ORIGINS` 의 **주석에만** 있어 데이터로 읽을 수도 없다). 팝인도 같은 이유다 — 대상이
아직 없는 `<Image>` 이고 그것을 켜는 트리거가 그 엔진이다.

**판정은 여전히 눈이고, 이 단계에서는 한 번도 못 봤다.** 화면이 없어 볼 대상이 없다 — 두 스피너의
실제 움직임, 스윕 마스크가 띠를 따라가는지, `toast-shrink` 가 지속시간과 맞는지, PTR 두 구간의
연속성, 진행률 바 트랜지션의 체감은 전부 4단계에서 두 앱을 나란히 놓고 볼 대상이다(«잃는 안전망»).
자동 테스트가 담보하는 것은 **숫자와 on/off** 이지 그림이 아니다.

### 4단계 — `app/` 화면 재작성

- 화면 15개 + 하위 컴포넌트. **파일별 ADR 계약 체크리스트를 소진**하며 진행(원칙 2)
- **게이트**: 각 화면의 테스트 통과 + 그 화면에 걸린 ADR 전부 확인 완료

#### 4-0단계 결과 — 앱 셸 (2026-08-12, **화면이 아니라 순서가 산출물이다**)

웹 `AppShell`(573줄)의 짝을 세웠다. 그 파일이 하던 일은 **화면 배치보다 부팅 순서**였고, 순서가
틀렸을 때 드러나는 모습이 *"흰 화면"* · *"스플래시가 안 걷힘"* · *"광고가 안 뜸"* 이라 어느 것도
스택 트레이스를 남기지 않는다. 그래서 이 단계의 가장 오래 쓰일 산출물이 아래 표다.

**전수 대조 — 웹이 하던 열아홉을 넷으로 가른다.**

| 웹 `App.tsx` 가 하던 것 | RN | 어디에 |
|---|---|---|
| **그대로** | | |
| 저장소 복원 넷(온보딩·테마·트래킹 모드·드롭 연출) | 이펙트 넷, 각자 하나씩 | `AppShell` |
| 광고 SDK 초기화 + 첫 광고 사전 로드([[ADR-090]]) | 그대로 | `AppShell` |
| 탭 스토어 선하이드레이션([[ADR-101]]) — 완료 상태에서만 · 동적 import | 그대로 | `AppShell` → `app/prehydrate.ts` |
| 최소 표시 시간 뒤 스플래시 내리기([[ADR-025]]) | 그대로 | `AppShell` |
| 실패 안전 타이머로 스플래시 내리기([[ADR-117]] 결정 3) | 그대로(8초) | `boot-splash.ts` |
| `ErrorBoundary` 폴백이 스플래시를 내린다([[ADR-117]] 결정 6) | 그대로 — **단 이유가 셋 중 하나로 줄었다**(3-5단계) | `ErrorBoundary` |
| 키 무효화·429 안내 모달([[ADR-115]]·[[ADR-116]]) | 그대로, 내비게이터 **밖** | `AppShell` |
| 토스트 스택 | 그대로 | `AppShell` |
| **바뀜** | | |
| 스플래시 붙들기 = `capacitor.config.ts` 의 `launchAutoHide:false` | `SplashScreen.preventAutoHideAsync()` — **전역 스코프**여야 한다 | `boot-splash.ts` |
| 키보드 뜨면 `<BottomTabBar />` 언마운트 | `tabBarHideOnKeyboard`(라이브러리가 자기 구독으로 판정) | `TabNavigator` |
| 그 값을 셸이 state 로 들고 있음 | 남는다 — **토스트가 탭바 위에 서야 하는지** 하나 때문에 | `use-keyboard-visible.ts` |
| 라우팅·탭바·`lazy`·`Suspense`·`STACK_PRELOADERS`·`TabLayer` | react-navigation(3-2단계) | `navigation/` |
| 시스템 뒤로가기(`useSystemBack`) | `use-root-back.ts` + 네이티브 스택 | `navigation/` |
| 탭 클릭 인터셉터([[ADR-050]] 문서 리로드 방어) | **`listeners.tabPress`**(3-2단계) — 방어할 `<a href>` 가 없다 | `TabNavigator` |
| 전역 에러 경계 위치 = 라우터 **밖**([[ADR-065]] 결정 5) | 프로바이더 **안** — 밖에 두면 폴백이 `var(--color-*)` 를 못 찾아 **색이 통째로 빠진다**(3-1단계 실측) | `App.tsx` |
| **사라짐** | | |
| `refreshSafeAreaInsets()` | 의도적 no-op — `SafeAreaProvider` 가 이미 한다(3-6단계) | — |
| `--tab-bar-h` 실측·`theme-backdrop`·`min-h-screen` | 3-6·3-1단계가 각각 흡수 | — |
| `consumePendingNotice()` → 캐시 삭제 실패 토스트([[ADR-065]] 결정 3) | **짝이 없다**(아래) | — |
| **안 이어짐 (OTA)** | | |
| `checkOnBoot()`([[ADR-027]]) · `notifyLiveUpdateReady()`([[ADR-117]] 결정 2) | **부르지 않는다** | — |
| `<UpdatePromptModal />` 마운트 | 컴포넌트는 있고 **마운트는 없다** | — |

**«그대로» 칸이 «바뀜»보다 많은 것이 이 단계의 결과다.** 부팅 순서는 웹뷰 사정이 아니라 제품
결정이었고, 그래서 대부분 옮겨졌다. 바뀐 것들은 하나같이 *"웹이 문서·CSS 로 하던 일을 RN 에서는
다른 층이 한다"* 이지 결정이 바뀐 것이 아니다.

**OTA 는 화면은 있고 값이 없다.** `UpdatePromptModal`(상태 아홉·[[ADR-126]] 결정 1 의 아코디언
포함)을 다 그려 놓고 **마운트하지 않았다.** 벽이 둘인데 둘 다 [[ADR-128]] 결정 7 이 미뤄 둔
프로토콜 재설계에 걸린다 — `LiveUpdatePort` 가 던지고, 그보다 앞서 core 의 live-update 스토어는
**import 하는 것만으로** 죽는다(`import.meta.env` 를 모듈 최상위에서 읽는다 — `import.meta.glob`
과 같은 종류의 벽이고, 이쪽은 아직 치환 대상이 아니다. 대체 구현이 곧 "가짜 OTA 스토어"라
프로토콜을 정하기 전에 만들면 그 결정을 코드가 몰래 대신 내린다). 그래서 모달은 **스토어를 부르지
않고 값을 프롭으로 받고**, 타입만 `import type` 으로 가져와 상태 아홉이 두 벌이 되지 않게 했다 —
OTA 가 붙는 날 배선은 `state={useLiveUpdateStore()}` 한 줄이다.

딸려 오는 공백 셋을 적어 둔다. ① [[ADR-117]] 결정 2 의 **자동 롤백이 없다**(되돌릴 번들 자체가
아직 없다). ② [[ADR-126]] 결정 4 의 **「업데이트를 마쳤어요」가 안 뜬다**(판정이 스토어의
`checkOnBoot` 안에 있다). ③ [[ADR-065]] 결정 3 의 **캐시 삭제 실패 토스트가 리로드를 못 넘는다** —
`consumePendingNotice` 가 `sessionStorage` 위에 서 있어 RN 에는 짝이 없다(`reloadAppAsync()` 는 JS
런타임을 통째로 다시 실행한다). 부르면 항상 `null` 이라 *"있는데 안 도는 코드"* 가 되므로 **셸에
넣지 않았다.** 그 삭제 흐름 자체가 설정 화면(step 3) 몫이라, 대체 수단은 그때 함께 정한다.

**부팅 순서는 이제 테스트가 들고 있다**(`src/__tests__/boot-order.test.tsx`). 셋을 본다 — ① 셸이
무엇을 언제 하는가(렌더 관측) ② 진입점 순서(`installPorts()` → `holdSplashUntilAppReady()` →
`registerRootComponent`, 소스 읽기 — 트리 밖이라 렌더로는 못 본다) ③ **OTA 가 아직 아무 데도 안
이어져 있는가**(소스 스캔: live-update 스토어는 `import type` 으로만 · `@core/native/live-update`
호출 0건 · `UpdatePromptModal` import 0건). ③이 스캔인 이유는 값 import 가 하나 생기면 **그 순간
앱도 테스트도 안 떠서** 호출 관측이 성립하지 않기 때문이다.

**'다시 시작' 의 짝은 있었다 — 3-5단계 주석을 정정한다.** 그때 *"RN 에는 `location.reload()` 의
짝이 없고 번들 재실행은 OTA 런타임의 일"* 이라 적었는데 **사실이 아니다.** `expo` 의
`reloadAppAsync()`(expo-modules-core)가 release·debug 양쪽에서 **지금 도는 것과 같은 번들**을 다시
실행한다 — 새 업데이트를 집는 `Updates.reloadAsync()` 와 갈리는 지점이 정확히 그것이라 [[ADR-128]]
결정 7 을 기다릴 필요가 없다. 즉 [[ADR-065]] 결정 5 의 복구 수단이 **실제로 존재한다.** 프롭으로
받는 구조는 그대로 둔다(폴백을 그리는 것과 재시작 수단을 아는 것은 다른 관심사다).

**함정 둘을 실측으로 찾았다.** 둘 다 이 단계에서 실제로 걸렸다.

| 자리 | 무슨 일이 | 왜 |
|---|---|---|
| `UpdatePromptModal` 「자세히 보기」 화살표 | 펼치는 순간 **힙을 다 써서 죽는다**(jest OOM · dev 번들 동일) | transform 이 **첫 렌더에 없다가 나중에 생기면** NativeWind 는 호스트를 `Animated.View` 로 올려야 하는데 리마운트라 포기하고 **개발 경고**를 찍는다. 그 경고가 `originalProps` 를 직렬화하는데(`stringify`) 순환 가드가 **경로 단위**뿐이라 React 엘리먼트 그래프를 헤맨다. 처방은 두 상태 모두 transform 을 갖는 것(`rotate-0` ↔ `rotate-180`) — 라이브러리 경고문의 *"기본 스타일을 두라"* 가 이것이다 |
| 셸 안의 동적 `import()` | jest 에서 **동기적으로 던져** 마운트가 통째로 죽는다 | `--experimental-vm-modules` 없이는 Node 가 거부한다. 정적 import 로 되돌리면 평가 시점이 바뀌므로(이 패키지 Metro 는 `inlineRequires: false` — 실측) **형태를 유지한 채 `app/prehydrate.ts` 로 가뒀다.** 그 경계 덕에 [[ADR-101]] 결정 6 게이트를 처음으로 붙들 수 있다 |

> 첫 줄은 **step 3~7 이 모은 «조용히 안 되는 것» 목록과 같은 가족이되 반대**다 — 그 넷은 에러 없이
> 사라졌지만 이것은 앱을 멈춰 세운다. 조건도 좁다(*상태에 따라 transform 이 생겼다 사라진다*).
> 이미 있는 `Toast` 의 `translate-y-3` ↔ `translate-y-0` 은 양쪽 다 transform 이라 무사하고,
> 화면 단계에서 새로 쓰는 조건부 transform 은 전부 이 규칙을 따라야 한다.

- **결과**: jest **67파일/693개** 통과(step 0 순증 33 = `UpdatePromptModal` 26 + `boot-order` 7) ·
  vitest 199파일/3046개 증감 0 · lint 0 errors/17 warnings(baseline 동일) · `tsc --noEmit` 0 ·
  `expo export`(android 1,678 모듈) · `gradlew assembleDebug` 성공.
- **실기기 미검증**: 스플래시가 실제로 1초 떠 있다 걷히는지 · 실패 안전 타이머가 오탐하지 않는지 ·
  `ErrorBoundary` 폴백의 '다시 시작' 이 정말 되살리는지 · 광고 초기화. 전부 **눈으로만** 판정된다.

#### 4-1단계 결과 — 에셋 코드젠 (2026-08-12, **3단계가 남긴 벽 하나를 없앤다**)

3-4단계가 *"에셋 벽에 처음 부딪혔다"* 고 적은 그 벽이다. core 는 에셋 목록을 `import.meta.glob` 으로
만드는데 Metro 에 짝이 없어, 치환표로 다섯을 갈아끼우고 **URL 을 전부 `null`** 로 돌려 두었다.
[[ADR-129]] 가 그 목록을 **커밋된 생성물**로 옮겨 벽 자체를 없앴다.

**요점은 «가르지 않았다»는 것이다.** step 지시는 *"웹은 URL 문자열, RN 은 `require()` 결과"* 라며
값을 어떻게 가를지 고르라 했는데, 생성물 안에 평범한 ESM 에셋 import 만 두면 **번들러가 이미 가른다**
(Vite → URL · Metro → 에셋 id). 그래서 목록은 **한 벌**이고, 갈리는 것은 *"에셋 참조란 무엇인가"*
**타입 한 줄**뿐이다(`types/image-asset.ts` ↔ `.native.ts` + tsc `moduleSuffixes`).

| 3단계에서 | 지금 |
|---|---|
| core 의 glob 모듈 **8개** 목록을 손으로 고정 | **0이어야 한다**로 뒤집음 + `ImportMeta.glob` 선언 삭제 → 이제 tsc 가 먼저 막는다 |
| `SHIMMED_CORE_MODULES` 5개 · `src/lib/rn-*.ts` 5개 | **표는 `[]`, 파일은 삭제.** 배선은 남긴다(`import.meta.env` 벽이 아직 있다) |
| 보스 초상 `?` 원 · 아이템 회색 원 · 엠블럼 생략 · 배경 단색 · 연출 정적 | 값은 **전부 진짜**. 그리는 것은 아래 표대로 갈린다 |

- **여덟 중 하나는 오탐이었다** — `data/feature-guides/index.ts` 는 글롭을 **쓰지 않는다.**
  *"쓰지 않는 이유"* 를 적은 **주석**이 문자열 검사에 걸린 것이다(실사용처는 `__tests__` 안이고 그쪽은
  vitest 전용). 에셋을 나르는 것은 맞아 `FeatureGuideImage.src` 타입만 바꿨다.
- **웹은 한 글자도 안 달라졌다** — `dist` 의 에셋 126개가 **이름·해시까지 동일**하고, JS 는 런타임
  경로→슬러그 루프가 사라져 오히려 줄었다(`screen-profit` 438.4 → 433.3 kB). 반환 타입도 웹에서는
  여전히 `string | null` 이다.

**에셋이 왔다고 그림이 다 뜨는 것은 아니다.** 남은 벽이 무엇인지 자리마다 갈린다 — 값만 있으면 되는
곳은 이번에 붙었고, 나머지는 **CSS 기하를 RN 으로 옮기는 일**이라 화면 작업의 범위다.

| 자리 | 지금 | 남은 것 |
|---|---|---|
| 월드 엠블럼(`CharacterTrackingGrid`·`CharacterSelectDropdown`) | **그린다** | — (드롭다운은 3단계가 패딩 규칙만 남겨 뒀던 자리라 함께 채웠다) |
| 보스 초상(`BossPortrait`·`PartySizeModal`) | 자리만 | `background-size: "220% auto"` / `position: "60% 40%"` → RN 기하. **그림의 고유 종횡비**가 필요하다(번들 에셋이라 이제 읽을 수 있다) |
| 테마 배경(`ThemeHeaderBackdrop`) | 안 그림 | RN 변수 맵은 색만 낸다 — 벽지는 `<Image resizeMode="cover">` + `dim` 으로 직접 앉혀야 한다 |
| 드롭 연출(`DropEffectOverlay`) | 정적 | 재생 엔진. **막던 것이 프레임 부재였고 그것은 풀렸다** — [[ADR-048]] origin 은 프레임 비트맵 크기 위에서 해석되는데 번들 에셋은 크기를 스스로 안다 |
| 아이템 아이콘(`ValuableDropBadge`) | ~~회색 원~~ → **그린다**(2026-08-14) | — 예고대로 조회만 붙였다. **오래 남은 이유는 «값을 대는 데까지» 라는 이 표의 선 긋기 자체였고**, 그 폴백 원이 어두운 테마에서 **새까맣게** 보여 «아이템 이미지가 안 나온다» 로 보고돼서야 걷혔다 |

- **`source` 의 형태가 두 가지가 됐다.** `CharacterTrackingGrid` 한 컴포넌트 안에 **얼굴 = 넥슨의
  원격 URI(`{ uri }`)** 와 **엠블럼 = 번들 에셋(값 그대로)** 이 공존한다. 감싸는 쪽을 바꾸면 **에러 없이
  그림만 안 뜬다** — 그래서 그 구분을 테스트 계약으로 박아 뒀다.
- **jest 의 에셋 값은 숫자가 아니다** — RN 프리셋이 `{ testUri }` 대역을 준다. 타입은 앱이 보는 값을
  적고, 테스트는 그 경로로 *"어느 파일로 해석됐는가"* 를 본다(오히려 더 강한 단언이다).
- **스냅샷은 렌더 순서를 탄다.** `DropEffectOverlay` 스냅샷의 그라디언트 id 가 앞에 렌더 하나를
  끼웠다고 `r6` → `r7` 로 밀렸다(`useId`). 새 테스트를 **스냅샷 뒤**에 두어 되돌렸다.
- **결과**: vitest **200파일/3056개**(순증 10 = 낡음 방지 테스트) · jest **67파일/705개**(순증 12) ·
  `tsc --noEmit` 0 · lint 0 errors/17 warnings(baseline 동일) · `npm run build` 산출물 에셋 동일 ·
  `expo export`(android) 성공.
- **실기기 미검증**: 그림이 실제로 뜨는지는 **한 번도 본 적이 없다.** `expo export` 는 번들에 들어간
  것까지만 말한다(앱 진입에서 닿는 것은 테마 배경 2장뿐이라 나머지 여섯 목록은 임시 진입점으로
  250장 전량 확인했다).

#### 4-2단계 결과 — 온보딩 5개 (2026-08-12, **처음으로 화면이 생겼다**)

앱을 처음 여는 사람이 보는 다섯을 옮겼다(775줄). 자리표시자를 치우고 `RootNavigator` 의 `Onboarding`
라우트가 진짜 화면을 그린다 — **이 단계부터 *"예전과 같아 보이는가"* 를 물을 수 있다**(그 답은 사람이
두 앱을 나란히 놓아야 나온다 — 아래 «육안 대조 목록»).

**캐릭터 0명 계정([[ADR-127]])을 화면 층에서 다시 거르지 않았다.** 그 결함은 대표 캐릭터를 못 세워
렌더 중에 던지는 것이었고 수정은 `core/nexon/character/normalize.ts` 한 곳에 있다(`MapleAccount` 의
뜻이 *"응답에 있던 계정"* 이 아니라 **"고를 수 있는 계정"** 이라서다). RN 화면은 그것을 그대로
물려받는다 — 다만 **그 필터 때문에 목록이 통째로 빌 수는 있어서**, 그때 던지지 않고 안내 + 비활성
CTA 로 서는 것을 테스트 계약으로 박았다(웹과 같은 동작이고, 그 자리의 탈출구는 다음 단계의
`emptyAction` 과 키 재입력 모달이 쥔다).

**`TextInput` 으로 갈린 것 — 폼이 사라지고 제출 경로가 둘이 된다.**

| 웹 | RN | 왜 |
|---|---|---|
| `<form onSubmit>` + `preventDefault` | `onPress` + `onSubmitEditing` | 폼도 submit 도 없다. **가드는 그대로 남는다**(제출 중이거나 값이 비면 안 부른다) |
| `type="password" \| "text"` | `secureTextEntry={!isRevealed}` | 토글의 뜻은 같다 — 붙여넣은 긴 문자열을 눈으로 확인할 수 있어야 한다 |
| `autoCorrect="off"` | `autoCorrect={false}` | 이름만 같고 타입이 다르다. `autoCapitalize="none"`·`spellCheck` 는 그대로 |
| `<label htmlFor>` | `Text` + `TextInput` 의 `aria-label` | RN 에 라벨-컨트롤 연결이 없다 |
| `<a target="_blank" rel>` | `role="link"` + `Linking.openURL` | `rel` 은 브라우저 탭 사이의 문제라 짝이 없다(OS 브라우저가 열리는 순간 관계가 없다) |
| 브라우저 기본 placeholder 색 | **지정하지 않는다** | 웹도 안 정했다 — 여기서 정하면 웹에 없던 결정을 만드는 것이 된다(**육안 확인 대상**) |
| 키보드가 뷰포트를 줄임 | `automaticallyAdjustKeyboardInsets`(iOS) + `keyboardShouldPersistTaps` | 안드로이드는 창이 `adjustResize` 로 줄어 저절로 되지만 iOS 는 스크롤 뷰 크기가 그대로다. `persistTaps` 가 없으면 키보드가 떠 있을 때 **첫 탭이 버튼에 안 닿는다** |

**컨테이너는 `ScreenScroll` 이 아니다.** 그 셸은 탭 화면 + `PageHeader` 를 위한 것이고 온보딩은 헤더도
탭바도 없다 — 무엇보다 **콘텐츠 컨테이너의 `flexGrow: 1`** 을 요구하는데 그 축이 셸에 없다. 웹에서도
온보딩만 공용 셸 밖이었다(`min-h-[calc(100dvh-…)]` 를 자기 컨테이너에 직접 걸었다). 그 min-height 가
만들던 *"남는 세로 공간"* 이 RN 에서는 `flexGrow` 이고, 그것이 있어야 프로브 대기의 `m-auto` 와 전체
대기 두 자리의 `justify-center` 가 선다. 상단 안전영역은 이 화면이 직접 먹는다 — 웹에서는 `TabLayer`
루트의 `pt-[var(--sa-top)]` 가 앱 전체에 깔려 있었고 RN 에는 그 공통 래퍼가 없다.

- **`RootNavigator` 테스트 하네스에 `ThemeProvider` 가 들어갔다.** 자리표시자는 테마를 안 읽었지만
  진짜 화면은 읽는다(스크롤 인디케이터 색 — [[ADR-099]] 결정 5). 컨텍스트가 없으면 조용히 기본
  테마로 폴백하지 않고 **던진다**(`theme/context.ts` 의 판단). 실제 트리와도 같은 순서다.
- **내비게이션 스냅샷이 커진다**(1,304 → 2,080줄). 「온보딩 골격」 스냅샷 안에 이제 진짜 화면이 있어
  `ApiKeyForm` 이 바뀌면 함께 움직인다 — 자리표시자였을 때보다 시끄럽지만 그것이 그 기준선이 고정하기로
  한 것이다(내비게이터가 그 자리에 **무엇을** 그리는가). 화면 내부 계약은 `app/onboarding/__tests__` 가 본다.
- **RNTL 14 의 함정 셋을 실측으로 넘었다** — ① `render`·`rerender` 는 **비동기**라 `await` 없이 쓰면
  단언이 빈 트리를 본다 ② 한 케이스에서 두 번 렌더하면 `overlapping act()` 로 **다음 케이스부터** 렌더가
  빈다(웹판의 `unmount` 후 재렌더 케이스를 둘로 쪼갰다) ③ `UNSAFE_*ByProps` 가 없다 — 진행률 바는
  `accessible` 표시가 없어 `getByRole('progressbar')` 로도 안 잡혀 `toJSON()` 트리를 프롭으로 훑는다.
- **`jest.mock` 의 `...requireActual` 스프레드가 순환 참조에서 죽는다** — `schedule-sync` ↔
  `character-roster` ↔ `character-eligibility` 가 순환이라 팩토리 안의 `requireActual` 이 아직 구성 중인
  모듈을 `undefined` 로 만난다(실측). 화면이 실제로 쓰는 둘만 세우고, 진짜가 필요한
  `toScheduleSyncError` 는 사이클 밖 원본(`./errors`)에서 곧장 가져온다.
- **아이콘 다섯을 `lib/icons.ts` 에 더했다**(`Eye`·`EyeOff`·`ExternalLink`·`Gamepad2`·`ListChecks`) —
  배럴이 아니라 아이콘별 경로 그대로다(4단계 step 1 이 잰 1.8MB 차이).
- **결과**: vitest **200파일/3056개**(증감 0 — `app-capacitor`·`core` 무수정) · jest **72파일/791개**
  (순증 86 = 온보딩 5벌) · `tsc --noEmit` 0 · lint 0 errors/17 warnings(baseline 동일) ·
  `npm run build` 성공 · `expo export`(android) 성공.

##### 육안 대조 목록 — 첫 실행 경로는 되돌리기 어렵다

**순서가 중요하다.** 키를 넣는 순간 저장되고, 그 뒤 단계는 저장된 값에서 파생되므로([[ADR-086]] 결정 1)
같은 화면을 다시 보려면 저장소를 지워야 한다. 그래서 **키를 넣기 전에 볼 수 있는 것을 먼저 전부 본다.**

1. **키 입력 화면 — 키를 넣지 않고** (다시 볼 수 있는 유일한 화면이다. 여기서 오래 머물 것)
   - [ ] 제목·보조문·안심 문구 세 줄의 크기·색 위계가 웹과 같은가
   - [ ] **placeholder 색** — 웹은 브라우저 기본, RN 은 플랫폼 기본이다. 어느 테마에서든 읽히는가
   - [ ] 커서·선택 색이 테마와 부딪히지 않는가(둘 다 지정하지 않았다)
   - [ ] 눈 아이콘이 인풋 안 오른쪽에 세로 중앙으로 앉는가(`pr-11` + `absolute right-3`)
   - [ ] 토글로 키가 보였다 가려지는가 · 자동 대문자가 **안 걸리는가**(실기기 키보드로 직접)
   - [ ] 구분선 좌우 선이 문구 높이 가운데에 오는가
   - [ ] 가이드 버튼(outline)이 주 CTA(채움)와 색·크기로 갈리는가
   - [ ] 두 링크가 **시스템 브라우저**로 나가는가 · 돌아왔을 때 **입력 중이던 값이 남는가**
   - [ ] 키보드를 띄운 채 확인 버튼이 닿는가(iOS — 인셋이 실제로 붙는지) · **첫 탭에 눌리는가**
   - [ ] 상단 노치를 침범하지 않는가 · 하단 홈 인디케이터와 겹치지 않는가
2. **잘못된 키를 한 번 넣어 본다** (저장되지 않는다 — 검증 실패는 폼에 남는다)
   - [ ] 버튼이 `확인 중` + 16px 트레일 링으로 바뀌고 폼이 그 자리에 남는가
   - [ ] 실패 토스트가 원인별 문구로 뜨는가(인라인 문구는 없어야 한다)
3. **여기서부터는 되돌리려면 저장소를 지워야 한다.** 유효한 키를 넣는다
   - [ ] 계정 선택 **대기**: 숫자 `(n/N)` 한 줄 + 얇은 바만 보이는가(설명 문장이 없어야 한다) ·
         **세로 중앙**에 서는가(`m-auto` 가 `flexGrow` 위에서 도는지 — 이 조합이 RN 에서 처음 도는 자리다)
   - [ ] 계정 카드: 초상화 얼굴 크롭이 웹과 같은 자리를 자르는가 · 월드 엠블럼 높이(22px)와 이름 줄의
         세로 정렬 · 이름이 길 때 한 줄로 잘리는가
   - [ ] 계정이 하나면 처음부터 선택돼 있고 `계속하기` 가 곧바로 활성인가
   - [ ] 계정이 여럿이면 탭에 하이라이트가 옮겨가고, 카드 탭만으로는 넘어가지 **않는가**
4. **예열**
   - [ ] `캐릭터 정보를 준비하고 있어요 (n/N)` + 바가 세로 중앙에 서는가
   - [ ] 바가 실제로 차오르는가(값이 계속 흐르는 유일한 자리)
5. **스케줄 관리 방법**
   - [ ] 두 카드의 아이콘·제목·설명·주의 박스가 설정 모달과 **같은 모양**인가(공용 카피를 함께 쓴다)
   - [ ] 주의 박스가 실패(빨강)가 아니라 정보 톤으로 읽히는가
   - [ ] 고르기 전 `계속하기` 가 흐린가 · 고른 카드만 테두리·배경이 바뀌는가
6. **추적 캐릭터**
   - [ ] 그리드가 3열로 서는가(좁은 기기에서 2열로 접히지 않는지 — RN 에 CSS Grid 가 없어 폭을
         `w-1/3 p-1` 로 만든다)
   - [ ] **그리드 안쪽 스크롤과 화면 스크롤이 싸우지 않는가**(중첩 `ScrollView` — 웹에는 없던 자리다)
   - [ ] 그리드가 화면의 70%를 넘지 않고 그 아래 `계속하기` 가 늘 보이는가
   - [ ] 카드를 골랐다 풀 때 즐겨찾기 정렬이 웹과 같이 움직이는가
7. **수동 모드를 골랐다면 시드 대기**
   - [ ] 32px 스윕 스피너 + `체크리스트를 준비하고 있어요` 가 세로 중앙에 서는가
8. **되돌리기** — 설정 → 연결 해제(또는 앱 데이터 삭제) 후 1번부터 다시. 계정이 여럿인 키와 하나인
   키를 각각 한 번씩은 통과시켜야 3번의 두 갈래를 다 본다.

**실패 화면은 눈으로 보기 어렵다** — 429·조회 불가·판정 불가는 실제 응답을 만들어야 한다. 개발 단계
키로 fan-out 을 태우면 429 는 재현된 이력이 있고([[ADR-116]]), 그 화면에서 확인할 것은 **목록이 아예
안 그려지고 닫을 수 없는 모달이 덮이는가** 하나다.

#### 4-3단계 결과 — 설정 20개 (2026-08-12, **처음으로 스택이 실제로 쌓인다**)

파일 수는 가장 많고(20개·1,849줄) ADR 밀도는 낮다. 대신 이 단계에서 처음으로 **하위 페이지 일곱이
루트 스택 위로 밀려 올라간다** — 3단계가 세운 라우트 표에 진짜 화면이 들어가면서 자리표시자가
치워졌다(`RootNavigator` 의 `SETTINGS_SCREENS`). 파일별 ADR 확인은
[parity-inventory §2.6](./parity-inventory.md) 의 「확인」 열에 있다.

**하위 페이지의 셸이 통째로 사라진다.** 웹은 `StackScreen` 하나가 넷을 했다 — 포털로 탭 레이어 밖에
그리기([[ADR-120]] 결정 3) · 푸시/팝 전환(결정 5) · 가장자리 스와이프 백(결정 6) · 탭바를 아래 화면과
함께 밀어내기(결정 4). RN 에서는 그 넷이 전부 **루트 스택의 성질**이라([[ADR-128]] 3단계가 이미
`animation: 'ios_from_right'` · `gestureEnabled` 로 걸어 뒀다) 화면에 남는 것은 내용뿐이다. 딸려서
`<Outlet />` 도, `parentPath` 상수 다섯 개도, `useStackBack` 도 사라진다 — **뒤로 갈 곳을 우리가
계산하던 코드였고, pop 은 스택이 이미 안다**(`use-settings-navigation.ts`).

| 웹 | RN | 왜 |
|---|---|---|
| `StackScreen` + `PageHeader` | `ScreenScroll`(`hasTabBar={false}`) + `PageHeader` | 오버레이·전환·제스처를 OS 가 한다 |
| `useStackBack(PARENT_PATH)` | `navigation.goBack()` | 딥링크가 없어 *"돌아갈 곳이 없는 경우"* 자체가 없다 |
| `resolveParentPath(pathname)` | (없음) | 안내 상세가 두 경로에 걸려도 **누가 밀었는지는 스택이 안다** |
| `?s=` 쿼리 + `setSearchParams(replace)` | `section` 파라미터 + `setParams` | `resolveStackDirection` 이 없어 세그먼트/쿼리를 가를 이유가 없다 |
| `getElementById` + `scrollIntoView` | `onLayout` 으로 y 수집 + `scrollTo` | 문서도 id 도 없다 — **마디가 자기 위치를 알려 주는 것이 계약이 됐다** |
| `overlays` 프롭(`SettingsAccountDataScreen`) | 그냥 형제 | RN `Modal` 은 별도 네이티브 윈도우라 갇힐 상자가 없다 |
| `<iframe>` + 8초 타임아웃이 **유일한** 실패 신호 | `WebView` + `onError` + 8초 **보조** 신호 | 교차 출처 프레임과 달리 `onError` 가 온다 |
| `window.location.reload()` | `reloadAppAsync()` | 같은 번들 재실행 — `Updates.reloadAsync()` 와 갈리는 지점이 정확히 그것이라 OTA 와 무관하다 |

**OTA 가 안 붙어 있다는 사실이 이 단계에서 세 자리에 드러난다**([[ADR-128]] 결정 7 — `LiveUpdatePort`
가 던지고, core 스토어는 **값으로 import 하는 것만으로 죽는다**). 셋 다 **없는 값을 지어내지 않는
쪽**으로 좁혔다: ① `AppUpdateSection` 은 스토어 대신 프롭을 받고 `SettingsAboutScreen` 이 `unsupported`
를 심는다(**문구 열넷은 하나도 안 지웠다** — 그 표가 [[ADR-026]]·[[ADR-027]]·[[ADR-126]] 의 계약이고,
배선은 그날 `state={useLiveUpdateStore()}` 한 줄이다) ② 설정 본화면·`앱 정보` 행·footer 의 버전이
**빌드 시점 `package.json`** 이다(웹에 이미 있던 폴백 경로) ③ 개발 노트의 `사용 중` 배지도 같은 기준이라
OTA 로 올린 번들에서는 아직 어긋날 수 있다.

**테마 배경은 값까지 왔고 그림은 아직 안 뜬다.** step 1 의 에셋 코드젠으로 `getThemeBackgroundUrl` 이
**진짜 번들 참조를 돌려준다**(실측: 혼테일·검은마법사 둘 다 해석됨 — 전에는 항상 `null` 이었다).
그런데 화면에는 안 나온다. 남은 것 셋:

1. `ThemeHeaderBackdrop` 의 두 번째 갈래가 아직 `return null` 이다(배경 **선언 여부** 판정은 지금도
   진짜로 한다 — 몸통만 비어 있다).
2. **전면 백드롭에 해당하는 RN 컴포넌트가 아예 없다.** 웹의 `.theme-backdrop` 은 `position: fixed`
   백드롭이었고([[ADR-088]] 결정 4), RN 쪽 변수 맵(`theme/theme-vars.ts`)은 **색만** 낸다.
3. `size`/`position`/`dim` 을 CSS 배경 속성에서 `<Image resizeMode>` + 오버레이 기하로 옮기는 일 —
   [[ADR-108]] 결정 4·[[ADR-109]] 결정 2·3 이 정한 값(`cover` · `25%`/`45% bottom` · `0.65`/`0.8`)이
   **그 변환 뒤에도 같은 그림을 내는지**는 눈으로 봐야 안다.

셋 다 `components/templates` 의 일이라 이 step 에서 하지 않았다.

**RNTL 14 함정이 하나 더 나왔다 — `fireEvent` 는 갱신을 예약만 한다.** 누른 직후의 질의는 **누르기 전
화면**을 본다(실측 — `CacheClearConfirm` 체크박스에서 처음 걸렸고, `Modal` 안이라서가 아니라 일반
성질이다). 밖으로 나가는 콜백(`onPress` → `jest.fn()`)을 보는 케이스는 안 걸리므로 **조용히 통과하다가
다시 그려진 화면을 보는 순간에만** 드러난다. 그래서 그 자리마다 `await act(async () => fireEvent…)`
헬퍼를 쓴다. 함께 나온 둘 — `view.rerender()` 는 **넘긴 요소로 루트를 통째로 갈아치워** 프로바이더가
사라지고(부모가 상태를 들게 해 우회), 픽스처 주입의 **getter 가 한 번만 평가된다**(`vi.mock` 관례가
그대로 안 옮겨진다 — 배열 정체성을 고정하고 내용만 갈아 끼운다, 그리고 그 배열은 **팩토리가 만들어야**
한다: 바깥 `const` 는 팩토리가 먼저 돌아 `undefined` 로 실려 간다).

**웹에 없던 테스트를 하나 더 썼다** — `SettingsPrivacyScreen`. 웹 테스트 16개에 그 화면이 없는데,
RN 으로 오며 가장 많이 갈린 자리라(실패 신호가 늘고 사전 검사가 사라졌다) 지켜 둘 값이 생겼다.

##### 육안 대조 목록 — 설정

두 앱을 나란히 놓고 본다. **모달이 네이티브 윈도우라는 것이 이 화면 무리의 최대 변수**다.

1. **본화면** — 카드 둘의 경계가 웹과 같은 자리인가 · 값 배지 오른쪽에 chevron 이 **함께** 있는가 ·
   고지 4줄의 톤이 균일한가(눌러야 하는 것이 하나도 없다) · 스크롤이 생기는가([[ADR-118]] 미검증 1 —
   행이 6개인 지금 높이는 **웹에서도 안 쟀다**)
2. **테마 모달** — 타일을 고르면 **모달 자신이 그 자리에서 갈아입는가**([[ADR-104]] 결정 7). 네이티브
   윈도우가 `ThemeProvider` 의 `vars()` 아래에 있는지가 구조상 자명하지 않아 **이것이 이 단계에서 가장
   먼저 볼 것**이다. 안 되면 모달을 여는 자리가 아니라 프로바이더 배치가 답이다
3. **트래킹 모드 모달** — 적용 중 안드로이드 **뒤로가기**로도 안 닫히는가(웹에 없던 진입 경로)
4. **캐시 삭제** — 체크박스 두 줄·용량·경고가 웹과 같은가 · 삭제를 누르면 스플래시가 덮고 앱이 다시
   뜨는가(범위는 core 가 정하므로 **화면이 아니라 결과**를 본다)
5. **계정 변경** — `verifying` 0% 바 → 프로브 대기 바가 **하나의 연속된 로딩**으로 보이는가
   ([[ADR-113]] 결정 5 — 마크가 중간에 바뀌면 실패다)
6. **하위 페이지 일곱** — 밀려 들어오고 밀려 나가는가 · 왼쪽 가장자리 스와이프로 돌아오는가 ·
   **탭바가 아래 화면과 함께 나가는가**([[ADR-120]] 결정 4) · 돌아왔을 때 설정 본화면의 스크롤 자리가
   남는가
7. **개인정보 처리방침** — 2단 스택이 실제로 서는가(앱 정보 → 처방침) · 사이트가 뜨는가 ·
   비행기 모드에서 실패 화면 + `브라우저로 열기` 가 뜨는가
8. **기능 안내** — 목차를 누르면 **화면이 밀리지 않고** 그 마디로 스크롤하는가 · 개발 노트 항목에서
   들어가면 그 마디에 **이미 서 있는가** · 뒤로가 들어온 쪽으로 돌아가는가(두 경로 각각)
9. **이미지** — 안내 스크린샷이 실제로 뜨는가(step 1 이후 첫 실물 확인 자리 중 하나)

#### 4-4단계 결과 — 컨텐츠 스케줄러 5개 (2026-08-13, **첫 탭 화면이자 첫 그림**)

컨텐츠 스케줄러 5개(1,401줄)를 `src/app/content-scheduler/` 로 옮기고, `TabNavigator` 의 첫 탭과
`RootNavigator` 의 `ContentManage` 자리표시자를 진짜 화면으로 갈아 끼웠다. 파일별 ADR 확인 결과는
[parity-inventory §2.3](./parity-inventory.md) 의 «확인» 열에 있다.

**이 단계의 산출물은 화면 다섯이 아니라 결정 하나다 — 당겨서 새로고침의 갈래([[ADR-130]]).**
step 6·7 이 *"화면이 붙는 단계에서 고른다"* 로 두 번 미룬 자리이고, 여기서 골라야 보스 스케줄러·보스
수익이 그것을 물려받는다. **`RefreshControl` 로 갔고, 판정한 것은 취향이 아니라 사실 하나다** —
안드로이드 `ScrollView` 는 최상단을 넘겨 당겨도 콘텐츠를 움직이지 않아 **당김 거리 신호가 아예 없다**
(iOS 는 `bounces` 로 `contentOffset.y` 가 음수가 된다). 커스텀 마크를 고르면 그 플랫폼에서만
`PanGestureHandler` 로 최상단 판정·목록 이동을 새로 만들어야 하는데, 그것은 옮기는 일이 아니다.
[[ADR-074]] 의 마크 결정 넷과 [[ADR-061]] 의 PTR 예외를 폐기하는 값을 치렀고, 결정 1(문구 없음)·
7(`aria-hidden`)은 **플랫폼이 같은 답을 내서** 살아남았다.

**두 번째 산출물은 그림이다 — CSS 배경 크롭을 RN 기하로 옮기는 법.** [[ADR-129]] 로 에셋이 번들에
들어온 뒤 처음으로 실제 그림이 붙는 자리이고, 벽은 셋이었다.

| 웹 | RN | 어떻게 |
|---|---|---|
| `background-size: "220% auto"` | 배경 이미지가 없다 | `<Image>` 를 앉히고 `width: '220%'` + `aspectRatio`(고유 크기는 `Image.resolveAssetSource`) — **`height: undefined` 를 함께 적어야 한다, 아래 정정** |
| `background-position: "60% 40%"` | 퍼센트 배치가 없다 | **`left: 60%` + `translateX: -60%`** — CSS 정의(`(W−dw)×X%`)를 두 기준의 뺄셈으로 푼 것이라 **컨테이너를 재지 않는다** |
| `mask-image` 로 오른쪽 페이드 | 마스크가 없다 | 아트 위에 **표면색 그라데이션을 반대 알파로 덧칠** — 카드 배경이 불투명 단색이라 색이 **근사가 아니라 정확히 같다** |

`onLayout` 으로 컨테이너를 재는 길을 피한 것이 요점이다. 그 길은 첫 프레임에 그림이 없고, 그
한 프레임이 [[ADR-101]] 이 없앤 *"모르는 사실을 그리는 프레임"* 과 같은 종류다. **필터는 `<Image>` 가
아니라 감싸는 `View` 가 진다** — RN 의 `ImageStyle` 에 `filter` 가 없다(tsc 가 `Array.prototype.filter`
로 읽어 거부한다). 웹도 배경을 얹은 `div` 하나가 필터·투명도·마스크를 함께 졌으므로 모양이 같다.

**웹에 없던 테스트가 하나 생겼다.** 크롭 값이 CSS 로 그대로 흘러가던 웹에는 검사할 변환이 없었지만,
RN 에서는 우리가 그 해석을 대신하므로 **틀려도 에러가 안 나고 그림만 이상하게 잘린다.** 그래서 기하는
순수 함수로 떼어 케이스로 고정하고, 값(필터·마스크·투명도)은 **core 의 상수를 읽어 대조한다** — 손으로
적으면 두 벌이 되고 웹이 바뀌어도 조용히 통과한다.

**사라진 것 넷.** 전부 구조가 대신한다 — ① `usePullToRefresh` 훅과 `PullToRefreshIndicator` 배선
② `resolveContentOffsetPx` 로 목록을 내리던 `transform`([[ADR-073]] 결정 6) ③ `useScreenStackStore`
깊이로 당김을 끄던 배선([[ADR-120]] 결정 10 — 하위 페이지가 **덮여** 올라와 손가락이 안 닿는다)
④ `<Outlet />`([[ADR-077]] 언마운트 금지 — 관리 페이지가 루트 스택 push 라 내비게이터가 그 계약을
지킨다). [[ADR-098]] 결정 1(이동 전에 스크롤을 0으로)도 함께 사라진다 — 스크롤이 화면과 함께 죽어
계승할 오프셋이 없다.

**생긴 것 셋.** ① `ScreenScroll` 에 `refreshControl` 프롭(셸이 만들지 않고 **받는다** — `refreshing`
이 각 화면 스토어의 상태다) ② `app/use-screen-navigation.ts` — step 3 이 `settings/` 아래 두었던 훅이
설정 밖 두 번째 호출부가 생기며 올라왔다(옛 자리는 별칭만 남는다) ③ `lib/text-styles.ts` 의
`MEDIA_TEXT_SHADOW_STYLE` — 세 번째 호출부가 생겨 `PartySizeModal` 의 사본이 여기로 접혔다.

**`animate-spin` 은 NativeWind 에 없다.** 새로고침 아이콘의 회전을 Reanimated CSS 애니메이션으로
값으로 준다(step 7 이 `@keyframes` 넷에 쓴 방식과 같다) — **없는 클래스는 에러가 아니라 안 도는
아이콘**이라 조용히 사라지는 종류다. 지금은 호출부가 하나뿐이라 화면 안의 비-export 상수로 두고,
보스 스케줄러가 붙는 step 5 에서 둘이 되면 `lib/` 로 올린다([[ADR-094]] 결정 1).

**내비게이션 테스트가 처음으로 저장소를 만났다.** 자리표시자만 있을 때는 화면이 저장소를 안
건드렸는데 진짜 탭 화면은 마운트하며 추적 목록을 읽는다([[ADR-101]] 결정 1). 포트가 없으면
`getPreferencesPort()` 가 **던져서**(core 의 의도된 설계) 배선 테스트가 화면과 무관한 이유로 빨개진다 —
스토어를 목으로 덮는 대신 **인메모리 포트를 꽂았다**(`navigation/__tests__/memory-preferences.ts`).
목으로 덮으면 step 5·7 마다 목 목록이 늘고, 그 목록이 곧 *"무엇이 실제로 도는지 모른다"* 가 된다.
같은 자리에서 **스냅샷이 통째로 죽는 함정**도 하나 나왔다 — `refreshControl` 처럼 **React 엘리먼트를
값으로 받는 프롭**이 트리에 있으면 기본 직렬화기가 `_owner` 파이버를 따라가 `RangeError: Invalid
string length` 가 난다. `normalize-tree.ts` 가 그런 프롭을 `<element:…>` 로 접는다.

**RNTL 함정 셋**(step 2·3 목록에 이어서) — ① `aria-hidden` 을 단 요소는 **기본 질의에서 빠진다**
(장식이라 그것이 옳고, 볼 때는 `includeHiddenElements`) ② `Pressable` 은 `aria-selected`·`disabled` 를
호스트 뷰로 넘기지 않고 `accessibilityState` 로 접는다 ③ `ReturnType<typeof useContentSchedulerStore>`
는 **`unknown` 이 된다**(zustand 훅이 오버로드라 tsc 가 셀렉터 시그니처를 집는다) — 스토어가 내보내는
타입을 그대로 쓴다.

**육안 대조 목록 (실기기, 웹 앱과 나란히)**

1. **당겨서 새로고침** — 최우선. 두 플랫폼에서 **각각** 당겨 보고, [[ADR-072]] 가 의도한 몸짓으로
   읽히는지 · 헤더 버튼과 같은 재조회가 도는지 · 헤더가 제자리에 있는지([[ADR-073]] 결정 1)
2. **헤더 버튼 재조회** — 플랫폼 인디케이터가 **함께 뜨는 것**이 어색하지 않은가(웹과 갈리는 유일한
   자리이고 눈으로만 판정된다)
3. **카드 배경 크롭** — 일일 퀘스트·주간 지역·에픽 던전·길드 카드를 웹과 나란히 놓고 **같은 부분이
   같은 크기로 잘리는지**. 이 단계에서 가장 틀리기 쉬운 곳이다(퍼센트 두 기준이 어긋나면 그림이
   통째로 밀린다)
4. **오른쪽 페이드** — 덧칠이 마스크와 같아 보이는가 · 라이트/다크 모두에서 이음매가 없는가
5. **지역 아이콘** — 24px 아이콘이 뜨는가(안 뜨면 슬러그 해석이 아니라 `<Image>` 배선 문제다)
6. **탭 전환** — 일간↔주간이 스토어 소유라 다른 탭에 다녀와도 유지되는가([[ADR-096]] 결정 1)
7. **관리 페이지** — 수동 모드에서 밀려 들어오는가 · **진입 시점의 탭을 이어받는가**(한 방향) ·
   캐릭터 드롭다운이 스케줄러와 같은 캐릭터를 보는가
8. **길드 잠금** — 미가입 캐릭터에서 길드 3종이 눌리지 않고 사유가 행 위에 뜨는가. **블러가 빠졌으니
   스크림만으로 충분히 읽히는지**가 판정 대상이다
9. **빈 상태 셋** — 캐릭터 0명 / 자동 모드 미등록 / 수동 모드 미추적. CTA 가 가는 곳이 문구가
   가리키는 곳인가([[ADR-060]])
10. **새로고침 아이콘 회전** — 조회 중에 실제로 도는가(값으로 준 애니메이션이라 안 돌아도 조용하다)

**미확인** — 실기기에서 아무것도 안 봤다. 특히 **크롭 기하는 자동 테스트가 값만 지키고 그림은 못
본다**(jest 에서 에셋이 `{ testUri }` 대역이라 고유 크기가 없어 항상 `cover` 폴백으로 떨어진다) —
`sized` 분기는 **실기기에서 처음 그려진다**.

> **정정(step 5)** — 위 괄호가 틀렸다. `cover` 로 떨어진 것이 아니라 **가드를 통과해
> `aspectRatio: NaN` 이 나가고 있었다**(`undefined <= 0` 은 false 다). 보스 원형 초상을 붙이며
> 렌더 트리에서 실물로 확인했고, 검사를 `Number.isFinite` 로 고쳤다. **NaN 은 에러가 아니라
> 레이아웃이 조용히 무너지는 값**이고 기기에서도 크기를 모르는 소스가 오면 같은 길이다. 이제는
> 문서가 적은 대로 `cover` 로 떨어진다.
>
> **정정 2 (2026-08-14 — 실기기 보고, [[ADR-135]])** — 위 표의 첫 줄이 **반쪽이었다.** `width` +
> `aspectRatio` 만 적으면 **높이에 그림의 고유 픽셀값이 남는다** — RN 의 `<Image>` 는 스타일을
> `[{source.width, source.height}, styles.base, props.style]` 세 겹으로 쌓고 **우리가 안 적은 축은
> 맨 아래 층이 이긴다**([[ADR-129]] 이후 번들 에셋은 늘 자기 크기를 싣고 온다). 두 축이 다 정해지면
> Yoga 가 `aspectRatio` 를 **버리므로**, 이 표대로 옮긴 카드·원형 초상이 전부 세로로 늘어나 있었다
> (보스 카드 358×255.8 → 358×**556**). 처방은 **나머지 축을 명시적 `undefined` 로 지우는 것**이고,
> 그 한 줄이 «`background-size` 를 옮기는 법» 의 빠진 절반이다. 같은 병이 `w-full`(안내 이미지)·
> `h-[17px] w-auto`(월드 엠블럼)에도 있었다 — 웹에서 그 자리를 메우던 것이 preflight 의
> `img{height:auto}` 였고 **RN 에 짝이 없다.** 아래 «미확인» 이 예고한 대로 `sized` 분기는 실기기에서
> 처음 그려졌고, 그리자마자 이것이 나왔다.

#### 4-5단계 결과 — 보스 스케줄러 2개 (2026-08-13, **파일 둘에 ADR 스물여섯**)

보스 스케줄러 2개(1,166줄)를 `src/app/boss-scheduler/` 로 옮기고, `TabNavigator` 의 두 번째 탭과
`RootNavigator` 의 `BossManage` 자리표시자를 진짜 화면으로 갈아 끼웠다. 파일별 ADR 확인 결과는
[parity-inventory §2.4](./parity-inventory.md) 의 «확인» 열에 있다.

**파일 수에 속으면 안 되는 단계였다.** `BossScreen` 하나가 ADR 26개를 지고(`BossProfitScreen` 다음),
그중 화면에 보이는 것은 절반이 안 된다 — 완료 승격 · 시즌 보스 판정 · 실패의 목적지 · 빈 상태의
판정 시점은 전부 눈으로 못 잡는다. **step 4 가 정한 것을 그대로 물려받는 것이 이 단계의 규율이다** —
당겨서 새로고침([[ADR-130]] `RefreshControl`) · 헤더(스크롤 뷰의 형제) · 스크롤 소유([[ADR-099]])를
컨텐츠 스케줄러와 **같은 모양으로** 배선했다. 두 탭이 같은 제스처에 다르게 반응하면 그 자체가 회귀다.

**step 4 가 예고한 이사 둘을 실행했다.**

| 옮긴 것 | 왜 지금인가 |
|---|---|
| `MediaCardArt`·`media-card-art.ts` → `components/molecules/MediaCardArt/` | 세 번째 호출부(보스 카드 · 파티 인원 모달 히어로 · 원형 초상)가 붙었다. 화면 폴더에 두면 `app/boss-scheduler/` 가 `app/content-scheduler/` 를 import 하는데, **계층 테스트가 못 보는 사각**이다 |
| `SPIN_ANIMATION` → `lib/animation.ts` | 새로고침 아이콘 회전의 두 번째 호출부. step 4 가 화면 안 비-export 상수로 두며 *"step 5 에서 둘이 된다"* 고 적어 둔 자리 |

**그림 셋이 한꺼번에 살아났다** — 보스 카드 bleed · 파티 인원 모달 히어로 · 관리 페이지 원형 초상.
셋 다 step 4 가 푼 변환(`resolveMediaArtLayout`)을 **부르기만 한다**. 크롭 표만 다르고
(`boss-portrait-crops`(카드·히어로) vs `boss-portrait-icon-crops`(원형)) 값의 형태가 같아서, 변환을
두 벌로 두면 한쪽만 고쳐지는 사고가 열린다. 갈린 자리는 둘이다 — ① 페이드 끝점이 카드(38%/76%)와
히어로(42%/82%)로 달라 `variant` 프롭으로 가른다(core 의 두 마스크가 원래 그렇게 갈라져 있다)
② 원형 초상은 **`overflow-hidden` 을 우리가 명시해야 한다**(웹은 `background-image` 라 둥근 모서리가
배경을 저절로 잘랐지만 RN 의 `<Image>` 는 자식이다).

**NativeWind 함정 하나를 실측으로 규명했다 — `Pressable` 의 `style` 함수는 통째로 삼켜진다.**
[[ADR-121]] 결정 1 의 눌림 피드백(`active:scale-[.985] active:brightness-110`)이 이 카드의 **유일한
어포던스**라 그대로 옮겨야 했는데, 셋 다 확인했더니:

| 방법 | 결과 |
|---|---|
| `active:scale-[.985]` | **된다**(렌더 트리에 `scaleX/Y 0.985`) |
| `active:brightness-110` | **조용히 사라진다** — NativeWind 가 `brightness-*` 를 네이티브 `filter` 로 안 낸다 |
| `style={({pressed}) => …}` | **통째로 삼켜진다**(className 이 없어도 그렇다) |
| `style={{…}}` 객체 | className 과 **머지된다** |

그래서 **축소만 남고 밝기는 못 온다.** 남는 길은 카드마다 `onPressIn/Out` 상태를 두는 것뿐인데,
"눌렸다"를 알리는 일은 축소가 이미 하므로 그 값을 치르지 않았다(육안 대조 목록 2번).

**사라진 것 넷.** 컨텐츠 스케줄러와 같다 — `usePullToRefresh`·`PullToRefreshIndicator` 배선 ·
`resolveContentOffsetPx` transform · `useScreenStackStore` 깊이 게이트 · `<Outlet />`. 관리 페이지
쪽은 여기에 **`StackScreen` 통째와 `PARENT_PATH` 상수**가 더해진다([[ADR-120]] — 넷이 전부 루트
스택의 성질이다). `renderPartyStepper` 의 인라인 마크업도 사라졌다 — 3단계가 두 호출부를
`PartySizeStepper`(molecule)로 모아 두었으므로 `size="compact"` 로 부르기만 한다.

**갈린 것 둘.** ① `?openPicker=1` 쿼리 → **라우트 파라미터**. URL 이 없어 "새로고침마다 피커가 다시
열린다"는 웹의 걱정은 사라지지만 **파라미터는 스택에 남아** 탭을 떠났다 돌아오면 살아 있으므로 지우는
일(`setParams`)은 그대로 필요하다. **보내는 쪽은 step 7 이 온다** — 받는 쪽을 먼저 둔 것은 그것이 이
탭의 계약이기 때문이고([[ADR-068]] 결정 4), 안 두면 그 화면을 옮기다 여기로 되돌아와야 한다.
② 관리 페이지의 "등록된 보스만 보기" 토글은 **갈리지 않았다** — `role="switch"`·`aria-checked` 가 RN
에도 있고 노브 이동은 `translate-x-*` 두 클래스다. 빠지는 것은 `transition-*` 뿐이고, 그 자리에
Reanimated 를 새로 들이는 것은 옮기기가 아니라 새로 만들기다.

**웹 테스트 여섯(2,772줄)은 명세로만 읽고 다시 썼다.** 제스처 시뮬레이션 넷과 DOM 스냅샷 둘은
**옮길 계약이 아니다**(그 값을 이제 OS 가 갖는다 · 전환 계획서 «잃는 안전망»). 웹의 콜드 스타트 파일도
따로 두지 않았다 — 그 프레임 순서를 만드는 것은 `AppShell` 의 선하이드레이션이고 그쪽 테스트가 이미
갖고 있다. 여기 남은 [[ADR-101]] 계약은 *"`null` 을 0명으로 읽지 않는다"* 한 케이스다.

**육안 대조 목록 (실기기, 웹 앱과 나란히)**

1. **보스 카드 일러스트** — 최우선. 자쿰·스우·검은마법사를 웹과 나란히 놓고 **같은 부분이 같은
   크기로 잘리는지**. 카드 크롭은 `100% auto` 라 컨텐츠 카드(`220% auto`)와 배율이 달라 **다른
   실패 모드**를 볼 수 있다
2. **카드 눌림 피드백** — 축소만으로 "눌렸다"가 읽히는가. 안 읽히면 밝기를 되살리는 값
   (`onPressIn/Out` 상태)을 치를지 정한다
3. **원형 초상(관리 페이지)** — 44px 원 안에 얼굴이 들어오는가 · **네모로 삐져나오지 않는가**
   (`overflow-hidden` 이 안 먹으면 그렇게 된다)
4. **파티 인원 모달 히어로** — 카드와 **같은 그림인데 다른 끝점**으로 페이드하는가 · 288px 폭에서
   4난이도 칩(칼로스·카링·최초의 대적자)이 한 줄에 들어오는가([[ADR-121]] 폭 하한)
5. **당겨서 새로고침** — 컨텐츠 탭과 **똑같이** 반응하는가(다르면 그 자체가 회귀다)
6. **탭·필터 유지** — 월간 탭 + 파티 필터를 고르고 다른 탭에 다녀와도 그대로인가([[ADR-096]] 결정 1)
7. **관리 페이지 진입** — 밀려 들어오는가 · 진입 시점 탭을 이어받는가(한 방향) · 캐릭터 드롭다운이
   스케줄러와 같은 캐릭터를 보는가
8. **12개 한도** — 수동 모드에서 12개를 채운 뒤 미선택 행이 **흐려지되 눌리는지**, 누르면 정보 톤
   토스트가 뜨는지([[ADR-055]] 정정 3 — 비활성이면 이유를 알릴 수 없다)
9. **난이도 칩** — 미선택이 `opacity-40` 풀컬러인가([[ADR-121]] 결정 4 — 고스트 칩으로 돌아가면 회귀)
10. **시즌 보스** — 챌린저스 월드 캐릭터에서만 배지와 관리 목록에 나오는가

**미확인** — 실기기에서 아무것도 안 봤다. 자동 테스트가 담보하는 것은 **어느 분기로 가는가**이고
**그림이 어떻게 잘리는가**는 아니다(jest 에셋 대역에 고유 크기가 없어 `sized` 분기가 안 돈다).

#### 4-6단계 결과 — 보스 수익 **공유 조각 9개** (2026-08-13, 화면이 아니라 화면이 딛고 설 것들)

`BossProfitScreen`(ADR 32개)을 치기 전에 그 **아래**를 세웠다 — `src/app/boss-profit/` 에 9개
(2,023줄 상당)를 옮겼고 화면 넷은 step 7·8 몫으로 남는다. 파일별 ADR 확인 결과는
[parity-inventory §2.5](./parity-inventory.md) 의 «확인» 열에 있다.

**[[ADR-124]] «미입력 ≠ 0원» 이 이 단계의 중심이다.** 화면에 안 보이는 판단이고 틀리면 **사용자의
기록이 조용히 거짓이 된다** — [[ADR-128]] 결정 6 이 "눈으로는 못 잡는다"의 예로 든 바로 그 종류다.
합산 층은 core 가 이미 지킨다(`dropPayoutMeso` 가 `priceState !== 'entered'` 를 통째로 0으로 접고,
그것이 **의도된 설계**다). 이 단계가 지킨 것은 **표시 층**이고, 갈래가 셋이다.

| 자리 | 모르는 값 | 화면이 하는 말 |
|---|---|---|
| `ItemRevenuePopover` 목록 줄 | 드롭 가격 미입력 | **`미입력`**(금액 자리에 `0` 을 안 쓴다) |
| 같은 자리 | 스킵(`excluded`) | 목록에서 **뺀다**(값을 안 매기기로 한 것이라 수익 내역에서 할 말이 없다) |
| `BossProfitBossRow` 금액 자리 | 미완료·가격 미확정([[ADR-032]]) | **배지**(`미완료`·`가격 미확정`) |
| `AccordionBody` 주차 소계 | 기간 6상태 중 넷([[ADR-068]]) | **정적 라벨 또는 버튼** — `0 메소` 는 `confirmedEmpty` 에만 |

테스트가 그 셋을 각각 고정하고, 가장 강한 케이스는 **`priceMeso` 는 있고 `priceState` 만 없는**
기록이다 — `priceMeso ?? 0` 계열 구현이면 거기서 금액이 새어 나온다. `character-groups` 쪽에는
반대편도 박았다: `sumPayout` 의 `?? 0` 은 **다른 `null`** 이고(합산 편의값), 그 행의 화면에는 배지가
서므로 0이 금액으로 읽히지 않는다.

**`ItemRevenuePopover` 를 무엇으로 그렸나 — `react-native` 의 `Modal`.** step 지시가 준 세 갈래를
실제 제약에 대 보면 남는 것이 하나다.

| 갈래 | 판정 |
|---|---|
| 화면 안 절대 배치 | **[[ADR-049]] 가 막는다** — 펼친 카드 셸이 `overflow: clip` 이라 잘린다. 셸 밖 화면 루트까지 올리려면 컨텍스트로 좌표를 흘려야 하고, 그것이 곧 포털을 손으로 만드는 일이다 |
| `BottomSheet` | 상호작용의 **모양이 바뀐다** — 이 상자는 "지금 이 줄의 내역"이라 트리거를 지목해야 하고(꼬리가 그 일을 한다), 보스 행은 [[ADR-124]] 결정 6 때문에 이미 시트를 열어 둔 채 살아 있는 자리다 |
| **`Modal`** ✅ | 웹이 고른 것(`createPortal(document.body)` + `position: fixed`)과 **성질이 같다** — 부모의 클리핑·스태킹 밖이고 탭바까지 덮는다 |

`Modal` **organism** 이 아니라 그것이 감싸는 프리미티브인 이유는 organism 이 **스크림 + 중앙 정렬**을
소유하기 때문이다(`bg-scrim`·`items-center`). 웹의 백드롭은 **투명**했고 상자는 트리거에 붙는다 —
스크림을 켜면 그것은 팝오버가 아니라 대화상자다. 같은 판단을 `DropEffectOverlay` 가 이미 했다.

**컨텍스트에서 `scrollRoot` 가 사라진다.** 웹의 여덟 번째 필드는 [[ADR-100]] 결정 5 가 내린
스크롤 컨테이너였는데, **4단계 아래 자손이 그것을 읽던 목적이 하나뿐**이었다 — `fixed` 팝오버를
스크롤 시작 시 닫는 것([[ADR-100]] 결정 4). RN 에서 그 팝오버는 별도 네이티브 윈도우라 **열려 있는
동안 아래 화면에 손가락이 닿지 않고, 그래서 스크롤이 일어날 수 없다.** 계약이 사라진 게 아니라
구조가 지킨다(step 4·5 의 `useScreenStackStore` 깊이 게이트와 같은 종류). 기간 이동의
`scrollTo(0,0)`([[ADR-080]])은 **원래도 컨텍스트를 안 썼다** — 화면 로컬 ref 이고, RN 에서 그 자리는
`ScreenScroll` 의 `ref` 프롭이다(step 7).

**`valuable-drop-row` 가 클래스에서 값이 됐다** — [[ADR-045]] 결정 5. `index.css` 한 클래스가 셋을
했는데(정적 골드 틴트 · 오른쪽에서 배어나오는 radial 글로우 · 2.6s 맥동) RN 에는 셋의 짝이 전부
따로 있다: `backgroundColor` · **`react-native-svg` 의 `RadialGradient`**(RN 에 배경 그라디언트가
없다) · Reanimated CSS 애니메이션. `@media (prefers-reduced-motion)` 짝은 `useReducedMotion()` 이다.
`keyframes-parity.test.ts` 가 **웹 `index.css` 를 실제로 읽어** 지속시간·이징·두 색·정적 폴백을
대조하므로, 화면 층 세 keyframes 중 하나가 이 단계에서 «분류만 된 상태»를 벗었다.

**갈린 것 넷 더.**

| 자리 | 웹 | RN |
|---|---|---|
| 팝오버 앵커 | `getBoundingClientRect()`(동기) | **`measureInWindow()`(비동기)** — 상자는 열리자마자 트리에 들어가고 좌표를 알 때까지 `opacity-0` 으로 기다린다. 좌표를 모르는 채 아무 데나 그리지 않는다([[ADR-101]] 이 없앤 "모르는 사실을 그리는 프레임"과 같은 종류). **jest 는 그 콜백을 주지 않아** 테스트가 보는 것은 늘 투명한 상자다 |
| `CharacterIssue` 배지 | `<span>` + `stopPropagation`(중첩 인터랙티브 회피) | **`Pressable`** — RN 은 터치를 가장 깊은 곳이 가져가므로 중첩이 정상이고, 웹이 감수했던 "키보드 포커스를 못 받는다"가 **사라진다** |
| `measureIssueAnchor(card, money)` | 두 요소를 받아 그 자리에서 잰다 | **`resolveIssueAnchor(cardRect, moneyRect)`** — 재는 일이 호출부(step 7)로 나가고 여기는 좌표계만 옮긴다(`-4 + 7` 은 여전히 이 파일의 지식) |
| 드롭 시트 타일·난이도의 선택 상태 | `aria-pressed` | **`aria-selected`** — RN 접근성 매핑에 `aria-pressed` 가 **없어 조용히 사라진다**(실측). 이 저장소가 반복해 만난 실패 모양이다 |

**남긴 자리 둘 — 정직하게 적어 둔다.**

- **`DropPricePad` 는 step 8 몫이라 시트 안 키패드가 자리표시자다**(`drop-price-pad-seam`). 흐름
  (`기록 → 확인 → 입력 → 복귀`)과 상태(`pricing`·`justAdded`)는 전부 살아 있고 안쪽 화면만 비었다.
  가르지 않고 자리를 남긴 이유는 [[ADR-124]] 결정 6 이 *"시트가 살아서 하던 작업을 잇는다"* 이기
  때문이다 — 시트를 닫는 형태로 임시 구현하면 그 계약이 사라지고, 테스트가 그것을 고정한다.
  (→ step 8 이 그 자리에 `DropPricePadContent` 를 끼웠다. **흐름과 상태는 한 줄도 안 바뀌었다** —
  자리를 남겨 둔 판단이 값을 한 것이 여기서 확인된다.)
- **시트 하단 바가 `sticky` 가 아니다.** 웹은 `sticky bottom-0` 로 스크롤 중에도 「추가 완료」를
  붙들었다. RN 의 짝은 `@gorhom/bottom-sheet` 의 `footerComponent` 인데 그것은 **시트 껍데기**(3단계
  organism)의 API 라 이 단계에서 정할 일이 아니다. 지금은 웹의 DOM 순서 그대로 내용 끝에 흐른다.

**`character-groups.ts` 는 `packages/core` 로 갈 후보다 — 지금은 아니다.** 뷰가 한 줄도 없고
`@core/*` 만 참조해 **경로 수정 없이 이동한다**. 그런데 이 단계의 규칙이 core 무수정이고([[ADR-128]]
결정 4 가 83% 무수정을 지키는 조건), core 이동은 「어느 계산이 뷰 밖인가」를 화면 전부가 붙은 뒤에
한 번에 판정할 별도 결정이다. 파일 머리에 그 사실을 적어 뒀다.

**에셋은 값까지 왔다.** 아이템 아이콘(`getItemIconUrl`)·보스 초상(`BossPortrait`)·결정석·월드 엠블럼이
전부 실제 참조를 돌려준다. 캐릭터 얼굴만 **원격 URI** 라 `{ uri }` 로 감싼다 — 같은 파일에 두 형태가
공존하는 함정을 `CharacterTrackingGrid` 가 먼저 적어 뒀다.

**육안 대조 목록 (실기기, 웹 앱과 나란히)** — step 7 이 화면을 붙인 뒤에야 대부분 볼 수 있다.

1. **아이템 수익 팝오버의 위치** — 최우선. 칩 바로 아래에 꼬리가 닿아 붙는가 · 화면 가장자리
   행에서 상자가 안으로 당겨지고 **꼬리만 칩을 가리키는가** · 여는 순간 **엉뚱한 자리에 한 프레임**
   그려지지 않는가(`measureInWindow` 가 늦으면 그렇게 된다)
2. **미입력 줄** — 값을 안 매긴 드롭이 `미입력` 으로 뜨는가. **`0` 이 보이면 그 자리가 [[ADR-124]]
   위반이다**
3. **고가 드롭 행 강조** — 골드 틴트가 맥동하는가 · radial 글로우가 **오른쪽에서 배어나오는가**
   (SVG 로 다시 그린 자리라 CSS 와 가장 갈리기 쉽다) · 라이트 테마에서 글자가 묻히지 않는가
4. **진행 링** — 12칸이 12시부터 **반시계로** 차는가 · 칸 사이가 벌어져 보이는가(붙어 보이면 round
   캡 보정이 안 먹은 것) · 월간 탭에서 **한 칸 온전한 원**인가([[ADR-059]] 정정 1)
5. **얼굴 크롭** — 32px 원 안에 얼굴이 들어오는가 · 4px 밀리지 않았는가([[ADR-015]] 기준 박스)
6. **드롭 시트 4열 그리드** — 마지막 칸이 밀려 3열이 되지 않는가(퍼센트 폭 + `gap` 조합의 전형적
   실패라 패딩 방식으로 피했다) · 고정 드롭 3개일 때 마지막이 전폭인가
7. **드롭 시트 하단 바** — 긴 보스(검은마법사)에서 「추가 완료」가 **얼마나 먼가**. 멀면
   `footerComponent` 를 껍데기에 붙일지 정한다
8. **연출 토글** — 노브가 켜짐/꺼짐 위치에 정확히 앉는가(전환이 없어 즉시 이동한다)
9. **실패 배지 팝오버** — 배지가 금액 첫 글자와 한 줄로 맞는가 · 팝오버가 카드 밖으로 안 나가는가
10. **결정석 칩 분해** — 월드 둘 이상에서 눌러 펼쳐지는가 · **아무 데나 눌러 닫히는가**(투명
    `Modal` 판이 그 일을 한다) · 펼쳐도 헤더 높이가 안 변하는가([[ADR-049]])

**미확인** — 실기기에서 아무것도 안 봤다. 그리고 **자동 테스트가 담보하는 것은 어느 분기로
가는가이지 픽셀이 아니다**: jest 는 레이아웃을 계산하지 않아 `measureInWindow` 콜백이 오지 않고
(팝오버 위치는 실기기에서 처음 그려진다), 에셋 대역에 고유 크기가 없어 보스 초상의 크롭 기하도
안 돈다.

#### 4-7단계 결과 — 보스 수익 화면 (2026-08-13, **ADR 32개**)

이 저장소에서 가장 밀도 높은 파일을 옮겼다(`BossProfitScreen.tsx` 1,026줄). **코드를 쓰기 전에
동작 명세를 먼저 뽑았고**, 그 목록이 이 단계의 첫째 산출물이다 —
[`packages/app-rn/src/app/boss-profit/BossProfitScreen.contract.md`](../../packages/app-rn/src/app/boss-profit/BossProfitScreen.contract.md).
ADR 32개를 한 줄씩 적고 판정 기호 넷(✅ 코드 / 🏗 구조 / ➖ 밖 / ⚠️ 못 옮김)을 붙인 표이고,
그 결과는 [parity-inventory §2.5](./parity-inventory.md) 의 «확인» 열에도 옮겨 적었다.

**세 커밋으로 쪼갰다** — ① 명세 문서 ② 카드(`CharacterAccordion`) + 고가 드롭 강조 ③ 테스트.
32개가 한 커밋에 들어가면 실패 시 원인 분리가 안 된다.

##### 못 옮긴 것 하나 — **중첩 sticky**([[ADR-047]])와 그에 딸린 셋

펼친 카드 헤더가 페이지 헤더 아래에 멈추지 않는다. 배지 sticky 레일(후속 2) · stuck 헤더 하단
페이드(후속 1) · 페이지 헤더 실측을 받던 `stickyTop`([[ADR-100]] 결정 3)도 함께 없다.

**두 길이 각각 다른 ADR 과 충돌한다.**

| 길 | 왜 안 갔나 |
|---|---|
| `ScrollView` 의 `stickyHeaderIndices` | RN 의 sticky 는 **스크롤 뷰의 직계 자식**만 붙일 수 있어 목록을 `[카드1 헤더, 카드1 본문, …]` 로 펴야 한다. 그 순간 [[ADR-045]] 의 **카드 링이 두 조각으로 갈려 가운데에 이음매**가 생기고 [[ADR-049]] 결정 3 의 셸 클리핑은 **자를 상자를 잃는다** — sticky 를 얻는 대가로 다른 ADR 둘을 부순다 |
| Reanimated 로 손수 | 카드 구조가 살아남는 유일한 길이지만 공용 `ScreenScroll` 을 `Animated.ScrollView` 로 바꿔야 하고(다섯 화면이 함께 걸린다), **jest 가 한 줄도 검증하지 못한다** — 레이아웃이 없어 `onLayout` 이 실제 값으로 오지 않아 sticky 가 테스트에서 한 번도 발동하지 않는다 |

이 저장소는 실기기 없이 세운 스크롤 처방을 두 번([[ADR-079]]·[[ADR-084]]) 실기기에서 반증한 이력이
있다. **검증할 수 없는 150줄을 넣는 것보다 없는 채로 눈에 보이게 두는 편이 낫다** — 없으면 실기기에서
즉시 드러나고, 있는데 틀리면 조용히 남는다.

**잃는 것은 명확하다**: [[ADR-047]] 후속 3 이 소계 footer 를 지운 근거가 *"헤더가 sticky 라 캐릭터
합계가 스크롤 내내 보인다"* 였다. sticky 가 없으면 보스 행을 스크롤하는 동안 **그 캐릭터의 합계가
화면에서 사라진다.** 육안 대조 1순위이고, 거슬리면 두 번째 길을 잡는다(그때는 `ScreenScroll` 변경이
선행 작업이다).

##### 못 옮긴 것 둘 — **테마 배경**([[ADR-088]] 결정 5-1)

`ThemeHeaderBackdrop` 을 헤더 **첫 자식으로 부르기는 한다.** 그런데 그 컴포넌트가 오늘도 두 갈래
모두 `null` 이다 — 배경 없는 테마 넷은 웹과 같고(안 그리는 것이 맞다), 선언이 있는 둘은 몸통이 없다.
[[ADR-129]] 로 그림은 번들에 들어왔고 `getThemeBackgroundUrl` 이 진짜 에셋을 돌려주지만, **전면
백드롭이 없다.** 헤더 조각은 *"백드롭과 이어 붙이는"* 물건이라 그것 없이 조각만 그리면 화면 맨 위에
그림 띠 하나만 뜨고 아래는 `bg` 단색이 된다 — 그 결정이 없애려던 이음매를 **오히려 만드는** 일이라
반쪽만 만들지 않았다. 남은 일은 전면 백드롭 RN 컴포넌트이고 그것은 `components/templates` 몫이다.

##### 구조가 대신 지킨 것 여섯

| ADR | 웹이 손으로 한 일 | RN |
|---|---|---|
| 077 | 히스토리를 중첩 라우트 + `<Outlet />` 으로 얹어 언마운트를 막았다 | 하위 페이지가 **루트 스택 push** 라 이 화면이 트리에 남는다 |
| 085·112 | `fixed` 헤더 + 실측 spacer + **매 커밋 도는** layout effect | 헤더가 스크롤 뷰의 **형제**라 spacer 도 실측도 없다 |
| 099 | 문서 스크롤을 화면 컨테이너로 옮겼다 | `ScrollView` 가 기본값 |
| 100 결정 2 | 헤더 + spacer 를 래퍼로 묶어 셸 안에 | 헤더가 `ScreenScroll` 의 `header` 프롭이다 |
| 073 | 목록을 `transform` 으로 내리고 인디케이터를 얹었다 | `RefreshControl` ([[ADR-130]]) |
| 120 결정 10 | 스택 깊이로 아래 화면의 당김을 껐다 | 하위 페이지가 **덮어** 손가락이 안 닿는다 |

##### 고가 드롭 강조가 CSS 한 덩어리에서 값 셋으로 내려왔다 ([[ADR-045]])

| 웹 | RN | 근거 |
|---|---|---|
| `::before` conic-gradient + `mask(xor)` 회전 샤인 링 | **정적 골드 2px 테두리** | conic-gradient 가 없다. 다만 이것은 임시방편이 아니라 **[[ADR-045]] 가 `@property` 미지원 WebView 를 위해 이미 설계해 둔 degrade 경로 그대로**다(`--vd-angle: 0deg` 폴백이 그리는 그림이 정확히 이것) |
| `box-shadow` 키프레임 맥동 | **`boxShadow` 두 겹의 교차 페이드** | RN 이 `box-shadow` 를 보간하지 않는다. 두 끝점(`0%,100%` 와 `50%`)은 **정확히 같고** 중간만 파라미터 보간이 아니라 알파 교차다 |
| 펼치면 `animation: none`(결정 4) | 맥동 겹을 안 그리고 **정적 폴백 하나** | 웹이 그 선택자로 고정하는 값이 곧 `.valuable-drop-card` 의 `box-shadow` 다 |

맥동 겹이 **셸 안이 아니라 카드 루트에** 붙는 것이 짝이 되는 조건이다 — 펼침 셸은 자식을 잘라내므로
([[ADR-049]]) 안에 두면 밖으로 번지는 그림자가 잘린다. 웹에서 그 그림자가 셸 **자신의** `box-shadow`
라 `overflow: clip` 에 안 잘렸던 것과 같은 결과를 다른 방법으로 얻는다.

`keyframes-parity.test.ts` 가 웹 `index.css` 를 실제로 읽어 대조한다 — `valuable-drop-glow` 는
«화면 몫»에서 **옮겨진 것**이 되고, `valuable-drop-spin` 은 **«degraded» 칸을 새로 만들어** *"웹에
그 폴백이 실재하는가"*(`--vd-angle: 0deg` · 베이스 골드 · `padding: 2px`)를 붙든다.

##### 코드로 갈린 것 다섯

① **공용 `PageHeader` 를 쓰지 않는다** — 그 셸은 하단 경계 페이드를 항상 그리는데 이 화면은
[[ADR-047]] 결정 6 이 그것을 금지한다(경계는 총 수익 헤드라인 하단 헤어라인이 담당). 나머지 셸 값은
글자 그대로 같다. ② **[[ADR-080]] 최상단 이동은 남기되 이유가 바뀐다** — 웹에서 그것은 깨진 프레임을
없애는 처방이었고 RN 에는 그 사슬이 없다. 남는 것은 **관찰 가능한 동작**(기간을 옮기면 목록 처음부터
본다)이라 `ScreenScroll` 의 `ref` 로 계속 부른다. ③ `?openPicker=1` → **라우트 파라미터**(받는 쪽은
step 5 가 이미 뒀다). ④ `CharacterAccordion` 이 **파일로 나왔다**(웹은 화면 안 인라인) — 나눈 이유는
줄 수가 아니라 관심사다([[ADR-094]] 결정 7). ⑤ 실패 배지 팝오버의 **측정이 비동기**라 두 상자를
재는 일이 화면 층으로 왔다(`resolveIssueAnchor` 는 환산만 한다).

##### 사라진 것 · 생긴 것

**사라진 것**: `<Outlet />` · `usePullToRefresh` 배선과 `PullToRefreshIndicator` · `resolveContentOffsetPx`
`transform` · `useScreenStackStore` 깊이 게이트 · `useMeasuredHeight` 와 spacer · `stickyOffset()` ·
스크롤·바깥 탭으로 팝오버 닫는 코드(이슈 팝오버는 **카드와 함께 스크롤**된다) · 아이템 칩의
`stopPropagation`/`preventDefault`/`tabIndex`/`onKeyDown` 네 줄.

**생긴 것**: `valuable-card-glow.ts`(값을 컴포넌트 파일 밖으로 — fast refresh) ·
`CharacterAccordion.tsx` · `normalize-tree.ts` 가 `navigation/__tests__/` 에서 `src/__tests__/` 로
승격(두 번째 호출부 — 이 화면이 `ScreenScroll` 에 엘리먼트 프롭을 둘 넘긴다).

##### RNTL 함정 둘 (실측)

① **`act(() => fireEvent.press(x))` 로는 상태가 반영되지 않는다.** 동기 `act` 는 예약만 하고 끝나
직후 질의가 *"누르기 전 화면"* 을 본다 — 케이스 전체가 "요소를 못 찾는다"로 떨어져 마치 렌더가
비어 있는 것처럼 보인다(디버그로 트리를 찍어야 아니라는 것이 드러난다). **`await act(async () => {…})`**
가 답이다. ② **엘리먼트를 값으로 받는 프롭이 있으면 스냅샷이 아예 안 찍힌다** — `_owner` 파이버를
따라가다 `RangeError: Invalid string length` 로 죽는다(step 4 가 먼저 밟았고, 이 화면은 `header` 와
`refreshControl` 둘이라 그대로 걸렸다).

##### 육안 대조 목록 (실기기, 우선순위 순)

1. **캐릭터 카드 헤더가 sticky 가 아니다** — 보스 행을 스크롤하는 동안 그 캐릭터 합계가 사라지는
   것이 견딜 만한가. **여기서 판정이 갈리면 위 «두 길» 중 하나를 잡는다**
2. **고가 드롭 카드** — 골드 테두리가 회전 없이도 "고가"로 읽히는가 · 글로우 맥동이 웹과 같은
   호흡인가(2초) · 펼치면 맥동만 멎는가
3. **총 수익 헤드라인** — 라벨행이 뱃지·칩 유무와 무관하게 같은 높이인가([[ADR-054]] 정정 4) ·
   금액 카운트업이 굴러가는가 · 기간을 옮기면 **총 수익만** 굴러가는가([[ADR-087]] 정정 1)
4. **당겨서 새로고침** — 현재 기간에서 돌고 닫힌 과거 기간에서는 **당김 자체가 없는가**
5. **기간 이동** — 최상단으로 가는가 · 그 사이 헤더가 튀지 않는가
6. **아이템 내역 상자 셋**(총 수익 · 카드 · 보스 행) — 트리거 밑에 붙는가 · 화면 밖으로 안 나가는가
7. **실패 배지 팝오버** — 금액 첫 글자와 한 줄로 맞는가(측정이 비동기라 **한 프레임 늦게** 제자리를 잡는다)
8. **결정석 칩** — 월드 둘 이상에서 펼쳐지는가 · 헤더 높이가 안 변하는가
9. **테마 배경** — 혼테일·검은마법사에서 **아직 단색**인 것이 맞다(위 «못 옮긴 것 둘»)
10. **새로고침 아이콘** 회전 · 탭 pill 과 30px 로 나란한가([[ADR-049]] 결정 1)

**미확인** — 실기기에서 아무것도 안 봤다. 그리고 **자동 테스트가 담보하는 것은 어느 분기로 가는가이지
픽셀이 아니다**: jest 는 레이아웃을 계산하지 않아 `measureInWindow` 콜백이 오지 않고, 애니메이션은
UI 스레드가 굴려 트리에 값이 남지 않는다(대조는 `keyframes-parity` 가 **상수 대 CSS** 로 한다).

#### 4-8단계 결과 — 드롭 화면 셋 (2026-08-13, **남은 모션을 닫는다**)

드롭 화면 셋을 옮겼다 — `DropHistoryScreen`(397) · `DropPriceScreen`(445) · `DropPricePad`(323).
`RootNavigator` 의 `STACK_SCREENS` 표가 이로써 **다 찼다**: `PlaceholderScreen` 으로 떨어지는 이름이
0이다(분기와 컴포넌트는 남긴다 — 라우트가 늘 때 다시 쓰인다).

##### `@keyframes` 표가 «진행 상황»에서 «결과»로 바뀌었다

| 칸 | 이름 | 누가 |
|---|---|---|
| `ported` | `toast-shrink` · `maple-trail` · `maple-sweep` · `fx-drop-float` | 3단계(컴포넌트 계층) |
| `portedByScreens` | `valuable-drop-glow` · `valuable-drop-row-pulse` | **4단계** — step 7(캐릭터 카드) · step 6(보스 행) |
| `screenLayer` | — | **비었다.** step 8 이 4단계의 마지막이라 남은 이름이 곧 미완이고, 전용 케이스가 그것을 잡는다 |
| `degraded` | `valuable-drop-spin` | step 7 — 아래 |

**셋 중 어느 것도 step 8 이 처음 옮긴 것이 아니다.** 3단계가 «화면 몫»으로 넘긴 셋 가운데
`valuable-drop-row-pulse` 는 step 6 이, `valuable-drop-glow` 와 `valuable-drop-spin` 의 degrade 는
step 7 이 자기 화면을 그리며 이미 가져갔다(«degraded» 칸도 그때 섰다) — 모션만 따로 옮기면 **붙일
요소가 없어서** 그렇게 될 수밖에 없었고, 그 편이 옳다.

step 8 이 실제로 한 일은 둘이다. ① **표를 갈랐다** — 옮겨진 둘을 `portedByScreens` 로 빼고
`screenLayer` 를 **빈 채로 남겨** *"여기 이름이 있으면 그것이 곧 미완"* 을 계약으로 세웠다(그 전까지
`screenLayer` 는 «옮겼다»와 «안 옮겼다»를 한 칸에 담고 있어 다 옮겨도 초록이었다).
② `valuable-drop-row-pulse` 의 **두 번째 호출부**를 만들며 그 값을 컴포넌트 파일 밖으로 꺼냈다.
칸 이름은 이 경위를 안 남기므로 여기 적어 둔다.

`setInterval`/`setTimeout` 으로 만든 프레임은 **0건**이다(전부 Reanimated CSS 애니메이션 · SVG 속성은
`useAnimatedProps` — 3단계가 세운 두 갈래 그대로). 지속시간·이징은 손으로 베끼지 않고
`keyframes-parity.test.ts` 가 웹 `index.css` 를 **읽어** 대조한다.

##### `valuable-drop-spin` 은 «못 옮김»이 아니라 **degrade** 다 — 그 구분이 이 칸의 전부

RN 에 conic-gradient 도 `mask-composite: xor` 도 없어 회전 샤인 링을 그릴 방법이 없다. 그런데 우리가
대신 그리는 정적 골드 2px 은 임시방편이 아니라 **[[ADR-045]] 가 `@property` 미지원 WebView 를 위해
이미 설계해 둔 폴백 경로 그대로**다. 그래서 테스트가 붙드는 것도 *"RN 이 웹을 얼마나 흉내내는가"* 가
아니라 ***"웹에 그 폴백이 실재하는가"*** 다 — `--vd-angle: 0deg` · 그 각도의 시작 정지점이 베이스
골드 · `padding: 2px`. 웹이 그 폴백을 지우면 **RN 쪽 근거가 사라지므로 빨개진다.**

##### 웹의 클래스 하나가 컴포넌트로 나왔다 — `ValuableRowBackground`

step 6 이 `BossProfitBossRow` **안에** 두었던 것을 꺼냈다. 그때는 호출부가 보스 행 하나뿐이었고,
가격 기록 화면의 행(`EntryRow` — 웹도 같은 `valuable-drop-row` 클래스를 쓴다)이 **두 번째**가 되어
[[ADR-094]] 결정 1 의 *"호출부 2곳 이상"* 을 넘겼다. 옮기지 않고 `BossProfitBossRow` 에서 가져오면
가격 화면이 드롭 시트·팝오버·보스 초상까지 딸린 모듈에 매달린다.

딸려 온 것 하나 — **lint 경고가 36 → 35 로 줄었다.** `VALUABLE_ROW_PULSE` 가 객체라
`react-refresh/only-export-components` 의 `allowConstantExport` 가 안 봐줬고(문자열인
`VALUABLE_ROW_TINT` 는 봐준다), 값이 `valuable-row-glow.ts` 로 나가며 그 한 건이 사라졌다. 추측이
아니라 HEAD 판을 따로 린트해 확인했다(`BossProfitBossRow.tsx:61:14` 한 건).

**드롭 히스토리에는 이 배경을 쓰지 않는다** — [[ADR-071]] 결정 8 이 명시적으로 뺐다(줄간격을 좁히면
배경 블록끼리 붙어 서로를 잡아먹는다). 그 화면의 고가 표시는 pill 과 본문색만 담당하고, 회귀 가드
2케이스가 *"고가 줄에도 배경을 만들지 않는다"* 를 붙든다.

##### [[ADR-124]] — 미입력은 0원이 아니다 (이 화면이 그 계약의 가장 직접적인 자리다)

합산 층은 core 가 이미 지킨다(`dropPayoutMeso` 가 `priceState !== 'entered'` 를 0으로 접는다). 여기서
지키는 것은 **표시**이고, 사용자가 값을 넣는 자리라 그 구분이 눈에 보여야 한다.

- 상태 pill 셋을 **색이 아니라 형태**로 가른다(채움 / 회색 / 점선), 미입력 행의 금액 자리에는 `0` 이
  아니라 **`입력`** 이 선다
- **가장 강한 반례는 `priceMeso` 는 있고 `priceState` 만 없는 기록**이다(`priceMeso ?? 0` 계열로
  그리면 정확히 거기서 금액이 샌다) — 케이스로 고정했다
- **값을 매긴 행만 인원을 말한다** — 미입력에 `1인` 이 서면 이미 정해진 값처럼 읽힌다
- 빈 칸을 `0` 으로 저장하는 경로도 없다: `0` 이면 저장 버튼이 눌리지 않고, 스킵은 **아무것도 저장하지
  않으며**, 「기록 안함」은 0원이 아니라 `excluded` 라는 **결정**을 저장한다

##### [[ADR-121]] 키패드 — *"RN 키보드로 갈리는 것"* 을 확인한 답이 «부르지 않는다» 다

step 지시가 숫자 키패드 타입·소수점·큰 수를 확인하라 했고, 확인한 결과 **셋 다 해당이 없다**:
`keyboardType` 을 쓰지 않고(앱이 자기 키패드를 그린다), 메소는 정수라 소수점이 없으며, 큰 수는
`MAX_MESO`(9,999,999,999,999 — `Number.MAX_SAFE_INTEGER` 아래)로 막는다.

웹이 자체 키패드를 고른 근거는 *"키보드가 뜨면 WebView 가 줄어 시트가 밀리거나 잘린다"* 였고 RN 에는
웹뷰가 없다. 그래도 **결론은 그대로 선다** — 메소는 자릿수가 커서 시스템 숫자 키패드로는 0을 세게
되고(`keyboardType="numeric"` 이 못 고치는 것이 그것이다), `KeyboardAvoidingView` 는 플랫폼마다 갈리는
데다 `@gorhom/bottom-sheet` 의 동적 높이와 겹친다. **앱이 자기 키패드를 그리면 보정할 것이 애초에
없다.** 스테퍼를 `PartySizeStepper` 로 접지 않은 것도 그대로다(22px·`Users` 없음이라 그 molecule 이
정한 두 크기 어느 쪽도 아니다 — 보스 행이 셋째인 것과 같은 사정이라 넷째 모양을 만들지 않는다).

##### 코드로 갈린 것 여섯

① **고가 pill 이 degrade 된다** — RN 문장 안의 중첩 `Text` 가 받는 것은 `backgroundColor` 하나뿐이라
**그라디언트도 라운드도 글로우도 못 온다**(웹 그라디언트의 **끝 정지점** `#f7c400` 을 단색으로 쓴다 —
새 골드를 뽑지 않는 것이 [[ADR-071]] 결정 8 의 요구다). ② 그 대가로 **같은 결정의 줄바꿈 처방 하나가
통째로 필요 없어진다**: pill 이 원자적 인라인 박스가 아니게 되어 *"조사만 다음 줄로 떨어지는"* 일이
구조적으로 안 일어난다(`particle` 은 그대로 받고 `whitespace-nowrap` 묶음만 사라진다). ③ **`overlays`
프롭이 소멸한다** — 웹은 오버레이가 탭 레이어의 `transform` 에 딸려 밀리지 않게 `StackScreen` 으로
넘겼는데, RN 시트는 별도 네이티브 호스트에 떠 갇힐 상자가 없다. ④ `invisible` →
**`opacity-0` + `pointerEvents="none"`**(RN 에 `visibility` 가 없어 투명도로 대신하고, **투명한 버튼이
눌리지 않도록 터치를 함께 끈다**). ⑤ **하단 안전영역을 키패드가 넣지 않는다** — 시트 껍데기가 이미
주므로 두 번 주면 두 겹이 된다(웹 주석이 *"드릴다운은 안전영역을 넣지 않는다"* 고 갈라 둔 갈래가
**양쪽 다 그렇게** 되어 사라진다). ⑥ **본문과 시트 껍데기를 갈랐다**(`DropPricePadContent` ↔
`DropPricePad`) — 가격 기록 화면은 `BottomSheet` 로 띄우고, 드롭 입력 시트는 **드릴다운으로 갈아
끼운다**([[ADR-124]] 결정 6 의 *"시트가 살아서 하던 작업을 잇는다"*). step 6 이 남긴
`drop-price-pad-seam` 자리표시자가 이것으로 채워졌고, **스킵은 순차 모드에만 넘긴다**(단건 편집은
뒤로 누르는 것이 곧 같은 일이라 버튼을 늘리지 않는다).

##### 육안 대조 목록 (실기기, 우선순위 순)

1. **가격 키패드** — 자체 키패드가 OS 키보드보다 실제로 나은가 · 다섯 단위 칩이 390px 한 줄에 들어가는가
   · 큰 금액을 칠 때 자릿수 표기가 흔들리지 않는가
2. **미입력 ≠ 0원** — 세 pill 이 **색 없이 형태만으로** 갈려 보이는가(채움 / 회색 / 점선)
3. **드릴다운 복귀** — 드롭 시트에서 값을 매기고 뒤로 나왔을 때 **고르던 자리가 그대로인가**
4. **고가 행 배경** — 맥동이 웹과 같은 호흡인가(2.6초) · 오른쪽 글로우가 같은 자리에서 배어나오는가
   · 가격 화면과 보스 행이 **같은 그림인가**
5. **고가 pill** — 그라디언트·글로우 없는 단색 골드가 여전히 "고가"로 읽히는가(**degrade 판정**)
6. **가뭄 단풍잎 5단** — 단계가 실제로 구분돼 보이는가 · 0단계 글로우가 뜨는가
7. **히스토리 한 줄 문장** — 줄바꿈 품질(`text-balance`·`break-keep` 짝이 없다) · WORD JOINER 가 사는가
8. **월간 탭에서 연 가격 화면** — 검은마법사 드롭이 실제로 보이는가(웹에서 못 닿던 자리)
9. **순차 입력** — `3 / 6` 진행 표기가 맞고 스킵이 아무것도 저장하지 않는가
10. **모션 줄이기 켜고** — 맥동만 멎고 정적 틴트·글로우는 남는가

**미확인** — 실기기에서 아무것도 안 봤다. 자동 테스트가 담보하는 것은 **분기와 숫자**이지 그림이
아니다(jest 는 레이아웃을 계산하지 않고, 애니메이션은 UI 스레드가 굴려 트리에 값이 안 남는다).

---

#### 4단계 결과 — `app/` 화면 재작성 (2026-08-12 ~ 08-13, step 0~8)

**화면을 다 옮겼다.** 자리표시자로 떨어지는 라우트가 0이고, 온보딩 · 탭 넷 · 하위 페이지 **열한
라우트**(컴포넌트는 열 — 안내 상세 둘이 같은 것을 가리킨다, [[ADR-125]] 결정 3)가 전부 진짜 화면을
그린다.

| | 3단계 끝 | 4단계 끝 |
|---|---|---|
| jest | 693개 | **1,382개 / 109파일** |
| vitest | 3,046개 / 199파일 | **3,056개 / 200파일** — 늘어난 10은 step 1 의 에셋 목록 검사이고 **step 2~8 은 증감 0**(웹 앱을 한 줄도 안 건드렸다) |
| lint | 0 errors / 17 warnings | **0 errors / 35 warnings** |
| `@keyframes` | 화면 몫 3 | **0** (이식 2 · degrade 1) |

warning 35의 갈래를 재 보면 **웹 17 · RN 18** 이고, 웹 쪽 17은 **기준선과 정확히 같은 그 17**이다
(파일 목록도 그대로). 전부 `react-refresh/only-export-components` 한 규칙이고, RN 쪽 8파일 중
`ItemRevenuePopover` 하나만 웹에 짝이 없다.

##### 이 단계에서 반복된 것 — **구조가 계약을 대신 지킨다**

가장 많이 쓴 판정 기호가 🏗 였다. 웹이 손으로 세운 처방 여럿이 RN 에서는 **코드가 아니라 구조로**
만족된다.

| 웹이 손으로 한 일 | RN 에서 그것이 사라진 이유 |
|---|---|
| [[ADR-077]] 중첩 라우트 + `<Outlet />` 으로 언마운트 방지 | 하위 페이지가 **루트 스택 push** 라 아래 화면이 트리에 남는다 |
| [[ADR-085]]·[[ADR-098]]·[[ADR-112]] `fixed` 헤더 + 실측 spacer + 매 커밋 layout effect | 헤더가 스크롤 뷰의 **형제**라 spacer 도 실측도 필요 없다 |
| [[ADR-099]]·[[ADR-100]] 문서 스크롤을 화면 컨테이너로 옮기기 | `ScrollView` 가 **기본값**이다 |
| [[ADR-072]] 결정 14 · [[ADR-120]] 결정 10 스택 깊이로 아래 화면 당김 끄기 | 하위 페이지가 **덮어** 손가락이 안 닿는다 |
| [[ADR-100]] 결정 4 스크롤 시작하면 팝오버 닫기 | 팝오버가 별도 네이티브 윈도우라 **아래가 스크롤될 수 없다** |
| [[ADR-050]] 탭 클릭 인터셉터(문서 리로드 방어) | 방어할 `<a href>` 가 없다 |

**이것이 이 전환에서 가장 값진 결과다** — [[ADR-079]]·[[ADR-084]] 처럼 실기기에서 두 번 반증당하며
얻은 처방들이 새 플랫폼에서는 **처방이 아니라 전제**가 됐다. 다만 뒤집어 말하면 **그 처방들이 실제로
필요 없는지는 실기기에서만 확인된다.**

##### 5단계로 넘기는 것 — **먼저 눈으로 봐야 하는 것들**

5단계는 실기기 검증·롤아웃이다. 그 앞에 놓인 것을 셋으로 가른다.

**ⓐ 못 옮긴 채 넘어가는 것 (판정이 필요하다)**

| 무엇 | 상태 | 판정 기준 |
|---|---|---|
| ~~[[ADR-047]] **중첩 sticky**~~ | **판정 끝 — 안 옮긴다**([[ADR-131]], 2026-08-13) | — |
| [[ADR-088]] **테마 배경** | `ThemeHeaderBackdrop` 이 두 갈래 모두 `null` | 전면 백드롭 RN 컴포넌트(`components/templates`)가 선행 조건. **반쪽만 만들면 그 결정이 없애려던 이음매를 오히려 만든다** |
| ~~[[ADR-048]]·[[ADR-103]] **드롭 연출 재생 엔진**~~ | **해소됨**(2026-08-13) — 아래 «드롭 연출» 절 | — |
| [[ADR-065]] 결정 3 **캐시 삭제 실패 토스트** | 짝이 없다(`sessionStorage` 위에 서 있었고 `reloadAppAsync()` 가 JS 런타임을 다시 실행한다) | 대체 수단 설계 — *"있는데 안 도는 코드"* 가 되므로 셸에 넣지 않았다 |

#### 드롭 연출 — ⓐ 에서 빠졌다 (2026-08-13)

프레임 에셋([[ADR-129]])이 들어온 뒤 재생 엔진을 되살렸다. **웹과 달리 상태 전이를 순수 함수로
떼어냈다** — 웹판은 그 로직이 `useEffect` 클로저 + DOM 변이와 한 덩어리라 단위로 검사할 수 없었고,
그래서 RN 테스트 파일 머리에 *"재생을 보는 아홉은 여기 없다"* 고 적혀 있었다. 이제 시간을 인자로
받는 검사 14개가 그 자리를 지킨다(8프레임 등장 · pre→loop · end 종료 · 프레임 0 인 단계에서
무한 루프 방지).

**[[ADR-103]] 의 1.5배가 RN 에서도 그대로 맞는다**(사용자 판정, 2026-08-13 — *"속도는 괜찮아"*).
그 ADR 은 2배로 올렸다가 *"너무 빨랐다"* 는 반려로 1.5배로 되돌아온 이력이고 *"배율은 계측이 아니라
눈으로 정하는 값"* 이라 적혀 있다. **웹에서 눈으로 정한 값이 RN 에서 다시 눈으로 확인됐다** —
프레임 타이밍은 렌더러가 아니라 그림에 붙은 성질이라는 뜻이고, fps 표를 그대로 옮긴 판단이 맞았다.

기기에서 두 번 틀렸고 둘 다 **«어디에 거는가»** 의 문제였다.

| 증상 | 원인 | 처방 |
|---|---|---|
| 팝인에서 **앱이 죽는다** | 웹의 `cubic-bezier(.2,1.3,.35,1)` 을 문자열로 옮겼다. Reanimated CSS API 는 미리 정의된 이름만 문자열로 받고 임의 곡선은 `cubicBezier()` 헬퍼다 — **타입은 통과하고 런타임에 던진다** | 헬퍼로 교체 + 이징의 **형태**를 고정하는 테스트(값이 아니라 형태다 — 웹 CSS 를 베껴 오면 반드시 밟는다) |
| 스프라이트 뒤에 **검은 사각형** | `mixBlendMode: 'screen'` 을 프레임 상자에 걸었는데 앵커의 `zIndex` 가 만든 스태킹 컨텍스트에 블렌드가 갇혔다. 합성 상대가 빈 배경이 되니 검정이 검정으로 남는다 | 블렌드를 **앵커 자신**으로. 픽셀 스캔으로 확정(수정 전 x 20~83% 가 `rgb(0,0,0)`, 수정 후 전 구간 그라디언트) |

> **`mix-blend-screen` 짝이 없다는 3단계의 기록은 틀렸다** — RN 0.86 에 `mixBlendMode` 가 있다.
> 없는 것은 짝이 아니라 «어느 요소에 거는가» 에 대한 이해였다.

#### 중첩 sticky — ⓐ 에서 빠졌다, 만들어서가 아니라 **안 만들기로 해서** (2026-08-13)

계획서는 이 자리를 *"육안 대조 1순위 — 거슬리면 `Animated.ScrollView` 가 선행 작업"* 으로 두고
**판정을 기다렸다.** 사용자가 UI 정책을 다시 잡으며 판정을 내렸고, 판정은 **두 번에 걸쳐 좁혀졌다**
— *"최상단 헤더만 남긴다"* 에서 **"그 헤더도 푼다"** 로([[ADR-131]]).

그래서 «못 옮긴 것» 이 «안 옮기기로 한 것» 이 되고, **덤으로 고정이 하나 더 풀렸다.** RN 의
`PageHeader` 는 스크롤 뷰의 **형제**여서 sticky 보다 강한 고정이었는데(sticky 는 스크롤 범위 안에서만
붙지만 형제는 영원히 붙어 있다) 그것을 **첫 자식**으로 옮겼다 — `ScreenScroll` 한 곳이고 화면
열하나가 전부 그 프롭을 지난다. 대신 정책이 조용히 뒤집히지 않도록
`src/__tests__/sticky-policy.test.ts` 가 `stickyHeaderIndices`·`position:'sticky'`·`stickyTop` 을
막는다 — 이 부류의 회귀는 «기능이 깨지는» 모양이 아니라 **«없기로 한 것이 슬그머니 생기는»** 모양
으로 오기 때문이다.

**대가가 둘이다.** [[ADR-047]] 후속 3 이 소계 footer 를 지운 근거가 *"헤더가 sticky 라 합계가
스크롤 내내 보인다"* 였으므로 긴 카드에서 **캐릭터 합계가 화면 밖으로 나가고**, 헤더가 올라가면
그 자리에 배경이 없어 **콘텐츠가 상태바 아래로 지나간다**(실기기 확인 — 시계·다이나믹 아일랜드가
카드 그림과 겹친다). [[ADR-131]] 은 **둘 다 지금 되메우지 않는다** — 후자의 처방 중 하나(스크롤
위치에 따라 띠를 띄우기)는 «고정 영역» 을 되살리는 것이라 그 결정과 정면으로 부딪힌다.

**웹은 그대로 둔다**(사용자 판정) — 교체될 앱이라 회귀 위험을 지지 않는다. 전환 기간에 두 앱의 이
동작이 다른 것은 **의도된 차이**이고, 육안 대조에서 이 항목은 «다르면 결함» 이 아니라 «다른 것이
맞음» 이다.

**ⓑ OTA — 화면은 다 있고 값이 없다** ([[ADR-128]] 결정 7)

`UpdatePromptModal` 은 상태 아홉과 문구를 한 글자도 안 지운 채 **마운트만 없고**, `AppUpdateSection` 은
`unsupported` 상수를 심는다. 벽은 `LiveUpdatePort` 가 던지는 것 **그리고 그보다 앞서** core 의
live-update 스토어가 `import.meta.env` 를 모듈 최상위에서 읽어 **import 하는 것만으로** 죽는다는 것이다.
딸린 공백 셋 — [[ADR-117]] 결정 2 **자동 롤백 없음** · [[ADR-126]] 결정 4 **「업데이트를 마쳤어요」가
안 뜸** · 설정 화면 세 자리의 버전이 **빌드 시점 `package.json`** 으로 좁혀져 있음. **이것은
5단계보다 앞서 별도 ADR 로 닫아야 한다** — 전환 릴리스는 OTA 로 못 고치는데(아래 «되돌릴 수 없는
지점») 그 다음 릴리스부터 고칠 수단이 이것이다.

**ⓒ 정리 대상 (동작에 영향 없음)**

- `PullToRefreshIndicator` 가 **고아가 확정됐다** — [[ADR-130]] 결정 5 가 *"고아 확정은 step 5·7 이 같은
  선택을 물려받은 뒤"* 로 미뤄 둔 조건이 충족됐다(제품 참조 0건, 남은 것은 주석과 자체 테스트뿐).
  삭제는 이 단계 범위 밖이라 손대지 않았다
- `character-groups.ts` 가 **`packages/core` 로 갈 후보**다(뷰 0줄 · `@core/*` 만 참조 — 파일 머리에
  적어 두었다). 4단계 규칙이 core 무수정이라 옮기지 않았다

##### 그리고 이 단계가 답하지 못하는 것

**실기기에서 아무것도 안 봤다.** step 2~8 이 각자 남긴 육안 대조 목록이 합쳐서 **67항목**(8·9·10×5)
이고, 그것이 5단계의 첫 작업이다. 자동 테스트가 담보하는 것은 **어느 분기로 가는가와 숫자**이지 픽셀이 아니며,
[[ADR-128]] 이 «잃는 안전망»에 적어 둔 대로 **웹뷰 앱과의 대조는 사람 눈이 한다** — RN 트리 스냅샷
49개는 *"앞으로 안 바뀌는가"* 에만 답한다.

### 5단계 — 실기기 검증 · 단계적 롤아웃

- Play Console staged rollout 1% → 확대, iOS Phased Release
- **게이트**: 아래 «되돌릴 수 없는 지점» 체크리스트 전항 통과

---

## 되돌릴 수 없는 지점

전환 릴리스는 **OTA로 고칠 수 없다.** 새 빌드에 `@capgo` 가 없고, `expo-updates` 로 밀려면 이미 RN이
깔려 있어야 한다. 스토어 롤백도 불가하다(새 버전을 올려 심사를 기다려야 한다).

릴리스 전 반드시 확인:

- [ ] **서명키가 동일한가** — 다르면 **설치가 거부된다**(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`).
      갤럭시 실기기에서 실제로 관측했고 **비파괴적이다** — 기존 앱도 데이터도 그대로 남는다.
      Play 배포는 앱 서명 키를 구글이 들고 있어(Play App Signing) 업로드 키만 맞으면 되고,
      틀리면 그 역시 **업로드가 반려**된다. 즉 이 항목의 실패 모드는 «데이터 소실» 이 아니라
      «배포 불가» 다. **데이터가 사라지는 경로는 하나뿐이다 — 거부당한 뒤 uninstall 하고 새로
      까는 것.** 그러니 검증 중에도 uninstall 하지 마라([data.md](./data.md) · MIUI 는 애초에
      재설치가 막혀 있다).
      (이 줄은 원래 *"바뀌면 데이터가 전부 사라진다"* 로 적혀 있었으나 **틀린 서술**이었다.
      OS 는 서명이 다른 패키지를 같은 앱의 업데이트로 받지 않고, 받지 않는다는 것이 곧 기존
      설치본을 건드리지 않는다는 뜻이다.)
- [ ] `appId` 가 `com.mapleroutine.app` 그대로인가
- [ ] `versionCode` 를 올렸는가 ([[ADR-024]] OTA 섀도잉 이력 참고)
- [ ] 구버전 설치본 → 신버전 **업데이트** 시나리오를 Android·iOS 실기기에서 통과했는가
      (MIUI는 `install -r` 만 허용 — `uninstall` 하면 검증 자체가 무의미해진다)
- [x] ~~예약된 로컬 알림 재등록이 동작하고 **중복 알림이 없는가**~~ ([data.md](./data.md) 결정 4) —
      **해당 없음으로 확정**(2026-08-17). 이 앱은 로컬 알림을 **한 번도 예약한 적이 없다**
      (`native/notifications.ts` 는 어댑터와 자기 테스트뿐, 호출부 0 — [[ADR-004]] 가 설계만 되고
      구현되지 않았다). 옛 예약이 0건이라 중복·유령이 일어날 수 없고, **정리 코드도 넣지 않는다**
      (원칙 5). 알림 자체의 설계는 [[ADR-146]]
- [ ] AdMob 앱 ID가 `AndroidManifest.xml`·`Info.plist` 에 있는가 (없으면 SDK가 부팅 시 크래시한다)
- [ ] 전 사용자에게 "스토어 업데이트 필요"를 알리는 **준비 릴리스**를 OTA로 먼저 내보냈는가

---

## 잃는 안전망

전환 기간에만 없어지는 것들이다. 미리 알고 대비하는 것과 겪고 나서 아는 것은 다르다.

| 안전망 | 왜 없어지나 | 대비 |
|---|---|---|
| **OTA 즉시 수정** | 프레임워크 교체는 스토어 릴리스 | 단계적 롤아웃, 원본 데이터 보존 |
| **DOM 스냅샷 5개** | `BossProfitScreen`(725줄)·`ContentScreen`(195)·`BossScreen`(122)·`Modal`(31)·`PageHeader`(13). 전부 DOM 트리라 RN에 이식 불가 | **RN 트리 스냅샷을 새 기준선으로 + 예전과의 대조는 사람 눈**(사용자 결정, 2026-08-11 — 아래) |
| **브라우저 devtools** | RN엔 DOM이 없다 | Flipper / React DevTools |
| **`npm run dev` 즉시 반영** | 웹 타깃 소멸 | Fast Refresh (동등하나 다르다) |

DOM 스냅샷 3종이 가장 아프다. **이 저장소에서 "화면이 예전과 같은가"를 기계적으로 판정하던 유일한
장치**이고, 하필 이 전환이 그 질문을 가장 많이 하게 만든다.

### RN 트리 스냅샷 관례 (3단계에서 확정, 2026-08-11)

| 항목 | 규칙 |
|---|---|
| 배치·이름 | 테스트 파일 옆 `__snapshots__/<파일명>.snap` — jest 기본값 그대로. 도구가 정해 둔 자리가 있으면 규칙을 새로 만들지 않는다 |
| 찍는 법 | `expect((await render(<X />)).toJSON()).toMatchSnapshot()` — `@testing-library/react-native` 14 의 `render` 는 **비동기**다. `await` 를 빠뜨리면 Promise 에 대고 단언하게 되고, 그때 나는 에러가 배선 문제처럼 보인다 |
| 무엇을 찍나 | 렌더 트리 **전체**. `className` 이 풀린 `style` 이 그 안에 들어 있어야 한다 |

**스타일 값이 스냅샷에 실리게 하는 것이 이 관례의 전제다.** 그냥 두면 `className` 이 스타일 없이
렌더돼 트리에 클래스 이름만 남고, 그러면 `p-4` 를 `p-5` 로 바꿔도 초록이다 — 회귀를 잡으라고 만든
기준선이 정작 스타일 회귀를 못 잡는다. 그래서 `jest.global-setup.js` 가 앱이 실제로 쓰는
`tailwind.config.js` 로 `global.css` 를 **실행당 한 번** 컴파일하고 `jest.setup.js` 가 테스트마다
주입한다. NativeWind 가 주는 `nativewind/test` 의 `render()` 를 안 쓰는 이유는 둘이다 — 그 파일이
JSX 가 트랜스파일되지 않은 채 배포돼 jest 에서 `SyntaxError` 로 죽고, 설령 돌아도 **넘긴 JSX 에 직접
적힌 `className` 만** 훑어 컴포넌트 **안쪽** 클래스는 빈 스타일이 된다.

> **이 스냅샷은 "예전과 같은가"에 답하지 않는다.** 답하는 것은 오직 *"앞으로 안 바뀌는가"* 다.
> 웹뷰 앱과의 대조는 위에 적은 대로 **사람 눈**이 한다 — 초록색을 보고 패리티가 검증됐다고 읽지 말 것.

---

## 폐기된 정책 (history)

- (아직 없음 — 이 문서는 [[ADR-128]] 과 함께 신설됐다)
