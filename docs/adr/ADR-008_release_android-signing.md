# ADR-008 Android 릴리스 서명

> 🟢 유효
> 옛 번호: ADR-091
> 관련 소스: `android/app/build.gradle` · `android/keystore.properties`(커밋하지 않는다) · `.gitignore` · `app.json`

## 배경

Play 는 서명된 AAB 만 받는다. iOS 는 Xcode 자동 서명이 인증서를 관리해 주지만, Android 는 키스토어 파일과
비밀번호를 개발자가 직접 가지고 있어야 한다. 그래서 키를 어디에 두고 빌드에 어떻게 넣을지를 정해야 했다.

## 결정

### 결정 1. Play 앱 서명을 쓰고, 우리는 업로드 키만 관리한다

앱 서명 키는 Google 이 보관한다. 업로드 키를 잃어버려도 Google 에 재설정을 요청해 새 업로드 키로 계속
올릴 수 있고, 기존 설치본의 업데이트도 끊기지 않는다. 그래서 업로드 키는 잃어버리는 것보다 유출되는 것이
더 위험하다.

업로드 키는 Capacitor 앱 때와 같은 키를 쓴다. 새 앱이 아니라 `com.mapleroutine.app` 의 업데이트라서, 다른
키로 서명하면 Play 가 업로드 단계에서 거부한다.

### 결정 2. 키스토어 파일은 저장소 밖에 둔다

`~/keys/maple-routine-upload.jks` 처럼 워킹 트리 밖에 둔다. 파일이 저장소 안에 있으면 `git add -f`, 저장소를
통째로 압축하는 백업, 에디터의 파일 동기화 같은 경로로 새어 나갈 수 있다. 지금 `.gitignore` 에는 `*.jks` 를
무시하는 줄이 없어서, 저장소 밖에 두는 것이 유일한 방어다.

### 결정 3. 비밀번호는 `android/keystore.properties` 에 적는다

`build.gradle` 에는 값을 적지 않는다. `android/keystore.properties` 는 `.gitignore` 에 들어 있다.

```properties
storeFile=/Users/<user>/keys/maple-routine-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

`storeFile` 은 절대 경로로 적는다. Gradle 의 `file()` 은 `~` 를 펼치지 않는다. 키스토어를 PKCS12 로 만들었기
때문에 `storePassword` 와 `keyPassword` 는 같은 값이다. 다르게 적으면 서명 단계에서 실패한다.

### 결정 4. `keystore.properties` 가 없으면 릴리스 빌드에 서명을 붙이지 않는다

`build.gradle` 은 파일이 있을 때만(`hasSigningConfig`) `signingConfigs.release` 를 만들어 `release` 빌드에
붙인다. 키스토어가 없는 환경(다른 기기의 클론, 디버그 빌드만 필요할 때)에서도 빌드가 깨지지 않는다.

서명 없는 AAB 는 Play 가 거부하므로 스토어로 새어 나갈 수 없다. Expo 템플릿 기본값처럼 디버그 키로 서명하는
방식은 쓰지 않는다. 그 방식은 빌드가 성공하고 AAB 도 정상으로 보여서, Play 가 거부할 때까지 원인을 알기
어렵다.

### 결정 5. `versionCode` 는 올리기만 한다

Play 는 한 번 받은 `versionCode` 를 다시 받지 않는다. 내부 테스트에 올렸다 내린 번호도 쓴 번호로 친다.
번호는 `applicationId` 마다 하나라서 Capacitor 앱(19까지)에 이어 React Native 앱이 20 부터 썼다.

`versionCode` 는 `android/app/build.gradle` 과 `app.json` 두 곳에 있다. 빌드가 실제로 읽는 것은
`build.gradle` 이고, `app.json` 은 두 플랫폼이 같이 쓰는 지문 재료다([[ADR-011]]).

## 테스트

이 결정들을 지키는 테스트는 없다. 서명은 릴리스마다 산출물로 확인한다
(`keytool -printcert -jarfile <AAB>` 에 `소유자: CN=MapleRoutine …` 이 나와야 한다. 절차는 `foundation/release.md`).

## 번호 기록

- ADR-008 (2026-10-19): 옛 ADR-091(정정 1 포함)을 옮겨 처음 작성
