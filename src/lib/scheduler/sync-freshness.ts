// 화면 진입 자동 재조회를 건너뛰는 창의 길이다. 게임 안에서 한 사이클(보스 하나,
// 일일 몇 개)을 도는 시간보다 짧아 "방금 한 것이 안 보인다"가 길게 가지 않으면서, 탭을 오가는
// 동선(수 초~수 분)은 전부 이 창 안에 들어온다.
//
// 잠정값이라 사용자가 직접 쓰면서 조정한다. 그래서 이 파일에서 한 번만 정의하고 어디서도 재선언하지
// 않는다. 상수 하나를 고치면 세 화면이 함께 움직여야 한다.
export const SYNC_TTL_MS = 10 * 60 * 1000

// "자동 재조회를 건너뛰어도 되는가"에 답한다(true = 건너뛴다). syncedAts 는 캐시가 있는 캐릭터들의
// 동기화 시각이고, trackedCount 는 추적 캐릭터 총수다. 둘의 수가 다르면 캐시가 없는 캐릭터가 있다는
// 뜻이라 만료로 본다. 새로 추가된 캐릭터가 조회 없이 빈 채로 남는 것을 막는다.
export function isSyncFresh(
  syncedAts: readonly (string | null)[],
  trackedCount: number,
  now: Date,
): boolean {
  if (trackedCount <= 0) return true
  if (syncedAts.length !== trackedCount) return false

  for (const syncedAt of syncedAts) {
    if (syncedAt === null) return false
    const age = now.getTime() - new Date(syncedAt).getTime()
    if (Number.isNaN(age)) return false
    // 음수 = 미래 시각. 기기 시계가 앞으로 튀면 미래 타임스탬프가 캐시에 남는데, 그걸 신선으로 읽으면
    // 영원히 조회하지 않는 상태가 된다. 가장 오래된 값이 기준이므로 하나라도 걸리면 만료다.
    if (age < 0 || age >= SYNC_TTL_MS) return false
  }
  return true
}
