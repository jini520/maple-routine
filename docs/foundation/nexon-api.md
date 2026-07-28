# Nexon Open API 연동

> **범위**: Nexon Open API 호출·인증·엔드포인트·정규화·호출 제한. 별도 서버/프록시 없이 사용자 개인 키로 기기에서 직접 호출한다([[ADR-003]], [[ADR-007]]).
> **관련 소스**: `nexon/client` · `nexon/character` · `nexon/schedule`(client/normalize) · `lib/boss-matching`.
> **관련 ADR**: [[ADR-007]] [[ADR-003]] [[ADR-006]]. **관련 문서**: [architecture.md](./architecture.md), [error-resilience.md](./error-resilience.md), [features/content-scheduler.md](../features/content-scheduler.md), [features/boss-scheduler.md](../features/boss-scheduler.md).

## 클라이언트·인증
- 호출 도메인은 **`https://open.api.nexon.com/`**(문서 사이트 `openapi.nexon.com` 과 다름). 모든 요청 헤더에 **`x-nxopen-api-key: <저장된 개인 API 키>`**.
- **타임아웃 10초**(공식 권장값 없어 모바일 관례상 채택, 2026-07-09).
- **호출 제한**: 개발 단계 초당 5건/일 1,000건, 서비스 단계 초당 500건/일 2,000만 건. 이 앱은 사용자가 이미 승인받은 **서비스 단계 키**를 쓰므로 개발 단계 상한 검증은 불필요. 여러 캐릭터 동기화 병렬화는 [[ADR-008]] 정정 참고.
- 별도 서버/프록시 없음 — 키는 기기에만 저장되고 호출도 기기에서 직접 나간다([[ADR-003]]).
- 이용약관 출처 표기: 영문 원문 **"Data based on NEXON Open API"** 를 **설정 화면 하단**(앱 버전·카피라이트와 함께) 상시 노출([[ADR-007]], 앱 전역 footer는 만들지 않음).

## 엔드포인트
- **`GET /maplestory/v1/character/list`** (`nexon/character`): 계정 소속 캐릭터 목록. 캐릭터명+월드 수동 입력 폼은 없다. 응답: `{ account_list: [{ account_id, character_list: [{ ocid, character_name, world_name, character_class, character_level }] }] }`. **하나의 키가 여러 `account_id`(메이플 ID)를 반환할 수 있다**(실측, 2026-07-09) — `account_list.length > 1` 이면 계정 선택 UI. `ocid` 는 길이가 계정마다 다르므로(32~65자 관찰) 불투명 문자열로 다룬다. 키가 등록된 Nexon 계정 캐릭터만 반환(다른 계정은 별도 키 필요).
- **`GET /maplestory/v1/character/basic`** (`nexon/character`, ocid별, [[ADR-015]]): 캐릭터 이미지(`character_image`)·`access_flag`·`world_name`. "캐릭터 관리" 피커·아바타에 사용, 병렬 호출.
- **`GET /maplestory/v1/scheduler/character-state`** (`nexon/schedule`, ocid별): `daily_contents`/`weekly_contents`/`boss_contents` 를 앱 도메인 모델로 변환.
  - `boss_contents.cycle` = `bossDaily`/`bossWeekly`/`bossMonthly`(실측). **`bossWeekly`·`bossMonthly` 만 사용, `bossDaily` 무시** — 힐라(하드)·핑크빈(카오스) 등 일간 격하 보스가 `bossDaily` 로 온다([[ADR-006]] 일치).
  - **`date`(YYYY-MM-DD) 쿼리 파라미터** 지원(공식 문서 확인, 2026-07-14, [[ADR-023]]) — 보스 수익 과거 기간 재조회에 사용. 조회 하한: 고정 하한 `MIN_SCHEDULER_DATE`(2026-07-01) + 롤링 하한(오늘-13일, 정확히 14일 전은 조회 불가) 중 더 늦은 쪽([[ADR-032]]).

## 정규화
- 난이도: 영문 소문자 ↔ 한글 변환(`nexon/normalize`).
- 보스명: **양쪽 문자열 공백을 전부 제거한 뒤 비교**(`lib/boss-matching`). 공백이 API 쪽에 더 있을 때도, 데이터 쪽에 더 있을 때도 있어 한쪽으로 가정하면 안 됨(예: API `검은 마법사` vs 데이터 `검은마법사`, 반대로 API `블러디퀸` vs 데이터 `블러디 퀸`). 공백 제거로도 못 잡는 예외(API `시즌 보스 메이린` ↔ 데이터 `메이린`)는 `weekly-bosses.json` 의 `apiAlias` 로 명시 매핑. 매핑 실패는 원문 그대로 "알 수 없는 콘텐츠"(크래시 금지).
- `nexon/` 은 `src/data/` 를 몰라야 독립 테스트가 가능하므로, 보스명 매칭은 `nexon/` 이 아니라 `lib/boss-matching` 이 담당하고 결과를 feature 가 소비한다.

## 확인 완료된 사실 (레퍼런스)
- `weekly_boss_clear_limit_count` = 캐릭터당 주간 보스 12마리 제한 카운트. 시즌보스(메이린)는 예외.
- 주간 리셋 = KST 목요일 00:00(`lib/reset-clock` 과 정확히 일치). 월간 보스 리셋 = 매월 1일 00:00 KST([[ADR-030]] 확정).
- 온보딩 계정 표기: 각 `account_id` 는 그 계정 최고 레벨 캐릭터의 닉네임+직업+레벨로 표기(`account_id` 해시 비노출).

## 폐기된 정책 (history)
- ~~개발 단계 호출량 상한(초당 5건/일 1,000건) 검증 필요~~ → 서비스 단계 키 사용이라 불필요(2026-07-09).
- ~~NEXON Open ID(OAuth) 연동 + 토큰 교환 서버 도입 검토~~ → 파트너스 승인 필요 + 개인 키 단독 호출 실측 확인으로 기각([[ADR-003]], [[ADR-007]]).
