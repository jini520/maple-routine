# Step 5: errorstate-contract

이 step 은 **이슈 #178** 을 닫는다 — `ErrorState` 가 그려지는 자리가 원인과 무관하게 **진행 경로를
하나 이상** 갖도록 규칙을 세우고, 세 자리가 실제로 그러한지 확인한다. 이 phase 의 마지막 코드 변경이다.

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(지정한 것만)
- `/docs/adr/ADR-116.md` — **결정 4**(진행 경로 규칙 · 그 경로가 그 자리의 버튼일 필요는 없다) ·
  **결정 1**(429 의 경로는 모달이 제공한다)
- `/docs/adr/ADR-114.md` — **결정 2**(429 에 액션 없음 — `ErrorState` 자리에서만 정정) · **결정 3**(배너)
- `/docs/adr/ADR-062.md` 결정 3 · `/docs/adr/ADR-060.md` 결정 5(정보 톤) · `/docs/adr/ADR-061.md`
- `/docs/foundation/error-resilience.md` — 원칙 3(step 0 이 규칙을 넣었다) · 원칙 2(세 상태 구분)
- `/docs/foundation/design-system.md` — "실패 상태"
- `/src/components/molecules/ErrorState/ErrorState.tsx` (**전문** — 특히 **10행** 컴포넌트 계약 주석과
  `action?` 옵셔널 구현의 어긋남)
- `/src/components/organisms/CharacterTrackingPicker/CharacterTrackingPicker.tsx`
- `/src/app/onboarding/ContentCharacterStep.tsx`
- `/src/app/settings/AccountFlowStatus.tsx` (모달이라 `취소` 가 이미 있다)
- `/src/app/content-scheduler/ContentScreen.tsx` · `/src/app/boss-scheduler/BossScreen.tsx`
  (**EmptyState 의 유일한 액션이 피커 열기**인 자리 — `ContentScreen.tsx:308-314` 부근)
- `/src/features/schedule-sync/format.ts` (`formatRosterError` 의 `rateLimited`)
- **step 1~4 산출물**: `apiKeyNotice` · `ApiKeyNoticeModal` · `useApiKeyNotice` · 계정 프로브 판정

## 배경 — 자리별 분기 (이슈 #178 의 표)

| 자리 | 껍데기 | 429 일 때 남는 조작(지금) |
|---|---|---|
| **온보딩** 캐릭터 선택 | 페이지 | **0개** → #176 잠금 |
| **설정** 계정 변경 | 모달 | `취소` |
| **컨텐츠/보스** 캐릭터 관리 | 모달 | `닫기` — 그런데 닫아도 EmptyState ↔ 피커 **루프** |

**step 3 이 배선을 끝냈다면 세 자리 모두 429 에서 모달이 덮인다.** 그래서 이 step 의 일은
*"버튼을 새로 다는 것"* 이 아니라 **그 사실을 확인하고 계약·규칙을 문서와 코드 주석에 못박는 것**이다.

## 작업

TDD 다 — 확인 테스트를 먼저 쓰고, 필요한 곳만 고쳐라.

### 1. `ErrorState` 컴포넌트 계약 정정 ([[ADR-116]] 결정 4)

`ErrorState.tsx:10` 의 주석이 `ErrorState … 액션 항상` 인데 구현은 `action?` 이다 — **계약과 구현이
어긋나 있다.** 계약을 현재 사실로 고쳐라:

- `ErrorState` 가 그려지는 자리는 **원인과 무관하게 진행 경로를 하나 이상 갖는다.**
- **그 경로가 이 컴포넌트의 `action` 일 필요는 없다** — 껍데기(모달의 `닫기`·`취소`)나 그 위에 덮이는
  안내 모달([[ADR-116]] 결정 1)이 제공해도 된다. 그래서 `action` 은 옵셔널이다.
- **액션 없이 쓸 수 있는 조건**을 명시하라: *"이 자리에서 사용자가 앞으로 갈 수 있는 다른 수단이
  실제로 있을 때만"*. 없으면 그 화면은 잠긴다(#176 이 그 사고다).
- `EmptyState`·`UnavailableNotice` 와의 구분 표는 그대로 두되 `ErrorState` 행만 고친다.

### 2. 세 자리를 **테스트로** 확인한다

각 자리에서 429 가 났을 때 **진행 경로가 실제로 존재하는지** 단언하라. 새 UI 를 만들지 말고 지금
있는 것을 확인하는 테스트다.

- **온보딩 캐릭터 선택**(`ContentCharacterStep`): 로스터 429 → `useApiKeyNotice` 가 진입점을 부른다
  (step 3 이 배선). **이 자리의 진행 경로는 모달이다** — `ErrorState` 에 버튼이 없어도 잠기지 않는다.
- **컨텐츠/보스 피커**: 429 → 같은 진입점 + 모달. 피커의 `닫기` 도 그대로 있다.
- **설정 계정 변경**: 429 → step 3 이 `refreshAccounts` 를 배선했다.

### 3. EmptyState ↔ 피커 루프 (#178 의 두 번째 증상)

`trackedOcids` 가 빈 상태면 화면 전체가 `EmptyState` 이고 **유일한 액션이 피커 열기**다. 429 면 피커가
0건이라 닫아도 같은 자리로 돌아온다.

- **step 1~3 이후 이 루프가 실제로 끊기는지 확인하라** — 피커를 여는 순간 로스터 429 가 진입점을 불러
  모달이 뜨고, `확인` 이 키 입력 화면으로 보낸다. 그러면 EmptyState 로 되돌아올 일이 없다.
- **끊긴다면 코드를 더 고치지 마라.** 확인 테스트만 남기고 그 근거를 주석으로 적어라.
- **끊기지 않는다면**(예: 피커를 열기 전에는 조회가 안 일어나 모달이 안 뜬다) 그 사실을 summary 에
  적고, EmptyState 에 두 번째 길을 더할지는 **판단해서 하되 최소로** 하라 — 새 문구·새 컴포넌트를
  만들지 말고 기존 것을 쓴다.

### 4. `formatRosterError` 의 `rateLimited`

- 문구(`호출 한도를 초과했습니다` / `입력하신 API 키가 서비스 단계 키인지 확인해주세요`)는 **그대로
  둔다** — [[ADR-114]] 결정 1 이 정한 것이고 모달 문구와 일관된다.
- **액션도 그대로 없다** — 재시도는 틀린 처방이고([[ADR-114]] 결정 2) 진행 경로는 모달이 제공한다.
- 즉 **이 파일은 안 고칠 가능성이 높다.** 고치지 않았다면 "고칠 것이 없었다"를 summary 에 적어라.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                     # errors 0
# 계약이 현재 사실과 맞다
grep -c '액션 항상' src/components/molecules/ErrorState/ErrorState.tsx    # 0
grep -q '진행 경로' src/components/molecules/ErrorState/ErrorState.tsx
npx vitest run src/components/__tests__/layer-dependencies.test.ts
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력**: step 3 의 배선(`useApiKeyNotice`) 중 **온보딩 것 하나만** 무력화하면 이 step 의
   "온보딩 자리에 진행 경로가 있다" 테스트가 실제로 실패하는가? 확인 후 되돌리고 결과를 summary 에.
3. **세 자리 잠금 점검을 손으로 한 번 더 하라** — 각 자리에서 429 일 때 사용자가 **누를 수 있는 것**을
   나열하고, 하나도 없으면 그 자리는 잠긴 것이다. 결과를 표로 summary 에 담아라.
4. 아키텍처 체크: molecule 이 feature·상위 계층을 import 하지 않는가(layer-dependencies) ·
   design-system.md 의 실패 상태 규격을 벗어나지 않았는가.
5. `index.json` step 5 갱신.

## 금지사항

- **429 에 "다시 시도" 버튼을 되살리지 마라.** 이유: 눌러도 또 429 다([[ADR-114]] 결정 2 는 유효하다).
- **스탈 배너의 액션 규칙을 건드리지 마라.** 이유: 배너는 아래에 목록이 남아 막다른 길이 아니다 —
  정정 범위는 `ErrorState` 뿐이다([[ADR-116]] 결정 4).
- **`ErrorState` 에 카드·크기 변형을 추가하지 마라.** 이유: 그 컴포넌트가 그것을 두지 않기로 한 이유가
  주석에 있다(적용처가 모두 이미 껍데기 안이다).
- **새 문구를 만들지 마라.** 이유: 429 문구는 [[ADR-114]] 결정 1 이 정했고 모달은 step 2 가 정했다.
- **`features/onboarding` 을 건드리지 마라**(step 1·3·4 가 끝냈다).
- 기존 테스트를 깨뜨리지 마라.
