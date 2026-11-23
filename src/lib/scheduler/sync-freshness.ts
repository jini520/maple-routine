/**
 * 스케줄 회차가 신선한 시간. 게임 안에서 한 사이클(보스 하나, 일일 몇 개)을 도는 시간보다 짧아 방금 한 것이 안 보이는
 * 시간이 길지 않고, 탭을 오가는 동선(수 초~수 분)은 전부 이 안에 든다. 회차가 서버 기록도 함께 받아, 켜 놓고 쓰는 두 기기가
 * 어긋나 있는 시간도 이 값이다.
 *
 * 사용자가 직접 쓰면서 조정하는 값이다. 여기서 한 번만 정의하고 어디서도 다시 적지 않는다. 쓰는 곳은
 * `features/query/freshness.ts` 의 `scheduleStaleTime` 이다. `character/basic` 의 가드(`CHARACTER_BASIC_TTL_MS`)보다 짧으면 안 된다.
 */
export const SYNC_TTL_MS = 5 * 60 * 1000
