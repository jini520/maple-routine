/**
 * 직접 완료를 열어 둔 보스. **계약은 서버 저장소와 나눠 갖는다**(`maple-routine-server` 의 README).
 *
 * 필드를 더할 때 양쪽을 함께 본다. 한쪽만 바꾸면 다른 저장소의 타입 검사가 못 잡는다.
 */
export interface ManualCompletionBoss {
  /** 보스 key. `src/data/weekly-bosses.json` 과 같은 값이다. */
  boss: string
  /** 여는 날(KST `YYYY-MM-DD`). 이 날이 든 기간부터 단추가 선다. */
  from: string
}
