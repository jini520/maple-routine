# 서버 전송

앱이 기기 기록에서 뽑아 서버로 올리는 값을 정리한다. 지금 올리는 것은 드롭 가격 하나다. 서버는 이 값으로 아이템별
시세 추이를 모은다. 왜 이렇게 만들었는지는 [[ADR-018]] 에, 누구의 값으로 받는지는 [[ADR-017]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `features/server-sync/drop-price-sync.ts` | 드롭 가격 종류. 보낼 값 만들기(`dropPricePayloadOf`) · 저장할 때의 전송(`reportDropPrice` · `reportDropRemoved`) · 기준 기간(`SERVER_PRICE_FROM`) |
| `features/server-sync/sweep.ts` | 대기 표를 훑어 다시 보내는 재전송 처리. 종류는 구분하지 않는다 |
| `features/server-sync/registry.ts` | 종류마다 함수 둘(`read` · `send`)을 모은 표 |
| `features/server-sync/run.ts` | 앱을 켤 때 재전송 처리를 한 번 실행한다(`runServerSync`) |
| `features/server-sync/forget.ts` | 연결 해제 때 서버에 탈퇴를 알리고 대기 표를 비운다 |
| `storage/server-sync-queue.ts` | 못 보낸 것만 담는 대기 표(SQLite `server_sync_queue`) |
| `storage/boss-drops.ts` | 드롭 기록. 기존 uuid 를 유지하는 저장(`replaceBossDropRecords`) · 한 건 읽기(`getBossDropRecordById`) |
| `storage/sqlite/uuid.ts` | SQLite 가 uuid 를 만드는 식(`NEW_UUID_SQL`) |
| `server/drop-price.ts` | 서버 호출. 결과를 `sent` · `no-response` · `rejected` 로 나눈다 |
| `types/drop-price.ts` | 보내는 한 건의 형식(`DropPricePayload`) |
| `app/AppShell.tsx` | 준비가 끝나면 `runServerSync` 를 배경으로 띄운다 |

## 언제 보내나

| 사용자 동작 | 보내는 것 |
|---|---|
| 드롭 시트에서 저장 | 저장한 드롭 전부를 올린다. 저장에서 빠진 드롭은 지우기를 보낸다 |
| 가격 화면에서 가격 저장 · 기록 안함 | 그 드롭 하나를 올린다 |
| 처치 난이도 확정 | 새 난이도로 옮긴 드롭을 올린다. 그 난이도에서 얻을 수 없어 지워진 드롭은 지우기를 보낸다 |
| 기록을 불러오다 얻을 수 없는 드롭을 지움 | 지워진 드롭의 지우기를 보낸다 |
| 앱을 켬 | 대기 표에 남은 것을 다시 보낸다 |
| 연결 해제 | 서버에 탈퇴를 알리고 대기 표를 비운다 |

기기 저장이 끝난 뒤에 보내고, 결과를 기다리지 않고, 실패해도 사용자에게 알리지 않는다. 기준 기간(`SERVER_PRICE_FROM`)
앞의 기록은 보내지 않는다. 설정에서 전송을 끌 수는 없다.

## 보내는 값

| 칸 | 값 |
|---|---|
| `dropRecordId` | 드롭 기록의 uuid |
| `itemKey` | 아이템 key. 없는 옛 기록은 보내지 않는다 |
| `status` | 가격이 있으면 `completed`, 기록 안함이면 `skipped`, 그 밖에는 `pending` |
| `priceMeso` | 판매 총액. `completed` 일 때만 값이 있다 |
| `periodKey` | 주간 `YYYY-MM-DD` · 월간 `YYYY-MM` |
| `worldKey` | 기록 시점의 월드 key. 모르면 `null` |
| `ringLevel` | 반지 레벨. 반지가 아니면 `null` |
| `boss` · `difficulty` | 보스 key · 난이도 key |

분배 인원 · 비율 · 수수료는 보내지 않는다.

## 못 보냈을 때

못 보낸 기록은 대기 표(`server_sync_queue`)에 `record_id` 만 남는다. 앱을 켤 때 재전송 처리가 원본의 지금 값을 읽어 다시
보낸다. 원본이 없으면 지우기를 보낸다.

| 결과 | 대기 표 |
|---|---|
| 보냈다 | 줄을 지운다 |
| 응답이 안 왔다 | 그대로 둔다. 횟수를 안 센다 |
| 응답이 왔고 거절이다 | 횟수를 센다. 다섯 번째면 줄을 버린다 |
| 신원이 없다 | 그 회차를 건너뛴다 |

## 종류를 더할 때

1. `registry.ts` 의 `SyncKind` 에 이름을 더한다.
2. `SYNC_HANDLERS` 에 한 줄을 더한다.
3. 그 종류의 파일에 `read` · `send` 를 만든다. `read` 가 `null` 을 돌려주면 서버에서 지운다.
4. 대기 표에 줄을 넣는 코드는 `features/server-sync/` 안에만 둔다. `registry.spec.ts` 가 넣는 이름이 모두 레지스트리에
   있는지 본다.
