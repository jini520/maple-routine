# Step 5: account-select

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/adr/ADR-144.md` 결정 6 전문** — 드롭다운 전체 명세(행 모양·대표 표기 정정·오버레이·TTL)
- `/docs/ADR.md` 에서 **[[ADR-094]] 결정 1 · [[ADR-107]] · [[ADR-122]] · [[ADR-131]]** 만
- 코드: `packages/app-rn/src/components/organisms/CharacterTrackingPicker/CharacterTrackingPicker.tsx`
  (**RN `Modal` 을 쓰는 이유·안전영역 처리의 선례**) ·
  `packages/app-rn/src/components/organisms/Modal/Modal.tsx` · `packages/app-rn/src/lib/icons.ts`
- **step 3 산출물**: `features/character-manage/` 의 `summarizeAccount`·`AccountSummaryView`
- **step 4 산출물**: `components/molecules/CharacterRow/` (엠블럼·얼굴 처리를 참고하되 **이 컴포넌트는
  자기 행을 따로 그린다** — 드롭다운 행은 캐릭터 카드가 아니다)

## 배경

RN 에 `<select>` 가 없고, [[ADR-142]] 정정 8 이 «눌러도 안 열리는» `CharacterSelectDropdown` 을 지웠다.
**여는 목록을 이 앱이 처음으로 만든다.**

## 작업

`packages/app-rn/src/components/organisms/AccountSelect/` (신규):

```tsx
export interface AccountSelectProps {
  accounts: AccountSummaryView[]      // step 3 의 파생값
  selectedAccountId: string
  /** 그 계정의 대표 캐릭터 얼굴 — 캐시에 있을 때만. 없으면 이니셜 */
  portraitByAccountId: Record<string, string | null>
  onSelect: (accountId: string) => void
}
```

### 행 하나 — 트리거와 목록이 **같은 모양**이다

```
(얼굴)   [스] 스카니아 Lv.294 낟낟          ▾
         스카니아 19개, 엘리시움 7개
```

- **1줄**: 월드 엠블럼 + **월드 이름(글자)** + 레벨 + 대표 캐릭터 이름.
  (캐릭터 카드는 월드를 엠블럼만 쓰지만 여기는 **글자로도 적는다** — 계정을 가르는 기준이라 성질이
  다르다.)
- **2줄**: 월드별 개수, 많은 순 **최대 둘**(step 3 이 이미 잘라서 준다).
- **단위는 «개» 다.** «명» 을 쓰지 마라 — 캐릭터는 사람이 아니다.
- **다른 것을 더 얹지 마라** — «선택 n개» 배지도, «방금 확인함» 류 표시도 없다.
- 얼굴이 `null` 이면 이니셜. **얼굴 때문에 조회하지 마라**(이 컴포넌트는 네트워크를 모른다).

### 열리는 방식 — 겹치되 **어둡게 하지 않는다**

- **트리거만 자리를 차지한다.** 열려도 아래 콘텐츠가 밀리지 않는다.
- **목록의 첫 행이 트리거가 있던 자리에서 시작**해 한 덩어리로 이어진다. 사이를 띄우지 마라.
- 구현: `Modal transparent` + 트리거의 `measureInWindow()` 좌표에 절대 배치.
  **화면 아래로 넘치면 위로 뒤집어라.** `absolute` 만으로는 부모 상자에 갇혀 아래 층을 못 덮는다
  (`CharacterTrackingPicker` 파일 머리 ①이 같은 이유를 적어 두었다).
- **backdrop(스크림)을 두지 마라.** 뒤를 어둡게 하면 ① 피커·키 안내 모달과 같은 무게로 읽히고
  ② 바로 아래 후보 목록까지 함께 어두워진다. 층은 **그림자와 테두리**가 말한다.
- **바깥을 누르면 닫힌다** — 배경색 **없는** 전체 화면 `Pressable` 로 잡기만 한다. 안드로이드
  뒤로가기(`onRequestClose`)도 닫는다.
- 선택된 행은 배경 틴트로 표시한다(체크 마크 같은 새 표식을 만들지 마라).

### 테스트 먼저

- 트리거가 선택된 계정의 행을 그린다 · **계정이 하나여도 그린다**
- 열면 계정 수만큼 행이 있고, 각 행이 대표(월드·레벨·이름)와 월드별 개수(**최대 2개**)를 말한다
- 단위가 «개» 다 · «선택 n개»·«방금 확인함» 같은 문자열이 **없다**
- 고르면 `onSelect(accountId)` 가 그 값으로 불린다
- **스크림/딤 역할을 하는 배경색 요소가 없다**(이 테스트가 이 step 의 계약이다)
- 바깥 탭·`onRequestClose` 로 닫힌다

## Acceptance Criteria

```bash
npm test
npm run lint
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `organisms/` 계층 규칙을 지키는가(스토어를 직접 읽지 않고 프롭으로 받는가)
   - 네트워크·저장소를 모르는가
   - 새 문구를 지어내지 않았는가
3. `phases/character-multi-account/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "AccountSelect 프롭·앵커 배치 방식·뒤집기 조건·닫힘 경로"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **backdrop·스크림·딤을 넣지 마라.** 이유: 사용자가 명시적으로 거부했다. 닫힘을 위한 터치 캐처는
  **색 없이** 두어라.
- **트리거와 목록 사이를 띄우지 마라.** 이유: 그 둘이 서로 다른 컨트롤로 보인다.
- **대표 캐릭터 얼굴을 위해 `character/basic` 을 부르지 마라.** 이유: [[ADR-143]] 결정 5 가 산
  «안 열어 본 계정의 비용 0» 을 도로 내주는 것이다. 이 컴포넌트는 받은 것만 그린다.
- **`<select>` 흉내를 낸다고 스크롤 잠금·포커스 트랩 같은 것을 새로 만들지 마라.** 이유: `Modal` 이
  이미 그 성질을 준다.
- 기존 테스트를 깨뜨리지 마라.
