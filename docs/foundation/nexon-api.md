# 넥슨 Open API

넥슨 Open API 를 어떻게 부르고, 넥슨이 실제로 어떻게 답하는지 적은 문서다. 언제 · 몇 번 부르는지와 실패를
구분하는 규칙의 이유는 [[ADR-021]] 에 있다. 어느 자격으로 어느 경로를 부르는지는 [[ADR-025]] 에, API 키의 단계를
판정하는 방법은 [[ADR-024]] 에 있다. 아래 사실은 전부 실제 응답으로 확인한 것이다. 넥슨이 동작을 바꾸면
`scripts/probe-nexon-api.mjs` 로 다시 확인한다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `nexon/http.ts` | `requestJson`. 주소 · 헤더 · 10초 타임아웃 · 상태 코드를 에러로 바꾸기. 자격에 따라 넥슨 직접 호출과 서버 스트림을 나눈다 |
| `nexon/errors.ts` | 넥슨 에러 클래스와 무효 키 판정 `isInvalidApiKeyError` |
| `nexon/character/` | `character/list` · `character/basic` 호출과 정규화 |
| `nexon/schedule/` | `scheduler/character-state` 호출과 정규화 |
| `nexon/history/` | 강화 사용 내역(큐브 · 스타포스 · 잠재 · 소울 잠재) |
| `nexon/meso-rate/` | 사냥 계산기의 메소 획득량 |
| `nexon/symbol-levels/` | 심볼 강화 폼의 심볼 레벨 |
| `nexon/notice/` | 넥슨 공지 목록과 상세 |
| `nexon/developer-keys.ts` · `nexon/key-stage.ts` | 번들 개발자 키 교대, API 키 단계 판정 |
| `features/schedule-sync/` | 스케줄 동기화 회차, `character/basic` 5분 가드, 자격 판정, 에러 종류 `toScheduleSyncError`. `schedule-query.ts` 가 회차를 쿼리로 두고 캐릭터 열쇠에 나눠 넣는다 |
| `features/query/` | 쿼리 캐시 · 열쇠 · 신선함(10분 + KST 자정) · 앱 복귀 · 자정 타이머 · 기기 저장 · 표의 판 무효화(`invalidation.ts` · `meta.ts`)([[ADR-142]]) |
| `features/schedule-window/` | 지난 13일을 채우는 창 |
| `features/refresh/pull.ts` | 당겨서 새로고침 하나(`pullRefresh`). 스케줄 회차 → 13일 창 → 오늘 강화 |
| `features/boss-profit/round-record.ts` · `defeat-dates.ts` | 회차가 동기화 뒤에 부르는 자동 기록과 처치 날짜 캐기 |
| `storage/schedule-probe-ledger.ts` | 조회 원장(Preferences `scheduleProbe:{ocid}`) |
| `features/schedule-sync/read-schedule.ts` · `character-basic-fetch.ts` | 쿼리 캐시를 렌더 밖에서 읽는 함수(`readScheduleEntry` · `readCharacterBasic`) · `character/basic` 통과 지점(`fetchCharacterBasicCached`). 받은 값은 쿼리 캐시 `characterBasic(ocid)` 에만 넣는다 |
| `features/mvp-grade/character-list.ts` | `character/list` 를 5분 안에 한 번만 받는 `fetchCharacterListCached`(쿼리 `characterList(credentialKey)`). 캐릭터 관리 · MVP 등급 · 회차가 같은 응답을 쓴다 |
| `storage/scheduler-cache.ts` · `storage/character-basic-cache.ts` | 1.0.12 까지의 Preferences 캐시(`schedulerCache:{ocid}` · `characterBasicCache:{ocid}`) 읽기 · 지우기. 업데이트 뒤 첫 실행이 쿼리 캐시로 옮긴 뒤 지운다([[ADR-142]] 결정 7) |
| `lib/scheduler/sync-freshness.ts` | 10분 값 `SYNC_TTL_MS`. `features/query/freshness.ts` 의 `scheduleStaleTime` 이 쓴다 |
| `lib/boss/boss-profit-period.ts` | 조회 가능한 날짜의 상한과 하한 |

## 호출 방법

- 주소는 `https://open.api.nexon.com` 이고, 키는 헤더 `x-nxopen-api-key` 에 넣는다. 요청마다 10초가 지나면 끊는다.
- 호출 한도는 키의 단계마다 다르다. 개발 단계는 초당 5건 · 하루 1,000건, 서비스 단계는 초당 500건 · 하루
  2,000만 건이다. 한도를 넘으면 429 `OPENAPI00007` 이다. 앱이 개발 단계 키를 받지 않으므로([[ADR-024]]) 동시
  호출은 서비스 단계 한도를 기준으로 짠다.
- 넥슨 로그인으로 부를 수 있는 경로(프렌즈 API)는 아래 여섯이다. 로그인 자격이면 이 여섯은 우리 서버의 스트림을
  거치고, 나머지는 번들 개발자 키로 넥슨을 직접 부른다. 이 목록은 서버의 `FRIENDS_PATHS` 와 글자까지 같아야 한다.
  한쪽만 늘리면 그 경로만 404 가 나고 앱에서는 원인이 안 보인다.

| 프렌즈 경로 | 스코프 |
|---|---|
| `/maplestory/v1/character/list` | `maplestory.characterlist` |
| `/maplestory/v1/history/cube` · `starforce` · `potential` · `soul-potential` | `maplestory.cube` · `starforce` · `potential` · `soulpotential` |
| `/maplestory/v1/scheduler/character-state` | `maplestory.scheduler` |

- 이용약관에 따라 설정 화면 맨 아래에 `Data based on NEXON Open API` 를 늘 표시한다(`AppSettingsScreen`).

## 앱이 부르는 경로

| 경로 | 부르는 때 | 읽는 것 |
|---|---|---|
| `character/list` | 키 입력 · 동기화 회차 · 캐릭터 관리 | 계정(`account_id`)마다 캐릭터 목록. 한 키가 메이플 ID 여럿을 줄 수 있다 |
| `character/basic` | 동기화 회차에 함께 · 캐릭터 관리. 5분 안에 받은 캐릭터는 다시 안 부른다 | 이름 · 레벨 · 외형 · 월드 · 길드 · `access_flag` · EXP 진행률 |
| `scheduler/character-state` | 동기화 회차(오늘) · 13일 창 · 자격 판정 · 섹션 채우기 | 일간 · 주간 컨텐츠, 보스 |
| `history/*` 넷 | 가계부의 강화 내역 수집 | 날짜마다 강화 사용 내역. `count=1000`, 다음 쪽은 `cursor` 만 보낸다 |
| `character/item-equipment` · `ability` · `symbol-equipment` · `skill` · `user/union-raider` · `union-artifact` | 사냥 계산기에서 캐릭터를 고를 때. 여섯을 동시에 부른다 | 메소 획득량 |
| `character/symbol-equipment` | 지출 시트 심볼 강화 폼에서 캐릭터를 고를 때 | 심볼 이름과 레벨 |
| `character/hexamatrix` | 지출 시트 헥사 매트릭스 폼에서 캐릭터를 고를 때 | 헥사 코어 이름 · 타입 · 레벨. 활성화하지 않은 코어는 줄이 없고 `hexa_core_event_level` 은 안 쓴다 |
| `notice` · `notice-update` · `notice-event` · `notice-cashshop` 과 각 `/detail` | 공지 화면 · today 배너 | 공지 목록과 본문 |

- `ocid` 는 계정마다 길이가 다르다(32 ~ 65자). 형식을 가정하지 않고 글자 그대로 다룬다.
- 경험치는 `character_exp`(누적 절대값, 숫자)와 `character_exp_rate`(진행률, `"80.300"` 같은 문자열) 둘로 온다.
  앱은 진행률만 숫자로 바꿔 쓴다.
- `access_flag` · `registration_flag` · `complete_flag` · `ongoing_flag` 는 불리언이 아니라 문자열이다.
- 응답의 `date` 칸은 당일 조회에서 `null` 이거나 요청한 날짜를 그대로 돌려준다. 마지막 갱신 시각이 아니다.
- `weekly_boss_clear_count` · `weekly_boss_clear_limit_count` 는 앱이 쓰지 않는다. 미접속 캐릭터는 상한이 0 으로 와서
  분모로 쓰면 0 으로 나누게 된다.
- `boss_contents.cycle` 은 `bossDaily` · `bossWeekly` · `bossMonthly` 셋이다. 앱은 `bossDaily` 를 버린다.
- 넥슨의 주간 초기화는 KST 목요일 00:00, 월간 보스는 매월 1일 00:00 이다. `lib/scheduler/reset-clock.ts` 와 같다.

### 공지 경로의 특징

- 분류가 넷이고 `notice_id` 의 번호 체계가 분류마다 다르다. 상세 응답에는 `notice_id` 가 없어서 부른 쪽이 붙인다.
- 상세는 지금 목록에 있는 글만 돌려준다. 목록에서 빠진 글은 400 `OPENAPI00004` 다.
- 이벤트 목록은 게시판 최근 20건이 아니라 지금 진행 중인 이벤트다. 썬데이 메이플은 일요일 하루만 뜬다.
- 이벤트 · 캐시샵 목록 항목은 `thumbnail_url` 을 준다. 캐시샵 상시 판매는 `ongoing_flag` 가 `"true"` 이고 기간이 `null` 이다.
- `date` 는 `2026-09-09T16:24+09:00` 처럼 초 없이 KST 오프셋이 붙어 온다.
- 서버도 개발자 키로 이 경로를 1분마다 부른다([[ADR-057]]).

### 메소 획득량을 읽는 규칙

- 메소 획득량은 장비 잠재 · 에디셔널, 어빌리티, 그랜드 어센틱 심볼, 유니온 공격대, 유니온 아티팩트에서 온다.
  챌린저스 스킬과 섀도어의 그리드는 앱이 더한다(`nexon/meso-rate/client.ts`).
- 장비는 `메소 획득량 +20%`, 어빌리티 · 유니온은 `메소 획득량 20% 증가` 로 표기가 다르다. 정규식 하나로 둘 다 읽는다.
- 심볼만 숫자 칸(`symbol_meso_rate`, `"13%"`)이다.
- 아티팩트는 `union_artifact_effect` 만 읽는다. 크리스탈 쪽 값은 이미 거기 합쳐져 있다.
- `character/stat` 의 메소 획득량은 쓰지 않는다. 지금 프리셋 값이고 일시 버프가 섞인다.
- `union_raider_preset_1 ~ 5` 는 늘 `null` 이라 읽지 않는다.

## 조회 가능한 날짜

`scheduler/character-state` 의 `date`(`YYYY-MM-DD`)로 지난 날을 물을 수 있다.

| `date` | 결과 |
|---|---|
| 없음 | 200. 오늘 상태 |
| 오늘 · 미래 · 형식 오류 | 400 `OPENAPI00004` |
| 오늘−1 | 집계가 끝나기 전 새벽에는 400 `OPENAPI00009`, 그 뒤 200 |
| 오늘−2 ~ 오늘−13 | 200 |
| 오늘−14 이전 | 400 `OPENAPI00004` |

- 넥슨이 알리는 한도는 14일이지만 마지막 날이 몇 시간 일찍 닫혀서, 날짜로 따지면 오늘−13 까지만 된다. 그래서 코드
  상수는 13(`ROLLING_QUERY_WINDOW_DAYS`)이고, 사용자에게 보이는 문구는 14일이다.
- 상한은 오늘−1 이다(`getMaxQueryableDate`). 새벽의 `OPENAPI00009` 를 피하려고 오늘−2 로 낮추지 않는다. 낮추면 집계가
  끝난 아침에 볼 수 있는 지난 주를 앱이 스스로 가린다. 집계가 끝나는 시각을 상수로 두지 않고 응답으로 판단한다.
- `MIN_SCHEDULER_DATE`(2026-07-01)는 API 가 생긴 날이다. 지금은 롤링 하한이 늘 더 뒤라 판정에 영향이 없다.
- 서버는 같은 `OPENAPI00009` 를 넥슨이 결산 중인지 판단하는 신호로 쓴다. 00:00 ~ 06:00 KST 에 `date=어제` 를 물어
  400 `OPENAPI00009` 면 결산 중, 200 이면 끝났다고 본다. 여섯 밤 동안 결산은 00:00 부터 02:00 정각까지였다. 자정 전에는
  `date` 없는 조회가 결산 중에도 200 이라 신호가 없다(today 의 결산 안내는 [[ADR-058]]).

## 에러 코드

| 코드 | 상태 | 뜻 | 다시 하면 |
|---|---|---|---|
| `OPENAPI00003` | 400 | 조회할 수 없는 ocid. `character/list` 가 준 ocid 여도 나올 수 있다 | 안 풀린다 |
| `OPENAPI00004` | 400 | 그 ocid 로 그 날짜를 조회할 수 없다. 창 밖 · 미래 · 형식 오류 · 월드 이전 전 날짜를 모두 이 코드로 답한다 | 원인에 따라 다르다. 부르는 쪽이 날짜로 판단한다 |
| `OPENAPI00005` | 400 | 무효한 API 키. 없는 키도, 넥슨에서 지운 키도 이 응답이다. 401 · 403 이 아니다 | 키를 바꿔야 한다 |
| `OPENAPI00007` | 429 | 호출 한도 초과 | 시간이 지나면 |
| `OPENAPI00009` | 400 | 아직 집계 전(오늘−1) | 시간이 지나면 풀린다 |
| `OPENAPI00010` | 400 | 메이플스토리 API 점검 중. 넥슨 문서의 표기는 `게임 점검 중` 이다 | 점검이 끝나면 풀린다 |
| `OPENAPI00011` | 503 | 넥슨 Open API 점검 중. 넥슨 문서에만 있고 아직 받아 본 적은 없다 | 점검이 끝나면 풀린다 |

메이플스토리 API 점검 중에 모든 경로가 막히지는 않는다. 2026-10-22 정기 점검 중에 잰 결과다.

| 경로 | 응답 |
|---|---|
| `character/basic` · `character/symbol-equipment` · `character/ability` · `user/union-raider` · `notice` · `notice-event` · `notice-update` · `notice-cashshop` | 400 `OPENAPI00010` |
| `id` · `character/list` · `scheduler/character-state` · `history/*` · `date` 를 준 `character/basic` | 200 |

그래서 메이플스토리 API 점검은 주로 메소 획득량과 공지에서 보이고, 스케줄 동기화와 캐릭터 목록은 그대로 돈다.

이 표가 실패의 전부는 아니다. 캐릭터가 사라진 ocid 에 넥슨은 400 이 아니라 200 에 모든 칸이 `null` 인 본문을 준다.
앱은 이것을 `NexonNoCharacterError` 로 바꾼다. 앱에서 이 코드들이 어떤 종류가 되는지는 [[ADR-021]] 결정 3 에 있다.

## 미접속 캐릭터의 축약 응답

`access_flag` 가 `"false"` 인 캐릭터도 세 경로 모두 200 이다. 대신 오래 접속하지 않을수록 응답에 담기는 항목이 줄어든다.

| 캐릭터 상태 | 오늘 응답(일간 / 주간 / 보스) | 지난 날 응답 |
|---|---|---|
| 오늘 접속 | 18 / 22 / 77 | 18 / 22 / 77 |
| `access_flag: true`, 오늘 미접속 | 1 / 22 / 53(`bossDaily` 없음) | 18 / 22 / 77 |
| `access_flag: false` | 1 / 6 / 2(`bossMonthly` 만) | 1 / 22 / 53 |
| 특수 월드 · 저레벨 | 1 / 6 / 0 | 1 / 6 / 0 |

- 주간 보스부터 빠지고, 마지막에는 검은 마법사 두 줄이 미등록 · 미완료로 남는다. 이 응답을 믿으면 그 달의 완료가
  지워진다. 그래서 `bossWeekly` 가 없는 응답은 월간 보스도 믿지 않는다.
- 일간 응답에 남는 한 줄은 월드 공유인 `몬스터파크` 다. 주간에 남는 여섯 중 `[메이플 유니온] PC방 주간 드래곤 퇴치` 는
  계정 공유, `[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?` 는 월드 공유다. 공유 범위는 이름으로 짐작하지 않고
  컨텐츠 표에 적힌 값을 따른다.
- 공유 컨텐츠 이름은 접두어가 붙은 형태로 온다. 컨텐츠 key 는 NFC 로 맞추고 공백을 지운 뒤 완전히 같은 것만
  찾으므로, 응답에 오는 이름 그대로 컨텐츠 표에 줄을 둔다.
- `[길드] 지하 수로` 의 `now_count` 는 주간 초기화를 지나도 줄지 않고 쌓인다. 이 값으로 최근 활동을 판단하면 안 된다.
- 보스가 0건인 캐릭터는 지난 날도 0건이다.

## 월드 이전

- 월드 이전(월드 리프 · 챌린저스 이전)은 ocid 를 새로 만든다. 한 캐릭터의 기록이 옛 ocid 와 새 ocid 로 나뉜다.

| 부른 것 | 옛 ocid | 새 ocid |
|---|---|---|
| `character/list` | 빠진다 | 있다 |
| `character/basic` | 200, 모든 칸 `null` | 200, 값 있음 |
| `scheduler/character-state`(오늘) | 400 `OPENAPI00004` | 200 |
| `scheduler/character-state?date=이전 전날` | 200, 옛 월드 시절 데이터 | 400 `OPENAPI00004` |
| `id?character_name=` | | 새 ocid 를 준다 |

- 옛 ocid 는 무효가 아니다. 지난 날 조회는 지금도 실제 데이터를 준다. 존재한 적 없는 ocid 의 400 `OPENAPI00003` 과는 다른 응답이다.
- `character/list` 에서 빠졌다는 것만으로 캐릭터가 사라졌다고 판단하지 않는다. 목록은 계정 단위라 다른 계정 캐릭터도
  목록에 없다. 그래서 `character/basic` 을 따로 물어 확인한다(`probeStrandedTrackedCharacters`).
- 두 ocid 를 잇는 단서는 캐릭터 이름뿐이고, 이름은 바뀔 수 있다. 연결 규칙은 [[ADR-028]] 에 있다.
- 지난 날 응답도 `world_name` · `character_level` 은 지금 값을 담는다.
- 이전하기 전에 잡은 주간 · 월간 보스의 완료와 스케줄러 등록은 새 ocid 응답에도 그대로 보인다. 같은 처치를 두 번
  기록하지 않는 규칙은 [[ADR-040]] 에 있다. 넥슨은 등록하지 않은 일반 월드 캐릭터에도 시즌 보스를 미등록으로 목록에 넣는다.
- 이전은 보통 캐릭터 한두 개 단위로 일어난다. 조회 가능 여부는 항상 ocid 단위로 판단한다.

## 조회 불가 ocid

한 키가 준 두 계정 중 한 계정(13명) 전원이 `character/basic` · 스케줄러에서 400 `OPENAPI00003` 이었다. 같은 월드의
다른 사람 캐릭터는 200 이었고, `character/list` 와 `id?character_name=` 은 같은 ocid 를 정상으로 줬다. 원인은 확인하지
못했다. 앱은 이런 캐릭터를 목록에서 숨기지 않고, 추적 중이면 조회 불가로 표시해 해제할 수 있게 둔다.
