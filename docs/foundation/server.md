# 서버

앱이 부르는 우리 서버(`https://mapleroutine.store`)를 앱 쪽에서 정리한다. 어느 경로를 부르고, 무엇을 싣고, 무엇을
받는지와 실패하면 어떻게 하는지를 적는다. 서버를 어디에 어떤 구조로 두었는지는 [[ADR-016]], 서버가 사용자를 어떻게
구분하는지는 [[ADR-017]], 드롭 가격 전송은 [[ADR-018]], 게임 데이터 표는 [[ADR-020]] 에 이유가 있다.

서버 코드는 별도 저장소 `maple-routine-server` 에 있다. 요청과 응답의 형식은 두 저장소에 따로 정의되어 있으므로, 칸을
더하거나 바꿀 때는 양쪽을 함께 고친다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `server/notices.ts` | 공지 목록 · 공지 하나 조회 |
| `server/settlement.ts` | 넥슨 결산 중인지 조회 |
| `server/manual-completion.ts` | 직접 완료를 열어 둔 보스 조회 |
| `server/game-data.ts` | 게임 데이터 열세 칸 조회 |
| `server/drop-price.ts` | 드롭 가격 올리기 · 지우기 · 탈퇴 알림 |
| `server/nexon-auth.ts` | 넥슨 로그인 시작 · 세션 받기 · 연결 해제 |
| `server/friends-stream.ts` | 로그인 사용자의 프렌즈 조회 스트림 |
| `features/auth/server-identity.ts` | 쓰기 요청에 싣는 신원 헤더 |
| `lib/crypto/api-key-hash.ts` | API 키의 SHA-256 |

`features/*` 는 서버를 직접 부르지 않고 이 어댑터를 거친다.

## 앱이 부르는 경로

| 경로 | 신원 | 보내는 것 | 받는 것 | 기다리는 시간 |
|---|---|---|---|---|
| `GET /v1/notices?limit=&kind=` | 없음 | 개수 · 분류 | 공지 목록 | 8초 |
| `GET /v1/notices/:id` | 없음 | | 공지 하나 | 8초 |
| `GET /v1/settlement` | 없음 | | `{ settling, startedAt }` | 4초 |
| `GET /v1/manual-completion` | 없음 | | `{ bosses: [{ boss, from }] }` | 4초 |
| `GET /v1/game-data` | 없음 | | 열세 칸. 칸마다 `updatedAt` | 4초 |
| `POST /v1/drop-prices` | 세션 또는 키 해시 | 드롭 가격 한 건 | `{ ok: true }` | 10초 |
| `DELETE /v1/drop-prices/:dropRecordId` | 세션 또는 키 해시 | | 204 | 10초 |
| `DELETE /v1/me` | 세션 또는 키 해시 | | 204 | 10초 |
| `POST /v1/auth/nexon/login` | 없음 | `{ platform }` | `{ authorizeUrl, redeemKey }` | 15초 |
| `POST /v1/auth/nexon/session` | 없음 | `{ redeemKey, receipt }` | `{ status: 'ok', session }` · `{ status: 'pending' }` · 404 | 15초 |
| `DELETE /v1/auth/nexon/session` | 세션 | | | 15초 |
| `POST /v1/friends/stream` | 세션 | `{ tasks: [{ kind, date?, ocid? }] }` | gzip NDJSON 줄. 상한을 넘으면 503 · 세션이 죽었으면 401 | 130초 |

넥슨 로그인은 앱에서 아직 꺼져 있다(`NEXON_LOGIN_ENABLED = false`). 그래서 지금 실제로 나가는 쓰기 요청의 신원은 모두
키 해시다.

## 신원 헤더

쓰기 요청 셋(`POST /v1/drop-prices` · `DELETE /v1/drop-prices/:id` · `DELETE /v1/me`)에만 싣는다. 조회는 공개 정보라 싣지
않는다. 자세한 규칙은 [[ADR-017]] 결정 5 에 있다.

| 경우 | 싣는 헤더 |
|---|---|
| 넥슨 로그인 세션이 있다 | `Authorization: Bearer <세션>` 하나 |
| 키만 있다 | `x-api-key-hash: <첫 키의 SHA-256, 소문자 16진 64자>` 하나 |
| 둘 다 없다 | 보내지 않는다(`serverIdentityHeaders` 가 `null`) |

API 키 원문은 서버로 가지 않는다.

## 실패하면

| 어댑터 | 실패했을 때 |
|---|---|
| 공지 · 결산 · 직접 완료 · 게임 데이터 조회 | 실패가 어떤 형태든 `null` 하나를 돌려준다. 화면은 기기 사본이나 번들을 그대로 쓴다. 결산 여부를 모르면 결산 중이라고 표시하지 않고, 직접 완료 대상을 모르면 버튼을 보여 주지 않는다 |
| 드롭 가격 · 탈퇴 | `sent` · `no-response`(응답이 안 왔다) · `rejected`(응답이 왔고 거절) 셋으로 나눈다. 대기 표가 응답이 온 시도만 센다([[ADR-018]] 결정 8) |
| 넥슨 로그인 시작 · 세션 받기 | 예외를 던진다. 로그인 화면에 실패를 보여 준다 |
| 연결 해제 | 예외를 던지지 않는다. 기기에서 지우는 일이 먼저이기 때문이다 |
| 프렌즈 스트림 | 서버가 거절하면 `FriendsStreamRejected(status)`, 닿지 못하면 `fetch` 의 실패를 그대로 던진다. 부르는 쪽(`nexon/http.ts`)이 넥슨 에러로 바꾼다 |

조회 어댑터는 응답의 형식을 검사하고, 어긴 줄이나 칸만 버린다. 서버가 계약을 어겨도 빈 칸이 화면까지 가지 않게 하기
위해서다.

## 서버 쪽에서 실행되는 작업

앱이 부르지 않지만 앱이 받는 값을 만드는 일이다.

| 일 | 주기 | 앱에서 보이는 곳 |
|---|---|---|
| 넥슨 공지 폴링 · FCM 공지 발송 · 예약 발송 | 1분 | 공지 목록 · 공지 푸시 |
| 결산 감시 | KST 0시 ~ 6시 사이 10분마다 | `GET /v1/settlement` |
| 로그인 짝 · 고아 세션 · 만료 세션 청소 | 1분 | 없음 |

운영자는 `/admin` 관리 화면(nginx basic auth)에서 공지 · 직접 완료 보스 · 게임 데이터 표를 고치고 드롭 가격을 본다.
왼쪽 메뉴는 공지 · 게임데이터(보스 · 가계부 · 기타) · 로그 · 임시 기능으로 묶여 있고, 묶음마다 접고 펼 수 있다.
지금 보는 화면이 든 묶음만 펼친 채로 열린다. 화면이 열일곱이라 다 펼쳐 두면 찾기 어렵기 때문이다.
홈 화면의 카드도 같은 묶음 제목 아래 나뉘어 있다.
`GET /healthz` 는 서버 상태 확인용이다.
