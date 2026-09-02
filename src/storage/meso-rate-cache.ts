// 캐릭터별 **최대 메소 획득량**(%)의 마지막 성공값.
//
// **TTL 이 없다.** 이 값은 사용자가 장비를 갈아입을 때만 변하고, 낡은 값이 쓰이는 곳은 **폴백의
// 기본값** 하나뿐이다(API 를 못 읽었을 때 치는 칸에 미리 서 있는 숫자 — 결정 7). 갈아입은 것이
// 반영이 안 되면 캐릭터를 다시 고르면 그때 다섯을 다시 부른다.
//
// `KEEP_KEYS` 에 **안 넣는다** — 캐시 삭제가 쓸어가는 것이 맞다. 지워져도 생기는 것은 거짓 값이
// 아니라 **폴백 칸이 비어서 선다** 이고, 다음에 캐릭터를 고르면 다시 채워진다.
//
// 값은 **퍼센트 하나**다. 잰 시각을 같이 두지 않는 이유는 그것을 읽을 자리가 없기 때문이다 —
// TTL 이 없으니 **언제 쟀나** 로 갈리는 판단이 하나도 없다.
import { preferences } from './ports'
import { mesoRateCacheKey } from './keys'

export async function getCachedMesoRate(ocid: string): Promise<number | null> {
  const raw = await preferences.get(mesoRateCacheKey(ocid))
  if (raw === null) return null
  const parsed = Number(raw)
  // 상한 값(수동 편집·옛 형식)은 **없는 것으로 본다** — 폴백 칸의 기본값으로 쓰이는 자리라
  // NaN 이 새면 치는 칸이 깨진다. **0 은 값이다**(메획을 안 두른 부캐가 실제로 있다).
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export async function setCachedMesoRate(ocid: string, percent: number): Promise<void> {
  if (!Number.isFinite(percent) || percent < 0) return
  await preferences.set(mesoRateCacheKey(ocid), String(percent))
}
