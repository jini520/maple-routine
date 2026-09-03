/**
 * SQLite 조회의 복원력 래퍼.
 *
 * store.ts 안에서 여섯 함수가 함께 쓰던 리프였다. 백필·드롭·행 빌드를 각각 모듈로 가르려면
 * 이것이 먼저 나와야 한다. 안 그러면 각 모듈이 store.ts 를 가리켜 순환이 생긴다.
 *
 * 리로드로 dbPromise 는 초기화됐지만 네이티브 SQLite 커넥션이 stale 하게 남으면, 닫고 새로
 * 생성 보정만으로는 그 직후 첫 쿼리가 막힌다(실기기 재현). 그러면 화면이 불러오는 중 에서 영영
 * 멈추거나, 기간 이동에서 라벨만 바뀌고 rows 는 그대로인 증상이 된다. SQLite 의존 호출을
 * 타임아웃과 경쟁시켜 지연·실패 시 fallback 으로 진행한다.
 */
const SQLITE_QUERY_TIMEOUT_MS = 5000

// 경주가 끝나면 타이머를 반드시 끈다. 안 끄면 쿼리가 이겨도 5초짜리 `setTimeout` 이 그대로
// 남는다. 조회 한 번에 하나씩 쌓이고, 테스트에서는 jest 가 안 끝나 워커 정리와 겹쳐 SIGSEGV
// 까지 간다.
function raceWithTimeout<T>(
  promise: Promise<T>,
  onTimeout: (settle: { resolve(value: T): void; reject(error: Error): void }) => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  return Promise.race([
    promise,
    new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => onTimeout({ resolve, reject }), SQLITE_QUERY_TIMEOUT_MS)
    }),
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

export function withSqliteFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return raceWithTimeout(promise.catch(() => fallback), ({ resolve }) => {
    resolve(fallback)
  })
}

// 쓰기(upsertBossProfitRecord·markPeriodChecked)는 `withSqliteFallback` 처럼 타임아웃을 성공으로
// 위장하면 안 된다. 실제로는 저장되지 않았는데 markPeriodChecked 까지 호출되면 그 기간이
// 영구히 확인 완료, 기록 없음 으로 잘못 캐시된다. 대신 타임아웃을 실패로 전파해 재시도 가능한
// 실패로 처리하게 한다.
export function withSqliteTimeout<T>(promise: Promise<T>): Promise<T> {
  return raceWithTimeout(promise, ({ reject }) => {
    reject(new Error('SQLite 응답 시간 초과'))
  })
}
