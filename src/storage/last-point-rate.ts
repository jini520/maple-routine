// 마지막으로 넣은 메소마켓 시세 — 1억 메소당 메포.
//
// 값을 **행에 박는 것과 별개**다. 지난 기록의 시세는 이미 그 행에 있어(`spend_records`) 여기 값이
// 바뀌어도 소급하지 않는다. 이것은 **다음 입력의 기본값**일 뿐이다.
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export async function getLastPointRate(): Promise<number | null> {
  const raw = await preferences.get(STORAGE_KEYS.lastPointRate)
  if (raw === null) return null
  const parsed = Number(raw)
  // 저장된 값이 상한다면(수동 편집·옛 형식) **없는 것으로 본다**. 0 이나 NaN 이 기본값으로
  // 들어가면 환산이 나눗셈이라 화면이 깨진다.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function setLastPointRate(rate: number): Promise<void> {
  if (!Number.isFinite(rate) || rate <= 0) return
  await preferences.set(STORAGE_KEYS.lastPointRate, String(rate))
}
