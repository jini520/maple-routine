# 서버 전송

앱이 기기 기록에서 뽑아 서버로 올리는 값을 정리한다. 지금 올리는 것은 넷이다. 드롭 가격, 보스 처치 기간, 가계부 기록, 강화 합계다.
기기가 기준이고 서버는 사본이다. 서버는 이 값으로 여러 사용자의 통계를 낸다. 드롭 가격의 규칙은 [[ADR-018]] 에, 처치 ·
가계부와 과거 올리기는 [[ADR-099]] 에, 강화 합계는 [[ADR-100]] 결정 7 에, 누구의 값으로 받는지는 [[ADR-017]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `features/server-sync/drop-price-sync.ts` | 드롭 가격 종류. 보낼 값 만들기(`dropPricePayloadOf`) · 저장할 때의 전송(`reportDropPrice` · `reportDropRemoved`) |
| `features/server-sync/boss-clear-sync.ts` | 보스 처치 종류. 보낼 값 만들기(`bossClearPayloadOf`) · 대기 표에 넣기 |
| `features/server-sync/cashbook-entry-sync.ts` | 가계부 기록 종류. 보낼 값 만들기(`cashbookEntryPayloadOf`) · 대기 표에 넣기 |
| `features/server-sync/enhancement-total-sync.ts` | 강화 합계 종류. 보낼 값 만들기(`enhancementTotalPayloadOf`) · 대기 표에 넣기 |
| `features/server-sync/report.ts` | 기록을 쓴 자리가 부르는 곳. 대기 표에 넣고 전송을 깨운다 |
| `features/server-sync/kick.ts` | 전송을 깨운다. 한 번에 한 회차만 돈다 |
| `features/server-sync/run.ts` | 한 회차. 대기 표를 비운 뒤 과거 올리기를 잇는다(`runServerSync`) |
| `features/server-sync/sweep.ts` | 대기 표를 훑어 보내는 처리. 종류는 구분하지 않는다 |
| `features/server-sync/backfill.ts` | 업데이트 전 기록을 100 건씩 묶어 올린다(`runBackfill`) |
| `features/server-sync/registry.ts` | 종류마다 함수 둘(`read` · `send`)을 모은 표 |
| `features/server-sync/forget.ts` | 연결 해제 때 서버에 탈퇴를 알리고 대기 표를 비운다 |
| `features/auth/server-identity.ts` | 신원 헤더와 메인 넥슨 계정 id 헤더 |
| `storage/server-sync-queue.ts` | 보낼 것을 담는 대기 표(SQLite `server_sync_queue`) |
| `storage/server-sync-sources.ts` | 보낼 기록을 서버 칸 그대로 읽는다. 과거 올리기가 id 차례로 나눠 읽는다 |
| `storage/server-backfill.ts` | 과거 올리기를 어디까지 했는지(Preferences `serverBackfill`) |
| `server/write.ts` | 쓰기 호출. 결과를 `sent` · `no-response` · `rejected` 로 나누고, 묶음은 건마다 결과를 돌려준다 |
| `server/drop-price.ts` · `server/records.ts` | 종류마다의 서버 경로 |
| `types/drop-price.ts` · `types/server-records.ts` | 보내는 한 건의 형식 |
| `app/AppShell.tsx` | 준비가 끝나면 전송을 깨운다 |

## 언제 보내나

| 사용자 동작 · 앱 일 | 보내는 것 |
|---|---|
| 드롭 시트 저장 · 가격 저장 · 난이도 확정 | 그 드롭을 그 자리에서 한 건씩 올린다. 사라진 드롭은 지우기를 보낸다 |
| 보스 처치가 생기거나 바뀜(동기화 · 직접 완료 · 처치 날짜 채우기 · 월드 채우기 · 월드 리프 정리 · 분배 수수료 다시 매기기) | 바뀐 기간 행을 대기 표에 넣고 전송을 깨운다 |
| 처치가 사라짐(직접 완료 취소 · 난이도를 고친 옛 줄 · 리프한 옛 기록) | 지운 뒤 대기 표에 넣는다. 전송이 처치를 못 찾아 지우기를 보낸다 |
| 가계부 기록 저장 · 고치기 · 지우기 · 판매 수수료 다시 매기기 | 그 기록을 대기 표에 넣고 전송을 깨운다 |
| 강화 내역을 받아 그 날의 합계를 갈아 끼움 | 적은 줄과 지운 줄을 대기 표에 넣고 전송을 깨운다 |
| 앱을 켬 | 대기 표에 남은 것을 보내고, 끝나지 않은 과거 올리기를 잇는다 |
| 연결 해제 | 서버에 탈퇴를 알리고 대기 표를 비운다 |

- 기기 저장이 끝난 뒤에 보내고, 결과를 기다리지 않고, 실패해도 사용자에게 알리지 않는다. 설정에서 전송을 끌 수는 없다.
- 처치 · 가계부 · 강화 합계는 바로 보내지 않고 대기 표를 거친다. 분배 수수료를 다시 매기면 수백 건이 한꺼번에 바뀌어, 건마다 요청을
  내면 몰린다. 전송은 한 번에 한 회차만 돈다. 두 회차가 겹치면 같은 줄을 두 번 보낸다.
- 지우는 자리는 지우기 **전에** 기간 행 id 를 얻고 지운 **뒤에** 대기 표에 넣는다(`bossPeriodIdsOf`). 먼저 넣으면 전송이
  지우기보다 앞서 돌아 남아 있는 처치를 서버에 다시 적는다.
- 쓰기 요청마다 `x-nexon-account-id` 에 메인 넥슨 계정 id 를 싣는다. 서버가 그 신원의 계정 줄에 적는다.

## 과거 올리기

업데이트 전에 기기에 쌓인 기록은 처치 · 드롭 · 가계부 · 강화 합계 차례로 100 건씩 묶어 올린다(`POST …/batch`). 드롭이 처치 기간 id
를 가리키므로 처치가 먼저다.

- 종류마다 마지막으로 보낸 id 를 Preferences 에 적는다. 앱이 꺼져도 다음 회차가 그 뒤부터 잇는다. 100 건보다 적게 읽히면
  그 종류를 끝으로 적고 다시 훑지 않는다.
- 묶음이 실패하면(응답 없음 · 거절) 그 회차를 멈추고 자리를 넘기지 않는다.
- 서버는 건마다 결과를 돌려준다. 받지 못한 건만 평소 대기 표에 넣어 한 건씩 다섯 번 다시 보낸다.
- 캐시 삭제로 진행이 지워지면 처음부터 다시 올린다. 서버가 기록 id 로 덮으므로 줄이 늘지 않는다.

## 보내는 값

드롭 가격(`DropPricePayload`)

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
| `periodRecordId` | 드롭이 붙은 기간 행 id |

보스 처치(`BossClearPayload`): 기간 행 id(`periodRecordId`) · ocid · 보스 · 난이도 · 주기 · 기간 · 월드 · 결정석 가격 ·
받은 몫 · 분배 방식 · 인원 · 내 몫 · 비율 합 · 분배 수수료 · 처치 날짜 · 출처(`auto` · `manual`).

가계부 기록(`CashbookEntryPayload`): 기록 id(`entryRecordId`) · ocid · 캐릭터 없는 기록만 넥슨 계정 id(`accountRecordId`) ·
수입 · 지출 · 갈래 · 날짜 · 품목들(기기 품목 칸과 같은 이름, 자동 수수료 표시는 빼고).

강화 합계(`EnhancementTotalPayload`): 합계 id(`totalRecordId`) · 넥슨 계정 id(`accountRecordId`) · 캐릭터 이름 · 날짜 ·
분류 · 장비 key · 장비 이름 · 횟수 · 시도 비용 · 파괴 방지 비용. 비용은 MVP 할인 전이다. 이벤트 월드 줄과 판정하지 못한 줄은
보내지 않고, 대기 표에서 읽을 때 그런 줄이면 지우기를 보낸다. 서버는 여러 사용자의 지출 통계를 내는데, 이벤트 월드 지출이
섞이거나 사람마다 다른 MVP 할인이 붙으면 통계가 틀리기 때문이다.

보내지 않는 것: 드롭의 분배 인원 · 비율 · 수수료, 사냥 계산기 입력, 강화의 MVP 할인. 캐릭터 이름은 강화 합계에만 싣는다. 강화 응답이 캐릭터를 이름으로만 주기 때문이다. 가계부 메모 칸은 없앴다([[ADR-099]] 결정 15).

## 못 보냈을 때

대기 표(`server_sync_queue`)에는 `record_id` 만 남는다. 전송이 원본의 지금 값을 읽어 보낸다. 원본이 없거나 처치가 아니게
됐으면 지우기를 보낸다.

| 결과 | 대기 표 |
|---|---|
| 보냈다 | 줄을 지운다 |
| 응답이 안 왔다 | 그대로 둔다. 횟수를 안 센다 |
| 응답이 왔고 거절이다 | 횟수를 센다. 다섯 번째면 줄을 버린다 |
| 신원이 없다 | 그 회차를 건너뛴다 |

## 종류를 더할 때

1. `registry.ts` 의 `SyncRecordType` 에 이름을 더한다.
2. `SYNC_HANDLERS` 에 한 줄을 더한다.
3. 그 종류의 파일에 `read` · `send` 와 대기 표에 넣는 함수를 만든다. `read` 가 `null` 을 돌려주면 서버에서 지운다.
4. 대기 표에 줄을 넣는 코드는 `features/server-sync/` 안에만 둔다. `registry.spec.ts` 가 넣는 이름이 모두 레지스트리에
   있는지 본다. 종류 파일은 `kick` 을 가져오지 않는다. `kick → run → registry → 종류` 로 순환해 registry 가 빈 함수를
   표에 넣는다. 전송을 깨우는 일은 `report.ts` 가 한다.
5. 과거 올리기가 필요하면 `backfill.ts` 의 `BACKFILL_KINDS` 와 `server-sync-sources.ts` 의 목록 조건에 더한다.
