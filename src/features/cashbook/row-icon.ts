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

export function recordIconKeyOf(entry: DayRecord): string {
  // 수익과 지출의 갈래 key 가 겹칠 수 있어(`etc`) 기록 종류를 앞에 붙인다. 강화 줄도 같은 모양이다.
  if (isManualRecord(entry)) return `${entry.kind}:${entry.record.category}`
  if (entry.kind === 'enhancement') return `${entry.kind}:${entry.category}`
  // 결정석 · 판매 줄은 기록 종류 하나가 곧 열쇠다.
  return entry.kind
}
