# ADR-005+308+334 React Native 앱 하나로 만들고, 웹과 한 저장소에 둔다

> ⚪ 미구현
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

웹이 앱의 로직을 함께 쓰게 되면서 이 결정은 결정 8 의 모노레포로 바뀐다. 결정 8 을 구현하면 이 결정을 지운다.

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
| `ota/manifest-parser.ts` | 1.0.6 번들에 실린 매니페스트 파서를 그대로 복사한 것이다. 기기에서 도는 앱이 이 파일을 읽을 수 있는지 확인하려면, 지금 저장소의 코드가 아니라 1.0.6 에 멈춰 있는 그 코드로 검사해야 한다. 그래서 코드는 고치지 않는다. 주석은 동작과 관계가 없어 이 저장소의 주석 규칙을 따른다 |
| `ota/__tests__/latest.spec.ts` | 위 둘로 `latest.json` 을 검사한다 |

### 결정 7. 런타임 import 사이클을 만들지 않는다. 값은 정의한 파일에서 바로 가져온다

사이클은 대개 재수출을 거쳐 자기 자신으로 돌아올 때 생긴다. 어떤 파일이 이웃 모듈의 값을 쓰는데, 그 이웃의
`index` 나 상위 모듈이 다시 처음 파일을 부르는 경우다. 값을 정의한 파일을 직접 가리키면 이런 고리가 생기지
않는다.

Metro 는 사이클을 찾으면 `Require cycle: …` 경고를 내고, 그 경고가 콜드 스타트마다 LogBox 배너로 뜬다. 지금은
값이 함수 본문에서만 쓰여 동작은 멀쩡해도, 누가 그 값을 모듈 최상위로 옮기는 순간 `undefined` 가 된다.
`import type` 은 컴파일 때 지워지므로 사이클로 치지 않는다.

### 결정 8. 저장소를 모노레포로 바꾸고 앱을 `apps/mobile` 로 옮긴다 (사용자 선택 2026-11-24 · 2026-11-27)

웹을 Next.js 로 따로 만들고 로직은 앱과 함께 쓰기로 했다([[ADR-307]] 결정 1). 로직을 두 앱이 함께 쓰려면 패키지로 빼야 해서, 결정 4 의
`앱이 하나뿐이라 패키지를 나눌 이유가 없다` 가 더는 맞지 않는다.

모노레포는 git 저장소 하나 안에서 폴더마다 `package.json` 을 따로 두는 구조다. 브랜치 · PR · 이슈는 지금처럼 하나다. 앱과 웹이 로직을
한 트리에서 함께 고쳐야 같은 로직을 쓴다. 웹이 다른 저장소에 있으면 core 를 패키지로 내고 버전을 올려야 해서, 두 앱이 다른 버전의
로직을 쓰는 때가 생긴다. 동기화는 앱과 웹이 같은 표와 트리거를 써야 맞물리므로 그 어긋남이 특히 위험하다.

```
apps/mobile/      지금 RN 앱. app.json · index.ts · ios/ · android/ · modules/ · 화면 · 저장소와 네이티브 어댑터
apps/web/         Next.js 웹
packages/core/    features · lib · storage · nexon · server · native 의 포트와 그 앞 함수, 이들이 쓰는 타입 · 상수
packages/tokens/  글자 역할표. 색은 앱(직업 테마)과 웹(라이트 · 다크)이 따로다
```

**서버 저장소(`maple-routine-server`)는 합치지 않는다**(사용자 선택 2026-11-27). 서버 main 은 운영 박스에 배포된 코드를, 앱 main 은 스토어
바이너리를 따라가서 브랜치 흐름이 다르다(서버에는 patch 가 없다, [[ADR-188]] 결정 9). 한 저장소에 넣으면 서버 핫픽스에도 앱 브랜치 규칙이
얽히고, 운영 박스가 앱 전체를 받아 빌드해야 한다. 합쳐서 얻는 것은 동기화 요청과 응답의 타입을 함께 쓰는 것뿐이다.

**패키지 관리자는 pnpm 이고, `node-linker=hoisted` 로 쓴다**(사용자 선택 2026-11-27). pnpm 은 패키지를 맥에 한 벌만 두고 워크트리마다
하드링크로 잇는다. npm 은 워크트리마다 `node_modules` 를 통째로 복사해서, 워크트리를 여럿 두는 이 저장소에서 디스크를 많이 쓴다.
`hoisted` 는 `node_modules` 를 npm 과 같은 모양으로 만든다. RN 자동 연결 · Metro · `ios/Podfile.lock` 이 npm 때와 같은 경로를 보게 하려는
것이다. `package-lock.json` 은 `pnpm-lock.yaml` 로 바뀌고, `CLAUDE.md` 와 문서의 `npm` 명령은 `pnpm` 으로 바뀐다. Turborepo 같은 작업
실행기는 두지 않는다. core 는 빌드하지 않고 TS 원본을 그대로 가져다 쓰므로 순서를 맞출 빌드 단계가 없다.

패키지와 도구는 이렇게 둔다.

- 앱과 웹은 core 를 패키지 이름(`@maple-routine/core/...`)으로 가져온다. pnpm 이 그 이름을 `packages/core` 폴더로 잇는다. 결정 4 의
  `alias 를 두지 않는다` 는 그대로다. 패키지 이름은 tsc · Metro · jest 가 모두 `node_modules` 에서 같은 방법으로 찾으므로 도구마다
  매핑을 적을 일이 없다. 한 패키지 안에서는 지금처럼 상대 경로로 쓴다.
- React 는 두 앱이 같은 버전 하나를 쓴다. 버전이 둘이면 core 의 훅이 앱마다 다른 React 를 불러 깨진다.
- `packages/core` 에는 플랫폼 라이브러리를 들이지 않는다. 웹 번들에 RN 이 딸려 오면 웹에서 돌지 않기 때문이다. 2026-11-27 에 core 로 갈
  파일 가운데 RN · Expo 를 직접 가져오는 것은 8개다. `features` 5개(`AppState` · `Platform`) · `server/friends-stream.ts`(`expo/fetch`) ·
  `native/browser.ts`(`Linking`) · `constants/style/text-styles.ts`(`TextStyle` 타입)다. 포트로 바꾸거나 타입을 core 의 것으로 바꾼다.
  `lib` 의 화면 치수 계산 8개는 화면이 쓰는 계산이라 `apps/mobile` 에 둔다.
- `native/` 는 둘로 나뉜다. `native/ports.ts` 와 그 앞 함수(`native/notifications.ts` 등, `features` 가 부르는 것)는 core 로, RN 구현인
  `native/adapters/` 는 `apps/mobile` 로 간다. 저장소도 같다. `storage/` 는 core 로, `storage/adapters/` 는 `apps/mobile` 로 간다.
- 화면 쪽 코드를 가져오는 로직 파일 8개는 그 타입과 표를 core 로 옮긴다. `features/bar-order` 둘과 `storage/bar-order.ts` 가
  `navigation/bar-groups` 를, `features/boss-profit` 둘 · `features/inventory` · `features/input-card` 가 `components/organisms/InputCard`
  의 타입을, `features/text-size/store.ts` 가 `theme/text-scale` 을 가져온다. `lib/fab-metrics.ts` 도 화면 훅을 가져오지만 화면 치수
  계산이라 위 8개와 함께 `apps/mobile` 에 둔다.
- 루트에는 `docs/` · `CLAUDE.md` · `README.md` · `site/` · `ota/` · `workers/` 와 저장소 전체를 보는 스크립트(`adr-number.mjs` ·
  `build-site.mjs`)를 둔다. 앱을 발행하고 그리는 스크립트(`publish-rn-ota.mjs` · `ota-runtime-version.mjs` · 그림 만드는 스크립트)는
  `apps/mobile` 로 간다. 저장소 규칙을 보는 `adr-policy.test.ts` 는 루트로 옮기고, `src/` 밖을 고르는 조건을 `apps/` · `packages/` 로 넓힌다.
- jest 는 루트 설정 하나에 패키지마다 project 를 둔다. 타입 검사도 패키지마다 `tsconfig.json` 을 두고 루트에서 한 번에 돌린다.

옮기는 때와 순서는 이렇다.

- 옮기는 일은 1.0.15 작업을 develop 에서 마치고 `release/1.0.15` 를 딴 직후 develop 에서 한다(#1208). 그 전에 옮기면 1.0.15 를 만드는
  브랜치마다 모든 파일 경로가 부딪힌다. 심사 중에 `patch/1.0.15` 에 들어온 고침은 옮기기 전 경로에 있다. develop 으로 머지할 때 git 이
  이름이 바뀐 파일을 찾아 맞춘다.
- 옮긴 트리는 1.0.16 스토어 바이너리로 낸다. `ios/Podfile.lock` 의 `../node_modules/...` 상대 경로 255곳이 바뀌어 iOS 지문이 바뀌고, 지문이
  다른 트리에서는 지금 스토어 바이너리에 OTA 를 낼 수 없기 때문이다([[ADR-011]]). 옮길 때 앞뒤 지문을 잰다.
- PR 은 넷으로 나눈다. 한 PR 에 이동과 로직 변경을 섞으면 리뷰에서 무엇이 바뀌었는지 가려낼 수 없다.
  1. 동작은 그대로 두고 앱을 `apps/mobile` 로 옮기고 pnpm 으로 바꾼다. 앞뒤 지문을 재고, 맥에서 iOS · Android 개발 빌드를 돌리고, 전체
     테스트를 돌린다. 문서의 경로와 명령도 함께 고친다.
  2. `packages/core` 를 뺀다. 위의 플랫폼 라이브러리 8개와 화면 코드 8개를 고치고, core 가 플랫폼 라이브러리를 가져오지 않는지 보는 테스트를 더한다.
  3. `packages/tokens` 를 뺀다.
  4. `apps/web` 시험 빌드. core 를 Next.js 에서 불러 첫 로딩 크기와 브라우저 SQLite 를 잰다(#1206).
- 1번 PR 을 머지하면 열려 있는 워크트리는 develop 을 받은 뒤 `node_modules` 를 지우고 `pnpm install` 을 다시 한다. 맥의 DEV 빌드
  워크트리(`device-1015`)도 같다.

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

결정 8 의 테스트는 옮길 때 적는다. `packages/core` 가 RN · Expo 와 플랫폼 라이브러리를 가져오지 않는지, `adr-policy.test.ts` 가 `apps/` · `packages/` 의 소스도 보는지 본다.

## 열린 질문

- iOS 를 `storeRequiredPlatforms` 에 넣을지. App Store 에는 2026-08-21 부터 React Native 판이 게시돼 있지만
  목록에는 아직 `android` 만 있어서, 업데이트하지 않은 iOS 의 Capacitor 사용자는 스토어로 안내받지 못한다.

## 번호 기록

- ADR-005 (2026-10-19): 옛 ADR-128 · 154 · 155 를 합쳐 처음 작성. 옛 ADR-092(Vite 번들 분할)는 Metro 에서
  의미가 없어져 옮기지 않았다. 옛 ADR-155 결정 6(러너 둘)은 [[ADR-006]] 으로 대체됐다
- ADR-308 (2026-11-24): 결정 8 을 더했다. 웹을 Next.js 로 따로 만들고 로직을 앱과 함께 쓰기로 해서, 결정 4 의 저장소 구조를 모노레포로
  바꾼다(#1206 · #1208)
- ADR-334 (2026-11-27): 결정 8 에 서버 저장소를 합치지 않는 것, pnpm(`node-linker=hoisted`), 패키지 경계, 옮기는 때와 PR 순서를 더했다(#1208)
