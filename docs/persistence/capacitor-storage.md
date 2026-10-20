# Capacitor 앱이 남긴 저장소

Capacitor 로 만든 예전 앱을 쓰던 사용자의 데이터를, 지금 앱이 옮기지 않고 그대로 여는 규칙이다. 앱이 켜질 때마다
이 규칙으로 저장소를 연다. 왜 옮기지 않는지는 [[ADR-005]] 결정 2 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `modules/capacitor-storage/` | 로컬 Expo 모듈. Android SharedPreferences `CapacitorStorage` 와 iOS `UserDefaults.standard` 를 읽고 쓴다(`getValue` · `setValue` · `removeValue` · `getAllKeys`) |
| `storage/adapters/capacitor-storage-keys.ts` | 앱 키 ↔ 저장소 키 변환(`toNativeKey` · `toAppKeys`) |
| `storage/adapters/rn-preferences.ts` | 위 둘로 만든 `PreferencesPort` |
| `storage/adapters/capacitor-sqlite-open.ts` | SQLite 파일 이름 · 디렉터리 · 암호화 규칙(`toOpenOptions`) |
| `storage/adapters/rn-sqlite.ts` | 위 규칙으로 op-sqlite 를 여는 `SqlitePort` |

이름의 `capacitor` 는 프레임워크가 아니라 저장소의 이름이다. 지우면 기존 사용자의 데이터가 오류 없이 안 보이게
된다([[ADR-005]] 결정 3).

## 전제

- 번들 ID 가 `com.mapleroutine.app` 이다.
- Android 업로드 키가 같다([[ADR-008]]). 서명 키가 바뀌면 OS 가 새 설치로 처리해 앱 데이터 디렉터리를 새로 만든다.

이 둘이 깨지면 아래 규칙은 의미가 없다. 둘 다 되돌릴 수 없다.

## Preferences

| | 저장 위치 | 키 |
|---|---|---|
| Android | SharedPreferences 파일 `CapacitorStorage` | 앱 키 그대로 |
| iOS | `UserDefaults.standard` | `CapacitorStorage.` + 앱 키 |

iOS 의 `UserDefaults.standard` 는 시스템도 같이 쓴다. 그래서 키 목록을 돌려줄 때 `CapacitorStorage.` 로 시작하는 키만
남기고 접두사를 뗀다. 거르지 않으면 `AppleLanguages` 같은 남의 키가 캐시 삭제 범위와 용량에 섞인다. 점이 없는
`CapacitorStorage` 나 `CapacitorStorageBackup.` 처럼 비슷하기만 한 키도 거른다.

값은 모두 문자열이다. Capacitor 의 Preferences API 가 문자열만 받았고, 앱이 구조 있는 값을 `JSON.stringify` 해서
넣었기 때문에 형 변환이 없다.

## SQLite

| | 파일 |
|---|---|
| Android | 앱 데이터의 `databases/boss_profitSQLite.db`(op-sqlite 의 `ANDROID_DATABASE_PATH`) |
| iOS | 앱 컨테이너의 `Documents/boss_profitSQLite.db`(op-sqlite 의 `IOS_DOCUMENT_PATH`) |

- 파일 이름은 Capacitor SQLite 플러그인이 DB 이름 뒤에 `SQLite.db` 를 붙인 것이다. `boss_profit.db` 가 아니다.
- iOS 는 `Library/CapacitorDatabase` 가 아니다. 그 경로는 플러그인에 `iosDatabaseLocation` 을 설정했을 때의 값이고,
  이 앱에는 그 설정이 없었다. iOS 시뮬레이터에서 Capacitor 앱을 실행해 `Documents/` 에 파일이 생기는 것을 확인했다.
- 암호화하지 않은 표준 SQLite 파일이다. `toOpenOptions` 는 `no-encryption` 이 아니면 던지고, op-sqlite 에 암호화
  키를 넘기지 않는다. 다른 모드를 조용히 평문으로 열면 아무 화면에도 드러나지 않기 때문이다.

경로나 파일 이름이 틀려도 예외가 나지 않는다. op-sqlite 가 빈 DB 를 새로 만들고, 사용자에게는 기록이 모두 사라진
것으로 보인다.

옛 테이블에 없는 칸은 `ensureColumn` 이, 옛 값은 버전 이관이 채운다(`sqlite.md`).

## 로컬 알림

Capacitor 앱은 로컬 알림을 예약한 적이 없다. 그래서 OS 알림 스케줄러에 남은 옛 예약이 없고, 옮기거나 지울 것도
없다.
