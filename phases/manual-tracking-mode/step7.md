# Step 7: manual-checklist-ui-content

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-035 결정 3, 6, 7, 8, 9, 11, 12 전체
- `/docs/PRD.md` "1. 컨텐츠 스케줄러" 절 — 일간/주간 카드 UI가 이미 어떤 모양인지(일일퀘스트 카드, 주간 콘텐츠 카드 4종)
- `/docs/UI_GUIDE.md` — 관련 카드 스펙(있다면)
- **이전 step들에서 만들어진** `/src/storage/manual-tracked-content.ts`(`ManualTrackedItem`), `/src/features/tracking-mode/store.ts`(`useTrackingModeStore`)
- `/src/data/scheduler-content-template.json` — daily/weekly 배열 shape(확정 데이터)
- `/src/types/scheduler.ts` — `DailyContent`/`WeeklyContent`
- `/src/features/content-scheduler/store.ts` — `ContentCharacterView`, `refresh`, `saveTrackedOcids` 전체
- `/src/app/content-scheduler/ContentScreen.tsx` — `registeredDailyContents`/`registeredWeeklyContents` 계산부(632~637줄 부근)와 카드 렌더링 부분 전체

## 작업

ADR-035 결정 3·6·8·11: 수동 모드에서는 게임 등록 여부(`isRegistered`)가 아니라 사용자가 앱에서 직접 관리하는 체크리스트(`manualTrackedContent`)로 컨텐츠 스케줄러의 표시 목록을 결정한다. 실제 진행값(`nowCount`/`questState`)은 항상 동기화 결과(`schedulerCache`)에서 조회하고, 한 번도 동기화된 적 없는 항목만 템플릿 기본값으로 대체한다.

### 1. 표시 목록 병합 함수 — `src/lib/manual-content-merge.ts` 신규 (순수 함수, 이 step에서 가장 먼저 TDD로 작성)

```ts
import type { DailyContent, WeeklyContent } from '../types'
import type { ManualTrackedItem } from '../storage/manual-tracked-content'

export interface SchedulerContentTemplateEntry {
  content_name: string
  type: 'contents' | 'quest'
  registration_flag: 'true' | 'false'
  now_count: number
  max_count: number
  quest_state: '0' | '1' | '2' | null
}

// tracked: kind === 'content'인 manualTrackedContent 항목만 넘긴다(호출부에서 필터링).
// synced: 이 캐릭터의 dailyContents 또는 weeklyContents(schedulerCache 기반 최신 동기화 결과).
// template: scheduler-content-template.json의 daily 또는 weekly 배열(캐릭터 무관 default).
// 반환 순서는 tracked 배열 순서를 그대로 따른다(사용자가 추가한 순서 유지).
export function mergeManualContentList(
  tracked: ManualTrackedItem[],
  synced: DailyContent[] | WeeklyContent[],
  template: SchedulerContentTemplateEntry[],
): DailyContent[] // WeeklyContent와 shape이 동일하므로 반환 타입은 호출부가 필요한 쪽으로 캐스팅 가능
```

동작 규칙(ADR-035 결정 6·8):
- `tracked`의 각 항목을 `contentName`으로 `synced`에서 이름이 일치하는 항목을 찾는다. **찾으면 `isRegistered` 값과 무관하게(수동 모드는 등록 여부를 아예 무시한다) 그 항목의 `nowCount`/`maxCount`/`questState`/`kind`를 그대로 쓴다.**
- `synced`에서 못 찾으면(한 번도 동기화 응답에 나타난 적 없음) `template`에서 `content_name`이 일치하는 항목을 찾아 `now_count`/`max_count`/`quest_state`/`type`을 그대로 옮겨온다(문자열 `quest_state`는 숫자 또는 null로 변환).
- 둘 다 없으면(템플릿 갱신 누락 등 방어적 케이스) 그 항목은 결과에서 제외하지 말고 `maxCount: 0, nowCount: 0, questState: null`인 안전한 기본값으로 채워 넣는다(크래시 금지, ADR-008 원칙과 동일한 정신) — 콘솔 경고 등은 필요 없다.

### 2. 항목 추가용 템플릿 피커 — `src/app/content-scheduler/ManualContentPickerModal.tsx` 신규

```tsx
export interface ManualContentPickerModalProps {
  tab: 'daily' | 'weekly'
  alreadyTracked: string[] // contentName 목록 — 이미 추적 중인 항목은 후보에서 제외
  onAdd: (contentName: string) => void
  onClose: () => void
}
```

- `scheduler-content-template.json`의 `daily` 또는 `weekly` 배열(`tab`에 따라 선택)에서 `alreadyTracked`에 없는 항목만 목록으로 보여준다. **자유 텍스트 입력 칸을 두지 마라**(ADR-035 결정 11 — 고정 템플릿에서 고르는 방식만 허용).
- `components/Modal`을 재사용한다(설정 화면의 `ThemeModal` 등과 동일한 패턴).
- 항목 탭 시 `onAdd(contentName)` 호출 후 모달을 닫는다(1회 선택 = 1회 추가, 여러 개를 한 번에 추가하는 체크박스 목록으로 만들 필요는 없다 — 단순하게).

### 3. `features/content-scheduler/store.ts` 수정

- `trackingMode`(useTrackingModeStore 구독 또는 파라미터로 전달 — 스토어 간 참조 방식은 `saveTrackedOcids`에서 이미 `useTrackingModeStore.getState()`를 쓴 전례를 따른다)에 따라 화면에 내려줄 목록 계산을 분기하는 헬퍼를 추가한다. 정확히 어디에 둘지(스토어 안 selector 함수 vs `app/content-scheduler`의 로컬 계산)는 재량이나, **기존 `registeredDailyContents`/`registeredWeeklyContents` 계산(ContentScreen.tsx 632~637줄)을 다음처럼 분기**하게 만든다:
  - `auto` 모드: 기존 그대로 `.filter(c => c.isRegistered)`.
  - `manual` 모드: `getManualTrackedContent(ocid)`로 읽은 목록 중 `kind: 'content'`인 것만 걸러 `mergeManualContentList(...)`에 넘겨 계산.
- 추가/삭제 액션을 스토어에 추가한다:
  ```ts
  addManualContent(ocid: string, contentName: string): Promise<void>
  removeManualContent(ocid: string, contentName: string): Promise<void>
  ```
  두 함수 모두 `getManualTrackedContent(ocid)`로 현재 배열을 읽고, 추가/삭제 후 `setManualTrackedContent(ocid, next)`로 다시 저장한 뒤 화면 상태를 갱신한다. `addManualContent`가 `maxCount`를 채울 때는 **템플릿 파일의 `max_count`를 그대로 복사**한다(ADR-035 결정 7 — 사용자가 숫자를 입력하는 UI는 없다).

### 4. `app/content-scheduler/ContentScreen.tsx` 수정

- `trackingMode === 'manual'`일 때 "캐릭터 관리" 버튼 옆(또는 각 탭 리스트 하단)에 "항목 추가" 버튼을 추가해 `ManualContentPickerModal`을 연다.
- 각 카드(일일퀘스트 카드/주간 콘텐츠 카드 등 기존 카드 컴포넌트는 그대로 재사용 — **카드 자체를 새로 만들지 마라**)에 수동 모드일 때만 삭제 진입점(예: 카드 우측 상단 작은 X 버튼 또는 길게 눌러 삭제 등 — 상세 인터랙션은 자유, 실수로 눌리지 않을 정도의 명확한 탭 타겟이면 충분)을 추가해 `removeManualContent`를 호출한다.
- `auto` 모드에서는 이번 step 이전과 완전히 동일하게 보여야 한다(추가/삭제 UI 자체가 렌더링되지 않음).

### 테스트 (TDD)

- `src/lib/__tests__/manual-content-merge.test.ts`: 이 step의 핵심 — (1) synced에 있는 항목은 등록 여부 무관하게 synced 값을 쓰는지, (2) synced에 없고 template에 있는 항목은 template 기본값을 쓰는지, (3) 둘 다 없는 방어적 케이스가 크래시 없이 안전한 기본값을 반환하는지, (4) 반환 순서가 `tracked` 순서를 따르는지.
- `features/content-scheduler/__tests__/store.test.ts`: `addManualContent`/`removeManualContent`가 storage 어댑터를 올바르게 호출하는지, `manual` 모드일 때 화면용 목록이 `mergeManualContentList` 결과를 쓰는지.
- `app/content-scheduler/__tests__/ManualContentPickerModal.test.tsx` 신규: 이미 추적 중인 항목이 후보에서 빠지는지, 항목 탭 시 `onAdd`가 정확한 `contentName`으로 호출되는지, 자유 텍스트 입력 요소가 없는지.

테스트를 먼저 작성하고 실패를 확인한 뒤 구현으로 통과시켜라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `mergeManualContentList`가 `src/lib/`(범용 유틸)에 있고 storage/features를 직접 import하지 않는 순수 함수인가(ARCHITECTURE.md `lib/` 원칙)?
   - `auto` 모드 동작이 이번 step 이전과 완전히 동일한가(회귀 없음)?
   - 새 카드 컴포넌트를 만들지 않고 기존 카드(`DailyQuestCard` 등)를 재사용했는가?
   - `ManualContentPickerModal`에 자유 텍스트 입력이 없는가(ADR-035 결정 11 CRITICAL에 준하는 제약)?
3. 결과에 따라 `phases/manual-tracking-mode/index.json`의 `step: 7`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `manualTrackedContent`에 값 필드(`nowCount` 등)를 캐싱해 다음 조회를 빠르게 하려 하지 마라. 이유: ADR-035 결정 6 — 항상 `schedulerCache`/템플릿에서 즉석 조회해야 모드 전환·재동기화 시 값이 어긋나지 않는다.
- `ManualContentPickerModal`에 자유 텍스트 입력이나 과거 이력 기반 자동완성을 추가하지 마라. 이유: ADR-035 결정 11 — 고정 템플릿에서만 고른다.
- `scheduler-content-template.json`의 값을 이 step에서 수정하지 마라(이미 확정된 데이터, ADR-006).
- 기존 카드 컴포넌트(일일퀘스트 카드, 주간 콘텐츠 카드 4종)의 마크업을 새로 만들거나 중복하지 마라 — 그대로 재사용해라.
- 기존 테스트를 깨뜨리지 마라.
