# Step 5: basic-piggyback

이 step 은 **GitHub 이슈 #139** 를 해결한다([[ADR-097]] 결정 7).

**증상**: 인게임에서 캐릭터의 **레벨·외형이 바뀌어도 앱에는 반영되지 않는다.** 캐릭터 관리 모달(피커)을 열기 전까지 옛 값이 그대로 표시된다.

**원인**: `character/basic` 을 호출해 캐시를 갱신하는 상시 경로가 **피커 하나뿐**이다. `fetchCharacterBasic` 호출부는 셋뿐이고(피커 로스터 `features/schedule-sync/character-roster.ts` · 온보딩 예열 `features/onboarding/prefetch.ts` · 계정 후보 판정 `features/onboarding/use-account-probes.ts`), 표시하는 쪽은 전부 `getCachedCharacterBasic` 만 읽어 갱신을 유발하지 않는다. 그래서 레벨·외형·월드·길드가 **피커를 마지막으로 연 시점의 스냅샷으로 굳는다.**

**처방**: 스케줄 동기화가 **실제로 도는 회차에** 그 대상 캐릭터의 `character/basic` 을 함께 받아 캐시를 갱신한다. 별도 TTL 을 두지 않는다 — 동기화의 호출 정책을 그대로 물려받는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — **TDD: 테스트 먼저**)
- `/docs/README.md` (문서 인덱스)
- `/docs/adr/ADR-097.md` (결정 원장 — 특히 **결정 7·8**)
- `/docs/adr/ADR-015.md` (피커의 `character/basic` 병렬 조회 — 결정 3의 2026-08-06 확장 표기를 읽어라)
- `/docs/adr/ADR-008.md` (프리플라이트 1건 + 나머지 병렬 — 이 step 이 지켜야 할 순서의 근거)
- `/docs/foundation/nexon-api.md` (`character/basic` 항목 — 응답이 무엇을 주는지)
- `/src/features/schedule-sync/schedule-sync.ts` (이번 수정 대상 — `syncSchedules`)
- `/src/features/schedule-sync/character-roster.ts` (피커 경로의 기존 구현 — `fetchCharacterBasic` → `setCachedCharacterBasic` 형태를 참고하라. **이 파일은 고치지 않는다**)
- `/src/storage/character-basic-cache.ts` (`setCachedCharacterBasic(accountId, ocid, { profile, cachedAt })`)
- `/src/features/schedule-sync/__tests__/schedule-sync.test.ts` (기존 테스트)

## 작업

`src/features/schedule-sync/schedule-sync.ts` 에 내부 함수를 더하고 `syncSchedules` 안에서 부른다.

```ts
// 절대 throw 하지 않는다. 실패는 그 캐릭터의 기존 캐시를 그대로 두는 것으로 끝난다.
async function refreshCharacterBasics(
  apiKey: string,
  accountId: string,
  characters: MapleCharacter[],
): Promise<void>
```

- 캐릭터별로 `fetchCharacterBasic(apiKey, ocid)` 를 **병렬** 호출하고, 성공한 것만 `setCachedCharacterBasic(accountId, ocid, { profile, cachedAt: new Date().toISOString() })` 로 쓴다.
- `accountId` 는 `syncSchedules` 가 이미 `resolveRegisteredCharacters()` 결과로 갖고 있다.

### 호출 위치 — 순서가 결정의 일부다

`syncSchedules` 는 [[ADR-008]] 에 따라 **첫 캐릭터를 프리플라이트로 먼저 호출**해 401/403·429 같은 전역 실패인지 확인하고, 전역 실패면 나머지는 API 를 더 부르지 않는다.

→ **`isGlobalFailure` 로 걸러 낸 뒤**, 나머지 캐릭터를 병렬 동기화하는 구간과 **같은 `Promise.all` 로 묶어** 부른다. 대상은 **`targetCharacters` 전체**다(프리플라이트로 이미 동기화한 첫 캐릭터도 basic 갱신 대상이다).

```ts
const [restResults] = await Promise.all([
  Promise.all(rest.map(/* 기존 syncOneCharacter 흐름 그대로 */)),
  refreshCharacterBasics(apiKey, accountId, targetCharacters),
])
```

이렇게 하면 basic 호출이 스케줄 호출과 **동시에** 나가므로 체감 대기 시간이 늘지 않는다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (신규 테스트 포함)
npm run lint    # ESLint 통과
```

### 테스트에 반드시 포함할 항목

`src/features/schedule-sync/__tests__/schedule-sync.test.ts` 에 `describe('character/basic 편승 갱신 (ADR-097 결정 7)')` 를 더한다.

- 추적 캐릭터 N명을 동기화하면 `fetchCharacterBasic` 이 **N회** 불리고 `setCachedCharacterBasic` 이 `cachedAt` 과 함께 쓰인다.
- **`character/basic` 이 reject 해도** 그 캐릭터의 동기화 결과가 `isStale: false` 로 정상이다(스케줄 조회는 성공했으므로).
- **전역 실패**(프리플라이트가 401/429)면 `fetchCharacterBasic` 호출이 **0회**다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/foundation/architecture.md` 레이어 규칙 — `features/*` 는 `nexon/`·`storage/` 어댑터를 통해서만 외부에 접근한다.
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/sync-ttl-gate/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(함수명·호출 위치·실패 정책)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`syncOneCharacter` 의 `try` 블록 안에서 `fetchCharacterBasic` 을 부르지 마라.** 이유: basic 실패가 `catch` 로 떨어져 `buildFallbackResult` 를 타면, **스케줄 조회는 성공했는데도** 그 캐릭터가 `isStale: true` 로 표시되고 "오래된 데이터" 토스트가 뜬다.
- **프리플라이트 전에 부르지 마라.** 이유: API 키가 죽었거나(401) 한도를 넘긴(429) 상황에서 캐릭터 수만큼의 호출을 낭비한다 — [[ADR-008]] 이 막으려던 바로 그 일이다.
- **`await` 없이 던져놓지 마라(fire-and-forget 금지).** 이유: 호출부(세 스토어)가 `syncSchedules` 반환 직후 `character-basic-cache` 를 읽어 정렬·아바타·레벨을 만든다. 기다리지 않으면 그 회차 화면에 반영될지가 레이스로 갈린다.
- **`resolveCharacterEligibility`(자격 스윕)를 부르지 마라.** 이유: 추가 네트워크 호출을 낳고, 추적 캐릭터는 사용자가 이미 고른 대상이라 자격 판정이 필요 없다. 그 스윕은 피커 경로의 몫이다([[ADR-086]] 결정 5).
- **`character-roster.ts`(피커 경로)를 고치지 마라.** 이유: 피커는 이 정책 밖이고 현행 유지다([[ADR-097]] 결정 8) — 그 자리는 추적하지 않는 캐릭터의 자격(`access_flag`)을 판정하는 유일한 경로다.
- **`character/basic` 실패를 사용자에게 알리지 마라**(토스트·에러 상태 금지). 이유: 이 갱신은 부가 작업이고, 실패해도 기존 캐시로 화면이 정상 동작한다.
- 기존 테스트를 깨뜨리지 마라.
