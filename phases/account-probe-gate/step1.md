# Step 1: basic-fetch-ttl

이 step 은 **새 모듈 1개 + 그 테스트 1개만** 만든다. 기존 호출부는 **한 줄도 고치지 마라**(step 2·3 의 몫).

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 `/docs/adr/ADR-NNN.md` 로 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-113.md` — **이번 phase 의 결정. 특히 결정 1.** step 0 이 만들었다
- `/docs/features/onboarding.md` — "계정 선택 프로브" 절(step 0 이 갱신함)
- `/docs/foundation/nexon-api.md` — `character/basic` 응답과 400 `OPENAPI00003`(조회 불가 ocid) 항목
- `/src/nexon/character/client.ts` — `fetchCharacterBasic(apiKey, ocid)` 원형
- `/src/nexon/errors.ts` — `NexonAuthError` · `NexonRateLimitError`
- `/src/storage/character-basic-cache.ts` — `getCachedCharacterBasic` · `setCachedCharacterBasic` · `CachedCharacterBasicEntry`
- `/src/types/character.ts` — `CharacterBasicProfile`
- `/src/features/schedule-sync/character-eligibility.ts` — 같은 디렉터리의 기존 모듈 서식 참고
- `/src/features/schedule-sync/__tests__/` — 이 디렉터리의 기존 테스트가 `@capacitor/preferences`·`nexon` 을 어떻게 목킹하는지 확인하라. **그 관례를 그대로 따라라**

## 배경

`character/basic` 이 온보딩 1회에 같은 캐릭터로 **세 번** 나가고 있다(계정 선택 프로브 → 예열 →
캐릭터 선택 피커). 네 번째로 동기화 편승 갱신(`schedule-sync.ts:222` `refreshCharacterBasics`,
[[ADR-097]] 결정 7)도 같은 요청을 한다.

[[ADR-113]] 결정 1 — 호출부를 하나씩 고치는 대신 **공유 경로 하나**로 접는다. 이유:
**호출자끼리 서로를 몰라도 접힌다.** 새 호출부가 생겨도 이 경로를 쓰면 자동으로 중복이 접힌다.

## 작업

### 1. `/src/features/schedule-sync/character-basic-fetch.ts` 신설

```ts
export const CHARACTER_BASIC_TTL_MS = 5 * 60 * 1000

export async function fetchCharacterBasicCached(
  apiKey: string,
  accountId: string,
  ocid: string,
  now: Date,
): Promise<CharacterBasicProfile>
```

동작:

1. `getCachedCharacterBasic(ocid)` 로 캐시 엔트리를 읽는다.
2. 엔트리가 있고 `now - Date.parse(entry.cachedAt) < CHARACTER_BASIC_TTL_MS` 이면
   **네트워크 없이** `entry.profile` 을 그대로 돌려준다.
3. 아니면 `fetchCharacterBasic(apiKey, ocid)` 를 호출하고,
   `setCachedCharacterBasic(accountId, ocid, { profile, cachedAt: now.toISOString() })` 로 쓴 뒤
   그 profile 을 돌려준다.

**설계 의도에서 벗어나면 안 되는 핵심 규칙:**

- **fetch 실패를 캐시로 폴백하지 마라.** 반드시 그대로 throw 한다. 이유: 호출부들이
  `toScheduleSyncError(error).kind === 'characterUnavailable'`(400 `OPENAPI00003` 판별)과
  `NexonAuthError`/`NexonRateLimitError` 전역 실패 분기를 그 예외에 걸고 있다. 여기서 삼키면
  조회 불가 계정 판정과 429 전파가 통째로 죽는다.
- **`cachedAt` 파싱 실패·미래 시각은 만료로 취급하라.** `Number.isFinite(Date.parse(...))` 가
  거짓이거나 경과 시간이 음수면 캐시를 무시하고 새로 받는다. 이유: 손상된 값이나 기기 시계 되감기가
  캐시를 영구히 신선한 것으로 만들면 안 된다.
- **경계는 배타적(`elapsed < TTL`)으로 하라** — 정확히 5분이면 만료다.
- **`cachedAt` 은 `now.toISOString()` 을 쓴다**(`new Date()` 재호출이 아니라). 이유: 호출부가 이미
  잡아둔 `now` 를 기준으로 삼으면 테스트가 결정적이고, 오차는 항상 TTL 이 **짧아지는**(보수적인)
  방향으로만 난다.
- **single-flight(동시 요청 병합)를 넣지 마라.** 이유: 한 라운드 안에서 같은 ocid 가 두 번 불리지
  않으므로 필요 없는 복잡도다. 필요해지면 그때 별도 결정으로 넣는다.
- **캐시 읽기·쓰기는 반드시 `storage/character-basic-cache` 어댑터를 거쳐라.**
  `@capacitor/preferences` 를 직접 부르지 마라 — `CLAUDE.md` CRITICAL 규칙.

모듈 상단에 **왜 이 가드가 있는지**를 [[ADR-113]] 결정 1 참조와 함께 주석으로 적어라(이 저장소의
관례 — 주변 모듈들이 전부 그렇게 되어 있다). 특히 "5분인 이유"(온보딩 한 바퀴를 덮고,
[[ADR-097]] 동기화 TTL 10분보다 짧아야 편승 갱신이 무력화되지 않는다)를 남겨라.

### 2. `/src/features/schedule-sync/__tests__/character-basic-fetch.test.ts` 신설 (TDD — 먼저 작성)

`CLAUDE.md` CRITICAL 규칙: **테스트를 먼저 쓰고, 통과하는 구현을 쓴다.**

최소한 아래를 덮어라:

- 캐시가 없으면 `fetchCharacterBasic` 을 부르고 결과를 캐시에 쓴다.
- 캐시가 TTL **안**이면 `fetchCharacterBasic` 을 **부르지 않고** 캐시 profile 을 돌려준다.
- 캐시가 TTL **밖**이면 다시 부르고 캐시를 갱신한다.
- 경계: 경과 시간이 정확히 `CHARACTER_BASIC_TTL_MS` 면 만료(재조회).
- `cachedAt` 이 파싱 불가 문자열이면 재조회한다.
- `cachedAt` 이 미래면 재조회한다.
- fetch 가 throw 하면 **그 예외가 그대로 전파되고**, 캐시에 쓰지 않는다.
- 새로 쓰는 엔트리의 `cachedAt` 이 인자로 받은 `now` 와 같다.
- 캐시 쓰기는 인자로 받은 `accountId` 로 이뤄진다(다른 계정 인덱스에 들어가지 않는다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 통과 (기존 개수 + 이 step 이 추가한 케이스)
npm run lint    # 에러 0 (warnings 는 baseline 유지)
# 이 step 이 만드는 것은 신규 2파일뿐이다 — 아래가 비어 있어야 한다
git diff --stat -- src/ | grep -v 'character-basic-fetch' | grep -v '^ [0-9]* file' 
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **판별력 확인**: 구현에서 TTL 가드 분기를 지우면(항상 fetch) 어느 케이스가 실패하는지 확인하고
   되돌려라. 실패하는 케이스가 없으면 그 테스트는 아무것도 담보하지 않는다. 확인 결과를 summary 에 적어라.
3. 아키텍처 체크리스트:
   - `features/` 코드가 `storage/` 어댑터를 거치는가(`@capacitor/preferences` 직접 접근 0건)?
   - `docs/ADR.md` 기술 스택을 벗어나지 않았는가?
   - `CLAUDE.md` CRITICAL 규칙(TDD·어댑터 레이어)을 지켰는가?
4. 결과에 따라 `phases/account-probe-gate/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **기존 호출부 4곳(`use-account-probes.ts`·`prefetch.ts`·`character-roster.ts`·`schedule-sync.ts`)을
  고치지 마라.** 이유: 이 step 은 새 경로를 **놓기만** 한다. 갈아 끼우기는 step 2·3 이 각자의
  좁은 범위로 하며, 그래야 회귀가 났을 때 어느 호출부인지 즉시 좁혀진다.
- **`src/nexon/` 아래 파일을 고치지 마라.** 이유: `nexon/` 은 순수 HTTP 레이어이고 저장소를 모른다.
  TTL 가드는 캐시를 알아야 하므로 `features/` 의 일이다.
- **`fetchCharacterBasic` 을 삭제하거나 시그니처를 바꾸지 마라.** 이유: step 2·3 이 아직 그것을
  쓰고 있고, 가드 없는 원형은 새 모듈이 내부에서 계속 쓴다.
- **`storage/character-basic-cache.ts` 를 고치지 마라.** 이유: 필요한 API
  (`getCachedCharacterBasic`/`setCachedCharacterBasic`)가 이미 그대로 있다. 인덱스 락·마이그레이션
  로직은 [[ADR-086]] 결정 9 의 산물이라 이번 범위 밖이다.
- **기존 테스트를 깨뜨리지 마라.**
