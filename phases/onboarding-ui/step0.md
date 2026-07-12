# Step 0: onboarding-components

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 `app/`(화면)과 `features/`(로직) 분리 규칙, "엣지 케이스" 섹션의 "동률 레벨 계정 대표 캐릭터 표기" 항목(정렬 규칙 원문)
- `/docs/ADR.md` — 특히 [[ADR-007]]의 "계정(메이플 ID) 선택 UI 필요" 확정 사항(각 계정을 최고 레벨 캐릭터의 닉네임+직업+레벨로 표기, `account_id` 해시는 노출 안 함)
- `src/types/character.ts` — `MapleCharacter`(`{ ocid, name, world, jobClass, level }`), `MapleAccount`(`{ accountId, characters: MapleCharacter[] }`)
- `src/features/onboarding/state.ts` — `OnboardingError` 타입(`{ kind: 'invalidApiKey' | 'rateLimited' | 'network' | 'storageWriteFailed' }`). 이 step의 컴포넌트가 이 에러를 사람이 읽을 문구로 보여줘야 한다.

## 배경

이번 step은 **프레젠테이션 컴포넌트만** 만든다 — `useOnboardingStore`를 직접 import하지 않는다. 스토어 연결은 다음 step(`onboarding-screen`)의 몫이다. 이렇게 분리하면 이 컴포넌트들을 스토어/네트워크 없이 props만으로 테스트할 수 있다.

**계정 대표 캐릭터 선정 규칙** (`ARCHITECTURE.md` 엣지 케이스 섹션, 확정 사항 — 임의로 바꾸지 마라):
- 계정 안에서 레벨이 가장 높은 캐릭터를 그 계정의 대표로 삼는다.
- 레벨이 동률이면 캐릭터명으로 정렬해 첫 번째를 대표로 삼는다. 정렬 우선순위는 **한글 > 알파벳 > 숫자** 그룹 순서이며, 같은 그룹 안에서는 한글은 가나다순, 알파벳은 abc순, 숫자는 123순으로 비교한다.

## 작업

1. `npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`으로 테스트 의존성을 추가하라. **주의**: `vite.config.ts`의 전역 `test.environment: 'node'` 설정은 바꾸지 마라 — 기존 데이터 레이어 테스트는 node 환경 그대로 둬야 한다. 대신 이번 step에서 새로 만드는 컴포넌트 테스트 파일 맨 위에 `// @vitest-environment jsdom` 한 줄을 추가해 그 파일에만 jsdom을 적용하라. jest-dom 매처(`toBeInTheDocument()` 등)는 각 테스트 파일에서 `import '@testing-library/jest-dom'`을 직접 import해서 써라(전역 setupFiles 설정 추가하지 마라 — 이 두 테스트 파일 외에는 아직 필요 없다).

2. `src/features/onboarding/representative-character.ts` — 위 정렬 규칙의 순수 함수:
```ts
export function pickRepresentativeCharacter(characters: MapleCharacter[]): MapleCharacter
```
- 빈 배열이 들어오면 어떻게 할지는 호출자가 신경 쓰지 않아도 되게 설계하되(예: 이 함수를 호출하는 쪽에서 애초에 캐릭터가 있는 계정만 넘긴다는 전제), 함수 자체가 던지는 에러 메시지 정도는 남겨도 된다 — 과도한 방어 코드는 넣지 마라.
- 이 파일은 순수 로직이라 jsdom이 필요 없다 — 테스트는 기존처럼 node 환경 그대로 작성하라.

3. `src/app/onboarding/ApiKeyForm.tsx` — API 키 입력 폼:
```ts
export interface ApiKeyFormProps {
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (apiKey: string) => void
}
export function ApiKeyForm(props: ApiKeyFormProps): JSX.Element
```
- 텍스트 입력 + 제출 버튼. `isSubmitting`이면 버튼 비활성화. `errorMessage`가 있으면 화면에 표시.
- API 키 발급 안내는 [[ADR-007]] 확정 사항대로 "openapi.nexon.com 링크 + 간단한 설명 문구"만 넣어라(전용 단계별 위저드 아님).

4. `src/app/onboarding/AccountSelectionList.tsx` — 계정 선택 목록:
```ts
export interface AccountSelectionListProps {
  accounts: MapleAccount[]
  isSubmitting: boolean
  errorMessage: string | null
  onSelect: (accountId: string) => void
}
export function AccountSelectionList(props: AccountSelectionListProps): JSX.Element
```
- 각 계정을 `pickRepresentativeCharacter`로 뽑은 대표 캐릭터 기준 "닉네임 · 직업 Lv.레벨" 형태로 표시(예: "낟낟 · 렌 Lv.293"). `accountId`(해시)는 화면에 노출하지 마라.
- 클릭 시 해당 계정의 `accountId`로 `onSelect`를 호출한다.

5. `OnboardingError`를 사람이 읽을 한국어 문구로 바꾸는 헬퍼도 하나 만들어라(예: `src/app/onboarding/error-message.ts`의 `formatOnboardingError(error: OnboardingError): string`) — `invalidApiKey`→"API 키가 유효하지 않습니다", `rateLimited`→"잠시 후 다시 시도해주세요", `network`→"네트워크 오류가 발생했습니다", `storageWriteFailed`→"기기에 저장하지 못했습니다. 다시 시도해주세요" 정도의 문구면 충분하다(정확한 워딩은 재량).

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `ApiKeyForm.tsx`/`AccountSelectionList.tsx`가 `useOnboardingStore`나 `src/nexon/`, `src/storage/`를 import하지 않았는가(순수 프레젠테이션 컴포넌트인가)?
   - `vite.config.ts`의 전역 `test.environment`를 건드리지 않았는가?
   - 계정 대표 캐릭터 정렬 규칙(레벨 내림차순, 동률 시 한글>알파벳>숫자 그룹 후 그룹별 정렬)을 정확히 구현했는가?
3. 테스트를 먼저 작성한 뒤(TDD) 구현하라.
   - `src/features/onboarding/__tests__/representative-character.test.ts`(node 환경): 레벨이 다른 경우, 레벨이 동률이고 이름이 한글/알파벳/숫자 섞인 경우 각각 올바른 대표를 고르는지 검증.
   - `src/app/onboarding/__tests__/ApiKeyForm.test.tsx`(`// @vitest-environment jsdom`): 입력 후 제출하면 `onSubmit`이 입력값으로 호출되는지, `isSubmitting`이면 버튼이 비활성화되는지, `errorMessage`가 렌더링되는지.
   - `src/app/onboarding/__tests__/AccountSelectionList.test.tsx`(`// @vitest-environment jsdom`): 계정 목록이 "닉네임 · 직업 Lv.레벨" 형식으로 렌더링되는지, 클릭 시 `onSelect`가 올바른 `accountId`로 호출되는지, `accountId` 원본 문자열이 화면 텍스트에 노출되지 않는지.
4. 결과에 따라 `phases/onboarding-ui/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 규칙을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `ApiKeyForm`/`AccountSelectionList`에서 `useOnboardingStore`를 직접 import하지 마라. 이유: 스토어 연결은 다음 step(`onboarding-screen`)의 몫이고, 이번 step은 props만으로 테스트 가능한 순수 컴포넌트여야 한다.
- 계정 선택 화면에 `accountId` 원본 문자열(해시)을 노출하지 마라. 이유: [[ADR-007]] 확정 사항 — 사람이 읽기 어려운 해시 대신 대표 캐릭터 표기만 보여준다.
- `vite.config.ts`의 `test.environment` 전역 기본값을 `jsdom`으로 바꾸지 마라. 이유: 기존 데이터 레이어 테스트가 영향받지 않게 필요한 파일에만 국소 적용해야 한다.
- API 키 입력에 전용 단계별 온보딩 위저드(여러 화면에 걸친 안내)를 만들지 마라. 이유: [[ADR-007]]이 "가벼운 안내, 전용 튜토리얼 아님"으로 확정했다.
- 기존 테스트를 깨뜨리지 마라.
