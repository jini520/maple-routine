/**
 * 기본키가 값의 조합이던 다섯 표의 본문. 버전 16 이 옛 표를 이 모양으로 다시 쓴다.
 *
 * `id` 는 SQLite 가 기본값으로 채운다. 쓰는 SQL 이 `id` 를 몰라도 행이 들어가고, 옛 기본키 조합은 `UNIQUE` 라
 * `ON CONFLICT(옛 조합)` 이 그대로 돈다.
 */
import { NEW_UUID_SQL } from './uuid'

const ID_COLUMN = `id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL})`

/** 기록 옆에 보일 캐릭터 이름 · 초상 · 월드 · 레벨 · 직업. 캐릭터 하나에 한 행이다. */
export const CHARACTER_PROFILES_BODY = `(
    ${ID_COLUMN},
    ocid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    -- 모르면 NULL. 0 이나 빈 문자열로 채우면 '모름' 이 값으로 둔갑한다.
    world TEXT,
    -- 월드 key. world 가 NULL 이면 함께 NULL 이다.
    world_key TEXT,
    level INTEGER,
    -- 월드 이전 판정이 읽는다. 이름만으로는 옮겨간 캐릭터를 짚을 수 없어 직업이 유일성을 세운다.
    job_class TEXT,
    updated_at TEXT NOT NULL
  )`

/** 월드 리프로 갈린 옛 ocid 와 새 ocid. 옛 ocid 하나는 한 번만 옮겨간다. */
export const CHARACTER_WORLD_LEAPS_BODY = `(
    ${ID_COLUMN},
    from_ocid TEXT NOT NULL UNIQUE,
    to_ocid TEXT NOT NULL,
    linked_at TEXT NOT NULL
  )`

/**
 * 강화 내역을 넥슨 계정 · 종류 · 날짜마다 조회했는지.
 *
 * `nexon_account_id` 가 빈 글자인 행은 버전 16 전에 메인 계정으로 받은 것이다. 부팅 단계가 메인 계정 id 로 채운다.
 */
export const ENHANCEMENT_HISTORY_CHECKS_BODY = `(
    ${ID_COLUMN},
    nexon_account_id TEXT,
    -- 'cube' | 'starforce' | 'potential' | 'soul_potential'
    enhancement_type TEXT NOT NULL,
    -- KST YYYY-MM-DD.
    history_date TEXT NOT NULL,
    -- **1쪽의 커서.** 다시 불렀을 때 같으면 새 데이터가 없다는 뜻이라 나머지를 안 부른다.
    -- 그 날에 아무것도 안 했으면 응답에 커서가 없어 NULL 이다.
    next_cursor TEXT,
    -- 어제 이전이면 1. **아예 안 부른다** - 그 날짜의 데이터는 변할 수 없다.
    settled INTEGER NOT NULL DEFAULT 0,
    checked_at TEXT NOT NULL,
    UNIQUE (nexon_account_id, enhancement_type, history_date)
  )`

/** 메이플 ID 의 MVP 등급 이력. 사용자가 적은 값이다. */
export const MVP_GRADE_HISTORY_BODY = `(
    ${ID_COLUMN},
    account_id TEXT NOT NULL,
    -- 그 주의 목요일 YYYY-MM-DD. MVP 등급이 매주 목요일에 바뀐다.
    from_date TEXT NOT NULL,
    -- 등급 key. NULL 은 등급 없음이고 첫 기록 앞에 끼워 넣은 기간을 닫는 줄이다.
    grade TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE (account_id, from_date)
  )`

/**
 * 캐릭터의 메이플 ID 소속. 스타포스 줄은 이름만 들어 옛 이름을 지우면 안 된다.
 *
 * `nexon_account_id` 는 그 소속을 어느 넥슨 계정의 `character/list` 에서 봤는지다. 빈 글자는 버전 16 전의 행이다.
 */
export const CHARACTER_ACCOUNTS_BODY = `(
    ${ID_COLUMN},
    ocid TEXT NOT NULL,
    name TEXT NOT NULL,
    account_id TEXT NOT NULL,
    nexon_account_id TEXT,
    -- KST YYYY-MM-DD. 볼 때마다 줄을 쌓지 않고 두 날짜를 넓힌다.
    first_seen_date TEXT NOT NULL,
    last_seen_date TEXT NOT NULL,
    UNIQUE (ocid, name, account_id)
  )`
