/**
 * 등급이 빈 줄을 지우는 부팅 단계. 옛 판은 첫 기록 앞에 기간을 끼워 넣으면 그 기간을 닫는 빈 줄을 남겼다. 기기 변환이 그 줄을
 * 지우고 앱은 빈 줄을 적지 않지만, 칸은 서버처럼 비울 수 있다. 등급이 빈 기간은 없으므로 지우고 앞 등급을 잇는다.
 */
import { deleteEmptyMvpGradeRows } from '../../storage/mvp-grades'
import { afterGradeChange } from './after-change'

/** 지운 줄이 있으면 그 기간의 자동 수수료가 앞 등급 요율로 바뀌므로 다시 계산한다. */
export async function dropEmptyMvpGradeRows(): Promise<void> {
  if ((await deleteEmptyMvpGradeRows()) > 0) await afterGradeChange()
}
