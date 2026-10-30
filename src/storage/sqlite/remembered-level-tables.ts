/**
 * 캐릭터의 강화 레벨 기억. 심볼 강화 · 헥사 스킬 폼이 강화 전 칸을 이 값으로 채운다.
 */
import { NEW_UUID_SQL } from './uuid'

/** 캐릭터 · 갈래 · 대상 하나가 한 줄이다. 대상은 심볼 key 또는 헥사 코어 이름이다. */
export const REMEMBERED_LEVELS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    ocid TEXT NOT NULL,
    -- 'symbol' | 'hexa'. 심볼 key 와 코어 이름이 겹쳐도 섞이지 않게 가른다.
    kind TEXT NOT NULL,
    item_key TEXT NOT NULL,
    level INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (ocid, kind, item_key)
  )`
