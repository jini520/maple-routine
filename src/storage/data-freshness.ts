/**
 * 넥슨 Open API 에서 **실시간 데이터**를 마지막으로 받은 시각.
 *
 * 실시간인 것 셋만 이 값을 움직인다(사용자 지정). 스케줄러 데이터 · 오늘 날짜의 강화 데이터 ·
 * `character/basic`. 앞의 둘은 조회가 실제로 돈 자리에서만 적히고 basic 은 스케줄러 회차가
 * 함께 받는다.
 *
 * **안 움직이는 것.** 기기 DB 에서 꺼낸 값 · 보스 수익과 가계부의 **과거 기간**. 과거 기간은
 * Open API 를 부르더라도 이미 확정된 기록이라 실시간이 아니다. 그것으로 시각을 갱신하면
 * 지난 달을 넘겨보기만 해도 방금 받은 데이터처럼 보인다.
 *
 * **영속한다.** 앱을 다시 켜도 화면이 그리는 것은 캐시에 있던 그 데이터인데, 시각만 비우면
 * 그 데이터가 언제 것인지 말할 방법이 사라진다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** 적은 적이 없거나 못 읽는 값이면 `null`. */
export async function getRealtimeFetchedAt(): Promise<string | null> {
  const raw = await preferences.get(STORAGE_KEYS.dataFetchedAt)
  if (raw === null) return null

  // 깨진 값 때문에 화면이 서지 않느니 줄 하나를 안 그리는 편이 낫다.
  return Number.isNaN(new Date(raw).getTime()) ? null : raw
}

export async function setRealtimeFetchedAt(fetchedAt: string): Promise<void> {
  await preferences.set(STORAGE_KEYS.dataFetchedAt, fetchedAt)
}
