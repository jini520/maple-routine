/**
 * 종류마다의 함수 둘을 모은 표. 고리(`sweep.ts`)는 이 표에서만 종류를 안다.
 *
 * 지금은 비어 있다. 1.0.15 서버에는 드롭 판매가 경로가 없고, 기록은 동기화의 올리기로 올라간다. 고리가 모르는 `record_type`
 * 의 줄은 버리므로, 옛 앱이 넣은 `boss-clear` · `cashbook-entry` · `enhancement-total` · `drop-price` 줄은 보내지 않고 지운다.
 *
 * **종류를 여기 안 더하면 그 종류는 조용히 안 나간다.** 대기 표에 줄은 쌓이고 읽기 함수가 없어 처리되지 않는다. 새 종류를 더할
 * 때 손댈 곳은 세 줄이다. `SyncRecordType` 에 이름, 이 표에 한 줄, 그리고 그 종류의 파일에 함수 둘이다.
 */
import type { SyncHandler } from './sweep'

/** 지금 보내는 종류. 이 이름이 대기 표의 `record_type` 칸에 그대로 들어간다. */
export type SyncRecordType = never

export const SYNC_HANDLERS: Readonly<Record<SyncRecordType, SyncHandler<unknown>>> = {}
