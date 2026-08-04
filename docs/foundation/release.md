# 스토어 릴리스 (Play · App Store)

> **범위**: 스토어에 나가는 **바이너리**를 만드는 절차 — 서명·버전·빌드 커맨드·산출물 검증, 그리고 콘솔에 채워 넣어야 하는 요건. 앱 안에서 도는 OTA 갱신은 [features/live-update.md](../features/live-update.md), 광고 관련 스토어 요건의 *배경*은 [features/ads.md](../features/ads.md).
> **관련 소스**: `android/app/build.gradle`(서명·`versionCode`) · `android/keystore.properties`(**커밋 금지**) · `android/.gitignore` · `ios/App/App.xcodeproj`(iOS 서명) · `package.json`(빌드 스크립트).
> **관련 ADR**: [[ADR-091]](Android 서명) [[ADR-090]](광고 — 스토어 요건이 늘어난 이유) [[ADR-024]](버전 형식). **관련 문서**: [../features/ads.md](../features/ads.md), [../features/live-update.md](../features/live-update.md), [../features/site.md](../features/site.md), [../trouble/2026-08-04-ios-appstore-signing.md](../trouble/2026-08-04-ios-appstore-signing.md).

## 빌드 커맨드는 하나뿐이다 — `npm run build`

스토어에 나가는 웹 번들은 **반드시 `npm run build`** 로 만든다.

| 명령 | 광고 | 채널 | 스토어행 |
|---|---|---|---|
| `npm run build` | **실 광고** | production | ✅ |
| `npm run build:test-ads` | 테스트 광고 | production | ❌ 수익 0 |
| `npm run build:beta` | 테스트 광고 | beta | ❌ |
| `npm run build:screenshot` | — | — | ❌ 캐릭터명이 익명화된다 |

**틀려도 화면에는 증상이 없다**([features/ads.md](../features/ads.md)) — 테스트 광고가 박힌
빌드도 멀쩡히 돌고 광고까지 뜬다. 수익만 0이다.

## Android

### 사전 1회 — 업로드 키스토어 만들기 ([[ADR-091]])

**저장소 밖**에 만든다. 여기서 정한 비밀번호 두 개와 별칭은 다시 볼 수 없으니 암호 관리자에
먼저 넣어둘 것.

```bash
mkdir -p ~/keys
keytool -genkeypair -v \
  -keystore ~/keys/maple-routine-upload.jks \
  -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

- `-validity 10000`(약 27년) — Play는 **2033-10-22 이후까지** 유효한 키를 요구한다.
- `-storetype PKCS12` — JKS는 레거시 포맷이라 `keytool` 이 변환 경고를 낸다.

**인증서 소유자 정보(DN)** 를 대화형으로 묻는다. **업로드 키의 DN은 사용자에게 어디에도 보이지
않는** 인증서 메타데이터라 값은 자유롭지만, 나중에 바꾸려면 키를 새로 만들어야 한다. 실제로
쓴 값은 이렇다.

```
CN=MapleRoutine, O=Maple Routine, L=Seoul, ST=Seoul, C=KR
```

- **한글을 넣지 않는다.** 이 저장소는 한글 번들 이름의 NFD 인코딩 때문에 App Store 서명 검증이
  깨진 전례가 있다([../trouble/2026-08-04-ios-appstore-signing.md](../trouble/2026-08-04-ios-appstore-signing.md)).
- 마지막 확인(`… 이(가) 맞습니까? [아니오]:`)에서 **`y` 를 입력**한다 — 기본값이 "아니오"라
  그냥 엔터를 치면 처음부터 다시 묻는다.

그 다음 `android/keystore.properties` 를 만든다(**gitignore 대상 · 절대경로**).

```properties
storeFile=/Users/<user>/keys/maple-routine-upload.jks
storePassword=<비밀번호>
keyAlias=upload
keyPassword=<같은 비밀번호>
```

⚠️ **`storePassword` 와 `keyPassword` 는 같은 값이다.** PKCS12는 키 비밀번호가 키스토어
비밀번호와 같아야 해서 `keytool` 이 키 비밀번호를 **따로 묻지 않는다**(JKS 시절의 "키 저장소
암호와 동일한 경우 RETURN" 프롬프트가 없다). 다른 값을 적으면 빌드가 서명 단계에서 실패한다.

> 업로드 키는 **분실보다 유출이 위험하다** — Play 앱 서명을 쓰므로 잃어버리면 Google에 재설정을
> 요청할 수 있다([[ADR-091]] 결정 1).

### 매 릴리스

```bash
# 1. versionCode 를 올린다 (android/app/build.gradle) — 소진된 번호는 재사용 불가
# 2. 웹 번들 → 네이티브 동기화
npm run build && npx cap sync android
# 3. AAB (APK 아님 — Play는 AAB만 받는다)
cd android && ./gradlew bundleRelease
# 4. 산출물: android/app/build/outputs/bundle/release/app-release.aab
```

**서명 확인** — 서명이 안 붙어도 빌드는 성공하므로([[ADR-091]] 결정 4) 산출물을 직접 본다.

```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

`소유자: CN=...` 이 나오면 서명된 것이고, 아무것도 안 나오면 `keystore.properties` 를 못 읽은
것이다. **실제 업로드 키로 끝까지 한 번 돌려 검증했다**(2026-08-04).

```
소유자: CN=MapleRoutine, O=Maple Routine, L=Seoul, ST=Seoul, C=KR
종료 날짜: Sat Dec 20 18:39:09 KST 2053     ← Play 요건(2033-10-22 이후) 충족
주체 공용 키 알고리즘: 2048비트 RSA 키       ← Play 요건(RSA 2048 이상) 충족
```

### 버전 규칙 ([[ADR-024]], [[ADR-091]] 결정 5)

| 값 | 현재 | 규칙 |
|---|---|---|
| `versionCode` | 19 | 업로드마다 +1. **되돌리지 않는다** — 내부 테스트에 한 번 올린 번호는 프로덕션에 다시 못 쓴다 |
| `versionName` | `1.0.0` | 3단 고정. OTA 매니페스트와 같은 축이라 2단(`1.0`)이면 OTA가 깨진다 |

내장 번들과 OTA 채널의 버전 관계는 [features/live-update.md](../features/live-update.md) 참조.

## Play Console 요건

바이너리와 별개로 콘솔에서 채워야 하는 것들. **코드로 해결되지 않는 항목이 대부분이다.**

| 항목 | 상태 | 메모 |
|---|---|---|
| 개발자 계정 | ⏳ 개인 계정 보유 | — |
| **비공개 테스트 12명 × 14일 연속** | ❌ | 2023-11 이후 **개인** 계정의 프로덕션 출시 전제조건. 조직 계정은 면제. **전체 일정을 지배하는 항목** |
| 개인정보 처리방침 URL | ✅ | `https://mapleroutine.store/privacy` — 게시 확인 완료(2026-08-04) |
| 개인정보 처리방침 **앱 내 링크** | ✅ | 설정 footer 맨 위(2026-08-04). Play 사용자 데이터 정책은 스토어 등록정보 **와 앱 안** 양쪽을 요구한다([features/settings.md](../features/settings.md)) |
| **앱 액세스 권한** | ❌ | 온보딩이 넥슨 API 키 하드 게이트라([features/onboarding.md](../features/onboarding.md)) **심사자용 테스트 키 + 캐릭터 있는 계정 + 입력 절차**를 적어주지 않으면 리뷰어가 앱을 실행조차 못 한다 |
| 데이터 안전 | ❌ | `AD_ID` 권한을 선언했으므로 **광고 ID 수집 신고 필수**. 넥슨 API 키의 취급 분류도 함께 |
| "광고 포함" 선언 | ❌ | [[ADR-090]] |
| 콘텐츠 등급 설문 · 타겟 연령 | ❌ | — |
| 배포 국가 | 한국 한정 | EU 사용자가 없어 GDPR 동의(UMP) 구현이 불필요하다는 전제([features/ads.md](../features/ads.md)). 국가를 넓히려면 그 흐름부터 |
| 계정 삭제 정책 | 해당 없음 | 계정 생성 기능이 없다([[ADR-003]]) |
| 스크린샷 | ✅ | `resources/screenshots/listing/play-store-1320x2640/` 6장 |
| **피처 그래픽 1024×500** | ❌ | 필수 항목인데 아직 없다 |
| 아이콘 512×512 | ⏳ | `ios/App/App/Assets.xcassets/` 에서 리사이즈 |

게시 **후**에 AdMob 콘솔에서 앱을 연결해 검토(2~3일)를 통과해야 광고가 정상 노출된다 —
미게시 앱은 *limited ad serving* 이다([features/ads.md](../features/ads.md)).

## iOS

Xcode 자동 서명을 쓰므로 키 관리가 없다. 대신 두 가지 함정을 이미 밟았고 둘 다 고쳐져 있다 —
`CODE_SIGN_IDENTITY` 의 레거시 문자열과 **한글 `PRODUCT_NAME`**(NFD 경로가 코드 서명을 깬다).
전말과 CLI 검증 절차는 [../trouble/2026-08-04-ios-appstore-signing.md](../trouble/2026-08-04-ios-appstore-signing.md).

`cap add ios` 를 다시 하면 `PRODUCT_NAME` 이 `capacitor.config.ts` 의 한글 `appName` 으로
되살아난다. **플랫폼을 재생성했다면 ASCII 로 다시 바꿀 것.**

## 폐기된 정책 (history)

(없음)
