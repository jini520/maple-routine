# Step 0: sync-single-flight

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- **`/docs/adr/ADR-147.md` 결정 4 전문** — 이 step 이 왜 today 보다 먼저인지가 거기 있다
- **`/docs/adr/ADR-132.md` 결정 8** — 이 구멍을 열어 두고 기한을 «today 에 내용이 붙는 시점» 으로 못 박은 원문
- `/docs/adr/ADR-097.md` 결정 1~4·7 · `/docs/adr/ADR-101.md` 결정 3
- 코드: `packages/core/src/features/schedule-sync/schedule-sync.ts` ·
  `packages/core/src/features/schedule-sync/sync-run-state.ts` ·
  `packages/core/src/lib/sync-freshness.ts` · `packages/core/src/features/prehydrate.ts` ·
  `packages/core/src/features/schedule-sync/__tests__/`

## 배경

[[ADR-097]] 결정 3 의 진입 게이트는 두 조건을 함께 본다 —
*건너뛴다 = 이번 실행에서 이미 시도함 **AND** 가장 오래된 `syncedAt` 이 10분 안*.

그런데 **플래그는 성공이 아니라 «시도» 를 기록하고**(`markSyncAttemptedThisRun`) **신선도는 호출이
끝나야** 갱신된다. 그래서 동기화가 **날아가는 중**에 다른 화면이 진입하면 게이트가
`시도함 = true` · `신선함 = false` 를 보고 **같은 호출을 한 번 더** 낸다.

지금은 `prehydrate.ts` 가 세 스토어를 **순차로** 돌아 이 창이 열리지 않는다. today 가 붙으면 그
순차 **밖**의 네 번째 트리거가 생기고, today 가 첫 화면이라 **실행당 첫 동기화를 대개 이 화면이
낸다** — 예외가 아니라 지배 경로다.

## 작업

`packages/core/src/features/schedule-sync/schedule-sync.ts` 에 **단일 비행(single-flight)** 을 넣는다.

```ts
// 모듈 수준. 진행 중인 회차가 있으면 그 프라미스를 함께 기다린다.
// 성공·실패와 무관하게 정산(settle)되면 즉시 비운다.
let inFlight: Promise<SyncSchedulesResult> | null = null
```

- **키는 «회차» 하나다. `ocid` 집합을 키로 삼지 마라.** 이유: 스케줄러 셋과 today 가 **같은 추적
  목록**을 보므로 집합이 늘 같고, 집합을 키로 두면 목록이 조금 다른 조합에서 여전히 두 번 나간다.
  집합별 맵을 만들면 «같은 캐릭터를 두 번 부르지 않는다» 를 보장할 수 없다.
- **정산 즉시 비운다.** 실패한 회차를 캐시해 두면 네트워크가 돌아와도 다음 진입이 그 실패를 다시
  받는다. `finally` 로 `inFlight = null`.
- **`markSyncAttemptedThisRun()` 호출 시점을 바꾸지 마라.** 그 플래그는 «시도» 를 기록하는 것이 정책이고
  ([[ADR-097]] 결정 3 의 주석), 단일 비행은 그 정책을 고치는 것이 아니라 **중복 호출을 접는 것**이다.
- **호출부를 하나도 고치지 마라.** 세 스토어와 앞으로 붙을 today 가 지금 시그니처 그대로 부른다.
  단일 비행은 이 파일 안에서 끝나야 한다.
- **테스트 전용 리셋을 둔다** — `sync-run-state.ts` 의 `resetSyncRunStateForTests` 와 같은 관례로
  모듈 상태를 비우는 함수를 export 하고, 프로덕션에서 부르지 말라는 주석을 단다.

### `prehydrate` 는 건드리지 않는다

`prehydrate.ts` 가 순차인 근거는 *"신선도는 앞 회차가 캐시를 다 쓴 뒤에야 참이 된다"*([[ADR-101]]
결정 3)이고, 단일 비행이 서면 병렬로 돌려도 호출이 늘지 않게 된다. **그래도 이 step 에서는 순차를
풀지 마라** — 고치는 것은 구멍이지 성능이 아니다. 순차를 푸는 것은 근거가 사라졌다는 사실을 확인한
뒤의 별건이다.

## 테스트 (먼저 작성한다)

`packages/core/src/features/schedule-sync/__tests__/schedule-sync.test.ts` 에 추가:

1. **동시 호출 두 건이 네트워크를 한 번만 탄다** — 첫 호출을 pending 으로 잡아 둔 채 둘째를 부르고,
   `fetch` 스파이 호출 수가 1 인지 본다.
2. **둘 다 같은 결과를 받는다** — 두 프라미스의 resolve 값이 동일 객체/동일 내용.
3. **정산 뒤의 호출은 새 회차다** — 첫 회차를 끝낸 뒤 다시 부르면 네트워크가 다시 탄다.
4. **실패도 공유되고, 실패 뒤에는 새 회차가 뜬다** — 첫 회차가 reject 하면 둘 다 reject 하고,
   그 다음 호출은 다시 시도한다.
5. **회귀 가드** — 단일 호출 경로의 호출 수·순서·인자가 지금과 같다.

## 금지사항

- **`ocid` 집합을 키로 한 맵을 만들지 마라.** 이유: 위 «키는 회차» 항목.
- **`prehydrate.ts` 를 고치지 마라.** 이유: 위 절.
- **`sync-run-state.ts` 의 플래그 의미(«성공» 이 아니라 «시도»)를 바꾸지 마라.** 이유: 네트워크가 죽은
  동안 탭을 옮길 때마다 실패 호출이 반복되는 것을 그 선택이 막고 있다([[ADR-097]] 결정 3 주석).
- 기존 테스트를 깨뜨리지 마라.

## Acceptance Criteria

```bash
npm run build                                       # core 타입 검사 포함
npx tsc --noEmit -p packages/app-rn/tsconfig.json   # RN 타입 (루트 tsconfig 는 참조 스텁이라 무의미하다)
npm test                                            # vitest(core·capacitor) + jest(app-rn)
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. 아키텍처 체크리스트:
   - `/docs/foundation/architecture.md` 디렉토리 구조를 따르는가?
   - CLAUDE.md CRITICAL — `features/*` 가 저장소·네이티브를 직접 만지지 않는가([[ADR-003]]·[[ADR-005]])?
   - CLAUDE.md CRITICAL — `src/data/` 의 게임 수치를 임의로 추정하지 않았는가([[ADR-006]])?
   - 새 컴포넌트를 만들었다면 아토믹 계층 자리가 맞는가(`components/__tests__/layer-dependencies.test.ts`)?
3. 결과에 따라 `phases/today-widgets/index.json` 의 해당 step 을 갱신한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 즉시 중단

