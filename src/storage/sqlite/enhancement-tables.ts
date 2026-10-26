/**
 * 강화 합계 표. 응답 원본(`enhancement_history`) 대신 이것을 읽는다. 비용은 MVP 할인 전 두 몫이다.
 */
import { NEW_UUID_SQL } from './uuid'

/** 날짜 · 캐릭터 · 분류 · 장비 하나가 한 줄이다. 같은 열쇠를 다시 받으면 id 를 지키고 값만 갈아 끼운다. */
export const ENHANCEMENT_TOTALS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    -- 받은 자격의 넥슨 계정. 빈 글자는 계정 칸이 생기기 전의 원본에서 옮긴 줄이고 부팅 단계가 메인 계정으로 채운다.
    nexon_account_id TEXT NOT NULL,
    -- KST YYYY-MM-DD.
    history_date TEXT NOT NULL,
    -- 응답이 이름만 준다.
    character_name TEXT NOT NULL,
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
    -- 1 이벤트 월드 · 0 아님 · NULL 판정 못 함. 이벤트 월드와 모름은 지출에서 뺀다.
    event_world INTEGER,
    updated_at TEXT NOT NULL,
    UNIQUE (nexon_account_id, history_date, character_name, enhancement_category, item_group)
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
