# 스토어 릴리스 (Play · App Store)

> **범위**: 스토어에 나가는 **바이너리**를 만드는 절차 — 서명·버전·빌드 커맨드·산출물 검증, 그리고 콘솔에 채워 넣어야 하는 요건. 앱 안에서 도는 OTA 갱신은 [features/live-update.md](../features/live-update.md), 광고 관련 스토어 요건의 *배경*은 [features/ads.md](../features/ads.md).
> **관련 소스**(전부 `packages/app-capacitor/` 아래 — [[ADR-128]] 0단계): `android/app/build.gradle`(서명·`versionCode`) · `android/keystore.properties`(**커밋 금지**) · `android/.gitignore` · `ios/App/App.xcodeproj`(iOS 서명) · `package.json`(**버전 원천** — OTA 매니페스트와 설정 화면 표시가 같은 파일을 읽는다). 빌드 스크립트 진입점은 저장소 루트 `package.json`(위임).
> **관련 ADR**: [[ADR-091]](Android 서명) [[ADR-090]](광고 — 스토어 요건이 늘어난 이유) [[ADR-024]](버전 형식) [[ADR-119]](릴리스 노트) [[ADR-126]](핵심 목록·모달). **관련 문서**: [../features/ads.md](../features/ads.md), [../features/live-update.md](../features/live-update.md), [../features/site.md](../features/site.md), [../trouble/2026-08-04-ios-appstore-signing.md](../trouble/2026-08-04-ios-appstore-signing.md).

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

## 릴리스는 노트를 쓰는 것으로 시작한다 ([[ADR-119]])

**버전을 올리기 전이 아니라, 올리면서 `packages/core/src/data/release-notes.ts` 에 그 버전의 항목을
먼저 쓴다.** OTA 배포든 스토어 바이너리든 순서는 같다.

```
1. packages/app-capacitor/package.json version 을 올린다  (x.y.z — 2단이면 OTA가 깨진다, [[ADR-024]])
     ↑ 저장소 루트 package.json 이 아니다. 루트는 워크스페이스 오케스트레이션용이라 version 이 없다
2. packages/core/src/data/release-notes.ts 에 그 버전 항목을 쓴다   ← 이 단계를 건너뛰면 3에서 막힌다
     · items      — 변경 전부. 개발 노트 화면이 읽는다
     · highlights — 핵심 3~4줄. **업데이트 모달**이 받기 전에 읽는다([[ADR-126]] 결정 2·3)
     · 네이티브 변경 항목에는 「스토어 업데이트 필요」 표식(항목 단위)
3. npm run build / node scripts/publish-live-update.mjs
```

> ⚠️ **지금 `packages/app-capacitor/package.json` 은 `1.0.6` 이고 아직 발행 전이다**(발행하면 다음은
> `1.0.7`). 그리고 그 `1.0.6` 은 **평소와 성격이 다르다** — [[ADR-128]] 의 RN 전환분이 스토어에 올라가는
> 릴리스라, capacitor 쪽 `1.0.6` 은 «적용될 번들»이 아니라 `--min-native 1.0.6` 으로 **사용자를 스토어로
> 보내는** 매니페스트다([[ADR-027]] 결정 7). 그래서 **두 스토어 모두 1.0.6 이 라이브 된 뒤에** 쏜다 —
> 먼저 쏘면 스토어에 받을 것이 없어 모달만 반복된다. 되돌리려면 `1.0.7` 로 번호를 하나 더 태워
> `--min-native` 없는 정상 번들을 다시 쏘는 수밖에 없다.
> 노트를 안 쓴 채 스크립트를 돌리면 가드에 걸려 중단되는 것이 정상이고
> ([[ADR-119]] 결정 6 + [[ADR-126]] 결정 8), 위 1·2 를 먼저 하면 풀린다. **`highlights` 를 빠뜨리는
> 것도 같은 중단**이다 — 문구가 어느 쪽이 비었는지 말해 준다.

> [!NOTE]
> **이 문서는 `app-capacitor` 기준이다.** RN 앱(`packages/app-rn`)의 OTA 는 프로토콜도 스크립트도 다르다
> (`scripts/publish-rn-ota.mjs` · [[ADR-137]]). **RN 스토어 릴리스 절차는 아직 이 문서에 없다** — 1.0.6
> 을 내보내며 확인된 것부터 여기 채울 것.

- **노트나 핵심 목록이 없으면 `publish-live-update.mjs` 가 중단한다**(`process.exit(1)`, 문구가 어느
  쪽이 비었는지 말한다). 앱 `package.json` version 형식 검사와 **같은 자리**에서, `npm run build` 보다
  **앞에서** 죽으므로 몇 분짜리 빌드를 버리지 않는다.
- **`highlights` 를 `items` 에서 베끼지 말 것**([[ADR-126]] 결정 3). *"무엇이 바뀌었나"* 가 아니라
  *"받으면 무엇이 생기나"* 를 쓰고, 자잘한 것은 `일부 버그 및 사용성 개선` 처럼 한 줄로 뭉친다.
- **스크립트가 `.ts` 를 읽는 방법은 Node 내장 타입 스트리핑이다** — `.mjs` 가
  `packages/core/src/data/release-notes.ts` 를 **그대로 `import`** 한다(Node 22.18+/23.6+ 부터 플래그 없이 켜져 있고
  이 저장소는 24.x 에서 확인했다). **이 자리를 만질 때 `tsx`·`ts-node` 를 들이지 말 것** — 배포
  스크립트는 릴리스 경로의 일부라 의존성이 늘수록 릴리스가 깨질 표면이 넓어진다. 정규식으로 파일을
  긁는 것도 안 된다(원천 형식이 바뀌는 순간 조용히 틀린 값을 낸다). `release-notes.ts` 는 순수
  데이터라 타입 선언 말고는 스트리핑할 것도 없다.
- **경고가 아니라 중단인 이유**: 노트가 빠진 채 배포되면 그 버전은 **영영 빈 채로 남는다** —
  [[ADR-119]] 결정 4 가 사후 재구성을 금지했으므로(릴리스 노트는 사실 기록이다) 나중에 채울 방법이
  없다. 사후 복구가 불가능한 실수는 사전에 막는다.
- 같은 파일이 두 곳으로 나간다 — 앱 내장 **개발 노트 화면**(`/settings/release-notes`, 과거 전체)과
  배포 스크립트가 파생시키는 **`latest.json` 의 `highlights`**(업데이트 모달, 그 버전의 핵심 3~4줄).
  상세는 [../features/live-update.md](../features/live-update.md)·[../features/settings.md](../features/settings.md).
- 스토어 등록정보의 **출시 노트**(아래 "스토어 등록정보 문구")는 **별개 칸**이다 — 콘솔에 직접 쓰고
  이 파일에서 파생되지 않는다. 같은 릴리스라도 담는 말이 다를 수 있다(스토어는 그 버전 한정 소개,
  개발 노트는 누적 기록).

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

그 다음 `packages/app-capacitor/android/keystore.properties` 를 만든다(**gitignore 대상 · 절대경로**).

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

**릴리스 노트가 선행한다**(위 "릴리스는 노트를 쓰는 것으로 시작한다") — 아래는 그 뒤의 빌드 절차다.

**네이티브 프로젝트는 `packages/app-capacitor/` 안에 있다**([[ADR-128]] 0단계) — `npx cap` 은 반드시
그 디렉터리에서 돈다(`capacitor.config.ts` 와 `android/`·`ios/` 가 거기 있다). `npm run build` 만
저장소 루트에서 위임으로 돈다.

```bash
# 1. versionCode 를 올린다 (packages/app-capacitor/android/app/build.gradle) — 소진된 번호는 재사용 불가
# 2. 웹 번들 → 네이티브 동기화
npm run build && (cd packages/app-capacitor && npx cap sync android)
# 3. AAB (APK 아님 — Play는 AAB만 받는다)
cd packages/app-capacitor/android && ./gradlew bundleRelease
# 4. 산출물: packages/app-capacitor/android/app/build/outputs/bundle/release/app-release.aab
```

**서명 확인** — 서명이 안 붙어도 빌드는 성공하므로([[ADR-091]] 결정 4) 산출물을 직접 본다.

```bash
keytool -printcert -jarfile packages/app-capacitor/android/app/build/outputs/bundle/release/app-release.aab
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
| 데이터 안전 | ❌ | `AD_ID` 권한을 선언했으므로 **광고 ID 수집 신고 필수**. 넥슨 API 키의 취급 분류도 함께. **알림을 넣는 릴리스부터 한 항목 더** — FCM 등록 토큰은 앱이 서버로 안 보내도(토픽 방식, [[ADR-146]] 결정 2) **Firebase 가 갖는 기기 식별자**라 신고 대상이다 |
| **개인정보 처리방침 갱신 (푸시)** | ❌ | [[ADR-146]] 을 구현하는 릴리스 전에 `PRIVACY.md`(→ `mapleroutine.store/privacy`)에 푸시 알림·Firebase 데이터 처리를 추가해야 한다. **바이너리가 아니라 문서 쪽 준비물이라 잊기 쉽다** |
| "광고 포함" 선언 | ❌ | [[ADR-090]] |
| 콘텐츠 등급 설문 · 타겟 연령 | ❌ | — |
| 배포 국가 | 한국 한정 | EU 사용자가 없어 GDPR 동의(UMP) 구현이 불필요하다는 전제([features/ads.md](../features/ads.md)). 국가를 넓히려면 그 흐름부터 |
| 계정 삭제 정책 | 해당 없음 | 계정 생성 기능이 없다([[ADR-003]]) |
| 스크린샷 | ✅ | `resources/screenshots/listing/play-store-1320x2640/` 6장 |
| 피처 그래픽 1024×500 | ✅ | `resources/play-feature-graphic-1024x500.png`(2026-08-04). **알파 채널을 뺀 24-bit PNG** — Play는 알파를 받지 않는다. 16:9로 크롭돼도(좌우 68px씩) 카피·로고가 모두 살아남는 것을 확인했다 |
| 아이콘 512×512 | ✅ | `resources/play-store-icon-512.png`(2026-08-04). iOS 마케팅 아이콘 1024를 **정확히 2:1로 축소**해 만든다 — Android 런처 아이콘(adaptive)은 전경에 16.7% inset이 들어가 스토어 아이콘으로 쓰면 안 된다. **모서리를 미리 둥글리지 않는다**(Play가 마스크를 씌운다) |

게시 **후**에 AdMob 콘솔에서 앱을 연결해 검토(2~3일)를 통과해야 광고가 정상 노출된다 —
미게시 앱은 *limited ad serving* 이다([features/ads.md](../features/ads.md)).

## 스토어 등록정보 문구

**세 칸이 서로 다른 항목이다** — 짧은 설명·자세한 설명은 **상시 노출**이고, 출시 노트는 **그
버전 한정**이다. 아래는 2026-08-04 작성한 첫 출시(1.0.0) 기준 원문이다.

**공통 정책** — 가격("무료")·순위("1위")·설치 유도("지금 다운로드") 문구를 넣지 않는다. 다른
앱이나 플랫폼도 언급하지 않는다. HTML 태그가 먹지 않아 불릿은 문자(`■` `▶` `•`)로 쓴다.

### 짧은 설명 (80자 제한)

```
메이플스토리 일간·주간 숙제와 보스 수익, 물욕템 드랍을 캐릭터별로 관리
```

40자. **여유를 일부러 남긴다** — 검색 결과에서 앱 이름 아래 한 줄로 붙는 자리라, 키워드를
채우면 읽히지 않고 스팸으로 보인다.

**앱 안에서는 "컨텐츠"라 부르지만 여기서만 "숙제"를 쓴다.** 스토어에서 찾는 사람은 "메이플
숙제"로 검색하고, 이 앱 유입의 대부분이 검색이다. 이 자리만 플레이어의 말을 쓴다.

미채택 후보 — `메이플스토리 숙제·보스 수익·물욕템 기록·사냥 타이머를 캐릭터별로 관리`(39자,
기능 하나 더) · `본캐도 부캐도 한 번에. 메이플스토리 숙제와 보스 수익, 물욕템 드랍 관리`(41자,
다캐릭터를 앞세움).

### 자세한 설명 (4000자 제한)

```
메이플 루틴은 메이플스토리 플레이어를 위한 루틴 관리 앱입니다. 본캐와 부캐에 걸친 일간·주간 콘텐츠 진행, 주간 보스 수익, 물욕 아이템 드랍 기록을 한 곳에서 확인합니다.


■ 이용 전 준비 사항

이 앱은 넥슨 오픈 API로 게임 데이터를 불러옵니다. 사용하시려면 두 가지가 필요합니다.

1. openapi.nexon.com에서 발급받은 본인의 개인 API 키
2. 게임 클라이언트의 스케줄러에 추적할 퀘스트·보스를 등록

키 발급 방법은 앱 첫 화면에서 안내합니다. 게임 스케줄러에 등록하지 않은 항목은 API로 조회할 수 없어 앱에도 표시되지 않습니다.


■ 주요 기능

▶ 컨텐츠 스케줄러
게임 내 스케줄러에 등록한 일간·주간 콘텐츠의 진행 상태를 캐릭터별로 한눈에 봅니다. 자동 모드는 게임에 등록한 항목을 그대로 따라가고, 수동 모드는 직접 고른 항목만 추적합니다.

▶ 보스 스케줄러
주간 보스 처치 현황을 캐릭터별로 정리합니다. 파티 인원과 난이도를 설정해 두면 수익 계산에 반영됩니다.

▶ 보스 수익
결정석 가격을 기준으로 캐릭터별·기간별 수익을 집계합니다. 지난 주차로 이동해 과거 기록도 확인할 수 있습니다.

▶ 물욕 아이템 드랍
칠흑·광휘 세트를 비롯한 물욕 아이템 획득을 기록합니다. 전 기간 히스토리에서 언제 무엇을 먹었는지 모아 봅니다.

▶ 사냥 타이머
30분 카운트다운과 함께 지정한 주기마다 알림음을 반복 재생합니다. 솔 야누스 재설치처럼 놓치기 쉬운 타이밍에 씁니다. 앱을 내려도 알림창에 경과 시간이 계속 표시됩니다.

▶ 테마
머쉬맘·혼테일·레테·렌·엔젤릭버스터·검은마법사 6종 중에서 고를 수 있습니다.


■ 기록은 기기에만 저장됩니다

회원가입을 받지 않습니다. 발급받은 API 키와 앱에서 만든 기록은 모두 사용하시는 기기 안에만 저장되며 운영자에게 전송되지 않습니다. 앱을 삭제하면 기록도 함께 지워지고, 기기를 바꾸면 옮겨지지 않습니다.

개인정보 처리방침: https://mapleroutine.store/privacy
문의: https://mapleroutine.store/support


■ 안내

Maple Routine is not associated with NEXON Korea
Data based on NEXON Open API

이 앱은 넥슨이 만들거나 운영하는 앱이 아니며 넥슨과 제휴 관계가 없습니다. 게임 데이터는 넥슨이 공개한 오픈 API를 통해 조회합니다.
```

1200자. 제한의 3분의 1도 안 쓴다 — 설명은 길이가 순위를 올려주지 않고, 첫 3줄 뒤는 "더보기"에
접힌다.

- **준비 사항이 기능 목록보다 앞이다.** API 키가 필요한 줄 모르고 설치한 사람이 남기는 별점
  1점이 초기 앱에 가장 아프다. "게임 스케줄러에 등록 안 한 항목은 안 보인다"도 같은 이유다 —
  이것이 문의로 가장 많이 올 내용이다.
- **비제휴 고지는 앱 설정 footer·안내 사이트·`PRIVACY.md` 와 같은 영문 문구를 쓴다**
  ([features/settings.md](../features/settings.md)). 한 곳만 고치면 네 곳이 달라진다.

### 출시 노트 (500자 제한, 언어별)

```
메이플 루틴 첫 출시입니다.

메이플스토리의 일간·주간 콘텐츠, 주간 보스 수익, 물욕 아이템 드랍을 캐릭터별로 관리합니다.

• 컨텐츠 스케줄러 — 게임 스케줄러에 등록한 일간·주간 콘텐츠 진행 상태를 캐릭터별로 확인
• 보스 스케줄러 — 주간 보스 처치 현황과 파티 구성 관리
• 보스 수익 — 캐릭터별·기간별 결정석 수익 집계
• 물욕 아이템 드랍 — 획득 기록과 전 기간 히스토리
• 사냥 타이머 — 주기적 스킬 재사용 알림

이용하려면 게임 내 스케줄러 등록과 openapi.nexon.com에서 발급받은 개인 API 키가 필요합니다. 기록은 회원가입 없이 기기에만 저장됩니다.
```

328자. 한국어만 배포하므로 언어는 하나면 된다. 내부 테스트 트랙에도 같은 내용을 쓴다.

**첫 출시라 변경점이 아니라 소개 형식이다. 다음 릴리스부터는 바뀐 것만 적는다** — 매번 이
소개를 반복하면 사용자가 무엇이 새로운지 알 수 없다.

## iOS

Xcode 자동 서명을 쓰므로 키 관리가 없다. 대신 두 가지 함정을 이미 밟았고 둘 다 고쳐져 있다 —
`CODE_SIGN_IDENTITY` 의 레거시 문자열과 **한글 `PRODUCT_NAME`**(NFD 경로가 코드 서명을 깬다).
전말과 CLI 검증 절차는 [../trouble/2026-08-04-ios-appstore-signing.md](../trouble/2026-08-04-ios-appstore-signing.md).

`cap add ios` 를 다시 하면 `PRODUCT_NAME` 이 `capacitor.config.ts` 의 한글 `appName` 으로
되살아난다. **플랫폼을 재생성했다면 ASCII 로 다시 바꿀 것.**

### RN 앱(`packages/app-rn`)의 아카이브 (2026-08-19, v1.0.6 build 13 으로 확인)

Xcode GUI 가 아니라 **CLI 로 돈다.** Organizer 는 아카이브가 `~/Library/Developer/Xcode/Archives/<오늘
날짜>/` 밑에 있으면 그대로 집어 가므로, `-archivePath` 를 거기로 주면 GUI 의 `Product ▸ Archive` 와
결과가 같다. CLI 를 쓰는 이유는 실패 지점이 로그에 남기 때문이다 — 서명 문제는 GUI 로 하면
Organizer 의 Distribute 까지 가야 드러난다([../trouble/2026-08-04-ios-appstore-signing.md](../trouble/2026-08-04-ios-appstore-signing.md)).

#### 1. 빌드 번호는 **두 파일**이다 — Android 와 같은 함정

| 파일 | 값 |
|---|---|
| `packages/app-rn/app.json` | `ios.buildNumber` |
| `packages/app-rn/ios/app/Info.plist` | `CFBundleVersion` ← **빌드가 실제로 읽는 값** |

이 저장소는 네이티브 트리를 커밋해 두므로 `app.json` 은 원천이 아니다(prebuild 를 돌려야 반영된다,
[[ADR-138]]). `app.json` 만 고치면 **옛 번호로 나간다** — Android 가 `versionCode` 20 으로 그렇게 한 번
나갔다(`c9ce4697`). 타겟의 `MARKETING_VERSION`(`1.0`)·`CURRENT_PROJECT_VERSION`(`1`) 은 스캐폴드
기본값 그대로 둬도 된다. `INFOPLIST_FILE` 의 리터럴이 이긴다.

#### 2. 소진된 번호는 **로컬 아카이브가 알고 있다**

App Store Connect 를 열 필요가 없다. Xcode 는 업로드 이력을 아카이브 안에 적어 둔다.

```bash
for a in ~/Library/Developer/Xcode/Archives/*/*.xcarchive; do
  plutil -p "$a/Info.plist" | grep -e uploadedBuildNumber -e '"title"' -e '"state"'
done
```

`task = distribute` 항목의 `uploadEvent.state = success` 가 보이면 그 `uploadedBuildNumber` 는 **다시 못
쓴다.** build 12 가 그랬다(업로드 2026-08-19 05:23). `task = validate` 만 있는 것은 검증만 한 것이라
번호가 살아 있다 — 둘을 구별할 것.

#### 3. 아카이브

```bash
cd packages/app-rn/ios
xcodebuild -workspace app.xcworkspace -scheme app \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/MapleRoutine-1.0.6-13.xcarchive" \
  archive
```

`npm run build`·`npx cap sync` 는 **필요 없다**(그건 capacitor 쪽 절차다). RN 은 `Bundle React Native
code and images` 빌드 단계가 `expo export:embed` 를 돌려 JS 번들과 에셋을 매 빌드 새로 만든다.

#### 4. 업로드 전에 export 까지 돌려 배포 서명을 확인한다

아카이브는 **개발 인증서로 서명된 채 성공한다**(`SigningIdentity = Apple Development …`). 배포
인증서로 바뀌는 것은 export 단계이고, 거기서 깨지면 error 90034 다. 그래서 업로드 전에 한 번 돌린다.

```bash
xcodebuild -exportArchive -archivePath <위 경로> \
  -exportPath /tmp/export -exportOptionsPlist ExportOptions.plist
# method: app-store-connect · destination: export · teamID: TQPKW249G7 · signingStyle: automatic
```

`destination` 을 `export` 로 두면 IPA 만 만들고 업로드하지 않는다.

#### 5. 산출물 확인 — 무엇을 보는가

```bash
A=~/Library/Developer/Xcode/Archives/<날짜>/<이름>.xcarchive/Products/Applications/app.app
plutil -p "$A/Info.plist" | grep -E 'CFBundleVersion|CFBundleShortVersionString'
codesign -dv --verbose=2 "$A" 2>&1 | grep -E 'Identifier|Authority|TeamIdentifier'
```

**Android 의 `app.manifest` 스탈 문제(`c9ce4697`)는 iOS 에 없다.** `Bundle React Native code and images`
와 `[CP-User] Generate updates resources for expo-updates` 가 둘 다 *"Based on dependency analysis"* 를 끈
채라 **매 빌드 돈다**(아카이브 로그의 `note:` 로 확인된다). Gradle 처럼 UP-TO-DATE 로 건너뛰는 자리가
없다. 그래도 스토어행 바이너리는 눈으로 확인하고 보낸다 — build 13 에서는 `EXUpdates.bundle/app.manifest`
의 288개 항목이 전부 `app.app/assets/` 의 실제 파일로 풀렸고, 카링·벨로나의 `packagerHash` 가
`packages/core/src/assets/bosses/*.webp` 의 md5 와 같았다.

### 알림을 넣는 릴리스의 iOS 준비물 ([[ADR-146]], 설계 완료·구현 전)

**바이너리에 안 들어가면 다음 심사까지 못 쓴다** — Push Notifications capability · Background Modes
(`remote-notification`·`fetch`) · `GoogleService-Info.plist` · **APNs 인증 키(.p8)를 Firebase 콘솔에
업로드**. 마지막 것은 코드가 아니라 콘솔 작업이라 빌드가 통과해도 조용히 빠진다(그러면 iOS 에서만
푸시가 안 온다). 전체 체크리스트는 [../features/notifications.md](../features/notifications.md).

### 저장소만 클론해서는 iOS를 빌드할 수 없다 (Xcode Cloud 비활성, 2026-08-04)

Xcode Cloud 워크플로(`메이플루틴 | Default | Archive - iOS`)가 **main 푸시마다** 아카이브를
시도해 머지할 때마다 실패 메일이 왔다. 간헐적 실패가 아니라 **구조적으로 성공할 수 없는
상태**였다.

```
ios/App/CapApp-SPM/Package.swift  (저장소에 추적됨)
  → .package(path: "../../../node_modules/@capacitor-community/admob") …
  → node_modules 는 gitignore 대상이라 클론본에 없음
  → SPM 의존성 해석이 컴파일 전에 실패
```

웹 번들(`ios/App/App/public`)과 `App/App/capacitor.config.json` 도 gitignore 대상이라, SPM이
풀렸더라도 내용 없는 앱이 나온다. **`npm ci` → `npm run build` → `npx cap sync ios` 가 선행돼야
Xcode가 이 프로젝트를 열 수 있다** — 로컬 아카이브가 되는 것은 그 세 단계가 이미 실행된 워킹
디렉토리에서 빌드하기 때문이다. Android 도 같은 구조다(`app/src/main/assets/public` 이 gitignore).

**결정: 워크플로를 비활성화하고 iOS 는 로컬 아카이브로 제출한다**(사용자 결정 2026-08-04).
로컬 경로가 이미 성공적으로 돌고 있고, 지금은 Play 배포가 우선이다.

다시 붙이려면 두 가지가 필요하다.

- `ios/App/ci_scripts/ci_post_clone.sh` — **`.xcodeproj` 와 같은 디렉토리**여야 하며(저장소 루트가
  아니다), 스크립트의 실행 위치가 `ci_scripts` 라 `cd $CI_WORKSPACE` 로 저장소 루트로 옮긴 뒤
  위 세 단계를 돌려야 한다.
- **트리거를 좁힐 것.** 무료 한도가 월 25 컴퓨팅 시간인데, main 푸시마다 아카이브가 돌면
  머지가 잦은 날 하루에 한도의 상당분을 쓴다. 태그나 수동 실행이 맞다.

## 폐기된 정책 (history)

(없음)
