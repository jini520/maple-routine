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

다만 **DOM 스냅샷 3종은 이식이 불가능하다**(아래 «잃는 안전망» 참고). 그 자리를 무엇이 대신하는지를
정하지 않고 화면 재작성을 시작하면, 패리티를 검증할 도구 없이 패리티를 주장하게 된다.

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
| Tailwind (`index.css` 384줄) | NativeWind | 중 | 임의 CSS·pseudo 셀렉터·`@keyframes` 불가 |
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

### 0단계 — `packages/core` 추출 + RN 스캐폴딩

```
packages/
  core/            141 파일. DOM도 Capacitor도 모른다(포트 역전 후)
  app-capacitor/   현재 앱. 계속 OTA로 배포한다
  app-rn/          새 앱. 패리티까지 조용히
```

- `core` 는 `storage/`·`native/` 의 **인터페이스만** 갖고 구현은 각 앱이 주입한다
- **게이트**: `app-capacitor` 가 `core` 를 물고 기존 테스트 197개 전부 통과 + 실기기 동작 확인.
  즉 이 단계는 **동작 변화 0** 이어야 한다

> 이 단계가 전환을 **중단 가능한 프로젝트로 만든다.** 여기서 그만둬도 `core` 분리는 그 자체로 남는
> 이득이다(경계 강제·테스트 속도). RN을 안 가더라도 손해가 아니다.

### 1단계 — 어댑터 구현 교체

- `storage/*` 21파일 · `native/*` 11파일의 RN 구현. **시그니처 고정**(원칙 1)
- **게이트**: `core` 의 로직 테스트 119개가 RN 어댑터 위에서 전부 통과

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

### 2단계 — 데이터 보존 ([data.md](./data.md))

- Preferences·SQLite를 **옮기지 않고 그대로 읽는** 구현
- **게이트**: 실기기에서 **기존 Capacitor 앱을 설치한 뒤 RN 빌드로 업데이트**해, 보스 수익 기록·드랍
  기록·API 키·추적 캐릭터·테마가 전부 그대로 보일 것. Android·iOS 각각

### 3단계 — 내비게이션 + `components/` 34개

- react-navigation 골격 + 4계층 컴포넌트(atoms 9 · molecules 11 · organisms 10 · templates 4)
- **게이트**: [[ADR-120]] 동작(탭바 동반 이동·시차·3버튼 수렴)이 실기기에서 재현될 것

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
| **DOM 스냅샷 3종** | `BossProfitScreen`·`BossScreen`·`ContentScreen` 의 스냅샷은 DOM 트리라 RN에 이식 불가 | **대체 장치를 3단계 전에 정할 것** — RN 렌더 트리 스냅샷 또는 화면 스크린샷 회귀 |
| **브라우저 devtools** | RN엔 DOM이 없다 | Flipper / React DevTools |
| **`npm run dev` 즉시 반영** | 웹 타깃 소멸 | Fast Refresh (동등하나 다르다) |

DOM 스냅샷 3종이 가장 아프다. **이 저장소에서 "화면이 예전과 같은가"를 기계적으로 판정하던 유일한
장치**이고, 하필 이 전환이 그 질문을 가장 많이 하게 만든다.

---

## 폐기된 정책 (history)

- (아직 없음 — 이 문서는 [[ADR-127]] 과 함께 신설됐다)
