/**
 * 직접 완료를 열어 둔 기간 하나. 칸 이름은 서버 표 `boss_manual_completion_periods` 를 따른다.
 *
 * 필드를 더할 때 서버 저장소와 함께 본다. 한쪽만 바꾸면 다른 저장소의 타입 검사가 못 잡는다.
 */
export interface ManualCompletionPeriod {
  /** 보스 줄 id. 게임 데이터 `bosses` 칸의 보스 `id` 와 같은 값이다. */
  bossId: string
  /** 여는 날(KST `YYYY-MM-DD`). 이 날이 든 기간부터 단추가 선다. */
  fromDate: string
}
