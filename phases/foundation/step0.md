# Step 0: core-types

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 `types/` 레이어의 위치와 역할
- `/docs/ADR.md` — 특히 [[ADR-007]](일간/주간 콘텐츠·보스 진행 상태를 Nexon Open API로 동기화)과 [[ADR-008]](에러 핸들링 및 복원력 정책)
- `src/data/__tests__/boss-portraits.test.ts` — 보스 난이도 표기(`이지`/`노멀`/`하드`/`카오스`/`익스트림`)가 이미 어떻게 코드에서 쓰이는지 확인

이번 phase(`foundation`)의 첫 step이라 이전 step 산출물은 없다.

## 배경

이 프로젝트(`메이플 루틴`)는 Nexon Open API의 "스케줄러 Open API"로 일간/주간 콘텐츠와 보스 진행 상태를 읽기 전용으로 동기화하는 하이브리드 앱이다. 이번 step은 그 다음 step들(storage 어댑터, Nexon API 클라이언트, native 어댑터)이 공통으로 참조할 도메인 타입을 `src/types/`에 정의하는 것이다. **이 step은 순수 타입 정의 + 상수 배열만 다룬다. fetch 호출, storage 접근, 실제 파싱 로직은 다음 step들의 몫이니 여기서 만들지 마라.**

Nexon API 실제 응답 예시(2026-07-09, 사용자 실측, 참고용 — 아래 필드 특이사항 반영):

```json
// GET /maplestory/v1/character/list
{
  "account_list": [
    {
      "account_id": "da9b2f2...",
      "character_list": [
        { "ocid": "50119a0...", "character_name": "내옆에최성일", "world_name": "베라", "character_class": "아크메이지(썬,콜)", "character_level": 211 }
      ]
    }
  ]
}
```

```json
// GET /maplestory/v1/scheduler/character-state
{
  "date": "2026-07-09T00:00+09:00",
  "character_name": "낟낟",
  "world_name": "엘리시움",
  "character_level": 293,
  "character_class": "렌",
  "daily_contents": [
    { "content_name": "몬스터파크", "type": "contents", "registration_flag": "true", "now_count": 7, "max_count": 14, "quest_state": null }
  ],
  "weekly_contents": [
    { "content_name": "에픽 던전 : 악몽선경", "type": "contents", "registration_flag": "true", "now_count": 5, "max_count": 0, "quest_state": null },
    { "content_name": "[메이플 유니온] 주간 드래곤 퇴치", "type": "quest", "registration_flag": "false", "now_count": 0, "max_count": 0, "quest_state": "0" }
  ],
  "boss_contents": [
    { "content_name": "검은 마법사", "difficulty": "extreme", "cycle": "bossMonthly", "list_order_no": 53, "registration_flag": "true", "complete_flag": "true" }
  ],
  "weekly_boss_clear_count": 0,
  "weekly_boss_clear_limit_count": 0
}
```

**중요 — wire 타입과 domain 타입을 분리해서 정의하라**:
- *wire 타입*: 위 JSON 응답을 그대로 반영하는 타입(snake_case 필드명, `registration_flag`/`complete_flag`는 문자열 `"true"`/`"false"`, `difficulty`는 영문 소문자, `cycle`은 `"bossDaily"`/`"bossWeekly"`/`"bossMonthly"` 3종 전부 포함). 다음 step(`nexon-api-client`)이 원본 API 응답을 파싱할 때 이 타입을 쓴다.
- *domain 타입*: 앱 나머지 레이어(`storage/`, `features/`)가 실제로 사용할, 정규화된 타입. `registrationFlag`/`isComplete`는 진짜 `boolean`, `difficulty`는 한글 리터럴 유니온(`'이지' | '노멀' | '하드' | '카오스' | '익스트림'`, `src/data/__tests__/boss-portraits.test.ts`의 `DIFFICULTY_PREFIX` 키와 동일한 5개 값), `cycle`은 **`'weekly' | 'monthly'` 2종만**(이 앱은 `bossDaily` 콘텐츠를 아예 다루지 않는다 — [[ADR-007]] 확정 사항).

## 작업

`src/types/` 아래에 파일을 나눠 작성하라(파일 분리 기준은 재량, 아래는 최소 요구 시그니처):

**`src/types/nexon-wire.ts`** — Nexon API 원본 응답 타입
```ts
export interface NexonCharacterSummary {
  ocid: string
  characterName: string
  worldName: string
  characterClass: string
  characterLevel: number
}
export interface NexonAccountSummary {
  accountId: string
  characterList: NexonCharacterSummary[]
}
export interface NexonCharacterListResponse {
  accountList: NexonAccountSummary[]
}

export type NexonRawDifficulty = 'easy' | 'normal' | 'hard' | 'chaos' | 'extreme'
export type NexonRawBossCycle = 'bossDaily' | 'bossWeekly' | 'bossMonthly'

export interface NexonDailyContentWire { /* content_name, type, registration_flag('true'|'false'), now_count, max_count, quest_state */ }
export interface NexonWeeklyContentWire { /* content_name, type('contents'|'quest'), registration_flag, now_count, max_count, quest_state */ }
export interface NexonBossContentWire { /* content_name, difficulty: NexonRawDifficulty, cycle: NexonRawBossCycle, registration_flag, complete_flag */ }
export interface NexonSchedulerCharacterStateWire { /* date, character_name, world_name, character_level, character_class, daily_contents, weekly_contents, boss_contents, weekly_boss_clear_count, weekly_boss_clear_limit_count */ }
```
위 인터페이스 본문의 실제 필드는 주석에 적힌 snake_case 이름 그대로, 위 JSON 예시의 값 종류(문자열/숫자/`"true"`\|`"false"` 등)에 맞춰 채워 넣어라.

**`src/types/scheduler.ts`** — 정규화된 domain 타입
```ts
export const BOSS_DIFFICULTIES = ['이지', '노멀', '하드', '카오스', '익스트림'] as const
export type BossDifficulty = (typeof BOSS_DIFFICULTIES)[number]

export const BOSS_CYCLES = ['weekly', 'monthly'] as const
export type BossCycle = (typeof BOSS_CYCLES)[number]

export interface DailyContent { name: string; isRegistered: boolean; nowCount: number; maxCount: number }
export interface WeeklyContent { name: string; kind: 'contents' | 'quest'; isRegistered: boolean; nowCount: number; maxCount: number }
export interface BossContent { name: string; difficulty: BossDifficulty; cycle: BossCycle; isRegistered: boolean; isComplete: boolean }

export interface SchedulerCharacterState {
  asOf: string // ISO 문자열, wire의 date 그대로 보존
  characterName: string
  world: string
  level: number
  jobClass: string
  dailyContents: DailyContent[]
  weeklyContents: WeeklyContent[]
  bossContents: BossContent[]
  weeklyBossClearCount: number
  weeklyBossClearLimitCount: number
}
```

**`src/types/character.ts`** — 캐릭터/계정 domain 타입
```ts
export interface MapleCharacter { ocid: string; name: string; world: string; jobClass: string; level: number }
export interface MapleAccount { accountId: string; characters: MapleCharacter[] }
```

**`src/types/auth.ts`** — 인증 설정 domain 타입
```ts
export interface NexonAuthConfig { apiKey: string; selectedAccountId: string | null }
```

인덱스 배럴 파일(`src/types/index.ts`)로 위 모든 타입을 재수출하라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/types/`에만 파일을 추가했는가? (다른 레이어 건드리지 않았는가)
   - `BOSS_DIFFICULTIES`가 정확히 `['이지', '노멀', '하드', '카오스', '익스트림']` 5개인가?
   - `BOSS_CYCLES`가 정확히 `['weekly', 'monthly']` 2개이고 `'bossDaily'`에 대응하는 domain 값이 없는가?
   - wire 타입과 domain 타입이 분리되어 있는가?
3. `src/types/__tests__/scheduler.test.ts` 같은 테스트 파일을 만들어 `BOSS_DIFFICULTIES`/`BOSS_CYCLES` 상수 배열이 위 값과 정확히 일치하는지, 그리고 각 domain 인터페이스에 맞는 샘플 객체를 하나씩 만들어 타입 에러 없이 대입되는지 확인하는 테스트를 최소 1개 이상 작성하고 통과시켜라(TDD — 테스트를 먼저 작성한 뒤 타입을 맞춰 나가라).
4. 결과에 따라 `phases/foundation/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일 목록과 핵심 타입명을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `fetch`, `@capacitor/*` 등 실제 API 호출/네이티브 플러그인 코드를 작성하지 마라. 이유: 이번 step은 타입 정의 전용이고, 실제 구현은 이후 step(`nexon-api-client`, `native-adapter-stub`)의 몫이다.
- `cycle` domain 타입에 `'bossDaily'`에 대응하는 값을 넣지 마라. 이유: 이 앱은 [[ADR-007]]에 따라 주간/월간 보스만 다루고 일간으로 격하된 보스 콘텐츠는 완전히 무시한다.
- `src/data/*.json`을 읽거나 수정하지 마라. 이유: 이 step은 Nexon API 도메인 타입만 다루고, 게임 레퍼런스 데이터 매핑은 features 레이어의 몫이다.
- 기존 테스트를 깨뜨리지 마라.
