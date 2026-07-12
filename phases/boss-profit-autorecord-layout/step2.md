# Step 2: character-dropdown-layout

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-014 결정 3(화면 레이아웃)과 트레이드오프("드롭다운 초기 펼침/접힘 상태 — 기본 접힘 상태로 시작")
- `/docs/PRD.md`의 "4. 주간 보스 수익 계산기" 섹션 중 "확정(2026-07-11) — 화면 레이아웃: 상단 총 수익 + 캐릭터별 드롭다운" 항목
- `/docs/UI_GUIDE.md`의 "아코디언 (드롭다운 리스트)" 섹션(카드 스타일 재사용, `ChevronDown`/`ChevronUp`, 기본 접힘) — 이번 step이 그대로 구현해야 할 스펙
- `src/app/boss-profit/BossProfitScreen.tsx` (이번 step에서 수정할 파일 — 현재 `BossProfitSection`/`BossProfitRowItem`/`rowKey`/`PERIOD_ORDER`/`findPortraitSlug` 구조를 정확히 파악하고 최대한 재사용하라)
- `src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` (기존 테스트 스타일 — `useBossProfitStore`를 모킹하는 방식을 그대로 따른다)
- `src/features/boss-profit/store.ts` — `BossProfitRow`(특히 `ocid`/`characterName`/`periodLabel`/`payoutMeso`) 시그니처 확인(이전 phase 산출물, 이번 step에서 store는 수정하지 않는다)

## 작업

`src/app/boss-profit/BossProfitScreen.tsx`를 재구성하라. 기존 `BossProfitRowItem`(보스 한 행)과 `BossProfitSection`(기간별 합계+목록)은 그대로 재사용한다 — 새로 만들지 않는다. 바뀌는 건 이 둘을 감싸는 상위 구조다.

1. **상단 전체 합계**: `rows`에서 `periodLabel === '이번 주'`인 행들의 `payoutMeso`(널은 0으로 취급) 합을 구해 화면 최상단(제목 아래, 캐릭터 목록 위)에 카드 형태로 크게 표시한다. 라벨은 "이번 주 총 수익", 값은 `{합계.toLocaleString()} 메소`. 월간 보스(`periodLabel === '이번 달'`)는 이 합계에 포함하지 않는다(ADR-014). `rows.length === 0`이면(처치한 보스 자체가 없음) 이 카드를 표시하지 않는다 — 기존 빈 상태 문구만 보여준다.
2. **캐릭터별 그룹핑**: `rows`를 `ocid` 기준으로 그룹핑한다. 그룹 순서는 `rows` 배열에 각 `ocid`가 처음 등장하는 순서를 따른다(별도 정렬 기준을 새로 만들지 마라 — 스토어가 만든 순서를 그대로 신뢰한다).
3. **캐릭터별 드롭다운(아코디언)**: 그룹마다 `UI_GUIDE.md`의 아코디언 스펙대로 헤더 하나를 렌더링한다.
   - 헤더 텍스트: `{characterName} · {그 캐릭터의 '이번 주' payoutMeso 합.toLocaleString()} 메소`(널은 0으로 취급 — 그 캐릭터가 주간 보스를 아직 안 잡았어도 헤더 자체는 항상 보인다).
   - 헤더 우측에 펼침 상태에 따라 `ChevronDown`(접힘)/`ChevronUp`(펼침) 아이콘(`lucide-react`, `strokeWidth={2}`).
   - 클릭 시 펼침/접힘을 토글하는 로컬 상태(컴포넌트 하나가 캐릭터 하나를 담당하는 하위 컴포넌트를 만들어 `useState`로 관리하라 — 화면 전체 상태에 넣지 않는다). **기본값은 접힘(false)**이다(ADR-014).
   - 펼쳤을 때: 그 캐릭터의 `rows`만 필터링해 기존 `PERIOD_ORDER`/`BossProfitSection` 로직을 그대로 적용한다(그 캐릭터의 "이번 주"/"이번 달" 섹션이 있는 것만 렌더링 — 기존 최상위 화면이 하던 걸 캐릭터 스코프로 좁혀서 그대로 재사용).
4. **로딩/에러/추적 캐릭터 없음/처치 보스 없음** 상태 분기는 기존 로직을 그대로 유지한다(변경 없음) — 이번 step은 `status === 'loaded' && rows.length > 0`일 때의 렌더링 구조만 바꾼다.
5. `setPartySize`를 각 `BossProfitRowItem`에 그대로 내려주는 배선(props)은 기존과 동일하게 유지한다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`app/boss-profit/`, `features/boss-profit/store.ts`는 수정하지 않았는가)
   - UI_GUIDE.md "아코디언" 스펙(카드 스타일 재사용, 기본 접힘, Chevron 아이콘)을 따르는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/app/boss-profit/__tests__/BossProfitScreen.test.tsx`에 케이스를 추가해 다음을 검증하라:
   - 상단 합계가 여러 캐릭터의 "이번 주" `payoutMeso`만 합산하고(월간 보스는 제외) 표시되는지
   - 캐릭터별 드롭다운이 기본 상태(마운트 직후)에는 접혀 있어 보스 행(`BossProfitRowItem`이 렌더링하는 텍스트)이 보이지 않는지
   - 드롭다운 헤더를 클릭하면 펼쳐지며 그 캐릭터의 보스 행이 나타나는지, 다시 클릭하면 접히는지
   - 드롭다운 헤더에 그 캐릭터의 "이번 주" 소계가 표시되는지(다른 캐릭터의 수익이 섞이지 않는지)
   - `rows`가 비어있으면(추적 캐릭터는 있지만 처치 보스 없음) 상단 합계 카드 없이 기존 빈 상태 문구만 보이는지
4. 결과에 따라 `phases/boss-profit-autorecord-layout/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `BossProfitRowItem`·`BossProfitSection`의 기존 로직(파티원 수 입력, 에러 표시, 가격 미확정 배지, 섹션 합계 계산)을 새로 다시 만들지 마라 — 그대로 재사용한다.
- `features/boss-profit/store.ts`나 `storage/boss-profit.ts`를 수정하지 마라(이전 두 step의 산출물이며 이번 step은 화면 레이어만 다룬다).
- 드롭다운 펼침 상태를 전역 상태(Zustand 등)로 관리하지 마라 — 화면을 벗어나면 사라져도 되는 순수 로컬 UI 상태다.
- "이번 주 / 월간 추이" 탭이나 히스토리 차트를 만들지 마라 — 여전히 1차 구현 범위 밖이다(PRD·ARCHITECTURE.md 확정 사항).
- `App.tsx`나 다른 화면을 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
