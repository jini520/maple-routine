/**
 * 창 동기화의 **한 문**. 화면은 이것만 부른다.
 *
 * 순서가 계약이다. **창을 채운다 → 기록을 굳힌다 → 날짜를 캔다.** 없는 기록은 날짜를 캘 수
 * 없고, 없는 관측으로는 기록을 만들 수 없다.
 *
 * 지출 기록용 호출은 나중에 이 안에 수집기 하나를 더 붙이는 일이 된다. 창을 도는 규칙
 * (원장·게이트·중복 방지)은 `fillScheduleWindow` 가 이미 들고 있다.
 */
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { resolveDefeatDates } from '../boss-profit/defeat-dates'
import { recordBossProfitFromWindow } from './records'
import { fillScheduleWindow } from './window'

/**
 * 지금 도는 회차. 겹쳐 부르는 쪽이 이것을 나눠 쓴다.
 *
 * 창은 화면을 안 막으려고 뒤에서 도는데, 그 사이에 과거 기간을 열면 그 화면도 창을 부른다.
 * 그때 같은 날짜가 두 번 나가면 안 된다.
 */
let inFlight: Promise<void> | null = null

/**
 * 이 캐릭터들의 창을 채우고 그 결과를 기록·날짜로 반영한다.
 *
 * **던지지 않는다.** 못 채운 날짜는 원장에 안 남아 다음 회차가 다시 온다. 부르는 쪽은 이 결과가
 * 아니라 저장소를 다시 읽어 화면을 그린다.
 *
 * 겹쳐 부르면 **같은 회차를 나눠 쓴다.** 두 화면이 같은 순간에 부를 수 있고, 그때 같은 날짜가 두
 * 번 나가면 안 된다.
 */
export async function syncScheduleWindow(ocids: readonly string[], now: Date): Promise<void> {
  if (inFlight !== null) {
    return inFlight
  }
  inFlight = runSyncScheduleWindow(ocids, now).finally(() => {
    inFlight = null
  })
  return inFlight
}

/**
 * 세 걸음은 **서로를 죽이지 않는다.**
 *
 * 한 try 로 묶으면 채우기가 던진 순간 굳히기와 캐기가 통째로 안 돈다. 그러면 원장은 다 찼는데
 * 기록이 하나도 없는 상태가 되고, 화면은 그것을 실패로 그린다. 셋은 원장을 사이에 두고 이어질
 * 뿐 서로의 성공을 필요로 하지 않는다. 채우기가 실패해도 **이미 원장에 있는 것으로** 기록을
 * 굳힐 수 있다.
 */
async function runSyncScheduleWindow(ocids: readonly string[], now: Date): Promise<void> {
  await fillScheduleWindow(ocids, now).catch(() => undefined)
  await recordBossProfitFromWindow(ocids, now).catch(() => undefined)
  await resolveDefeatDates(ocids, now).catch(() => undefined)
}

/** 관리 캐릭터 목록을 스스로 읽는 판. 목록을 들고 있지 않은 화면(가계부)이 쓴다. */
export async function syncTrackedScheduleWindow(now: Date): Promise<void> {
  const ocids = await getTrackedCharacterOcids().catch(() => null)
  if (ocids === null || ocids.length === 0) {
    return
  }
  await syncScheduleWindow(ocids, now)
}
