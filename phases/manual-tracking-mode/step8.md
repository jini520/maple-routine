# Step 8: manual-checklist-ui-boss

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-035 결정 3, 6, 9, 11, 12 전체
- `/docs/PRD.md` "2. 보스 스케줄러" 절 — 보스 카드 UI, 파티 관리, 솔로/파티 서브 필터
- **이전 step에서 만들어진** `/src/lib/manual-content-merge.ts`(패턴 참고 — 보스용은 별도 함수로 작성하되 구조는 유사하게), `/src/storage/manual-tracked-content.ts`, `/src/features/tracking-mode/store.ts`
- `/src/data/weekly-bosses.json` — `weekly`/`eventWeekly`/`monthly` 배열 shape(`boss`, `difficulties`, `portraitSlug`)
- `/src/types/scheduler.ts`의 `BossContent`(`name`, `difficulty`, `cycle`, `isRegistered`, `isComplete`, `ownComplete`)
- `/src/features/boss-scheduler/store.ts` — 전체(추가/삭제 액션을 넣을 위치)
- `/src/app/boss-scheduler/BossScreen.tsx` — 보스 목록 계산·카드 렌더링·솔로/파티 서브 필터 전체
- `/src/components/DifficultyBadge/` — 난이도 뱃지 컴포넌트(추가 모달에서 재사용)

## 작업

ADR-035 결정 3·6·9·11·12: 컨텐츠와 동일한 원칙을 보스에 적용한다. 다만 보스는 콘텐츠와 달리 카운트형 진행값이 없고 완료 여부(`isComplete`)만 있으므로, 컨텐츠 템플릿 같은 별도 기본값 파일이 필요 없다 — 한 번도 동기화된 적 없는 보스는 그냥 "미완료"가 자연스러운 기본값이다.

### 1. 표시 목록 병합 함수 — `src/lib/manual-boss-merge.ts` 신규

```ts
import type { BossContent, BossCycle } from '../types'
import type { ManualTrackedItem } from '../storage/manual-tracked-content'

// tracked: kind === 'boss'인 manualTrackedContent 항목만 넘긴다(호출부에서 필터링).
// synced: 이 캐릭터의 bossContents(schedulerCache 기반 최신 동기화 결과, cycle 무관 전체).
// 반환 순서는 tracked 배열 순서를 그대로 따른다.
export function mergeManualBossList(
  tracked: ManualTrackedItem[],
  synced: BossContent[],
): BossContent[]
```

동작 규칙(ADR-035 결정 6·12):
- `tracked`의 각 항목을 `(contentName, difficulty)` 쌍으로 `synced`에서 찾는다(보스는 이름만으로 유일하지 않으므로 난이도까지 일치해야 한다). 찾으면 `isRegistered` 값과 무관하게 그 항목의 `isComplete`/`ownComplete`/`cycle`을 그대로 쓴다(ADR-035 결정 12 — 트래커 완료 표시는 기존 `isComplete` 승격 로직과 동일하게 콘텐츠명 기준으로 판정하되, 난이도까지 일치하는 원본 항목을 우선 조회하는 이 병합 함수 자체는 정확한 난이도 매칭을 시도한다).
- `synced`에서 못 찾으면(한 번도 동기화 응답에 나타난 적 없음) `weekly-bosses.json`에서 그 보스의 `cycle`(주간이면 `weekly`/`eventWeekly`, 월간이면 `monthly` 배열에 속해 있는지)을 조회해 채우고, `isComplete: false, ownComplete: false`로 기본값을 채운다. `cycle`을 못 찾으면(템플릿에 없는 보스명) `weekly`로 안전하게 폴백한다(크래시 금지).

### 2. 항목 추가용 템플릿 피커 — `src/app/boss-scheduler/ManualBossPickerModal.tsx` 신규

```tsx
export interface ManualBossPickerModalProps {
  alreadyTracked: Array<{ contentName: string; difficulty: string }>
  onAdd: (contentName: string, difficulty: string) => void
  onClose: () => void
}
```

- `weekly-bosses.json`의 `weekly` + `eventWeekly` + `monthly`를 합쳐 보스 드롭다운(또는 목록) → 난이도 뱃지 선택의 **2단 폼**으로 구성한다 — `PartyManagementModal`(ADR-019, `features/boss-scheduler` 관련 기존 모달)이 이미 "보스 드롭다운 → 난이도 뱃지" 패턴을 쓰고 있다면 그 구조를 그대로 재사용해라(새 인터랙션 패턴을 만들지 마라).
- 난이도 뱃지는 `components/DifficultyBadge`를 재사용한다.
- 이미 `(contentName, difficulty)` 쌍이 `alreadyTracked`에 있으면 그 난이도는 선택지에서 제외(또는 비활성화)한다.
- 자유 텍스트 입력을 두지 마라(ADR-035 결정 11).

### 3. `features/boss-scheduler/store.ts` 수정

- `content-scheduler`의 `addManualContent`/`removeManualContent`(직전 step)와 동일한 패턴으로 `addManualBoss(ocid, contentName, difficulty)`/`removeManualBoss(ocid, contentName, difficulty)`를 추가한다. 보스는 `maxCount` 개념이 없으므로 `ManualTrackedItem`에 `maxCount`를 채우지 않는다.
- 화면에 내려줄 보스 목록 계산을 `trackingMode`에 따라 분기한다:
  - `auto`: 기존 그대로 `isRegistered` 기준.
  - `manual`: `getManualTrackedContent(ocid)`에서 `kind: 'boss'`인 것만 걸러 `mergeManualBossList(...)`로 계산.

### 4. `app/boss-scheduler/BossScreen.tsx` 수정

- `trackingMode === 'manual'`일 때 "캐릭터 관리"/"파티 관리" 버튼 옆에 "보스 추가" 버튼을 추가해 `ManualBossPickerModal`을 연다.
- 기존 보스 카드(`BossCard`, 일러스트 bleed·완료 뱃지·난이도 뱃지 포함 — **새로 만들지 마라**)에 수동 모드일 때만 삭제 진입점을 추가한다(step 7의 컨텐츠 카드 삭제 진입점과 동일한 인터랙션 방식으로 통일하는 것을 권장).
- **솔로/파티 서브 필터(ADR-019)는 트래킹 모드와 무관하게 그대로 동작해야 한다** — `partySizes` 맵 기반 필터링 로직 자체는 이 step에서 건드릴 필요가 없다(수동 모드의 보스 목록도 동일한 필터를 그대로 통과시키면 된다).
- `auto` 모드에서는 이번 step 이전과 완전히 동일하게 보여야 한다.

### 테스트 (TDD)

- `src/lib/__tests__/manual-boss-merge.test.ts`: (1) synced에 있는 (보스, 난이도) 쌍은 등록 여부 무관하게 synced 값을 쓰는지, (2) synced에 없으면 `weekly-bosses.json` 조회로 `cycle`을 채우고 `isComplete: false`인지, (3) 템플릿에도 없는 보스명이면 크래시 없이 `weekly`로 폴백하는지, (4) 순서가 `tracked` 순서를 따르는지.
- `features/boss-scheduler/__tests__/store.test.ts`: `addManualBoss`/`removeManualBoss` 동작 검증.
- `app/boss-scheduler/__tests__/ManualBossPickerModal.test.tsx` 신규: 보스 선택 → 난이도 선택 2단 흐름, 이미 추적 중인 (보스,난이도) 제외, 자유 텍스트 없음.
- 기존 `BossScreen.test.tsx`의 솔로/파티 필터 관련 테스트가 그대로 통과하는지 확인.

테스트를 먼저 작성하고 실패를 확인한 뒤 구현으로 통과시켜라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `mergeManualBossList`가 순수 함수로 `src/lib/`에 있는가?
   - 솔로/파티 서브 필터(ADR-019)가 수동 모드에서도 그대로 동작하는가(회귀 없음)?
   - `auto` 모드 동작이 이번 step 이전과 완전히 동일한가?
   - 새 보스 카드 마크업을 만들지 않고 기존 `BossCard`를 재사용했는가?
3. 이 step으로 ADR-035 구현이 전부 끝난다 — `docs/ADR.md`의 ADR-035 헤더 `(설계, 구현 전)`을 `(구현 완료)`로 갱신하고, `docs/ARCHITECTURE.md`/`docs/PRD.md`에 남아있는 "설계만·구현 전" 표시 중 ADR-035 관련 부분도 함께 정리한다.
4. 결과에 따라 `phases/manual-tracking-mode/index.json`의 `step: 8`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 솔로/파티 서브 필터(ADR-019) 로직을 이 step에서 리팩터링하지 마라. 이유: 이미 완성된 기능이며, 이 step은 그 필터가 소비하는 보스 목록의 소스만 트래킹 모드에 따라 바꾸면 된다.
- `manualTrackedContent`에 `isComplete`/`ownComplete` 같은 값 필드를 캐싱하지 마라(결정 6).
- `weekly-bosses.json`의 값을 수정하지 마라(이미 확정된 게임 레퍼런스 데이터).
- 새 보스 카드나 새 난이도 뱃지 컴포넌트를 만들지 마라 — 기존 `BossCard`/`DifficultyBadge`를 재사용해라.
- 기존 테스트를 깨뜨리지 마라.
