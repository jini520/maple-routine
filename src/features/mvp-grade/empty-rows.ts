/**
 * 옛 판이 남긴 등급 빈 줄을 지우는 부팅 단계. 첫 기록 앞에 기간을 끼워 넣으면 그 기간을 닫는 빈 줄이 생겼는데,
 * 등급이 빈 기간은 없으므로 지우고 앞 등급을 잇는다.
 */
import { deleteEmptyMvpGradeRows } from '../../storage/mvp-grades'
import { afterGradeChange } from './after-change'

/** 지운 줄이 있으면 그 기간의 자동 수수료가 앞 등급 요율로 바뀌므로 다시 계산한다. */
export async function dropEmptyMvpGradeRows(): Promise<void> {
  if ((await deleteEmptyMvpGradeRows()) > 0) await afterGradeChange()
}
