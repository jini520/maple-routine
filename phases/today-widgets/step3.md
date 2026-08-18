# Step 3: boss-display-extract

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/boss-scheduler.md`**
- **`/docs/adr/ADR-147.md` 결정 8** — 이 이동의 근거
- `/docs/adr/ADR-035.md` 결정 3·6·12·20(수동 모드 멤버십) · `/docs/adr/ADR-031.md` 결정 4·5 ·
  `/docs/adr/ADR-142.md` 결정 4
- 코드: `packages/app-rn/src/app/boss-scheduler/BossScreen.tsx` 의 **지역 함수 `displayedBossesOf`** ·
  `packages/core/src/features/boss-scheduler/store.ts` · `packages/core/src/lib/boss-matching.ts` ·
  `packages/core/src/lib/manual-boss-merge.ts` ·
  `packages/app-rn/src/app/boss-scheduler/__tests__/BossScreen.test.tsx`

## 배경

`today` 의 「캐릭터별 남은 스케줄」이 세는 «남은 보스» 는 보스 스케줄러 화면이 보여 주는 것과
**한 글자도 달라선 안 된다.** 그런데 그 «표시 대상 보스» 판정이 지금 `BossScreen.tsx` **안의 지역
함수**라 화면 밖에서 부를 방법이 없다.

그 함수 안에 결정 둘이 갇혀 있다:
- [[ADR-035]] 수동 모드 — 게임 등록 여부가 아니라 **앱의 추적 멤버십**이 표시 목록을 정한다(`mergeManualBossList`)
- [[ADR-031]] 결정 5 — 자동 모드는 **미등록이어도 완료된 보스를 포함**한다(`selectDisplayBosses`)

today 가 자기 버전을 만들면 두 화면이 서로 다른 수를 말하기 시작한다.

## 작업

### 1. 함수를 코어로 꺼낸다

`packages/core/src/features/boss-scheduler/displayed-bosses.ts` (신규):

```ts
export function displayedBosses(
  character: BossCharacterView,
  cycle: BossCycle,
  mode: TrackingMode,
  manualTrackedByOcid: Record<string, ManualTrackedItem[]> | null,
): MatchedBoss[]
```

- **`BossScreen.tsx` 의 지역 함수 본문을 그대로 옮긴다.** 지금 클로저로 읽던 `mode` ·
  `manualTrackedByOcid` 만 인자가 된다.
- **로직을 한 줄도 «이왕 하는 김에» 다듬지 마라.** 이 step 은 **이동**이지 개선이 아니다. 다듬으면
  이동 실패와 리팩터 버그를 구분할 수 없어진다.
- 의존이 코어 모듈(`boss-matching` · `manual-boss-merge` · `types`)과 인자뿐이라 RN 컴포넌트를 안 만진다.
- 파일 머리 주석에 **왜 여기 있는지**를 적어라 — 두 화면(보스 스케줄러 · today)이 같은 판정을 써야 하고,
  그 안에 [[ADR-035]]·[[ADR-031]] 이 들어 있다는 것.

### 2. 호출부 교체

`BossScreen.tsx` 가 지역 함수를 지우고 새 함수를 import 한다. `displayedBossesOf(character, cycle)` 를
쓰던 자리 셋(주간·월간·레일 링)이 인자를 넘기는 형태가 된다.

- **화면의 렌더 결과가 한 픽셀도 바뀌면 안 된다.** 기존 스냅샷(`BossScreen.test.tsx`)이 그것을 지킨다.

## 테스트 (먼저 작성한다)

`packages/core/src/features/boss-scheduler/__tests__/displayed-bosses.test.ts` (신규) — 지금까지
`BossScreen` 을 거쳐야만 검증되던 것을 **입출력으로 직접** 검증한다:

- 자동 모드: 등록된 보스 + **미등록이어도 완료된 보스**가 포함된다([[ADR-031]] 결정 5)
- 자동 모드: `selectDisplayBosses` 의 난이도 선택 규칙이 그대로 성립한다
- 수동 모드: 추적 멤버십 목록이 표시 목록을 정한다([[ADR-035]])
- 수동 모드: 동기화 결과의 완료 여부가 멤버십 항목에 붙는다(`mergeManualBossList`)
- `manualTrackedByOcid` 가 `null` 이거나 그 ocid 키가 없으면 빈 목록
- cycle 필터가 주간/월간을 정확히 가른다

그리고 **`BossScreen.test.tsx` 의 기존 스냅샷이 그대로 통과해야 한다** — 이것이 이동이 성공했다는
유일한 증거다.

## 금지사항

- **시그니처가 나가는 모양을 «개선» 하지 마라**(옵션 객체로 바꾸기 등). 이유: [[ADR-128]] 원칙 1 과 같은
  태도 — 꺼내는 작업과 다듬는 작업을 섞으면 이식이 재작성이 된다.
- **`BossScreen.tsx` 의 다른 부분을 손대지 마라.** 이유: 이 step 의 변경은 «지역 함수 삭제 + import
  + 인자 셋» 뿐이어야 하고, 그래야 스냅샷이 회귀 가드로 기능한다.
- **`selectDisplayBosses` · `mergeManualBossList` 를 고치지 마라.** 이유: 다른 화면이 함께 쓴다.
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

