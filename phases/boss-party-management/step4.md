# Step 4: boss-card-party-badge-modal

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/UI_GUIDE.md` — "보스 카드" 섹션(카드 레이아웃, 완료 뱃지 스타일)과 "파티 배지" 섹션(정확한 클래스명·아이콘 스펙) 전체
- `/docs/ADR.md` — ADR-019 결정 4·5(모달에서 파티 인원 입력, 파티 배지 표시 조건)
- `/src/app/boss-scheduler/BossScreen.tsx` — 수정 대상. 특히 `BossCard` 컴포넌트(export되어 있음)와 `DifficultyBadge`/완료 뱃지 렌더링 부분
- `/src/features/boss-scheduler/store.ts` — **Step 2에서 추가된** `partySizes`(`Record<string, number>`, key: `` `${ocid}:${boss}:${difficulty}` ``)와 `setPartySize(ocid, boss, difficulty, partySize)`. 정확한 시그니처를 이 파일에서 확인할 것. `maxPartySize` 조회 함수도 Step 2에서 어떤 방식으로 구현했는지(`lib/boss-crystal-prices.ts` 추출 여부) 확인해서 그대로 재사용할 것 — 새로 만들지 마라
- `/src/components/Modal/Modal.tsx` — 공용 모달 오버레이 컴포넌트. **이걸 재사용한다** (`CharacterTrackingPicker`처럼 오버레이 마크업을 직접 새로 작성하지 않는다)
- `/src/app/settings/ThemeModal.tsx` — `Modal`을 감싸는 화면별 모달 컴포넌트의 실제 사용 예시(이 구조를 그대로 따를 것)
- `/src/app/boss-profit/BossProfitScreen.tsx`의 `BossProfitRowItem` — 파티원 수 `<input type="number" min max>` + 에러 텍스트 패턴(입력 UI 재사용 대상). 단, 이 화면은 blur 시 즉시 저장하는 방식이고, 이번 step은 모달이므로 "저장" 버튼 클릭 시 검증·저장하는 방식으로 변형해서 적용한다(아래 "작업" 참고)

이전 step들에서 만들어진 store API와 공용 `Modal` 컴포넌트를 정확히 이해한 뒤 작업하라.

## 작업

### 1. `PartySizeModal` 신규 컴포넌트

`src/app/boss-scheduler/PartySizeModal.tsx`를 신규 생성한다(스크린 전용 모달이므로 `ThemeModal.tsx`처럼 화면 폴더 옆에 둔다).

```ts
export interface PartySizeModalProps {
  bossName: string
  difficulty: BossDifficulty
  currentPartySize: number // 1~maxPartySize. store.partySizes에 값이 없으면 호출자가 1을 넘긴다
  maxPartySize: number
  onSave: (partySize: number) => Promise<void>
  onClose: () => void
}
```

- `Modal`(`components/Modal/Modal.tsx`)로 감싼다(`ThemeModal.tsx` 패턴).
- 내부에 `<input type="number" min={1} max={maxPartySize}>` — `BossProfitScreen.tsx`의 기존 입력 패턴을 재사용하되, blur가 아니라 "저장" 버튼 클릭 시 검증한다. 정수가 아니거나 1 미만/`maxPartySize` 초과면 인라인 에러 텍스트를 보여주고(`features/boss-scheduler/store.ts`의 `setPartySize`가 던지는 에러 메시지를 그대로 표시), 저장 성공 시 `onClose()`를 호출한다.
- "취소" 버튼도 둔다(`onClose()` 호출, 저장 없이 닫기).

### 2. `BossCard`에 파티 배지 + 진입 버튼 추가

`BossScreen.tsx`의 `BossCard` props를 확장한다:

```ts
export function BossCard(props: {
  boss: MatchedBoss
  crop?: BossPortraitCrop
  partySize?: number // 미설정(솔로)이면 undefined 또는 1
  onOpenPartyModal?: () => void // 진입 버튼 클릭 핸들러 — 없으면 버튼 자체를 렌더링하지 않는다(BossCardPreview.tsx 디버그 화면에서 계속 이 컴포넌트를 재사용하므로 선택적으로 둔다)
}): React.JSX.Element
```

- **파티 배지**: `docs/UI_GUIDE.md` "파티 배지" 섹션의 스타일·클래스를 그대로 적용한다(`rounded-full bg-white/10 text-[#E8DFEC] text-xs font-semibold px-2 py-1`, `lucide-react`의 `Users` 아이콘 size 12 strokeWidth 2, 텍스트 "n인"). `partySize`가 `undefined`이거나 1이면 렌더링하지 않는다(솔로는 빈 공간).
- 오른쪽 배지 영역을 `flex items-center gap-1.5`로 감싸 파티 배지 → 완료 배지 순서로 배치한다(UI_GUIDE 명시 순서).
- **진입 버튼**: 카드 안에 별도 아이콘 버튼을 둔다(사용자 확정 — 카드 전체 탭 방식 아님). `onOpenPartyModal`이 주어졌을 때만 렌더링한다. 아이콘은 `lucide-react`에서 파티 인원 설정 의미가 드러나는 것(예: `Users`와 겹치지 않게 `Settings2` 또는 `SlidersHorizontal` 등)을 골라 쓰되, 배경 원 없이 아이콘 단독으로 표시한다(UI_GUIDE "아이콘 컨테이너로 감싸지 않는다" 규칙 재사용). 난이도 뱃지·보스명(왼쪽)과 파티/완료 배지(오른쪽)를 가리지 않는 위치에 배치하라 — 정확한 위치는 실제 카드에 렌더링해보고 판단할 것.
- 이 step에서 새로 확정한 시각적 규칙(진입 버튼 아이콘·위치)은 `docs/UI_GUIDE.md`의 "보스 카드"/"파티 배지" 섹션에 짧은 문단으로 추가 기록한다(기존 "정정" 노트들과 같은 형식) — 코드만 바꾸고 문서를 갱신하지 않으면 안 된다.

### 3. `BossScreen`에서 데이터 연결

`BossScreen` 컴포넌트에서 `useBossSchedulerStore()`로 `partySizes`와 `setPartySize`를 가져와 각 `BossCard`에 전달한다. 모달 열림 상태(`useState`로 어떤 보스의 모달이 열려있는지 관리, 예: 선택된 `MatchedBoss | null`)를 두고, 저장 시 `store.setPartySize(selected.ocid, boss.matchedBossName ?? boss.apiName, boss.difficulty, partySize)`를 호출한다. `maxPartySize`는 Step 2에서 만든 조회 함수로 구한다.

### 4. 테스트(TDD)

`BossScreen.test.tsx`(또는 신규 `PartySizeModal.test.tsx`)에 다음을 검증하는 테스트를 추가한다:
- 파티원 2인 이상 설정된 보스 카드에 "n인" 배지가 보이는지
- 1인/미설정 보스 카드에는 배지가 없는지
- 진입 버튼 클릭 시 모달이 열리는지, 저장 시 store의 `setPartySize`가 올바른 인자로 호출되는지
- 잘못된 값(0, `maxPartySize` 초과, 소수) 입력 시 인라인 에러가 보이고 `setPartySize`가 호출되지 않는지

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `components/Modal/Modal.tsx`를 재사용했는가(오버레이 마크업을 새로 작성하지 않았는가)?
   - `docs/UI_GUIDE.md`의 파티 배지 클래스·아이콘 스펙을 정확히 따랐는가?
   - 이 step에서 새로 정한 진입 버튼 아이콘/위치를 `docs/UI_GUIDE.md`에 기록했는가?
   - `BossCardPreview.tsx`(디버그 화면)가 `onOpenPartyModal`을 넘기지 않아도 여전히 정상 렌더링되는가(선택적 prop이므로 깨지지 않아야 함)?
3. 결과에 따라 `phases/boss-party-management/index.json`의 `step: 4`를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(선택한 진입 버튼 아이콘도 기록)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 카드 전체를 탭해서 모달이 열리게 하지 마라. 이유: 사용자가 명시적으로 "카드 안 별도 버튼" 방식을 선택했다(카드 전체 탭은 향후 다른 카드 인터랙션과 충돌할 수 있다는 우려 때문).
- `CharacterTrackingPicker.tsx`처럼 오버레이 마크업(`fixed inset-0 bg-bg/70` 등)을 직접 다시 작성하지 마라. 이유: `components/Modal/Modal.tsx`가 이미 이 패턴을 공용화했고, `ThemeModal`/`AccountModal`/`ApiKeyModal`이 전부 이걸 재사용 중이다 — 새로 작성하면 중복이다.
- 이 step에서 솔로/파티 필터 UI(전체/솔로/파티 pill 행)를 추가하지 마라. 이유: Step 5의 범위다.
- 기존 테스트를 깨뜨리지 마라.
