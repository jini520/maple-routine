/**
 * 하루 상세 목록에서 줄 표식을 고르는 열쇠.
 *
 * **화면에 적히는 글자가 아니다.** 손입력 줄의 글자는 `item ?? category` 라 사용자가 항목
 * 이름을 적으면 그것이 뜨는데, 그 글자로 그림을 찾으면 이름을 적은 줄에서만 그림이 사라진다.
 *
 * 그림이 없는 갈래도 열쇠는 낸다. 무엇을 그릴지는 조회표(`cashbookRowIconOf`)가 정하므로
 * 나중에 그림을 붙일 때 고치는 것이 표 한 줄이다.
 */
import { isManualRecord, type DayRecord } from './records'

/** 자동 줄의 열쇠. 강화 줄은 갈래 이름이 그대로 열쇠라 이 표에 없다. */
const AUTO_KEYS = {
  bossCrystal: '보스 결정석',
  dropSale: '아이템 판매',
} as const

export function recordIconKeyOf(entry: DayRecord): string {
  if (isManualRecord(entry)) return entry.record.category
  if (entry.kind === 'enhancement') return entry.category
  return AUTO_KEYS[entry.kind]
}
