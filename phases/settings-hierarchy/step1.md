# Step 1: settings-row

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `features/settings.md` · `foundation/design-system.md` 를 읽어라)
- `/docs/ADR.md` (슬림 인덱스 — **[[ADR-118]]** 결정 4 가 이 step 의 계약이다. `/docs/adr/ADR-118.md` 를 열어라)
- `src/app/settings/SettingsRow.tsx` (수정 대상)
- `src/app/settings/__tests__/SettingsRow.test.tsx` (기존 테스트)
- `src/app/settings/SettingsScreen.tsx` · `CacheDataSection.tsx` (현재 호출부 — 이 step 에서는 **고치지 않는다**)
- `src/components/atoms/Button/variants.ts` (컴포넌트가 아닌 값을 별도 파일로 빼는 이 저장소의 이유 — 같은 판단을 이 step 에서 한다)
- `src/app/onboarding/ApiKeyForm.tsx` (외부 링크를 여는 기존 방식 — `<a target="_blank" rel="noopener noreferrer">` + lucide `ExternalLink`)

## 배경

[[ADR-118]] 결정 4 는 설정 행의 우측 표기를 다섯 종류로 고정한다. 지금 `SettingsRow` 는

```tsx
{props.rightContent ?? (showChevron && <ChevronRight ... />)}
```

라 **값이 있으면 chevron 이 사라진다.** 그래서 같은 모달을 여는 세 행(`계정 변경`·`스케줄 관리 방법`·`테마`)
중 값이 없는 `계정 변경` 에만 화살표가 있다. 규칙은 *"chevron 이 있으면 누르면 무언가 열린다, 없는 위험 색
행은 누르면 지운다"* 이므로 이 배타를 **병기**로 바꾼다.

그리고 `개인정보 처리방침` 은 앱을 떠나 시스템 브라우저로 가는 **외부 링크 행**이라 `<button>` 이 아니라
`<a>` 여야 하고, chevron 이 아니라 외부 링크 표식을 단다.

## 작업

### 1. `src/app/settings/row-class.ts` 신규 — 공유 행 클래스

`SettingsRow`(버튼)와 `SettingsLinkRow`(앵커)가 **같은 행 골격**을 써야 하는데, 컴포넌트 파일이 컴포넌트가
아닌 값을 함께 export 하면 fast refresh 가 깨진다(`react-refresh/only-export-components`) — 이 저장소가
`Button/variants.ts` 를 별도 파일로 둔 것과 **같은 이유**다. 그 판단을 그대로 따른다.

```ts
export const SETTINGS_ROW_CLASS: string
```

값은 지금 `SettingsRow` 가 쓰는 것 그대로(`flex w-full items-center justify-between py-4 text-left`).
**왜 별도 파일인지**를 주석으로 남겨라(위 이유).

### 2. `src/app/settings/SettingsRow.tsx` 수정 — 병기

`SettingsRowProps` 시그니처는 **바꾸지 않는다**:

```ts
export interface SettingsRowProps {
  label: string
  onClick: () => void
  rightContent?: React.ReactNode
  danger?: boolean
  /** rightContent 유무와 무관하게 chevron 을 그릴지 — 기본 true. */
  showChevron?: boolean
}
```

바뀌는 것은 **렌더뿐**이다. 우측을 `flex items-center gap-2` 컨테이너로 감싸고 그 안에
`rightContent`(있으면)와 `ChevronRight`(`showChevron` 이면)를 **둘 다** 그린다. `showChevron` 기본값 `true`,
`data-testid="settings-row-chevron"` 유지. `danger` 의 라벨 색(`text-error-ink`)도 그대로.

클래스 문자열은 `SETTINGS_ROW_CLASS` 를 import 해서 쓴다. JSDoc 주석을 *"rightContent가 없을 때"* 에서
*"rightContent 유무와 무관하게"* 로 정정하라 — 지금 주석은 바뀔 동작을 잘못 설명하게 된다.

### 3. `src/app/settings/SettingsLinkRow.tsx` 신규 — 외부 링크 행

```ts
export interface SettingsLinkRowProps {
  label: string
  href: string
}
```

`<a href target="_blank" rel="noopener noreferrer">` 로 렌더하고, 우측에 lucide **`ExternalLink`**
(`h-4 w-4 text-text-muted`, `strokeWidth={2}`, `data-testid="settings-row-external"`). 라벨 타이포는
`SettingsRow` 의 비-danger 라벨과 같다(`text-sm font-medium text-text`). 골격은 `SETTINGS_ROW_CLASS`.

**`rel="noopener noreferrer"` 를 빼지 마라** — 하이브리드 앱이라 새 컨텍스트가 `window.opener` 로 원래
문서를 만질 수 있으면 안 된다. `ApiKeyForm` 이 이미 같은 방식을 쓴다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 새 error 0 (baseline: 0 errors / 17 warnings)
npm test        # 기준선 177 파일 / 2695 테스트 + 이 step 에서 추가한 개수
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **테스트를 먼저 쓰고 구현하라(TDD).** 최소 이 케이스들을 덮어라:
   - `rightContent` 와 chevron 이 **함께** 그려진다 (이 step 의 핵심 — 회귀 방지)
   - `showChevron={false}` 면 `rightContent` 만 남고 chevron 은 없다 (실행 행)
   - `rightContent` 없이 chevron 만 (이동 행)
   - `danger` 라벨 색
   - `SettingsLinkRow` 가 `<a>` 이고 `target="_blank"` · `rel` 에 `noopener` 와 `noreferrer` 가 둘 다 있고
     `href` 가 그대로 붙는다
3. **판별력을 확인하라** — 병기 렌더를 옛 `??` 배타로 되돌렸을 때 **새 케이스만** 실패하는지 실행으로
   확인하고 되돌려라. 그 결과를 summary 에 적어라.
4. 아키텍처 체크리스트:
   - `app/` 에서 `storage/`·`native/` 를 직접 부르지 않는가? (이 step 은 순수 표현 컴포넌트다)
   - 새 색·새 크기·새 라운딩을 만들지 않았는가? (design-system.md — 기존 토큰만)
5. 결과에 따라 `phases/settings-hierarchy/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **호출부(`SettingsScreen.tsx`·`CacheDataSection.tsx`)를 고치지 마라.** 이유: 이 step 은 프리미티브만
  바꾼다. 병기가 되면 `스케줄 관리 방법`·`테마` 행에 chevron 이 생기는데 **그것이 의도한 결과**이고,
  화면 재구성은 step 6 몫이다. 호출부를 함께 고치면 step 경계가 무너진다.
- **`SettingsRowProps` 에 필드를 새로 추가하지 마라(`href` 등).** 이유: `<button>` 과 `<a>` 는 시맨틱이
  다르다. 한 컴포넌트가 둘 다 되면 `onClick` 이 선택 필드가 되어 호출부에서 어느 쪽인지 타입으로
  알 수 없게 된다. 별도 컴포넌트로 나눈 이유가 그것이다.
- **`SETTINGS_ROW_CLASS` 를 `SettingsRow.tsx` 에서 export 하지 마라.** 이유: fast refresh 가 깨진다
  (`Button/variants.ts` 가 별도 파일인 것과 같은 이유).
- 기존 테스트를 깨뜨리지 마라
