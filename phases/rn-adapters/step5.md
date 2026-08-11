# Step 5: rn-ads

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- **`/docs/features/ads.md`** (광고 정책)
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-090]]** 만 열어라
- `packages/core/src/native/ports.ts` (**`AdsPort` 계약**)
- **`packages/core/src/native/ads.ts`** — **이 파일의 순수 함수를 반드시 재사용한다. 정독하라**
- `packages/core/src/features/ads/policy.ts` · `tab-switch-ad.ts` (게이트 — 이미 순수 함수다)
- `packages/app-capacitor/src/native/adapters/capacitor-ads.ts` (**참조 구현**)

## 배경 — 이 프로젝트에서 가장 비싼 실수가 있는 영역이다

`native/ads.ts` 주석이 그것을 이렇게 적어 뒀다.

> **개발 빌드는 항상 테스트 ID를 쓴다** — 실 ID로 자기 광고를 누르면 무효 트래픽으로 AdMob 계정이
> 정지될 수 있고, 그건 되돌리기가 매우 어렵다.

그래서 광고 단위 ID 결정은 **`@core/native/ads` 의 순수 함수 두 개가 갖고 있다.**

```ts
shouldUseTestAds(env: { VITE_ADS_TEST?: string; VITE_LIVE_UPDATE_CHANNEL?: string }): boolean
resolveInterstitialAdId(platform: string, useTestAds: boolean): string | null
```

**이 판정을 RN 쪽에서 다시 쓰지 마라.** 방어선이 두 벌이 되면 한쪽만 틀려도 사고가 난다.

## 작업

### 1. `AdsPort` 구현

`packages/app-rn/src/native/adapters/rn-ads.ts`. 라이브러리는 `react-native-google-mobile-ads`.

```ts
export interface AdsPort {
  initialize(): Promise<void>
  prepareInterstitial(): Promise<boolean>   // 준비됐으면 true
  showInterstitial(): Promise<boolean>      // 실제로 떴으면 true
}
```

**반환값의 의미를 지켜라.** `showInterstitial()` 이 안 떴는데 `true` 를 주면 호출부가 노출 시각을
기록해 **30분간 광고가 통째로 죽는다**([[ADR-090]]).

### 2. 광고 단위 ID 는 core 에서 가져와라

```ts
import { resolveInterstitialAdId, shouldUseTestAds } from '@core/native/ads'
```

- `platform` 인자에는 RN 의 `Platform.OS`(`'android'` | `'ios'`)를 넣어라. 그 함수는 그 둘이 아니면
  `null` 을 돌려주고, `null` 은 어댑터 전체의 no-op 스위치다
- **ID 문자열(`ca-app-pub-…`)을 이 파일에 쓰지 마라.** 단 하나도.

### 3. `shouldUseTestAds` 의 env 를 RN 에서 어떻게 채울지 정하라

그 함수는 Vite 환경변수 이름(`VITE_ADS_TEST` · `VITE_LIVE_UPDATE_CHANNEL`)을 **인자 객체의 키**로
받는다 — 즉 함수 자체는 Vite 에 묶여 있지 않다.

RN 에서 그 값을 무엇으로 채울지 정하고 **근거를 summary 에 남겨라.** 반드시 지켜야 할 성질:

- **개발·내부 빌드에서는 반드시 테스트 ID 가 나와야 한다.** 판단이 애매하면 **테스트 ID 쪽으로
  기울여라** — 테스트 광고가 잘못 나가는 것은 손해가 없고, 실 광고가 잘못 나가는 것은 계정이 날아간다
- Capacitor 쪽 판정(`import.meta.env` 를 쓰지 않는 이유가 주석에 있다)을 먼저 읽어라. 같은 함정이
  RN 에도 있는지 확인할 것

### 4. AdMob 앱 ID 를 네이티브에 배치하라

광고 **단위** ID 와 별개로 **앱 ID**(`~` 가 들어가는 값)가 `AndroidManifest.xml` / `Info.plist` 에
있어야 한다. **없으면 SDK 가 부팅 시 크래시한다.**

`packages/app-capacitor` 의 값을 그대로 옮겨라 — AdMob 은 Android/iOS 를 별개 앱으로 등록하므로
**플랫폼별로 다른 값**이다. Expo 에서는 `app.json` 의 config plugin 설정으로 넣는다.

### 5. jest 로 테스트할 것

- `Platform.OS` 가 `'android'`/`'ios'` 일 때 core 함수가 부르는 인자가 맞는지
- 그 외 플랫폼에서 `null` → no-op 인지
- `showInterstitial()` 이 실패했을 때 **`false`** 를 돌려주는지 (던지지 않는지)
- env 채우기 로직이 **개발 조건에서 테스트 ID 를 고르는지**

## Acceptance Criteria

```bash
npm test           # vitest 3044 + jest 전부 통과
npm run build
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

**ID 하드코딩 검사 — 비어야 한다**:

```bash
grep -rn "ca-app-pub" packages/app-rn/src
```

앱 ID 배치 확인:

```bash
grep -rn "ca-app-pub.*~" packages/app-rn/android/app/src/main/AndroidManifest.xml packages/app-rn/app.json
```

**iOS**: best-effort. 막히면 `blocked` + 사유.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `packages/app-rn/src` 에 `ca-app-pub` 광고 **단위** ID 가 하드코딩돼 있는가? **있다면 잘못됐다**
   - `resolveInterstitialAdId`·`shouldUseTestAds` 를 core 에서 import 하는가?
   - 개발 조건에서 **테스트 ID** 가 선택되는가?
   - `showInterstitial()` 이 실패 시 `false` 를 돌려주는가?
   - `packages/core` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-adapters/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "env 채우는 방식과 근거·앱 ID 배치 위치·테스트 ID 판정 확인 결과"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **광고 단위 ID(`ca-app-pub-…/…`)를 `packages/app-rn` 어디에도 쓰지 마라.** 이유: 방어선이 두 벌이
  되면 한쪽만 틀려도 실 ID 로 자기 광고를 누르게 되고, AdMob 계정 정지는 되돌리기가 매우 어렵다.
- **`shouldUseTestAds` 를 RN 용으로 다시 구현하지 마라.** core 의 함수에 인자만 채워라. 이유: 같다.
- **판정이 애매할 때 실 ID 쪽으로 기울이지 마라.** 이유: 비대칭이다 — 테스트 광고가 잘못 나가면
  손해가 없고, 실 광고가 잘못 나가면 계정이 날아간다.
- **`showInterstitial()` 에서 예외를 던지지 마라.** 이유: 광고 실패가 탭 이동을 깨뜨리면 안 된다
  (`tab-switch-ad.ts` 가 그 전제로 짜여 있다).
- **`packages/core` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
