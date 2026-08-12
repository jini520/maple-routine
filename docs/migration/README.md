# React Native 전환 (인덱스)

**범위**: Capacitor → React Native 전환 전체 — 원칙·전략·단계·검증 게이트. 옮길 대상의 전수 목록은
[parity-inventory.md](./parity-inventory.md), 기존 사용자 데이터 보존은 [data.md](./data.md).

**관련 소스(read/write)**: `src/**` 전체 · `android/` · `ios/` · `capacitor.config.ts` · `package.json`

**관련 ADR**: [[ADR-127]](전환 결정 — 배경·대안·기각 근거) · [[ADR-001]](Capacitor 채택, 이 전환이 뒤집는 결정) ·
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

전환 릴리스에는 OTA 안전망이 없다([[ADR-127]] 트레이드오프). 그래서 단발 실행 코드를 최대한 만들지
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
| `lib/use-measured-height.ts` | — | `onLayout` |
| `lib/use-pull-to-refresh.ts` | — | `RefreshControl` |
| `android/…/BackGesturePlugin.java` | 154 | predictive back 내장 |
| `android/…/SystemBarsPlugin.java` | 174 | edge-to-edge 내장 |

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
| CSS `@keyframes` (8종) | `react-native-reanimated` | **높음** | 단풍잎 스피너·드랍 연출 — 아래 참고 |

### 애니메이션이 이 전환의 숨은 비용이다

`src/index.css` 에 `@keyframes` 가 8종 있다 — `toast-shrink` · `maple-trail` · `maple-sweep` ·
`fx-drop-float` · `valuable-drop-glow` · `valuable-drop-spin` · `valuable-drop-row-pulse` 외.
[[ADR-048]]·[[ADR-103]](드랍 연출) 과 단풍잎 스피너([[ADR-061]])가 여기 산다.

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
(`native/adapters/not-implemented.ts`) — 셋은 3단계 몫, `LiveUpdatePort` 는 [[ADR-127]] 결정 7 의 별도
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
- **여기서 «던지는 구현» 셋이 채워진다** — `ThemeAppearancePort`(테마를 React 상태로, **완료** ✅
  아래 «3-1단계 결과») · `SystemBarsPort`(safe-area-context) · `BackGesturePort`(네이티브 스택).
  남은 둘은 부르면 던지므로 그 자리가 있다는 사실이 첫 호출에서 드러난다
- **게이트**: [[ADR-120]] 동작(탭바 동반 이동·시차·3버튼 수렴)이 실기기에서 재현될 것

**스타일링은 NativeWind 다**(사용자 결정, 2026-08-11). `components/` 33파일에 `className` 이 163곳
있어 그대로 옮기는 편이 압도적으로 싸다. 대가는 임의 CSS·pseudo 셀렉터·`@keyframes` 를 못 쓰는 것인데,
`@keyframes` 8종은 어차피 Reanimated 재구현 대상이라 새로 잃는 것이 아니다.

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
`@keyframes` 8종에 걸려 있어 step 7 몫이고, 지금 그리는 것은 **그 애니메이션의 0프레임**이다.
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

### 4단계 — `app/` 화면 재작성

- 화면 15개 + 하위 컴포넌트. **파일별 ADR 계약 체크리스트를 소진**하며 진행(원칙 2)
- **게이트**: 각 화면의 테스트 통과 + 그 화면에 걸린 ADR 전부 확인 완료

### 5단계 — 실기기 검증 · 단계적 롤아웃

- Play Console staged rollout 1% → 확대, iOS Phased Release
- **게이트**: 아래 «되돌릴 수 없는 지점» 체크리스트 전항 통과

---

## 되돌릴 수 없는 지점

전환 릴리스는 **OTA로 고칠 수 없다.** 새 빌드에 `@capgo` 가 없고, `expo-updates` 로 밀려면 이미 RN이
깔려 있어야 한다. 스토어 롤백도 불가하다(새 버전을 올려 심사를 기다려야 한다).

릴리스 전 반드시 확인:

- [ ] **서명키가 동일한가** — 바뀌면 업데이트가 아니라 신규 설치가 되고 **사용자 데이터가 전부 사라진다**
- [ ] `appId` 가 `com.mapleroutine.app` 그대로인가
- [ ] `versionCode` 를 올렸는가 ([[ADR-024]] OTA 섀도잉 이력 참고)
- [ ] 구버전 설치본 → 신버전 **업데이트** 시나리오를 Android·iOS 실기기에서 통과했는가
      (MIUI는 `install -r` 만 허용 — `uninstall` 하면 검증 자체가 무의미해진다)
- [ ] 예약된 로컬 알림 재등록이 동작하고 **중복 알림이 없는가** ([data.md](./data.md) 결정 4)
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

- (아직 없음 — 이 문서는 [[ADR-127]] 과 함께 신설됐다)
