# 서버

앱이 부르는 우리 서버(`https://mapleroutine.store`)를 앱 쪽에서 정리한다. 어느 경로를 부르고, 무엇을 싣고, 무엇을
받는지와 실패하면 어떻게 하는지를 적는다. 서버를 어디에 어떤 구조로 두었는지는 [[ADR-016]], 서버가 사용자를 어떻게
구분하는지는 [[ADR-017]], 기록을 서버에 두고 기기끼리 맞추는 일은 [[ADR-099]], 게임 데이터 표는 [[ADR-020]] 에 이유가 있다.

서버 코드는 별도 저장소 `maple-routine-server` 에 있다. 요청과 응답의 형식은 두 저장소에 따로 정의되어 있으므로, 칸을
더하거나 바꿀 때는 양쪽을 함께 고친다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `server/notices.ts` | 공지 목록 · 공지 하나 조회 |
| `server/settlement.ts` | 넥슨 결산 중인지 조회 |
| `server/manual-completion.ts` | 직접 완료를 열어 둔 보스 조회 |
| `server/game-data.ts` | 게임 데이터 열세 칸 조회 |
| `server/account-deletion.ts` | 계정 삭제 예약 · 예약 확인 · 취소 |
| `server/nexon-auth.ts` | 넥슨 로그인 시작 · 세션 받기 · 세션 거두기 |
| `server/friends-stream.ts` | 로그인 사용자의 프렌즈 조회 스트림 |
| `server/accounts.ts` | 메이플 ID 알리기 · 부계정 등록과 해제 |
| `server/usage-events.ts` · `server/enhancement-anomalies.ts` | 사용 로그 · 강화 합계에서 빠진 줄 보내기 |
| `server/write.ts` | 쓰기 호출의 공용 부분. 결과를 `sent` · `no-response` · `rejected` 로 나눈다 |
| `server/error-codes.ts` | 서버가 거절할 때 주는 `code` 목록. 서버 `common/error-codes.ts` 와 같다 |
| `features/auth/server-identity.ts` | 쓰기 요청에 싣는 신원 헤더 |
| `lib/crypto/nexon-id-hash.ts` | 넥슨 식별자(메이플 ID · ocid)의 SHA-256. 서버에는 원문 대신 이 값을 보낸다 |
| `lib/crypto/api-key-hash.ts` | API 키의 SHA-256. 서버에는 보내지 않고, 기기가 서버에 등록한 부계정 키를 적을 때 쓴다 |

`features/*` 는 서버를 직접 부르지 않고 이 어댑터를 거친다.

## 앱이 부르는 경로

| 경로 | 신원 | 보내는 것 | 받는 것 | 기다리는 시간 |
|---|---|---|---|---|
| `GET /v1/notices?limit=&kind=` | 없음 | 개수 · 분류 | 공지 목록 | 8초 |
| `GET /v1/notices/:id` | 없음 | | 공지 하나 | 8초 |
| `GET /v1/settlement` | 없음 | | `{ settling, startedAt }` | 4초 |
| `GET /v1/manual-completion` | 없음 | | `{ bosses: [{ boss, from }] }` | 4초 |
| `GET /v1/game-data` | 없음 | | 열세 칸. 칸마다 `updatedAt` | 4초 |
| `GET /v1/maintenance` | 없음 | | 점검 중이면 200 과 `{ maintenance: true, until }`, 아니면 204. 서버가 아니라 nginx 가 답한다([[ADR-261]] 결정 3) | 4초 |
| `DELETE /v1/me` | 세션 또는 메이플 ID 해시 | | 204 | 10초 |
| `PUT /v1/me/maple-ids` | 세션 또는 메이플 ID 해시 | `{ mapleIds }`. 메인 계정의 메이플 ID 해시 | `{ mapleIds }`. 그 넥슨 계정이 가진 메이플 ID 해시 전부 | 10초 |
| `POST /v1/me/sub-accounts` | 세션 | `{ mapleIds }`. 부계정의 메이플 ID 해시 | 204. 거절은 409 와 `code`(`same_account` · `registered_elsewhere` · `has_sub_accounts` · `login_is_sub_account`) | 10초 |
| `DELETE /v1/me/sub-accounts` | 세션 | `{ mapleIds }` | 204. 등록이 없어도 204 | 10초 |
| `POST /v1/usage-events` | 세션 또는 메이플 ID 해시 | 사용 로그 묶음 | `{ ok: true }` | 10초 |
| `POST /v1/enhancement-anomalies` | 세션 또는 메이플 ID 해시 | `{ items }` | `{ ok: true }` | 10초 |
| `POST /v1/sync/push` | 세션 또는 메이플 ID 해시 | `{ records: [{ table, action, row }] }`. 100건 · 256KB 까지 | `{ results }`. 기록마다 받았으면 `{ ok: true, id }`, 거절이면 `{ ok: false, code, reason }` | 10초 |
| `POST /v1/auth/nexon/login` | 없음 | `{ platform }` | `{ authorizeUrl, redeemKey }` | 15초 |
| `POST /v1/auth/nexon/session` | 없음 | `{ redeemKey, receipt }` | `{ status: 'ok', session }` · `{ status: 'pending' }` · 404 | 15초 |
| `DELETE /v1/auth/nexon/session` | 세션 | | | 15초 |
| `POST /v1/friends/stream` | 세션 | `{ tasks: [{ kind, date?, ocid? }] }` | gzip NDJSON 줄. 상한을 넘으면 503 · 세션이 죽었으면 401 | 130초 |

쓰기 요청의 신원은 넥슨으로 로그인한 사용자는 세션, API 키 사용자는 메인 키의 메이플 ID 해시다. 1.0.15 서버는 키 해시를 받지
않는다. 키 사용자가 로그인하면 앱은 같은 메이플 ID 의 키를 서버에 알리지 않고 기기에서 거둔다. 로그인 세션으로 메이플 ID 를
알릴 때 서버가 같은 메이플 ID 의 넥슨 계정 줄을 로그인 줄로 합친다([[ADR-017]] 결정 9, [[ADR-101]] 결정 25).

1.0.15 서버에는 기기 간 동기화의 받기 · 올리기 · 데이터 삭제 경로(`POST /v1/sync/pull` · `/v1/sync/push` · `/v1/sync/clear`)가 있다.
앱은 지금 올리기만 부른다(`foundation/server-sync.md` 의 `올리기`). 요청과 응답의 모양은 [[ADR-099]] 결정 66 에 있다.

## 신원 헤더

쓰기 요청과 계정 경로에만 싣는다. 조회는 공개 정보라 싣지 않는다. 받는 경로와 자세한 규칙은 [[ADR-017]] 결정 5 에 있다.

| 경우 | 싣는 헤더 |
|---|---|
| 넥슨 로그인 세션이 있다 | `Authorization: Bearer <세션>` 하나 |
| 키만 있다 | `x-maple-id-hash: <메이플 ID 의 SHA-256, 소문자 16진 64자>` 하나. 메이플 ID 는 메인 키의 넥슨 계정에서 본 것(`character_accounts`) 가운데 정렬해 맨 앞의 것이다. 본 메이플 ID 가 없으면 보내지 않는다. 부계정 키로는 밝히지 않는다 |
| 둘 다 없다 | 보내지 않는다(`serverIdentityHeaders` 가 `null`) |

API 키 원문은 서버로 가지 않는다.

## 실패하면

| 어댑터 | 실패했을 때 |
|---|---|
| 점검 상태 조회 | 점검 중 · 점검 아님 · 모름 셋으로 나눈다. 응답이 없거나 5xx 거나 JSON 이 아닌 200 이면 모름이고, 모르면 지금 상태를 둔다([[ADR-261]] 결정 5) |
| 공지 · 결산 · 직접 완료 · 게임 데이터 조회 | 실패가 어떤 형태든 `null` 하나를 돌려준다. 화면은 기기 사본이나 번들을 그대로 쓴다. 결산 여부를 모르면 결산 중이라고 표시하지 않고, 직접 완료 대상을 모르면 버튼을 보여 주지 않는다 |
| 계정 삭제 · 사용 로그 · 강화 합계에서 빠진 줄 · 부계정 해제 · 데이터 삭제 | `sent` · `no-response`(응답이 안 왔다) · `rejected`(응답이 왔고 거절) 셋으로 나눈다. 대기 표는 응답이 온 시도만 센다([[ADR-099]] 결정 10) |
| 메이플 ID 알리기 · 부계정 등록 | 본문까지 읽는다. 알리기는 서버가 돌려준 목록을, 등록은 409 의 `code` 를 `server/error-codes.ts` 의 목록으로 가려 돌려준다. 응답이 없거나 그 밖의 거절은 실패다 |
| 넥슨 로그인 시작 · 세션 받기 | 예외를 던진다. 로그인 화면에 실패를 보여 준다 |
| 세션 거두기 | 예외를 던지지 않는다. 로그아웃은 기기에서 지우는 일이 먼저이기 때문이다 |
| 프렌즈 스트림 | 서버가 거절하면 `FriendsStreamRejected(status)`, 닿지 못하면 `fetch` 의 실패를 그대로 던진다. 부르는 쪽(`nexon/http.ts`)이 넥슨 에러로 바꾼다 |

조회 어댑터는 응답의 형식을 검사하고, 어긴 줄이나 칸만 버린다. 서버가 계약을 어겨도 빈 칸이 화면까지 가지 않게 하기
위해서다.

## 서버 쪽에서 실행되는 작업

앱이 부르지 않지만 앱이 받는 값을 만드는 일이다.

| 일 | 주기 | 앱에서 보이는 곳 |
|---|---|---|
| 넥슨 공지 폴링 · FCM 공지 발송 · 예약 발송 | 1분 | 공지 목록 · 공지 푸시 |
| 결산 감시 | KST 00:00:01 ~ 06:00:01 에 10분마다([[ADR-016]] 결정 11) | `GET /v1/settlement` |
| 로그인 짝 · 고아 세션 · 만료 세션 청소 | 1분 | 없음 |

운영자는 관리 화면(`https://admin.mapleroutine.store/admin`, nginx basic auth)에서 공지 · 직접 완료 보스 · 게임 데이터 표를 고치고 드롭 가격을 본다.
공지는 마크다운으로 쓰고 그림을 올려 넣으며, 서버가 저장할 때 앱이 그리는 블록으로 바꾼다([[ADR-057]] 결정 13).
사용자 수와 사용 로그는 `로그` 묶음의 `사용자` · `사용 로그` 대시보드에서 본다([[ADR-158]]). 관리 화면도 앱처럼 테두리와
구분선을 쓰지 않는다([[ADR-016]] 결정 13).
드롭 시세는 장비는 거래권마다, 소비 아이템은 월드마다 `/admin/drop-market` 에서 본다. 관리 화면은 줄마다 하루 작업이 남긴 그날 울타리와 비교해 잘못 적은 값을 뺀다.
일일 기준가와 드롭 시세 지수 MASPI 는 하루 작업(KST 00:05)이 사람마다 하루 한 표로 계산해 남기고, 앱에 줄 응답을 만들어 저장한다.
앱은 `GET /v1/market/maspi` · `/v1/market/items?world=` · `/v1/market/items/{itemKey}?ring=&world=` 로 그 응답을 그대로 받는다(ETag · 304).
처음 채우기는 2026-11-16 에 `node dist/cli/market-backfill.js` 로 한 번 했다([[ADR-071]]).
왼쪽 메뉴는 공지 · 게임데이터(보스 · 가계부 · 기타) · 로그 · 임시 기능으로 묶여 있고, 묶음마다 접고 펼 수 있다.
지금 보는 화면이 든 묶음만 펼친 채로 열린다. 화면이 열일곱이라 다 펼쳐 두면 찾기 어렵기 때문이다.
홈 화면의 카드도 같은 묶음 제목 아래 나뉘어 있다.
`GET /healthz` 는 서버 상태 확인용이다.
