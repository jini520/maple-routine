/**
 * 캐릭터의 강화 레벨 기억. 심볼 강화 · 헥사 스킬 폼이 강화 전 칸을 이 값으로 채운다.
 *
 * 1.0.15 기기 변환 전의 표(`UNCONVERTED_REMEMBERED_LEVELS_BODY`)는 대상을 key 글자로, 변환한 표는 게임 데이터의 줄 id 로 가리킨다.
 */
import { NEW_UUID_SQL } from './uuid'

/** 변환 전 표. 캐릭터 · 종류 · 대상 하나가 한 줄이다. 대상은 심볼 key 또는 헥사 코어 이름이다. */
export const UNCONVERTED_REMEMBERED_LEVELS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    ocid TEXT NOT NULL,
    -- 'symbol' | 'hexa'. 심볼 key 와 코어 이름이 겹쳐도 섞이지 않게 가른다.
    kind TEXT NOT NULL,
    item_key TEXT NOT NULL,
    level INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (ocid, kind, item_key)
  )`

/** 캐릭터 · 종류 · 대상 하나가 한 줄이다. 대상 칸 하나가 두 표를 가리켜, 읽을 때 종류의 표에서 찾는다. */
export const REMEMBERED_LEVELS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    ocid TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('symbol', 'hexa')),
    -- 심볼은 심볼 줄 id, 헥사는 헥사 코어 줄 id. 코어는 이름이 같아도 직업마다 다른 줄이라 그 캐릭터 직업의 줄이다.
    target_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (ocid, type, target_id)
  )`
