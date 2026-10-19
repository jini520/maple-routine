# ADR-004 기기 저장소와 네이티브 어댑터 경계

> 🟢 유효
> 옛 번호: ADR-003 · ADR-005 · ADR-267 · ADR-094 결정 7
> 관련 소스: `src/storage/` · `src/native/` · `src/boot.ts` · `index.ts` · `app.json` · `package.json`

## 배경

이 앱은 사용자의 기록을 기기에 저장한다. 보스 수익 · 드롭 · 가계부처럼 사용자가 앱에서만 남기는 값은
넥슨 API 로 다시 받을 수 없어서, 기기의 저장소가 곧 원본이다.

저장소와 네이티브 기능은 플랫폼 라이브러리에 묶여 있다. 화면과 기능 코드가 라이브러리를 직접 부르면
라이브러리를 바꿀 때 앱 전체를 고쳐야 한다. 실제로 Capacitor 에서 React Native 로 옮길 때 이 경계 덕분에
기능 코드를 거의 고치지 않고 어댑터만 바꿨다([[ADR-005]]).

## 결정

### 결정 1. `features/*` 는 저장소와 네이티브 라이브러리를 직접 부르지 않는다

로컬 저장소는 `storage/` 를, 알림 · 키보드 · 햅틱 · 스플래시 같은 네이티브 기능은 `native/` 를 거친다.
`features/` 의 상태와 로직이 플랫폼을 모르게 하려는 것이다. 라이브러리가 바뀌거나 플랫폼이 늘어도 어댑터
안만 고치면 된다. 화면(`app/`)과 공용 컴포넌트(`components/`)도 같은 함수를 쓴다.

외부 서비스도 같은 방식으로 감싼다. 넥슨 Open API 는 `nexon/` 이, 우리 서버는 `server/` 가 맡는다.

### 결정 2. 어댑터는 포트에만 의존하고, 포트 구현은 부팅할 때 주입한다

`storage/ports.ts` 와 `native/ports.ts` 가 인터페이스(포트)를 정하고, `storage/*` · `native/*` 의 함수는 그
인터페이스만 부른다. 플랫폼 라이브러리를 실제로 부르는 것은 `storage/adapters/` · `native/adapters/` 의
`rn-*` 구현뿐이다. 이렇게 하면 어댑터 함수가 라이브러리를 몰라서, 테스트에서는 포트 하나만 가짜로 바꿔
끼우면 된다.

포트 구현 열다섯 개(저장소 둘 · 네이티브 열셋)는 `installPorts()`(`boot.ts`)가 한 번에 주입한다. `index.ts` 가
이 함수를 `registerRootComponent` 보다 먼저 부른다. 하나라도 빠지면 그 기능만 실패하고 나머지는 정상으로
동작해서 늦게 발견된다. 그래서 모든 주입을 이 함수 하나에 모았다.

주입 전에 포트를 쓰면 조용히 넘어가지 않고 예외를 던진다. 아무것도 안 하는 기본값을 두면 데이터가 없는
것과 포트가 없는 것을 구분할 수 없고, 사용자에게는 데이터가 사라진 것으로 보인다.

### 결정 3. 단순한 값은 Preferences, 조회가 필요한 기록은 SQLite 에 둔다

설정 · 캐시 · 캐릭터 하나당 JSON 하나로 끝나는 값은 Key-Value 저장소(Preferences)에 둔다. 보스 수익 ·
드롭 · 가계부처럼 날짜 범위로 조회하고, 복합 키로 upsert 하고, 여러 표를 이어 읽어야 하는 기록은 SQLite
에 둔다. Preferences 로 이런 조회를 하려면 값을 통째로 읽어 메모리에서 걸러야 한다. 두 저장소의 키와
스키마는 `persistence/` 문서에 있고, SQLite 운영 규칙은 [[ADR-007]] 에 있다.

### 결정 4. 새 네이티브 기능은 쓰는 코드보다 먼저 스토어 바이너리에 싣는다

OTA 는 JS 번들과 에셋만 바꾼다. 네이티브 모듈이 바이너리에 없으면 그것을 부르는 JS 를 OTA 로 보낼 수
없다. 그래서 네이티브 기능은 쓰는 코드보다 먼저 스토어 릴리스에 싣고, 화면과 기능은 그 뒤에 OTA 로
낸다. 그러면 디자인을 여러 번 고쳐도 심사를 다시 받을 필요가 없다.

이 순서로 보스 수익 · 가계부를 이미지로 내보내는 기능(이슈 #388)에 필요한 모듈 넷이 1.0.8 바이너리부터
실려 있다. 기능 코드는 아직 없고, `src/` 에서 이 모듈들을 import 하는 곳도 없다.

| 패키지 | 하는 일 | 버전 |
|---|---|---|
| `react-native-view-shot` | 화면을 그림으로 | `5.1.0` |
| `expo-sharing` | 공유 시트 | `~57.0.19` |
| `expo-media-library` | 사진 앨범에 저장 | `~57.0.5` |
| `expo-file-system` | 파일 쓰기 | `57.0.2` 고정 |

`expo-file-system` 은 `expo` 가 원래 끌어오는 의존성이라 1.0.6 바이너리에 이미 57.0.2 로 들어 있었다. 직접
의존성으로 적으면서 버전을 그 값에 고정했다. 버전을 올리면 새 JS 가 OTA 로 먼저 나가서 옛 네이티브 모듈 위에서 실행된다.

### 결정 5. 사진 권한은 앨범 저장 하나만 연다

`app.json` 의 `expo-media-library` 플러그인 설정이 권한을 정한다.

- `savePhotosPermission` 에 저장 권한 문구를 적는다. 이 문구는 iOS `Info.plist` 에 들어가고 OTA 로는 못 바꿔서,
  기능보다 먼저 바이너리에 실었다.
- `photosPermission: false` 로 앨범 읽기 문구를 지운다. 비워 두면 문구가 안 생기는 것이 아니라 플러그인이
  영어 기본 문구를 넣어서, 쓰지도 않는 권한이 영어로 심사에 올라간다.
- `granularPermissions: []` 로 안드로이드의 `READ_MEDIA_IMAGES` · `READ_MEDIA_VIDEO` · `READ_MEDIA_AUDIO` 를 뺀다.
  저장만 할 때는 이 셋이 필요 없고, 넣어 두면 Play 에 사진 · 동영상 권한 선언을 해야 한다.

앨범을 읽어야 하는 기능이 생기면 권한 문구와 이 설정을 다시 바꿔 스토어 바이너리를 새로 내야 한다.

### 결정 6. `expo-sharing` 과 `expo-file-system` 은 플러그인 목록에 넣지 않는다

`expo-sharing` 의 플러그인은 공유 시트가 아니라 밖에서 이 앱으로 공유해 들어오는 iOS 공유 확장 타깃을
만든다. 우리는 반대 방향만 쓰고, 확장 타깃을 두면 번들 ID 와 App Group 을 더 등록해야 한다. 모듈 자체는
autolinking 으로 바이너리에 들어간다.

`expo-file-system` 의 플러그인이 더하는 안드로이드 저장소 권한에는 `maxSdkVersion` 이 없어서 지금
매니페스트보다 넓다. 그 패키지는 자기 매니페스트에서 이미 `maxSdkVersion="32"` 로 선언한다.

### 결정 7. 파일은 크기가 아니라 다루는 관심사가 둘 이상일 때 나눈다

한 파일이 서로 다른 일을 둘 이상 하면 나눈다. 줄 수는 신호일 뿐 기준이 아니다. 예를 들어
`lib/boss/boss-profit-period.ts` 와 `lib/theme/theme-derive.ts` 는 길어도 각각 기간 계산 하나, 토큰 파생 하나만
다루므로 나누지 않는다. 반대로 로스터 조회와 동기화 흐름이 섞여 있던 `features/schedule-sync/` 는
`character-roster.ts` · `schedule-sync.ts` 등으로, 보스 수익 스토어는 `features/boss-profit/` 의 `rows.ts` ·
`auto-record.ts` · `drops-loader.ts` 등으로 나눴다.

줄 수 상한을 목표로 삼지 않는 이유는, 그러면 함께 있어야 할 코드부터 옮기게 되기 때문이다. 나눌 때는 서로의
값을 참조하는 코드끼리 같은 파일에 둔다. 컴포넌트를 다른 파일로 옮기는 것만으로는 렌더 결과가 바뀌지 않는다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `src/__tests__/boot.test.ts` | 결정 2: `storage/ports` · `native/ports` 가 내보내는 `get*Port` 열다섯이 모두 배선표에 있는지, 주입 전에는 던지고 주입 후에는 정해진 `rn-*` 어댑터를 그대로 주는지, 두 번 주입해도 같은지 본다 |
| `src/native/__tests__/haptics.test.ts` · `browser.test.ts` | 결정 2: 포트가 주입되지 않았으면 던지는지, 포트가 거절해도 부른 쪽으로 예외가 새지 않는지 본다 |
| `src/storage/adapters/__tests__/rn-preferences.test.ts` · `rn-sqlite.test.ts` | 결정 2: 어댑터가 포트 계약대로 라이브러리를 부르는지 본다. 자세한 내용은 [[ADR-005]] · [[ADR-007]] |

결정 1 과 결정 7 을 검사하는 테스트는 없다. 결정 4 ~ 6 의 네이티브 설정도 테스트가 없어서, 바꿀 때는 빌드한
`AndroidManifest.xml` 과 `Info.plist` 를 직접 확인한다.

## 열린 질문

- `features/auth/nexon-login.ts` 가 `expo-web-browser` 의 `openAuthSessionAsync` 와 `react-native` 의 `Platform` 을
  직접 import 한다. 결정 1 을 어기고 있으므로 `native/` 어댑터로 옮길지 정해야 한다.

## 번호 기록

- ADR-004 (2026-10-19): 옛 ADR-003 · 005 · 267 을 합쳐 처음 작성. 옛 ADR-003 의 `백엔드 없이 기기만 쓴다` 와
  옛 ADR-005 의 사냥 타이머는 폐기된 결정이라 옮기지 않았다. 옛 ADR-094 결정 7 을 결정 7 로 옮겼다
