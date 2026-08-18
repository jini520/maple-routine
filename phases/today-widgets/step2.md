# Step 2: representative-display

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/adr/ADR-143.md` 결정 4 전문** — «미지정이면 첫 번째가 임시 대표» 규칙과, 그 값을 읽는 화면이
  아직 없다고 적어 둔 자리(**이 step 이 그 문장을 낡게 만든다**)
- **`/docs/adr/ADR-144.md` 결정 4** — 대표를 안 고른 화면은 «채워진 별이 하나도 없다»
- **`/docs/adr/ADR-147.md` 정정 2**
- 코드: `packages/core/src/features/character-manage/derivations.ts` ·
  그 `__tests__/` · `packages/core/src/storage/character-selection.ts` ·
  `packages/app-rn/src/components/organisms/CharacterManage/use-character-manage.ts`

## 배경

`today` 의 대표 캐릭터 위젯은 **«대표 없음» 상태를 갖지 않는다**([[ADR-147]] 정정 2, 사용자 판정).
[[ADR-143]] 결정 4 가 이미 답을 갖고 있다 — *«미지정이면 목록의 첫 번째가 «임시 대표»» 이고 그
파생값을 저장하지 않는다.*

그런데 `resolveRepresentative` 는 지금 **일부러 `null` 을 돌려준다.** 그 함수 주석이 이유를 적어 뒀다:
*"«미지정이면 첫 번째» 를 여기서 만들지 않는다 — 그 값을 읽는 화면이 아직 하나도 없고, 화면은 대표가
없을 때 아무 표시도 하지 않기로 했다."*

**today 가 그 첫 독자다.**

## 작업

`packages/core/src/features/character-manage/derivations.ts` 에 **함수를 하나 더 만든다.**

```ts
/**
 * 지금 «대표 자리» 에 설 캐릭터. 미지정이면 목록의 첫 번째([[ADR-143]] 결정 4의 «임시 대표»).
 * 저장하지 않는 파생값이다.
 */
export function resolveDisplayRepresentative(
  orderedOcids: string[],
  stored: string | null,
): string | null
```

- 반환 규칙: 저장된 대표가 목록에 있으면 그것, 아니면 `orderedOcids[0]`, 목록이 비면 `null`.
- **`resolveRepresentative` 를 고치지 마라.** 그 함수를 폴백시키면 캐릭터 관리 화면에서 «대표를 안
  골랐는데 별이 채워져 있는» 상태가 만들어져 [[ADR-144]] 결정 4 가 깨진다. 두 함수는 **다른 질문**에
  답한다:
  - `resolveRepresentative` — «사용자가 대표라고 **말했는가**» (채워진 별)
  - `resolveDisplayRepresentative` — «지금 대표 **자리에 설** 캐릭터는 누구인가» (today 카드)
- **두 함수의 관계를 주석으로 박아라.** 이름이 비슷해 다음 사람이 «중복» 으로 보고 합치려 든다.
  그때 합치면 위의 [[ADR-144]] 위반이 조용히 돌아온다.
- 기존 함수 주석의 *"그 값을 읽는 화면이 아직 하나도 없고"* 문장을 **갱신하라** — 이제 today 가 읽는다.

## 테스트 (먼저 작성한다)

- 저장된 대표가 목록에 있으면 그것을 돌려준다
- 저장된 대표가 목록에 **없으면** 첫 번째를 돌려준다(«참조 무결성은 쓰는 쪽이 지킨다» 이지만 읽는
  쪽도 안전해야 한다)
- `stored === null` 이면 첫 번째
- 목록이 비면 `null`
- **회귀 가드**: 같은 입력에 대해 `resolveRepresentative` 는 **여전히 `null`** 을 돌려준다

## 금지사항

- **`resolveRepresentative` 의 반환 규칙을 바꾸지 마라.** 이유: 위 절.
- **파생값을 저장소에 쓰지 마라.** 이유: [[ADR-143]] 결정 4 — 저장하면 순서가 바뀔 때마다 «사용자가
  고른 대표» 와 «앱이 적어 둔 대표» 두 진실이 갈린다.
- **화면에 «임시» 라는 표시를 준비하지 마라.** 이유: [[ADR-144]] 결정 4 가 그 규칙을 화면에 그리지
  않기로 했다(이 step 은 값만 만든다).
- 기존 테스트를 깨뜨리지 마라.

## Acceptance Criteria

```bash
npm run build                                       # core 타입 검사 포함
npx tsc --noEmit -p packages/app-rn/tsconfig.json   # RN 타입 (루트 tsconfig 는 참조 스텁이라 무의미하다)
npm test                                            # vitest(core·capacitor) + jest(app-rn)
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. 아키텍처 체크리스트:
   - `/docs/foundation/architecture.md` 디렉토리 구조를 따르는가?
   - CLAUDE.md CRITICAL — `features/*` 가 저장소·네이티브를 직접 만지지 않는가([[ADR-003]]·[[ADR-005]])?
   - CLAUDE.md CRITICAL — `src/data/` 의 게임 수치를 임의로 추정하지 않았는가([[ADR-006]])?
   - 새 컴포넌트를 만들었다면 아토믹 계층 자리가 맞는가(`components/__tests__/layer-dependencies.test.ts`)?
3. 결과에 따라 `phases/today-widgets/index.json` 의 해당 step 을 갱신한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 즉시 중단

