# Step 6: today-view-model

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/today.md` 전문** (특히 「데이터」·「위젯 여덟」)
- **`/docs/adr/ADR-147.md` 결정 4·8·9 + 정정 3·4·9·12**
- `/docs/features/content-scheduler.md` · `/docs/features/boss-scheduler.md` ·
  `/docs/features/boss-profit.md`(「아이템 수익 합산」) · `/docs/adr/ADR-054.md`(결정석 한도)
- 코드(읽기만): `packages/core/src/features/content-scheduler/store.ts` ·
  `packages/core/src/features/boss-scheduler/store.ts` · `packages/core/src/features/boss-profit/store.ts` ·
  `packages/core/src/features/boss-profit/drop-history-store.ts` ·
  `packages/core/src/lib/drop-price.ts` · `packages/core/src/lib/drop-history.ts` ·
  `packages/core/src/lib/reset-clock.ts` · `packages/core/src/lib/boss-matching.ts` ·
  `packages/app-rn/src/app/content-scheduler/content-completion.ts`
- **step 2·3 산출물**: `resolveDisplayRepresentative` · `features/boss-scheduler/displayed-bosses.ts`

## 배경

**위젯은 스토어를 모른다**([[ADR-147]] 결정 4). 화면이 스토어 넷을 읽어 뷰모델 하나를 만들고 위젯에
프롭으로 준다. 이 step 은 그 **조립을 순수 함수로** 만든다 — 스토어를 안 만지므로 위젯이 전부 stub 인
지금 상태에서 **로직 전부를 검증할 수 있다.**

## 작업

`packages/app-rn/src/app/today/view-model.ts` (신규).

```ts
export interface TodayViewModel {
  representative: RepresentativeView | null
  schedule: ScheduleRowView[]          // 정렬 완료
  scheduleTotal: number
  profit: WeeklyProfitView
  topItem: TopItemView | null
  unpricedCount: number
  crystalLimits: CrystalLimitView[]    // 월드별
  drought: DroughtView | null
  resets: ResetCountdownView
}

export function buildTodayViewModel(input: TodayViewModelInput): TodayViewModel
```

`TodayViewModelInput` 은 **스토어 «상태» 를 그대로 받는다**(스토어 인스턴스가 아니라 값). `now: Date`
도 인자다 — 시계를 인자로 받아야 카운트다운·기간 판정이 테스트에서 고정된다.

### 계산 규칙 — 여기서 새로 만들지 말고 **있는 것을 쓴다**

| 값 | 반드시 쓸 것 |
|---|---|
| 컨텐츠 완료 판정 | `app/content-scheduler/content-completion.ts` 의 `dailyContentCompletion`·`weeklyContentCompletion` |
| 표시 대상 보스 | step 3 의 `displayedBosses(character, cycle, mode, manualTrackedByOcid)` |
| 아이템 수익 합산 | `lib/drop-price.ts` 의 `sumDropPayout` |
| 결정석 한도 분모 | `lib/boss-matching.ts` 의 `WEEKLY_CRYSTAL_SALE_LIMIT` |
| 가뭄 요약 | `lib/drop-history.ts` 의 `summarizeValuableDrought` |
| 초기화 시각 | `lib/reset-clock.ts` |
| 대표 캐릭터 | step 2 의 `resolveDisplayRepresentative` |

**판정을 이 파일에서 다시 구현하면 두 화면이 다른 수를 말하기 시작한다.** 이것이 이 step 의 가장 큰
금지사항이다.

### 남은 스케줄 — 분류·정렬 (정정 3·9·12)

- 분류 넷: **일퀘 · 주간퀘 · 주간 보스 · 검마**. 각각 «남은 개수» 만 센다.
  - 「검마」는 월간 보스가 검은마법사 하나뿐이라 종류 이름 대신 고유명을 쓴다. **`weekly-bosses.json`
    에서 자동 복수화하지 마라** — 월간 보스가 둘이 되면 그때 사람이 다시 정한다([[ADR-006]] 태도).
  - `unmeasurable`(무릉도장 등)은 세지 않는다 — `content-completion.ts` 가 이미 그 규칙을 갖고 있다.
- **정렬**: 남은 개수 **내림차순** → 동수면 **추적 목록(캐릭터 관리) 순서**.
- **동기화 실패 캐릭터는 언제나 맨 아래**(사용자 확정). 남은 개수를 «모르는» 것이라 정렬에서 0으로
  취급한다 — 위로 올리면 «제일 밀린 캐릭터» 자리를 모르는 값이 거짓으로 차지한다.
  `characterIssues`([[ADR-068]] 결정 3)로 판정한다.
- **모든 캐릭터를 담는다.** 「외 N명」 접기가 없다 — 자르는 것은 위젯이 아니라 **없다**.

### 주간 보스 수익 (정정 4)

- **결정석 + 아이템**([[ADR-124]]). 아이템은 `sumDropPayout`.
- **증감을 계산하지 마라** — `previousPeriodTotalMeso` 를 이 화면은 쓰지 않는다.
- **기록이 없으면 `0`** 이되, «기록이 하나도 없다» 를 **별도 불리언**으로 함께 실어라
  (위젯이 «0 메소» 옆에 한 줄을 그릴 수 있어야 한다 — 0원과 미기록이 완전히 같은 그림이 되면 안 된다).
- 캐릭터별 top3 도 여기서 정렬해 담는다.

### 최고가 아이템 (결정 9 · 정정 5)

- **`priceState === 'entered'` 인 기록만 순위에 넣는다.** 미입력을 «0메소 후보» 로 넣지 마라 — 값을
  모르는 것을 가장 싼 것으로 단정하는 일이다.
- top 5 까지 담는다(4x2 가 쓴다).
- `unpricedCount` 는 `priceState === undefined` 인 건수 — **별도 필드**다(최고가 뷰 안에 넣지 마라,
  그 값은 위젯 7 의 것이다).

## 테스트 (먼저 작성한다)

`packages/app-rn/src/app/today/__tests__/view-model.test.ts`:

- 정렬: 남은 개수 desc · 동수면 목록 순서 · **실패는 맨 아래**(개수가 많아도)
- 분류 넷의 개수가 `content-completion`·`displayedBosses` 의 판정과 일치한다
- `unmeasurable` 항목은 안 센다
- 대표: 저장된 대표 / 미지정이면 첫 번째 / 목록이 비면 `null`
- 수익: 결정석 + 아이템 합 · 기록 0건이면 `0` 이고 «미기록» 플래그가 참
- 최고가: 미입력 기록은 순위에서 빠진다 · 전부 미입력이면 `topItem === null` 이고 `unpricedCount > 0`
- 결정석: 월드별로 갈리고 분모가 `WEEKLY_CRYSTAL_SALE_LIMIT`
- 초기화: `now` 를 고정하면 카운트다운이 결정적이다

## 금지사항

- **완료 판정·표시 보스·수익 합산·한도 분모를 이 파일에서 다시 구현하지 마라.** 이유: 위 표.
  두 벌이 되면 today 와 원래 화면이 다른 수를 말한다.
- **스토어를 import 하지 마라.** 이유: 순수 함수여야 스토어 목킹 없이 값 조합만으로 테스트가 선다.
  상태는 인자로 받는다.
- **`new Date()` 를 이 파일에서 부르지 마라.** 이유: `now` 를 인자로 받아야 카운트다운·기간 판정이
  테스트에서 고정된다.
- **「외 N명」 접기·상한을 넣지 마라.** 이유: 사용자 확정 — 선택된 캐릭터를 전부 출력한다.
- **증감(`previousPeriodTotalMeso`)을 계산하지 마라.** 이유: [[ADR-147]] 정정 4.
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

