# Live Update(OTA) 실기기 테스트 트러블슈팅 (2026-07-15)

[[ADR-026]]/[[ADR-027]] 구현 중 iOS 시뮬레이터·Android 실기기(HyperOS)로 직접 검증하며 만난 문제들. OTA가 그동안 한 번도 실제로 작동한 적이 없어([[ADR-024]]), 유닛 테스트(mock)로는 못 잡는 버그가 실기기에서 다수 드러났다.

## 1. OTA 코드 버그

### 1-1. 매니페스트가 캐시된 옛 버전을 계속 반환

**증상**: `latest.json`을 새 버전으로 갱신해 배포해도, 기기가 계속 이전 버전이라고 판단해 업데이트를 못 받음.

**원인**: `latest.json`은 URL이 고정이고 내용만 바뀐다. iOS `URLSession`과 GitHub CDN 엣지 캐시가 예전 응답을 계속 돌려준다 — 한 번 옛 매니페스트를 받은 기기는 새 배포를 영영 못 보는 구조였다.

**해결**: `CapacitorHttp.get`에 매 요청 유니크 쿼리 파라미터(`?t=<Date.now()>`)와 `Cache-Control: no-cache` 헤더를 붙여 모든 캐시 층을 우회.

```ts
const response = await CapacitorHttp.get({
  url: manifestUrl,
  params: { t: String(Date.now()) },
  headers: { 'Cache-Control': 'no-cache' },
})
```

### 1-2. `response.data`가 객체가 아니라 문자열로 도착

**증상**: 캐시 문제를 고친 후에도 iOS에서 계속 "확인에 실패했습니다" 오류. 콘솔 로그를 보니 매니페스트 조회 자체는 성공(`{"version":"1.0.1",...}` 형태의 데이터 수신).

**원인**: GitHub Releases CDN이 자산을 `application/octet-stream`으로 내려줘, `CapacitorHttp`가 content-type을 보고 JSON 자동 파싱을 하지 않고 `response.data`를 **문자열째로** 반환한다(iOS 실측 — 콘솔에 `"data":"{\n  \"version\": \"1.0.1\"...`처럼 이스케이프된 문자열로 찍힘). 기존 코드가 `response.data as LiveUpdateManifest`로 강제 캐스팅했기 때문에, 런타임엔 문자열이라 `manifest.version`이 `undefined`가 되고 `isNewerVersion`이 항상 실패했다.

**진단 방법**: `xcrun simctl launch --console-pty`로 콘솔을 캡처해 `TO JS {...}` 로그를 직접 읽었다(`--console-pty` 없이는 capgo가 `Swift.print`로 찍는 로그가 `xcrun simctl spawn booted log stream`(os_log)에는 안 잡힘).

**해결**: `parseLiveUpdateManifest()`를 만들어 문자열이면 `JSON.parse`, 이미 객체면 그대로 쓰고 필수 필드 타입까지 검증.

### 1-3. `autoUpdate:'off'`에서 Android는 큐에 넣은 번들을 재시작해도 자동 적용하지 않음

**증상**: 부팅 세션 A에서 새 번들을 다운로드해 `next()`로 큐에 넣었는데, 앱을 완전히 종료(`force-stop`) 후 재실행(세션 B)해도 여전히 구버전 — 재다운로드만 반복.

**원인**: capgo Android 소스(`CapacitorUpdaterPlugin.appMovedToForeground`)를 확인한 결과, `autoUpdate:'off'`일 때는 재시작·포그라운드 전환 시 "Auto update is disabled" 로그만 남기고 큐에 든 `next()` 번들을 적용하지 않는다. [[ADR-022]]가 전제했던 "다음 재시작 시 조용히 자동 적용"은 애초에 이 설정에서 성립하지 않는 동작이었다.

**해결**: 부팅 시퀀스에서 `getNextBundle()`로 대기 번들을 직접 확인해, 현재 번들과 다르고 error 상태가 아니면 `reload()`로 직접 적용하는 `applyPendingLiveUpdate()`를 구현(이후 [[ADR-027]]에서 사용자 동의 흐름으로 대체됨 — `next()` 대신 `set()` 사용).

### 1-4. `getNextBundle()`이 대기 번들 없을 때 Android에서 `undefined` 반환 (null 아님)

**증상**: 클린 설치 후 첫 부팅에서 `checkOnBoot`이 통째로 실패 — logcat에 `unhandled_rejection: Cannot read properties of undefined (reading 'status')`. 다운로드 자체가 아예 안 일어남.

**원인**: capgo Android 네이티브(`getNextBundle`)는 대기 번들이 없으면 `call.resolve(null)`을 호출하는데, Capacitor 브릿지를 거치면 JS 쪽엔 `undefined`로 도착한다(`null` 아님). 코드가 `next === null`로만 체크해서 `undefined`를 놓쳤고, 그 결과 `next.status`에서 예외가 터져 `checkOnBoot` 전체(다운로드 포함)가 중단됐다. 유닛 테스트는 mock으로 `null`만 넣어봤기 때문에 이 문제를 못 잡았다.

**해결**: `next == null`(느슨한 비교로 `null`·`undefined` 둘 다 처리) + try/catch로 감싸 이 함수가 실패해도 부팅 체크 자체는 막지 않도록 함.

### 1-5. iOS와 Android의 "재시작 자동 적용" 메커니즘이 서로 다름

**증상**: iOS에서는 "지금 적용" 버튼을 누르지 않고 재시작만 두 번 했는데도 새 버전이 적용됨 — Android와 동작이 다른 것처럼 보여 "iOS만 수동인가?"라는 의문이 나옴.

**원인**: 실측 결과 iOS capgo는 콜드 스타트 시 큐에 든 `next()` 번들을 **네이티브가 알아서 적용**한다. Android는 위 1-3처럼 스스로 적용하지 않는다. 즉 코드는 완전히 동일(같은 JS 어댑터)한데 네이티브 플러그인 구현이 플랫폼별로 다르게 동작한다.

**교훈**: 한 플랫폼에서 관찰한 동작을 다른 플랫폼에 일반화하지 말 것 — 반드시 양쪽에서 각각 실측. (이 발견 이후 [[ADR-027]]에서 아예 `next()`를 버리고 `set()` 기반 사용자 명시적 적용으로 설계를 바꿔, 두 플랫폼의 이 차이 자체를 없앴다.)

## 2. 실기기/시뮬레이터 테스트 환경 이슈

### 2-1. iOS 시뮬레이터 탭 자동화 도구(`idb`) 미설치

**증상**: 화면을 탭해 업데이트 확인/적용 버튼을 누르려 했으나 자동화 도구가 없음.

**해결**: `idb_companion`은 이미 있었지만 CLI(`idb`)가 없어 `python3 -m pip install --user fb-idb`로 설치(`~/Library/Python/3.9/bin/idb`). `idb ui tap --udid <UDID> <x> <y>`로 좌표(포인트 단위, 스크린샷 픽셀 ÷ 배율) 탭.

### 2-2. MIUI가 `adb shell input tap`을 차단

**증상**: Android 실기기에서 좌표 탭 명령이 `SecurityException: ... does not have permission android.permission.INJECT_EVENTS`로 실패.

**원인**: Xiaomi HyperOS/MIUI가 보안 정책상 adb를 통한 입력 이벤트 주입을 차단한다. 개발자 옵션의 "USB 디버깅(보안 설정)"을 켜야 풀리는데, 이건 샤오미 계정 로그인이 필요한 수동 작업이라 자동화 세션 중엔 우회 불가.

**해결**: 탭이 필요한 시나리오(수동 확인 버튼 흐름)는 iOS에서 검증하고, Android는 탭이 필요 없는 **재시작 자동 적용** 경로 + `adb logcat`으로 검증하는 방식으로 전환.

### 2-3. MIUI가 `adb install`(신규 설치)도 차단

**증상**: 클린 상태로 테스트하려고 앱을 `adb uninstall` 후 재설치를 시도했으나 `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`로 실패 — 앱이 통째로 사라진 채 재설치가 안 돼 한동안 기기에 앱이 없는 상태가 됨.

**원인**: MIUI는 `adb install`(신규 패키지 설치)을 사용자 확인 없이는 차단한다. 반면 **`adb install -r`(기존 앱 업데이트)는 허용**된다.

**해결**: 신규 설치가 필요하면 `adb push <apk> /sdcard/Download/`로 기기에 APK를 넣어두고 사용자가 파일탐색기에서 수동 설치하도록 안내. 이후로는 **앱을 절대 uninstall하지 않고**, 항상 `install -r`(업데이트)만 사용.

### 2-4. MIUI가 `adb shell pm clear`도 차단

**증상**: capgo가 이미 적용한 이전 OTA 번들을 지우고 "새 네이티브 코드(builtin)" 상태로 되돌리려 `pm clear`를 시도했으나 `SecurityException: ... does not have permission android.permission.CLEAR_APP_USER_DATA to clear data`로 실패.

**원인**: uninstall·pm clear 둘 다 막혀 있어, **capgo가 한 번 적용한 OTA 번들을 실기기에서 강제로 리셋할 방법이 없다**. 즉 실기기는 항상 "마지막으로 적용된 OTA 코드"를 계속 실행하고, 새로 배포한 **네이티브** 빌드(플러그인 추가 등)를 테스트하려면 다른 방법이 필요하다.

**해결**: `android/app/build.gradle`의 `versionCode`를 올려서(`adb install -r`) 재설치하면, capgo의 `autoReset`이 네이티브 버전 변경을 감지해 builtin(새로 빌드한 코드)으로 리셋한다. 이후 새 배포 채널의 OTA를 다시 받는 정상 흐름으로 돌아온다. **네이티브 플러그인을 추가하거나 네이티브 코드를 바꾼 뒤 실기기로 검증하려면 반드시 `versionCode`를 올려야 한다**는 걸 이번에 확인.

## 요약 — 재발 방지 체크리스트

- OTA 관련 코드를 고칠 때는 **반드시 실기기/시뮬레이터로 실제 네트워크 요청을 태워볼 것** — mock 유닛 테스트는 "CDN이 문자열을 준다", "캐시가 옛 버전을 돌려준다", "네이티브가 null 대신 undefined를 준다" 같은 실물 API 계약 차이를 못 잡는다.
- iOS/Android는 같은 JS 어댑터를 쓰더라도 **네이티브 플러그인 동작이 다를 수 있다** — 한쪽만 보고 결론 내리지 말 것.
- MIUI 실기기 세션에서는 **uninstall·pm clear·input tap 셋 다 차단**된다는 전제로 계획할 것. 클린 상태가 필요하면 `versionCode` bump + `install -r`이 유일한 길.
- `xcrun simctl launch`로 콘솔을 봐야 할 때는 `--console-pty`를 꼭 붙일 것(os_log 스트림만으론 capgo의 `Swift.print` 로그가 안 잡힘).
