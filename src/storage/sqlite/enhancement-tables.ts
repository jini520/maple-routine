/**
 * 강화 합계 표. 응답 원본(`enhancement_history`) 대신 이것을 읽는다. 비용은 MVP 할인 전 두 몫이다.
 */
import { NEW_UUID_SQL } from './uuid'

/**
 * 날짜 · 캐릭터(ocid) · 분류 · 장비 하나가 한 줄이다. 같은 열쇠를 다시 받으면 id 를 지키고 값만 갈아 끼운다.
 *
 * 판정 열쇠에 넥슨 계정 id 를 넣지 않는다. 기기가 만든 값이라 같은 넥슨 계정이 번호를 새로 받으면 같은 줄이 두 번 들어간다.
 * ocid 는 넥슨이 주는 값이고 이름을 바꿔도 그대로다.
 */
export const ENHANCEMENT_TOTALS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    -- 받은 자격의 넥슨 계정. 그 계정의 날을 갈아 끼우고 다시 받는 단위다.
    nexon_account_id TEXT NOT NULL,
    -- KST YYYY-MM-DD.
    history_date TEXT NOT NULL,
    -- 응답이 준 그날의 이름. 묶고 찾는 것은 ocid 다.
    character_name TEXT NOT NULL,
    -- 그날 그 이름이었던 캐릭터. 리프 전 기간의 줄은 리프 뒤의 ocid 다.
    ocid TEXT NOT NULL,
    -- 그 캐릭터의 메이플 ID.
    account_id TEXT NOT NULL,
    -- 그 줄의 월드. 리프 전 기간이라 모르면 NULL.
    world_key TEXT,
    -- 받은 API 종류. 'cube' | 'starforce' | 'potential' | 'soul_potential'. 갈아 끼우는 단위다.
    enhancement_type TEXT NOT NULL,
    -- 화면의 분류 다섯. 잠재를 본 · 에디셔널로 나눈다.
    enhancement_category TEXT NOT NULL,
    -- 장비 key 면 'key:…', 없으면 공백을 지운 이름 'name:…'.
    item_group TEXT NOT NULL,
    item_key TEXT,
    item_name TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    -- MVP 할인 전 시도 비용. 할인은 화면에 보일 때 붙인다.
    attempt_cost_meso INTEGER NOT NULL,
    -- 파괴 방지 추가분. 어떤 할인도 받지 않는다.
    destroy_defence_cost_meso INTEGER NOT NULL,
    -- 스타포스의 가장 이른 시도의 강화 전 성과 가장 늦은 시도의 강화 후 성. 다른 분류는 NULL.
    from_star INTEGER,
    to_star INTEGER,
    -- 1 이벤트 월드 · 0 아님 · NULL 판정 못 함. 이벤트 월드와 모름은 지출에서 뺀다.
    event_world INTEGER,
    updated_at TEXT NOT NULL,
    UNIQUE (ocid, history_date, enhancement_category, item_group)
  )`

/** 날짜 범위로 읽는다. */
export const ENHANCEMENT_TOTALS_DATE_INDEX =
  'CREATE INDEX IF NOT EXISTS enhancement_totals_date ON enhancement_totals (history_date)'

/**
 * 강화 비용 다시 매기기 요청의 진행. 넥슨 계정 · 요청마다 한 줄이다. 강화 내역이 계정 단위라 계정마다 다시 받는다.
 */
export const ENHANCEMENT_RECOMPUTES_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    nexon_account_id TEXT NOT NULL,
    -- 환경 변수 요청의 id.
    request_key TEXT NOT NULL,
    -- 다시 받은 마지막 날. 다음 회차가 그 뒤부터 잇는다.
    done_through_date TEXT,
    -- 요청의 마지막 날까지 받은 시각. 적히면 다시 돌지 않는다.
    completed_at TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE (nexon_account_id, request_key)
  )`

/**
 * 캐릭터의 그날 이름과 월드. 강화 줄의 이름을 ocid 에 붙일 때 `character/basic` 에 날짜를 넣어 받은 값이다. 지난 날의 값은
 * 바뀌지 않아 같은 ocid · 날짜를 다시 부르지 않는다.
 */
export const CHARACTER_DATED_NAMES_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    ocid TEXT NOT NULL,
    -- KST YYYY-MM-DD.
    history_date TEXT NOT NULL,
    -- 그날 그 ocid 에 값이 없으면 NULL. 리프 전 기간이 그렇다.
    name TEXT,
    -- 월드 이름 원문. 판정할 때 지금 월드 표에서 찾는다.
    world_name TEXT,
    checked_at TEXT NOT NULL,
    UNIQUE (ocid, history_date)
  )`

/**
 * 캐릭터마다 만든 날과 처음 값이 온 날. 리프한 캐릭터는 만든 날과 처음 값이 온 날 사이가 리프 전 기간이다. 캐릭터마다 한 번
 * 찾아 둔다.
 */
export const CHARACTER_FIRST_DAYS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    ocid TEXT NOT NULL,
    -- character_date_create 의 KST 날짜. 리프 뒤에도 처음 만든 날 그대로다.
    created_date TEXT NOT NULL,
    -- 날짜를 넣어 불렀을 때 처음 값이 온 날과 그날의 이름.
    first_date TEXT NOT NULL,
    first_name TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE (ocid)
  )`

/**
 * 다시 받아야 하는 강화 내역의 날. 1.0.14 이관이 ocid 를 붙이지 못해 지운 줄의 날이다. 수집기가 다시 매기기처럼 뒤에서 받고,
 * 받아 굳히면 지운다.
 */
export const ENHANCEMENT_REFETCHES_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    nexon_account_id TEXT NOT NULL,
    enhancement_type TEXT NOT NULL,
    history_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (nexon_account_id, enhancement_type, history_date)
  )`
