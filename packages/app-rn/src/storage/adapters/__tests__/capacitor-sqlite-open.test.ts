// 여기서 지키는 것은 "어느 파일을 여는가" 하나다. 틀려도 예외가 없다 — op-sqlite 는 없는 파일을
// 만들어 주므로(`cpp/bridge.cpp:73` 이 디렉터리까지 만든다) 경로나 파일명이 어긋나면 **빈 DB 가
// 조용히 새로 생기고** 사용자에게는 보스 수익·드랍 기록이 사라진 것으로 보인다. 그래서 이 파일은
// 규칙을 눈으로 읽히는 리터럴로 못 박는다.

import {
  CAPACITOR_DB_FILE_SUFFIX,
  toOpenOptions,
  type CapacitorDatabaseDirectories,
} from '../capacitor-sqlite-open'

// 실제 상수가 네이티브에서 어떤 모양으로 오는지 그대로 흉내 낸다 — Android 는 끝에 `/` 가 붙어
// 오고(`OPSQLiteModule.kt:22-27`) iOS 는 안 붙는다(`OPSQLite.mm:20-22`).
const DIRECTORIES: CapacitorDatabaseDirectories = {
  android: '/data/user/0/com.mapleroutine.app/databases/',
  ios: '/var/mobile/Containers/Data/Application/ABC/Documents',
}

describe('CAPACITOR_DB_FILE_SUFFIX', () => {
  // 플러그인 규칙은 `dbName + "SQLite.db"` 다. `boss_profit.db` 로 열면 다른 파일이다.
  it('플러그인이 붙이는 접미사 그대로다', () => {
    expect(CAPACITOR_DB_FILE_SUFFIX).toBe('SQLite.db')
  })
})

describe('toOpenOptions', () => {
  it('파일명은 DB 이름 + SQLite.db 다', () => {
    expect(toOpenOptions('boss_profit', 'no-encryption', 'android', DIRECTORIES).name).toBe(
      'boss_profitSQLite.db',
    )
  })

  it('Android 는 앱 databases 디렉터리를 그대로 쓴다', () => {
    expect(toOpenOptions('boss_profit', 'no-encryption', 'android', DIRECTORIES).location).toBe(
      '/data/user/0/com.mapleroutine.app/databases/',
    )
  })

  // data.md 는 `Library/CapacitorDatabase` 로 적고 있으나 그것은 플러그인 README 가
  // `iosDatabaseLocation` 을 *설정하는 예시*다. 우리 `capacitor.config.ts` 에 그 설정이 없어
  // 기본값 "Documents" 가 적용된다(`CapacitorSQLite.swift:98`).
  it('iOS 는 앱 컨테이너의 Documents 다 (Library/CapacitorDatabase 가 아니다)', () => {
    const { location } = toOpenOptions('boss_profit', 'no-encryption', 'ios', DIRECTORIES)

    expect(location).toBe('/var/mobile/Containers/Data/Application/ABC/Documents')
    expect(location).not.toContain('CapacitorDatabase')
  })

  // 기존 DB 가 평문이라 암호화를 켜면 **읽을 수 없게 된다**(data.md 결정 2).
  it('암호화 키를 붙이지 않는다', () => {
    const options = toOpenOptions('boss_profit', 'no-encryption', 'ios', DIRECTORIES)

    expect(Object.keys(options).sort()).toEqual(['location', 'name'])
  })

  // 조용히 평문으로 여는 것이 더 나쁘다 — 아무 화면에도 안 나타난다.
  it("'no-encryption' 이 아니면 던진다", () => {
    expect(() => toOpenOptions('boss_profit', 'encryption', 'ios', DIRECTORIES)).toThrow(
      /암호화/,
    )
  })
})
