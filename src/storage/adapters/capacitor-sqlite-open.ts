/**
 * Capacitor 시절 DB 파일을 **그대로 여는** 데 필요한 순수 규칙. 파일명·디렉터리·암호화 모드
 * (`docs/migration/data.md` 결정 2).
 *
 * 파일을 실제로 여는 것은 네이티브지만 "어느 파일을 여는가"는 전부 문자열 규칙이라 여기 둔다.
 * `capacitor-storage-keys.ts` 와 같은 이유이고 같은 이득이다. **실기기 없이 검증되는
 * 자리로 옮기는 것**. 이 단계에서 오타 하나가 가장 비싼 자리가 정확히 여기다: 경로나 파일명이
 * 틀리면 예외도 없이 **빈 DB 가 새로 생기고**, 사용자에게는 보스 수익·드랍 기록이 전부 사라진
 * 것으로 보인다(API 로 복구할 수 없는 데이터다).
 */

/**
 * `@capacitor-community/sqlite` 가 DB 이름 뒤에 붙이는 접미사. 양 플랫폼 공통이다
 * (`CapacitorSQLite.java:346` · `Database.swift:69`).
 *
 * DB 이름이 `boss_profit` 이므로 파일명은 `boss_profitSQLite.db` 다. `boss_profit.db` 가 아니다.
 */
export const CAPACITOR_DB_FILE_SUFFIX = 'SQLite.db'

/** 이 앱이 빌드하는 두 플랫폼. DB 파일 위치에서 갈리는 것은 이것 하나뿐이다. */
export type SqlitePlatform = 'ios' | 'android'

/**
 * 플러그인이 DB 파일을 두는 디렉터리. 값은 네이티브가 알려주므로(op-sqlite 의
 * `ANDROID_DATABASE_PATH`·`IOS_DOCUMENT_PATH` 상수) 이 모듈은 **어느 쪽을 고르는지**만 정한다.
 *
 * | | 디렉터리 | 근거 |
 * |---|---|---|
 * | Android | `<앱 데이터>/databases` | `UtilsFile.java:23`. `context.getDatabasePath(dbName)` |
 * | iOS | `<앱 컨테이너>/Documents` | 아래 주석 |
 *
 * ⚠️ **iOS 는 `docs/migration/data.md` 가 적어 둔 `Library/CapacitorDatabase` 가 아니다.**
 * 그 값은 플러그인 README 가 `iosDatabaseLocation` 을 *설정하는 예시*로 든 경로이고,
 * 그 설정이 없다. 설정이 없으면 플러그인은
 * `"Documents"` 를 쓰고(`CapacitorSQLite.swift:98`) `UtilsFile.getFolderURL` 이 그것을
 * `NSDocumentDirectory` 로 푼다(`UtilsFile.swift:161-162`). 즉 `<앱 컨테이너>/Documents` 다.
 *
 * 근거는 플러그인 소스지만 **실기기 앱 컨테이너를 열어 확인한 것은 아니다**. data.md
 * 미검증 항목 에 남아 있고, 2단계(실기기 검증)에서 반드시 눈으로 확인해야 한다.
 */
export interface CapacitorDatabaseDirectories {
  android: string
  ios: string
}

/** op-sqlite `open()` 에 넘기는 것. **`encryptionKey` 가 없다는 것 자체가 계약이다.** */
export interface CapacitorDatabaseOpenOptions {
  name: string
  location: string
}

/**
 * `SqlitePort.createConnection` 인자 → op-sqlite `open()` 옵션.
 *
 * `encryption` 이 `'no-encryption'` 이 아니면 던진다. 기존 사용자의 DB 는 평문이라 우리가 할 일은
 * **아무것도 하지 않는 것**(= `encryptionKey` 를 안 넘기는 것)이 맞지만, 다른 모드가 왔을 때
 * 조용히 평문으로 여는 것은 다르다. "암호화해서 열어 달라고 했는데 평문으로 열렸다"는 아무
 * 화면에도 안 나타난다. 지금 `db.ts` 는 `'no-encryption'` 만 넘기므로 이 가지는 안 돈다.
 */
export function toOpenOptions(
  database: string,
  encryption: string,
  platform: SqlitePlatform,
  directories: CapacitorDatabaseDirectories,
): CapacitorDatabaseOpenOptions {
  if (encryption !== 'no-encryption') {
    throw new Error(
      `지원하지 않는 암호화 모드입니다: ${encryption}. 기존 사용자의 DB 는 평문이라 암호화를 켜면 읽을 수 없게 됩니다.`,
    )
  }
  return {
    name: `${database}${CAPACITOR_DB_FILE_SUFFIX}`,
    location: platform === 'ios' ? directories.ios : directories.android,
  }
}
