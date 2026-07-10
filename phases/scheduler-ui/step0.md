# Step 0: boss-portrait

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `lib/boss-icons`(portraitSlug + 난이도 접두사로 `assets/bosses/` 파일명 조회, 없으면 플레이스홀더)와 `components/BossPortrait`(공용 컴포넌트, feature 2·4·5가 재사용) 설명
- `/docs/ADR.md` — [[ADR-011]] 결정 4(보스 초상화는 난이도 무관 보스 1종당 1장이 아니라, 실제로는 파일이 `{난이도접두사}_{portraitSlug}.png`로 난이도별로 존재함 — 5번 정정 항목 참고)
- `src/data/weekly-bosses.json`의 `portraitSlug` 필드, `src/assets/bosses/` 안의 실제 파일명 패턴(예: `hard_verusHilla.png`, `normal_lucid.png`) — 난이도 접두사는 이지→`easy`, 노멀→`normal`, 하드→`hard`, 카오스→`chaos`, 익스트림→`extreme`
- `src/types/scheduler.ts` — `BossDifficulty`, `BOSS_DIFFICULTIES`
- `src/data/__tests__/boss-portraits.test.ts` — 기존에 이미 있는, `portraitSlug` 유무와 실제 파일 존재 여부를 검증하는 테스트. 이 step이 만드는 조회 로직과 같은 파일명 조합 규칙을 써야 한다.

## 배경

이번 step은 화면이 아니라, 보스 초상화 이미지를 찾아서 보여주는 재사용 가능한 조회 함수 + 컴포넌트만 만든다. 다음 step들(주간 화면 등)이 이걸 가져다 쓴다.

**중요 — Vite에서 동적 에셋 경로를 다루는 법**: `src/assets/bosses/`에는 파일이 수십 개 있고, 어떤 파일을 보여줄지는 런타임에(portraitSlug + 난이도 조합으로) 정해진다. 문자열을 조합해서 `<img src="/src/assets/bosses/hard_lucid.png">`처�럼 직접 쓰면 안 된다 — Vite는 빌드 시점에 정적으로 분석 가능한 경로만 번들에 포함시키므로, 이런 동적 문자열은 프로덕션 빌드에서 깨진다. 대신 `import.meta.glob`으로 폴더 전체를 한 번에 가져와 파일명→URL 매핑을 만들고, 그 매핑에서 조회하라:
```ts
const bossPortraitModules = import.meta.glob('../assets/bosses/*.png', { eager: true, import: 'default' })
// bossPortraitModules는 { '../assets/bosses/hard_lucid.png': '/실제/번들된/URL.png', ... } 형태
```
경로 키에서 파일명만 뽑아 조회 가능한 맵으로 바꿔 써라(예: `Object.entries`를 순회하며 마지막 `/` 뒤 파일명만 키로 재구성).

## 작업

### 1. `src/lib/boss-icons.ts`

```ts
export function getBossPortraitUrl(portraitSlug: string | null, difficulty: BossDifficulty): string | null
```
- `portraitSlug`가 `null`이면 곧바로 `null`을 반환한다(아직 이미지 없는 보스).
- 아니면 난이도 접두사(위 매핑)와 조합해 `${prefix}_${portraitSlug}.png` 파일명을 만들고, `import.meta.glob`으로 만든 맵에서 조회한다. 있으면 URL을, 없으면(그 난이도 파일이 실제로 없는 경우) `null`을 반환한다.

### 2. `src/components/BossPortrait/BossPortrait.tsx`

```ts
export interface BossPortraitProps {
  portraitSlug: string | null
  difficulty: BossDifficulty
  label: string // alt 텍스트 + 이미지 없을 때 플레이스홀더에 표시할 텍스트
}
export function BossPortrait(props: BossPortraitProps): React.JSX.Element
```
- `getBossPortraitUrl`로 URL을 조회해서 있으면 `<img src={url} alt={label} />`, 없으면 `label` 텍스트를 보여주는 단순한 플레이스홀더(회색 박스 정도면 충분, 디자인 시스템은 아직 없으니 과하게 꾸미지 마라)를 렌더링한다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `import.meta.glob`으로 에셋을 가져왔는가(문자열 경로 직접 조합 후 `<img src>`에 그대로 넣지 않았는가)?
   - `src/lib/boss-icons.ts`와 `src/components/BossPortrait/` 외 다른 파일을 만들지 않았는가?
3. 테스트를 먼저 작성한 뒤(TDD) 구현하라.
   - `src/lib/__tests__/boss-icons.test.ts`: `portraitSlug`가 `null`이면 `null` 반환, 실제 존재하는 slug+난이도 조합(예: `lucid`+`하드` → `hard_lucid.png`)이면 URL을 반환, 존재하지 않는 조합이면 `null` 반환.
   - `src/components/BossPortrait/__tests__/BossPortrait.test.tsx`(`// @vitest-environment jsdom`, `@testing-library/react` 사용): 이미지가 있는 경우 `<img>`가 렌더링되고 `alt`가 `label`과 같은지, 이미지가 없는 경우(portraitSlug `null`) `label` 텍스트가 렌더링되는지.
4. 결과에 따라 `phases/scheduler-ui/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 규칙을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 동적 문자열 경로를 그대로 `<img src>`에 넣지 마라. 이유: Vite 프로덕션 빌드에서 정적 분석이 안 돼 깨진다 — 반드시 `import.meta.glob`으로 미리 맵을 만들어 조회하라.
- `app/` 화면이나 다른 feature 코드를 만들지 마라. 이유: 이번 step은 재사용 가능한 조회 함수 + 컴포넌트까지만 다룬다.
- 기존 테스트(`src/data/__tests__/boss-portraits.test.ts` 포함)를 깨뜨리지 마라.
