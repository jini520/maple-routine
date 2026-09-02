// SQLite 조회의 **복원력 래퍼**(ADR-094 결정 7로 store.ts 에서 분리).
//
// 이 둘은 store.ts 안에서 6개 함수가 함께 쓰던 리프였다. 백필·드롭·행 빌드를 각각 모듈로
// 가르려면 이것이 먼저 나와야 한다 — 안 그러면 각 모듈이 store.ts 를 가리켜 순환이 생긴다.

// 리로드(OTA 적용·디버그 데이터 초기화 등)로 dbPromise는 초기화됐지만 네이티브 SQLite 커넥션은
// stale하게 남아있는 경우, openBossProfitDb의 "닫고 새로 생성" 보정만으로는 그 직후 첫 쿼리가
// 막히는 사례가 실기기에서 재현됐다(2026-07-17 — 데이터 초기화 → 보스 스케줄러 저장 직후 보스
// 수익 화면이 "불러오는 중..."에서 영영 멈춤). refresh()뿐 아니라 loadPeriod()(기간 이동)도 같은
// SQLite 조회에 의존하는데, 여기서 멈추면 periodKey 라벨만 바뀌고 rows는 갱신되지 않아 이전 기간
// 숫자가 그대로 남는(에러도 로딩 표시도 없는) 증상으로 나타난다(2026-07-17 재현). SQLite 의존 호출을
// 타임아웃과 경쟁시켜 지연/실패 시 fallback으로 진행한다 — 기록이 안 남았을 뿐이므로 다음
// 새로고침/재방문에서 정상 커넥션으로 재시도된다.
const SQLITE_QUERY_TIMEOUT_MS = 5000

// **경주가 끝나면 타이머를 반드시 끈다.** 안 끄면 쿼리가 이겨도 5초짜리 `setTimeout` 이 그대로
// 남는다 — 조회 한 번에 하나씩 쌓이고, 테스트에서는 jest 가 *"did not exit"* 로 멈춰 서 있다가
// 워커 정리와 겹쳐 `SIGSEGV` 까지 갔다(— 러너를 합치며 드러났다).
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

// upsertBossProfitRecord/markPeriodChecked(쓰기)는 withSqliteFallback처럼 타임아웃을 "성공"으로
// 위장하면 안 된다 — 실제로는 저장되지 않았는데 markPeriodChecked까지 호출되면 그 기간이 영구히
// "확인 완료, 기록 없음"으로 잘못 캐시돼 다시는 재시도되지 않는다. 대신 타임아웃을 실패로 전파해
// backfillTarget의 기존 catch가 재시도 가능한 실패(periodUnavailable)로 처리하게 한다.
export function withSqliteTimeout<T>(promise: Promise<T>): Promise<T> {
  return raceWithTimeout(promise, ({ reject }) => {
    reject(new Error('SQLite 응답 시간 초과'))
  })
}
