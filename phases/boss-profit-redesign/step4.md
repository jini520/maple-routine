# Step 4: profit-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 "ADR-023" 전체(결정 1~10)
- `/docs/UI_GUIDE.md`의 다음 섹션 전체를 정확한 클래스 값까지 그대로 따른다(새 스타일을 신설하지 마라):
  - "아코디언 (드롭다운 리스트)" (헤더+본문 결합 셸, 아바타, 통합 리스트, 압축 스테퍼, footer 소계)
  - "탭 토글(주간/월간, 일간/주간 등)"
  - "보스 수익 — 주간/월간 탭 + 기간 네비게이터" (탭, 기간 네비게이터, 기간 라벨 규칙, 백필 스피너, 월간 탭 주차별 합계 서브섹션)
  - "스크롤 영역"(이 화면에도 sticky 헤더 패턴이 이미 적용돼있다 — 그 구조를 깨지 마라)
- `src/features/boss-profit/store.ts` (Step 3에서 재구성된 최종 상태 — `BossProfitRow`/`BossProfitWeeklySubtotal`/`BossProfitState`/`BossProfitStore`의 정확한 필드명·타입을 그대로 확인하고 쓴다. 특히 `tab`/`periodKey`/`weeklySubtotals`/`isPeriodLoading`/`periodUnavailable`/`setTab`/`goToPreviousPeriod`/`goToNextPeriod`)
- `src/lib/boss-profit-period.ts` (`formatBossProfitPeriodLabel`, `isLatestPeriod` — 기간 라벨·다음 버튼 비활성화 판단에 쓴다)
- `src/app/boss-profit/BossProfitScreen.tsx` (이번 step에서 재작성할 파일 — 지금 구조를 참고용으로 완전히 읽어라)
- `src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` (기존 테스트 스타일 — 새 구조에 맞게 다시 쓴다)
- `src/app/boss-scheduler/BossScreen.tsx`의 343~376행 (탭 pill의 정확한 클래스 — 이 예시를 그대로 복제해 쓴다, import는 하지 않는다 — 이 프로젝트는 탭 UI를 컴포넌트로 공유하지 않고 각 화면에 그대로 복제하는 관례를 따른다, `ContentScreen.tsx`에도 동일하게 복제돼있다)
- `src/app/boss-scheduler/PartyManagementModal.tsx`의 `PartySizeEditor`(42~111행) — −/+ 스테퍼의 `clamp` 로직과 상호작용 패턴을 참고해 **이 화면에 맞는 압축 사이즈로 복제**한다(공용 컴포넌트로 추출하지 않는다 — 아래 "금지사항" 참고)

## 작업

`src/app/boss-profit/BossProfitScreen.tsx`를 ADR-023·UI_GUIDE.md 스펙에 맞춰 재작성한다.

### 1. 제목·탭·기간 네비게이터

- 제목을 "주간 보스 수익 계산기" → "**보스 수익**"으로 바꾼다.
- 제목 아래에 주간/월간 탭을 `BossScreen.tsx:343-366`과 동일한 클래스로 추가한다(카운트 배지는 없음). 탭 클릭 시 `store.setTab('weekly' | 'monthly')`를 호출한다.
- 탭 행 다음 줄에 기간 네비게이터를 추가한다(UI_GUIDE "기간 네비게이터" 스펙 그대로):
  - `flex items-center justify-center gap-4`
  - 이전 버튼: `h-7 w-7 rounded-full border border-border flex items-center justify-center text-text disabled:opacity-30`, `lucide-react` `ChevronLeft`, 클릭 시 `store.goToPreviousPeriod()`. 항상 활성(하한 없음).
  - 다음 버튼: 동일 스타일, `ChevronRight`, 클릭 시 `store.goToNextPeriod()`. `isLatestPeriod(store.tab, store.periodKey, now)`가 `true`면 `disabled`.
  - 가운데 라벨: `formatBossProfitPeriodLabel(store.tab, store.periodKey, now)`의 `primary`(`text-sm font-semibold text-text`)·`secondary`(`text-xs text-text-muted tabular-nums mt-0.5`)를 두 줄로.
  - `now`는 컴포넌트 렌더 시점에 `new Date()`로 한 번만 구해 재사용한다(렌더마다 새로 만들지 않도록 `useMemo` 등으로 고정해도 되고, 매 렌더 새로 만들어도 실질적 차이는 없다 — 과도한 최적화를 하지 마라).

### 2. 기간 미보유 백필 스피너

`store.isPeriodLoading`이 `true`면 아코디언 목록 대신 UI_GUIDE "기간 미보유 — 자동 재조회 스피너" 스펙 그대로 표시한다:
```
컨테이너: rounded-[14px] border border-dashed border-border p-6 flex flex-col items-center gap-3 text-center
스피너: h-6 w-6 rounded-full border-[3px] border-border border-t-primary animate-spin motion-reduce:animate-none
안내문: text-xs text-text-muted, 예: "{periodLabel.primary} 기록을 불러오는 중..."
```

`store.periodUnavailable`이 `true`면(백필 실패) 간단한 안내 문구(`text-sm text-error`, 예: "이 기간을 불러오지 못했습니다 — 다시 시도해주세요")를 표시한다. 정확한 문구는 UI_GUIDE에도 미확정으로 남아있으니 위 톤을 유지하는 선에서 자유롭게 정한다.

### 3. 캐릭터 아코디언 — 헤더+본문 결합 셸

UI_GUIDE "아코디언" 섹션 스펙을 그대로 따른다:

- 접힘 상태: `rounded-[14px] bg-surface border border-border p-4` (기존과 동일).
- 펼침 상태: 바깥 wrapper `rounded-[14px] bg-surface border border-border overflow-hidden` 안에 헤더(자체 border/rounded/bg 없이 `p-4`)와 본문을 `border-t border-border` 하나로만 구분해 넣는다.
- 헤더 레이아웃: 아바타(`h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold text-text`, 캐릭터명 첫 글자) + 이름(`flex-1 text-sm font-semibold text-text truncate`) + 금액(`text-sm font-bold text-text tabular-nums`, 우측) + 기존 `ChevronDown`/`ChevronUp`.
- 기본 상태는 전부 접힘으로 시작한다(기존과 동일).

### 4. weekly 탭 — 본문(통합 리스트 + footer 소계)

`store.rows`(이미 선택된 (tab, periodKey)로 필터링되어 옴 — 화면에서 `periodLabel`/기간별로 다시 필터링할 필요 없다)를 `ocid`로 그룹화해(기존 `groupRowsByCharacter`와 동일한 로직 재사용 가능) 각 캐릭터 아코디언 본문에 넣는다.

- 행: `flex items-start gap-3 p-4 border-b border-border last:border-b-0`(자체 rounded/bg/border 없음).
- 아이콘: 기존 `BossPortrait`(`h-10 w-10`).
- 1번째 줄: `flex items-baseline gap-1.5 flex-wrap` — 보스명(`text-sm font-semibold text-text`) + 난이도 텍스트(기존 방식 유지 — 이 화면은 `BossScreen.tsx`의 `DifficultyBadge`를 쓰지 않는 기존 관례를 유지한다. 이유: 이 화면은 애초에 난이도를 뱃지가 아닌 텍스트로 표시해왔고 ADR-023도 이 부분을 바꾸라고 지시하지 않았다).
- 2번째 줄: `flex items-center justify-between gap-2 mt-2` — 왼쪽 압축 스테퍼, 오른쪽 정산 금액(`text-sm font-semibold text-text tabular-nums`, "가격 미확정"이면 기존 배지 `rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary` 그대로).
- 압축 스테퍼(UI_GUIDE 스펙):
  ```
  스테퍼: inline-flex items-center gap-2 rounded-full border border-border px-1 py-0.5
  버튼: h-[18px] w-[18px] rounded-full bg-surface-2 flex items-center justify-center text-text disabled:opacity-40
  값: text-xs tabular-nums
  ```
  `-`/`+` 버튼은 각각 `Minus`/`Plus`(lucide-react), 클릭 즉시(별도 저장 버튼 없이) `props.setPartySize(row, clamp(현재값±1, 1, row.maxPartySize))`를 호출한다 — 실패 시 에러 메시지를 행 아래 `text-xs text-error`로 보여준다(기존 `inputError` 패턴과 동일한 역할, 표시 방식만 스테퍼에 맞게 조정). `priceMeso === null`(가격 미확정)이면 스테퍼 전체를 `opacity-40`로 비활성 처리한다(클릭 자체를 막는다).
- footer: `flex items-center justify-between px-4 py-3 bg-surface-2 text-sm` — 왼쪽 "{캐릭터명} 합계"(`text-text-muted`), 오른쪽 그 캐릭터의 `payoutMeso` 합계(`font-semibold tabular-nums text-text`).

### 5. monthly 탭 — 본문(주차별 합계 서브섹션 + 월간 보스 서브섹션)

각 캐릭터 아코디언 본문을 두 서브섹션으로 나눈다(UI_GUIDE "월간 탭" 스펙):

- 서브섹션 라벨: `px-4 pt-3 pb-1 text-[11px] font-bold tracking-wide text-text-muted bg-surface-2` — "주간 보스 수익 · 주차별 합계", "월간 보스 수익".
- 주차 행(그 캐릭터의 `store.weeklySubtotals`에서 `ocid`가 일치하는 항목들, `periodKey` 오름차순): `flex items-center gap-3 p-4 border-b border-border`(아이콘 없음).
  - 라벨: `text-sm font-semibold text-text`("N주차" — `formatBossProfitPeriodLabel('weekly', subtotal.periodKey, now).primary`에서 "이번 주"/"지난 주" 같은 상대 표현이 나오면 그대로 쓰고, 절대 표현("OO월 N주차")이 나오면 그대로 쓴다 — 이미 lib 함수가 규칙을 계산해준다) + 날짜 범위(`text-xs text-text-muted tabular-nums`, `secondary` 값).
  - `state === 'inProgress'`면 "진행 중" 배지(`rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5`).
  - 금액(우측): `state === 'upcoming'`이면 `text-xs text-text-muted`로 "예정", 아니면 `text-sm font-semibold text-text tabular-nums`로 `totalMeso`.
  - `state === 'upcoming'`이면 행 전체에 `opacity-40`.
- 월간 보스 상세 행: 4번(weekly 본문)과 완전히 동일한 보스 행 레시피를 그대로 재사용한다(월간 보스는 `store.rows`에 이미 담겨 온다 — monthly 탭일 때 `store.rows`는 정확히 이 용도다).
- footer 소계는 그 캐릭터의 (주차별 합계 전부 + 월간 보스 payoutMeso 전부)를 합산한 값이다.

### 6. 상단 총 수익 요약 카드

기존 `rounded-[14px] bg-surface border border-border shadow-[0_1px_2px_rgba(0,0,0,0.3),0_4px_12px_rgba(153,117,179,0.18)] p-6 text-center` 카드를 유지하되, 라벨을 `"{periodLabel.primary} 총 수익"`(예: "이번 주 총 수익", "7월 2주차 총 수익")으로 동적으로 바꾸고, 금액은 화면에 표시되는 모든 캐릭터의 footer 소계 합(= `store.rows`의 `payoutMeso` 합, monthly 탭이면 `weeklySubtotals`의 `confirmed`+`inProgress` 합도 더한 값)으로 계산한다.

### 7. 새로고침 버튼

기존 새로고침 버튼(`RefreshCw`)은 그대로 두되, `onClick`에서 여전히 `refresh(trackedOcids ?? [])`를 호출한다. `refresh`는 Step 3에서 "호출 시 항상 그 탭의 현재 기간으로 돌아온다"로 정의됐다 — 즉 과거 기간을 보다가 새로고침을 누르면 자동으로 "지금"으로 돌아온다. 이 동작을 막거나 확인 팝업을 추가하지 마라(정의된 동작 그대로 둔다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `app/boss-profit/BossProfitScreen.tsx` 외 다른 화면 파일을 건드리지 않았는가?
   - UI_GUIDE.md에 명시된 클래스 값을 임의로 바꾸지 않았는가(새 스타일 신설 금지)?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/app/boss-profit/__tests__/BossProfitScreen.test.tsx`를 새 구조에 맞게 다시 작성해 다음을 검증한다:
   - 제목이 "보스 수익"으로 렌더된다
   - 주간/월간 탭 클릭 시 `setTab`이 호출된다
   - ‹/› 버튼 클릭 시 `goToPreviousPeriod`/`goToNextPeriod`가 호출된다. 최신 기간에서는 › 버튼이 `disabled`다
   - `isPeriodLoading`이 `true`면 스피너 컨테이너가 렌더되고 보스 목록은 렌더되지 않는다
   - weekly 탭: 캐릭터 아코디언을 펼치면 보스 행 목록과 footer 소계가 보인다. 압축 스테퍼의 `+` 클릭 시 `setPartySize`가 호출된다
   - monthly 탭: 주차별 합계 서브섹션과 월간 보스 서브섹션이 각각 렌더되고, `state: 'upcoming'`인 주차는 "예정"으로 흐리게 표시된다
4. 실제 브라우저에서 동작을 확인한다(가능하면 `npm run dev`로 접속해 주간/월간 탭 전환, 기간 이동, 스테퍼 조작, 캐릭터 아코디언 펼침/접힘을 눈으로 확인 — CLAUDE.md 프로젝트 지침에 따라 UI 변경은 실제 화면에서 검증한다).
5. 결과에 따라 `phases/boss-profit-redesign/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `PartyManagementModal.tsx`나 그 안의 `PartySizeEditor`를 수정하거나, 이 화면과 공유하는 별도 컴포넌트로 추출하지 마라. 이유: 이 프로젝트는 탭 pill(`BossScreen.tsx`/`ContentScreen.tsx`)처럼 화면마다 UI를 그대로 복제하는 관례를 따르고 있고, 두 스테퍼는 크기 스펙 자체가 다르다(모달은 `h-9 w-9`, 이 화면은 `h-[18px] w-[18px]`) — 상호작용 로직(clamp, 경계 비활성화)만 참고해 이 화면 안에 압축 사이즈로 새로 작성한다.
- `features/boss-profit/store.ts`·`lib/boss-profit-period.ts`·`storage/`·`nexon/`을 수정하지 마라 — 이전 step들에서 이미 완성됐다. 이 화면에서 필요한 로직이 없다고 느껴지면 이미 있는 것을 놓친 건 아닌지 먼저 그 파일들을 다시 확인하라.
- UI_GUIDE.md에 명시된 클래스 값을 다른 값으로 바꾸거나 새 색/스타일을 만들지 마라.
- 기존 테스트를 전부 삭제하고 새로 만들지 마라 — 구조가 크게 바뀌므로 대부분 다시 써야 하지만, 여전히 유효한 케이스(예: "추적 중인 캐릭터가 없습니다" 빈 상태)는 그대로 남긴다.
