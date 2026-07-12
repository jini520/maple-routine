# Step 2: nexon-api-client

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 `nexon/` 레이어의 위치와 역할, `features/*`가 이 클라이언트를 통해서만 Nexon API에 접근한다는 규칙
- `/docs/ADR.md` — 특히 [[ADR-007]](Nexon Open API 연동 전체 — 엔드포인트, 인증 헤더, 필드 특이사항, 호출 제한)과 [[ADR-008]](에러 핸들링 및 복원력 정책)
- `src/types/nexon-wire.ts`, `src/types/scheduler.ts`, `src/types/character.ts` — 이전 step(`core-types`)에서 정의한 wire/domain 타입. 이 step의 핵심 작업이 바로 이 wire→domain 변환이다.
- `src/storage/api-key.ts` — 이전 step(`storage-adapter`)에서 만든 `getAuthConfig()`. 이 client는 호출자가 API 키를 직접 넘기는 순수 함수로 만들고, storage 조회는 호출자(향후 features 레이어) 책임으로 둔다 — 이유는 아래 "작업" 참고.

## 배경

**엔드포인트/인증 (ADR-007 확정 사항, 그대로 사용하라)**:
- 실제 호출 도메인은 `https://open.api.nexon.com` (문서 사이트 `openapi.nexon.com`과 다름)
- `GET /maplestory/v1/character/list` — 계정 소속 캐릭터 목록(=위 wire 타입 `NexonCharacterListResponse`)
- `GET /maplestory/v1/scheduler/character-state?ocid={ocid}` — 캐릭터의 일간/주간/보스 상태(=위 wire 타입 `NexonSchedulerCharacterStateWire`)
- API 키는 HTTP 헤더 `x-nxopen-api-key`로 전송
- 타임아웃: 10초 확정([[ADR-008]])
- 여러 캐릭터를 동기화할 때 병렬 호출 금지, 순차 호출 확정([[ADR-008]] — 초당 호출 제한 때문)

**에러 정책 (ADR-008 확정 사항)** — 아래 각 상황마다 구분되는 에러 타입을 던져서 호출자(향후 features 레이어)가 상황별로 다르게 반응할 수 있게 하라:
- 네트워크 없음/타임아웃/5xx, 그리고 **응답이 JSON이 아닌 경우**(WAF/CDN 차단 페이지 등, JSON 파싱 자체가 실패하는 경우도 이 그룹으로 취급) → 호출자는 마지막 캐시를 유지해야 하는 상황
- 401/403(키 무효) → 호출자는 "API 키가 유효하지 않습니다" 안내를 띄우고 재호출을 멈춰야 하는 상황
- 429(rate limit, 에러 코드 `OPENAPI00007`) → 호출자는 백오프해야 하는 상황

**wire → domain 정규화 규칙**:
- `registration_flag`/`complete_flag`는 문자열 `"true"`/`"false"`로 온다 → 진짜 `boolean`으로 변환
- `difficulty`는 영문 소문자(`easy`/`normal`/`hard`/`chaos`/`extreme`)로 온다 → 한글 리터럴(`이지`/`노멀`/`하드`/`카오스`/`익스트림`)로 변환하는 고정 매핑 테이블을 이 모듈 안에 두어라(이건 게임 데이터가 아니라 API 프로토콜 자체의 고정 어휘라 [[ADR-006]] CRITICAL 규칙 대상이 아니다 — 사용자 확인 없이 그대로 구현해도 된다)
- `cycle`은 `bossDaily`/`bossWeekly`/`bossMonthly` 3종으로 오는데, **`bossDaily` 항목은 domain 변환 시 걸러내고 버려라**(이 앱은 주간/월간 보스만 다룬다 — [[ADR-007]] 확정 사항). `bossWeekly`→`'weekly'`, `bossMonthly`→`'monthly'`로 변환.

**이번 step의 범위가 아닌 것 — 하지 마라**:
- `content_name`을 `src/data/weekly-bosses.json` 등 우리 게임 데이터와 이름 매칭(공백 제거 비교, "시즌 보스 메이린" 같은 별칭 처리 등)하는 로직은 이 step에 없다. 이 client는 Nexon이 원본 문자열로 준 `content_name`을 그대로 domain 타입의 `name` 필드에 넣기만 한다. 우리 데이터와의 매핑은 이후 features 레이어의 몫이다.
- `storage/`에서 API 키를 직접 읽어오지 마라. 이 client의 모든 함수는 API 키를 **인자로** 받는 순수 함수로 만들어라 — `nexon/`이 `storage/`를 몰라야 두 레이어가 독립적으로 테스트 가능하고, `ARCHITECTURE.md`의 계층 분리 의도와 맞는다.

## 작업

**`src/nexon/errors.ts`**
```ts
export class NexonApiError extends Error {}
export class NexonAuthError extends NexonApiError {}       // 401/403
export class NexonRateLimitError extends NexonApiError {}  // 429, OPENAPI00007
export class NexonNetworkError extends NexonApiError {}    // 네트워크/타임아웃/5xx/JSON 파싱 실패
```

**`src/nexon/client.ts`**
```ts
export async function fetchCharacterList(apiKey: string): Promise<MapleAccount[]>
export async function fetchSchedulerCharacterState(apiKey: string, ocid: string): Promise<SchedulerCharacterState>
export async function fetchSchedulerStatesForCharacters(apiKey: string, ocids: string[]): Promise<SchedulerCharacterState[]>
```
- `fetchSchedulerStatesForCharacters`는 내부적으로 `ocids`를 **순차적으로**(동시에 여러 개 in-flight 상태가 되지 않도록) 호출해야 한다. 한 캐릭터 호출이 실패해도 나머지 캐릭터 조회를 막지 않도록, 개별 실패는 어떻게 처리할지 판단해 구현하되 전체 함수가 한 캐릭터 실패로 무조건 reject되지 않게 하라(예: 실패한 캐릭터는 결과 배열에서 제외하거나 별도로 표시 — 세부 방식은 재량).
- HTTP 호출은 `fetch` + `AbortController`로 10초 타임아웃을 구현하라.
- 응답 상태 코드에 따라 위 에러 클래스 중 알맞은 것을 던져라. `response.json()`이 실패하면(JSON이 아닌 응답) `NexonNetworkError`로 처리하라.

**`src/nexon/normalize.ts`** (또는 `client.ts`에 포함해도 됨 — 재량)
- wire 타입 → domain 타입 변환 함수들. difficulty 매핑 테이블, `bossDaily` 필터링, flag 문자열→boolean 변환을 여기서 구현하라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `nexon/` 밖에 파일을 추가하지 않았는가?
   - `src/storage/`를 import하지 않았는가(이 레이어는 storage를 몰라야 한다)?
   - `src/data/*.json`을 import하지 않았는가(이름 매칭은 이 step 범위 밖)?
3. `src/nexon/__tests__/`에 테스트를 먼저 작성한 뒤(TDD) 구현하라. `global.fetch`를 `vi.fn()`으로 모킹해 실제 네트워크 호출 없이 단위 테스트하라. 최소한 다음을 검증하라:
   - 정상 응답 시 wire 타입 → domain 타입 변환이 정확하다(`registration_flag: "true"` → `true`, `difficulty: "hard"` → `"하드"`, `cycle: "bossMonthly"` → `"monthly"`).
   - `bossDaily` 항목은 결과의 `bossContents`에 포함되지 않는다.
   - 401/403 응답 시 `NexonAuthError`를 던진다.
   - 429 응답 시 `NexonRateLimitError`를 던진다.
   - 네트워크 에러/5xx/JSON이 아닌 응답 시 `NexonNetworkError`를 던진다.
   - `fetchSchedulerStatesForCharacters`가 여러 ocid를 순차 호출한다(동시에 두 개 이상 in-flight 상태가 아님을 호출 순서/타이밍으로 검증).
4. 결과에 따라 `phases/foundation/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 함수·에러 타입을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `src/storage/`를 import하지 마라. 이유: API 키는 호출자가 인자로 넘겨야 `nexon/`과 `storage/`가 독립적으로 테스트 가능하다.
- `src/data/*.json`을 읽거나 이름 매칭 로직을 넣지 마라. 이유: 그건 features 레이어의 몫이고 이 step 범위 밖이다.
- 캐릭터 여러 명을 `Promise.all` 등으로 동시에 호출하지 마라. 이유: [[ADR-008]]이 순차 호출을 명시적으로 요구한다(초당 호출 제한).
- axios 등 새 HTTP 라이브러리를 추가하지 마라. 이유: 브라우저/Capacitor WebView 모두 `fetch`를 지원하므로 추가 의존성이 불필요하다.
- 기존 테스트를 깨뜨리지 마라.
