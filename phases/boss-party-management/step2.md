# Step 2: boss-scheduler-party-store

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `features/boss-scheduler` 설명(파티 인원 설정·솔로/파티 필터 상태를 이 feature가 소유한다는 서술), ADR-019 관련 서술
- `/docs/ADR.md` — ADR-019 "파티 관리" 전체(결정 1~8), 특히 결정 3(미설정=솔로)·결정 4(최대 인원은 boss-crystal-prices.json 재사용)
- `/docs/data/boss-crystal-prices.json` 대신 실제 파일 `/src/data/boss-crystal-prices.json` — `partySizeScaling.defaultMaxPartySize`와 개별 `prices[].maxPartySize` 필드 구조 확인
- `/src/storage/boss-party-settings.ts` — **이전 step에서 만들어진** CRUD 어댑터. 이 step은 이 어댑터만 거쳐 SQLite에 접근한다(직접 접근 금지, CLAUDE.md CRITICAL)
- `/src/features/boss-scheduler/store.ts` — 이번 step에서 확장할 기존 zustand store. `refresh()`가 캐시 우선 표시 후 `syncSchedules`로 재검증하는 기존 흐름을 그대로 유지한 채 파티 인원 로딩을 끼워 넣어야 한다
- `/src/features/boss-scheduler/__tests__/store.test.ts` — 기존 테스트 컨벤션
- `/src/features/boss-profit/store.ts` — `findPriceEntry`/`DEFAULT_MAX_PARTY_SIZE`로 `boss-crystal-prices.json`에서 최대 파티원 수를 조회하는 기존 로직(재사용 또는 참고용, 아래 "작업" 참고)

이전 step에서 만들어진 `storage/boss-party-settings.ts`의 정확한 함수 시그니처를 확인한 뒤 작업하라.

## 작업

`src/features/boss-scheduler/store.ts`(`useBossSchedulerStore`)에 파티 인원 상태를 추가한다.

`BossSchedulerState`/`BossSchedulerStore`에 다음을 추가한다(시그니처 수준 — 내부 구현은 자유):

```ts
// key: `${ocid}:${boss}:${difficulty}` — boss는 matchedBossName ?? apiName(BossCard가 쓰는 것과 동일 기준)
partySizes: Record<string, number>

// ocids의 boss_party_settings를 벌크 조회해 partySizes를 채운다.
loadPartySizes(ocids: string[]): Promise<void>

// storage에 upsert하고, 성공하면 로컬 partySizes도 즉시 갱신한다(낙관적 갱신 — 실패 시 롤백 불필요,
// upsert 자체가 실패하면 예외가 throw되어 호출자가 처리한다).
setPartySize(ocid: string, boss: string, difficulty: string, partySize: number): Promise<void>
```

규칙(ADR-019 결정 3, 데이터 무결성 관련이라 반드시 지킬 것):
- `partySizes`에 키가 없으면 "솔로(1인)"를 의미한다. 이 store는 없는 키를 1로 채워 넣지 않는다 — 맵에 없는 것 자체가 "미설정"이고, 그 해석(뱃지 숨김 등)은 UI(다음 step들)의 책임이다.
- `setPartySize`는 1 이상, 해당 보스의 `maxPartySize` 이하의 정수만 허용해야 한다. 범위를 벗어나면 `features/boss-profit/store.ts`의 `setPartySize`와 동일하게 에러를 throw한다(`Number.isInteger` 체크 포함). `maxPartySize`는 `boss-crystal-prices.json`에서 조회한다 — **새 게임 데이터를 만들거나 다른 값을 하드코딩하지 마라(ADR-006 CRITICAL)**. `features/boss-profit/store.ts`의 `findPriceEntry`/`DEFAULT_MAX_PARTY_SIZE` 로직과 사실상 동일한 조회가 필요한데, 아래 둘 중 하나를 선택해 구현하라(에이전트 재량):
  1. 이 조회 로직을 `src/lib/boss-crystal-prices.ts`(신규)로 추출해 `getMaxPartySize(boss: string, difficulty: BossDifficulty): number`를 export하고, `features/boss-profit/store.ts`도 이 함수를 쓰도록 리팩터링한다.
  2. 또는 `features/boss-scheduler/store.ts` 안에 동일한 조회 로직을 독립적으로 둔다(중복 허용).
  - 어느 쪽을 택하든 `boss-crystal-prices.json`을 참조하는 파싱 로직(가격/최대인원 조회)은 반드시 이 JSON 파일 하나만 참조해야 하고, `features/boss-profit/store.ts`의 기존 동작(가격 조회 등)을 절대 바꾸지 마라.
- `loadPartySizes`는 `refresh(ocids)` 안에서, 기존 캐시 우선 표시/`syncSchedules` 흐름과 **독립적으로** 호출해도 된다(파티 설정은 스케줄 동기화와 무관한 상시 데이터이므로 굳이 캐시-후-재검증 2단계를 거칠 필요 없다 — 한 번의 `getBossPartySettings(ocids)` 조회로 충분하다). `refresh()`의 기존 로직(캐릭터 목록 상태 갱신)을 깨뜨리지 않도록 주의하라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/boss-scheduler/store.ts`가 `storage/boss-party-settings.ts`를 통해서만 SQLite에 접근하는가(직접 접근 없음, CLAUDE.md CRITICAL)?
   - `maxPartySize` 조회가 `boss-crystal-prices.json` 기존 데이터만 참조하고 새로운 수치를 하드코딩하지 않았는가(ADR-006 CRITICAL)?
   - 기존 `refresh`/`selectCharacter`/`saveTrackedOcids`/`loadTrackedOcids` 동작을 변경하지 않았는가?
3. 결과에 따라 `phases/boss-party-management/index.json`의 `step: 2`를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(리팩터링 방식을 택했다면 그 사실도 기록)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `app/boss-scheduler/BossScreen.tsx`(UI)를 이 step에서 수정하지 마라. 이유: 이 step은 store 레이어만 다루며 배지·모달·필터 UI는 이후 step(4, 5)의 범위다.
- `features/boss-profit/store.ts`의 파티원 수 자동 기록 로직(ADR-014의 "이어받기")을 이 step에서 건드리지 마라. 이유: 그 교체 작업은 Step 3(`boss-profit-party-default`)의 범위다. (단, 위 "작업"에서 허용한 `getMaxPartySize` 추출 리팩터링으로 인한 import 변경은 예외적으로 허용된다 — 가격/파티원수 로직의 **동작**은 바꾸지 않는 선에서만.)
- `boss_party_settings`에 없는 키를 기본값 1로 채워 store에 저장하지 마라. 이유: "미설정=솔로"는 UI 렌더링 시점의 해석이어야 하고, store가 미리 1로 채우면 "실제로 1로 설정함"과 "설정 안 함"을 구분할 수 없게 된다(ADR-019 결정 3 위반).
- 기존 테스트를 깨뜨리지 마라.
