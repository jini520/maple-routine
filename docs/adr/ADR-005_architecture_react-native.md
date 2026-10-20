# ADR-005 React Native 앱 하나로 만든다

> 🟢 유효
> 옛 번호: ADR-128 · ADR-154 · ADR-155
> 관련 소스: `package.json` · `app.json` · `index.ts` · `src/` · `modules/capacitor-storage/` · `src/storage/adapters/` · `ota/` · `tailwind-v4-axes.cjs`

## 배경

이 앱은 처음에 Capacitor 로 만들었다. 웹뷰 하나에 화면 전체를 그리고, 그 위에 네이티브 기능을 붙이는
방식이다. 이 방식은 두 가지에서 한계에 부딪혔다.

- **광고를 콘텐츠 사이에 넣을 수 없었다.** 보스 카드 목록 전체가 웹뷰 안의 DOM 이라, 카드 3번과 4번 사이에
  네이티브 광고 뷰를 끼울 방법이 없었다. 쓸 수 있는 것은 전면광고와 위아래 고정 배너뿐이었다.
- **화면 전환을 직접 만들어야 했다.** iOS 식 push 전환과 가장자리 스와이프를 웹 코드로 흉내 내느라 천 줄
  가까운 코드가 생겼고, 그 부분을 고칠 때마다 비슷한 문제가 다시 나왔다.

옮기기를 망설인 것은 OTA 를 못 쓰게 될까 걱정해서였는데, 실제로는 문제가 없었다. React Native 번들은
Hermes 가 해석해 실행하는 코드다. 그래서 앱 스토어와 Play 정책이 인터프리터 코드 다운로드에 허용하는 예외에
웹뷰와 똑같이 해당된다.

## 결정

### 결정 1. 앱은 React Native(Expo · Hermes · Metro) 하나로 만든다

Android 와 iOS 를 같은 코드로 낸다. 화면 전환은 react-navigation 의 네이티브 스택이 맡고, OTA 는
`expo-updates` 로 이어 간다([[ADR-011]]).

Flutter 도 검토했지만 고르지 않았다. OTA 는 유료 서드파티(Shorebird)에 기대야 하고, 인라인 광고는
PlatformView 를 거쳐 성능이 떨어지며, 화면에 나오기 전에 노출이 집계돼 AdMob 계정이 정지될 위험이 있었다.
무엇보다 기존 TypeScript 코드를 하나도 다시 쓸 수 없었다.

### 결정 2. 기존 사용자 데이터는 옮기지 않고, Capacitor 가 쓰던 저장소를 그대로 연다

기존 데이터는 Capacitor 안이 아니라 OS 가 앱마다 내주는 표준 저장소에 있다. 그 저장소는 번들 ID
(`com.mapleroutine.app`)에 묶여 있어서, 같은 번들 ID 로 만든 React Native 앱이 그대로 읽을 수 있다.

| 저장소 | 위치 | 여는 코드 |
|---|---|---|
| Preferences (Android) | `CapacitorStorage` 라는 이름의 SharedPreferences 파일. 키에 접두사가 없다 | `modules/capacitor-storage/` |
| Preferences (iOS) | `UserDefaults.standard`. 키 앞에 `CapacitorStorage.` 가 붙는다 | `modules/capacitor-storage/` · `storage/adapters/capacitor-storage-keys.ts` |
| SQLite | `boss_profitSQLite.db`. 암호화하지 않은 표준 SQLite 파일. Android 는 앱의 `databases/`, iOS 는 앱 컨테이너의 `Documents/` | `storage/adapters/capacitor-sqlite-open.ts` · `rn-sqlite.ts` |

데이터를 한 번 복사해 옮기는 방법은 고르지 않았다. 옮기는 코드는 첫 실행에서 한 번에 성공해야 하는데,
프레임워크를 바꾸는 릴리스는 OTA 로 고칠 수도 없다. 같은 저장소를 열면 실패해도 데이터가 안 보일 뿐
원본은 그대로 남는다. 경로와 키를 정하는 규칙은 `persistence/capacitor-storage.md` 에 있다.

이 방법은 번들 ID 와 Android 업로드 키가 같아야 성립한다. 서명 키가 바뀌면 OS 가 업데이트가 아니라 새
설치로 처리해서 앱 데이터 디렉터리가 새로 만들어진다([[ADR-008]]).

### 결정 3. 이름에 `capacitor` 가 붙은 저장소 코드는 지우지 않는다

`modules/capacitor-storage/` · `storage/adapters/capacitor-storage-keys.ts` · `capacitor-sqlite-open.ts` 의
`capacitor` 는 프레임워크가 아니라 기존 사용자 데이터가 있는 저장소의 이름이다. Capacitor 를 정리한다고
이 파일들을 지우면 기존 사용자의 데이터가 아무 오류 없이 읽히지 않게 된다.

### 결정 4. 저장소 루트가 곧 Expo 앱이고, 소스는 `src/` 한 곳에 있다

`app.json` · `index.ts` · `App.tsx` · `android/` · `ios/` 가 저장소 루트에 있고, 앱 코드는 전부 `src/` 아래에
있다. `package.json` 도 하나이고 workspaces 를 쓰지 않는다. 앱이 하나뿐이라 패키지를 나눌 이유가 없다.

import 경로에 alias 를 두지 않고 모두 상대 경로로 쓴다. 그래서 tsc · Metro · jest 가 같은 경로를 보고,
설정 사이에 경로 매핑이 어긋날 일이 없다.

타입 검사는 `npm run typecheck`(`tsc --noEmit`) 하나다. 루트 `tsconfig.json` 이 앱 전체를 검사하므로 따로
나눈 프로그램이 없다.

### 결정 5. Tailwind v4 기준 치수는 값을 고정해 둔다

NativeWind 는 Tailwind v3 만 받는다. 그런데 화면 코드는 웹 시절 Tailwind v4 의 간격 · 컨테이너 · 모서리
값을 기준으로 쓰여 있다. `tailwind-v4-axes.cjs` 가 그 세 축의 값(tailwindcss 4.3.3 의 `--spacing` 0.25rem,
`--container-*` 13개, `--radius-*` 8개)을 담고 있고, `tailwind.config.js` 가 그것으로 v3 설정을 만든다.

예전에는 웹 앱이 설치한 v4 의 `theme.css` 를 읽어 왔다. 웹 앱이 없어진 지금은 읽어 올 원본이 없으므로
값을 파일에 고정했다.

### 결정 6. Capacitor 앱 사용자는 `ota/latest.json` 의 플랫폼 목록으로 스토어에 보낸다

스토어 업데이트를 받지 않은 사용자는 아직 Capacitor 앱(번들 1.0.6)을 쓴다. 그 앱은 부팅할 때마다
GitHub Releases 의 `live-update-latest` 에 있는 `latest.json` 을 읽는다. 이 파일의 `storeRequiredPlatforms`
배열에 있는 플랫폼에서는 버전을 비교하기 전에 스토어 업데이트 모달을 먼저 띄운다. 그래서 버전을 올리지 않고 목록만
바꿔서 켜고 끌 수 있다.

지금 목록에는 `android` 만 있다. 바꿀 때는 `ota/latest.json` 을 고쳐 이 한 줄로 올린다.

```bash
gh release upload live-update-latest ota/latest.json --repo jini520/maple-routine --clobber
```

`ota/` 에는 세 가지만 남긴다.

| 파일 | 왜 남기나 |
|---|---|
| `ota/latest.json` | `url` · `checksum` · `size` 가 이미 올라간 `1.0.6.zip` 빌드에서만 나온 값이다. Capacitor 소스가 없어서 다시 만들 수 없다 |
| `ota/manifest-parser.ts` | 1.0.6 번들에 실린 매니페스트 파서를 그대로 복사한 것이다. 기기에서 도는 앱이 이 파일을 읽을 수 있는지 확인하려면, 지금 저장소의 코드가 아니라 1.0.6 에 멈춰 있는 그 코드로 검사해야 한다. 그래서 고치지 않는다 |
| `ota/__tests__/latest.spec.ts` | 위 둘로 `latest.json` 을 검사한다 |

### 결정 7. 런타임 import 사이클을 만들지 않는다. 값은 정의한 파일에서 바로 가져온다

사이클은 대개 재수출을 거쳐 자기 자신으로 돌아올 때 생긴다. 어떤 파일이 이웃 모듈의 값을 쓰는데, 그 이웃의
`index` 나 상위 모듈이 다시 처음 파일을 부르는 경우다. 값을 정의한 파일을 직접 가리키면 이런 고리가 생기지
않는다.

Metro 는 사이클을 찾으면 `Require cycle: …` 경고를 내고, 그 경고가 콜드 스타트마다 LogBox 배너로 뜬다. 지금은
값이 함수 본문에서만 쓰여 동작은 멀쩡해도, 누가 그 값을 모듈 최상위로 옮기는 순간 `undefined` 가 된다.
`import type` 은 컴파일 때 지워지므로 사이클로 치지 않는다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `src/storage/adapters/__tests__/capacitor-storage-keys.test.ts` | 결정 2: iOS 키에 `CapacitorStorage.` 가 붙고 떼어지는지, 붙였다 뗀 키 목록이 원래와 같은지, 시스템이 같이 쓰는 `UserDefaults` 의 남의 키(접두사와 비슷한 키 포함)가 섞이지 않는지, Android 는 키를 그대로 두는지 본다 |
| `src/storage/adapters/__tests__/capacitor-sqlite-open.test.ts` | 결정 2: 파일 이름이 `boss_profitSQLite.db` 인지, iOS 는 `Library/CapacitorDatabase` 가 아니라 `Documents` 인지, 암호화 키를 넘기지 않는지, `no-encryption` 이 아니면 던지는지 본다 |
| `src/storage/adapters/__tests__/rn-preferences.test.ts` | 결정 2: 어댑터의 네 연산이 모두 같은 접두사 규칙으로 저장소를 읽고 쓰는지, `keys()` 가 앱 키만 돌려주는지 본다 |
| `src/storage/adapters/__tests__/rn-sqlite.test.ts` | 결정 2: Capacitor 가 쓰던 파일 경로로 여는지 본다 |
| `src/__tests__/tailwind-axes.test.ts` 의 `v4 축 파생` | 결정 5: 간격 값 · `max-w-2xs`(288) · 모서리 계단이 v4 값 그대로인지 본다 |
| `src/__tests__/require-cycle-policy.test.ts` | 결정 7: Metro 가 번들하는 `src/` 그래프에 런타임 import 사이클이 없는지, 그래프를 실제로 읽었는지 본다 |
| `ota/__tests__/latest.spec.ts` | 결정 6: `latest.json` 이 동결한 파서를 통과하는지(문자열로 와도), 목록에 `android` 만 있는지, `highlights` 에 스토어 이야기가 없는지(iOS 도 같은 문구를 읽는다), `url` · `checksum` · `size` 형식이 맞는지 본다 |

## 열린 질문

- iOS 를 `storeRequiredPlatforms` 에 넣을지. App Store 에는 2026-08-21 부터 React Native 판이 게시돼 있지만
  목록에는 아직 `android` 만 있어서, 업데이트하지 않은 iOS 의 Capacitor 사용자는 스토어로 안내받지 못한다.

## 번호 기록

- ADR-005 (2026-10-19): 옛 ADR-128 · 154 · 155 를 합쳐 처음 작성. 옛 ADR-092(Vite 번들 분할)는 Metro 에서
  의미가 없어져 옮기지 않았다. 옛 ADR-155 결정 6(러너 둘)은 [[ADR-006]] 으로 대체됐다
