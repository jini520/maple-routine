# 서버 전송

앱이 기기 기록에서 뽑아 서버로 올리는 값을 정리한다. 지금 올리는 기록은 드롭 가격 하나다. 그 밖에 강화 합계에서 빠진 줄의 상황을 알린다([[ADR-102]]).
기기가 기준이고 서버는 사본이다. 서버는 이 값으로 여러 사용자의 통계를 낸다. 드롭 가격의 규칙은 [[ADR-018]] 에, 보내는
기록의 범위와 과거 올리기는 [[ADR-099]] 에, 누구의 값으로 받는지는 [[ADR-017]] 에 있다.

보스 처치 · 가계부 기록 · 강화 합계는 보내지 않는다. 서버는 API 키의 해시로 사람을 정하는데 기록 id 는 기기마다 따로 만들어,
여러 기기에서 같은 처치 · 지출이 기기 수만큼 쌓였기 때문이다([[ADR-099]] 결정 1). 서버에 남은 그 세 표와 경로는 그대로 둔다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `features/server-sync/drop-price-sync.ts` | 드롭 가격 종류. 보낼 값 만들기(`dropPricePayloadOf`) · 저장할 때의 전송(`reportDropPrice` · `reportDropRemoved`) |
| `features/server-sync/kick.ts` | 전송을 깨운다. 한 번에 한 회차만 돈다 |
| `features/server-sync/run.ts` | 한 회차. 대기 표를 비운 뒤 과거 올리기를 잇는다(`runServerSync`) |
| `features/server-sync/sweep.ts` | 대기 표를 훑어 보내는 처리. 종류는 구분하지 않고, 레지스트리에 없는 종류의 줄은 지운다 |
| `features/server-sync/backfill.ts` | 업데이트 전 드롭을 100 건씩 묶어 올린다(`runBackfill`) |
| `features/server-sync/registry.ts` | 종류마다 함수 둘(`read` · `send`)을 모은 표 |
| `features/server-sync/forget.ts` | 연결 해제 때 서버에 탈퇴를 알리고 대기 표를 비운다 |
| `features/auth/server-identity.ts` | 신원 헤더와 메인 넥슨 계정 id 헤더 |
| `storage/server-sync-queue.ts` | 보낼 것을 담는 대기 표(SQLite `server_sync_queue`) |
| `storage/server-sync-sources.ts` | 드롭이 붙은 기간 행 id 를 읽는다. 과거 올리기가 id 차례로 나눠 읽는다 |
| `storage/server-backfill.ts` | 과거 올리기를 어디까지 했는지(Preferences `serverBackfill`) |
| `server/write.ts` | 쓰기 호출. 결과를 `sent` · `no-response` · `rejected` 로 나누고, 묶음은 건마다 결과를 돌려준다 |
| `server/drop-price.ts` | 드롭 가격의 서버 경로 |
| `types/drop-price.ts` | 보내는 한 건의 형식 |
| `app/AppShell.tsx` | 준비가 끝나면 전송을 깨운다 |

## 언제 보내나

| 사용자 동작 · 앱 일 | 보내는 것 |
|---|---|
| 드롭 시트 저장 · 가격 저장 · 난이도 확정 | 그 드롭을 그 자리에서 한 건씩 올린다. 사라진 드롭은 지우기를 보낸다 |
| 앱을 켬 | 대기 표에 남은 것을 보내고, 끝나지 않은 과거 올리기를 잇는다 |
| 연결 해제 | 서버에 탈퇴를 알리고 대기 표를 비운다 |

- 기기 저장이 끝난 뒤에 보내고, 결과를 기다리지 않고, 실패해도 사용자에게 알리지 않는다. 설정에서 전송을 끌 수는 없다.
- 대기 표 전송은 한 번에 한 회차만 돈다(`kick.ts`). 두 회차가 겹치면 같은 줄을 두 번 보낸다.
- 쓰기 요청마다 `x-nexon-account-id` 에 메인 넥슨 계정 id 를 싣는다. 서버가 그 신원의 계정 줄에 적는다.

## 과거 올리기

업데이트 전에 기기에 쌓인 드롭은 100 건씩 묶어 올린다(`POST /v1/drop-prices/batch`).

- 마지막으로 보낸 id 를 Preferences 에 적는다. 앱이 꺼져도 다음 회차가 그 뒤부터 잇는다. 100 건보다 적게 읽히면
  끝으로 적고 다시 훑지 않는다.
- 묶음이 실패하면(응답 없음 · 거절) 그 회차를 멈추고 자리를 넘기지 않는다.
- 서버는 건마다 결과를 돌려준다. 받지 못한 건만 평소 대기 표에 넣어 한 건씩 다섯 번 다시 보낸다.

## 보내는 값

드롭 가격(`DropPricePayload`)

| 칸 | 값 |
|---|---|
| `dropRecordId` | 드롭 기록의 uuid |
| `itemKey` | 아이템 key. 없는 옛 기록은 보내지 않는다 |
| `status` | 가격이 있으면 `completed`, 기록 안함이면 `skipped`, 그 밖에는 `pending` |
| `priceMeso` | 판매 총액. `completed` 일 때만 값이 있다 |
| `pricedAt` | 거래 시각. 기기가 판매가를 적은 시각이고 `completed` 일 때만 값이 있다. 과거 올리기가 올린 날을 거래 날짜로 잡지 않게 기기 값을 보낸다 |
| `periodKey` | 주간 `YYYY-MM-DD` · 월간 `YYYY-MM` |
| `worldKey` | 기록 시점의 월드 key. 모르면 `null` |
| `ringLevel` | 반지 레벨. 반지가 아니면 `null` |
| `boss` · `difficulty` | 보스 key · 난이도 key |
| `periodRecordId` | 드롭이 붙은 기간 행 id |

드롭의 분배 인원 · 비율 · 수수료는 싣지 않는다. 내 몫을 계산하는 재료이고 시세와는 관계가 없다.

## 강화 합계에서 빠진 줄

수집기가 한 날 · 한 종류를 받을 때마다, 합계에서 빼거나 이벤트 월드를 판정하지 못한 줄을 날짜 · 종류 · 이유 · 장비마다 세어
`POST /v1/enhancement-anomalies` 로 한 번 보낸다(`features/enhancement-history/anomalies.ts`). 기록이 아니라 운영자가 예상하지 못한
상황을 보는 값이라 대기 표를 거치지 않고, 실패하면 버린다. 캐릭터 이름은 싣지 않는다. 이유와 서버 표는 [[ADR-102]] 에 있다.

## 못 보냈을 때

대기 표(`server_sync_queue`)에는 `record_id` 만 남는다. 전송이 원본의 지금 값을 읽어 보낸다. 원본이 없으면 지우기를 보낸다.

| 결과 | 대기 표 |
|---|---|
| 보냈다 | 줄을 지운다 |
| 응답이 안 왔다 | 그대로 둔다. 횟수를 안 센다 |
| 응답이 왔고 거절이다 | 횟수를 센다. 다섯 번째면 줄을 버린다 |
| 신원이 없다 | 그 회차를 건너뛴다 |
| 레지스트리에 없는 종류다 | 원본을 읽지도 보내지도 않고 줄을 지운다. 옛 앱이 넣은 처치 · 가계부 · 강화 합계 줄이 여기에 든다 |

## 종류를 더할 때

1. `registry.ts` 의 `SyncRecordType` 에 이름을 더한다.
2. `SYNC_HANDLERS` 에 한 줄을 더한다.
3. 그 종류의 파일에 `read` · `send` 와 대기 표에 넣는 함수를 만든다. `read` 가 `null` 을 돌려주면 서버에서 지운다.
4. 대기 표에 줄을 넣는 코드는 `features/server-sync/` 안에만 둔다. `registry.spec.ts` 가 넣는 이름이 모두 레지스트리에
   있는지 본다. 종류 파일은 `kick` 을 가져오지 않는다. `kick → run → registry → 종류` 로 순환해 registry 가 빈 함수를
   표에 넣는다.
5. 과거 올리기가 필요하면 `backfill.ts` 의 `BACKFILL_KINDS` 와 `server-sync-sources.ts` 의 목록 조건에 더한다.
