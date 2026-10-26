/**
 * 게임 데이터의 기기 사본. 서버 `GET /v1/game-data` 의 칸 하나가 한 줄이다.
 */
import { NEW_UUID_SQL } from './uuid'

/** 칸 하나가 한 줄이다. 칸 JSON 을 그대로 든다. */
export const GAME_DATA_SECTIONS_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    section TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL
  )`

/**
 * 사본 전체의 표식. `contract` 는 사본을 쓴 앱의 계약 판이고 `etag` 는 그 응답의 ETag 다.
 *
 * 칸과 같은 트랜잭션으로 쓴다. 이 줄이 있으면 칸과 그림을 다 받은 사본이다.
 */
export const GAME_DATA_META_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
  )`
