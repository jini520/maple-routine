# Step 9: display-order

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/adr/ADR-143.md` 결정 3 전문** — 특히 «순서를 얹는 자리는 core 스토어가 아니라 RN 화면 쪽
  셀렉터다» 항목
- `/docs/ADR.md` 에서 **[[ADR-017]] 결정 2 · [[ADR-042]] · [[ADR-142]] · [[ADR-140]] 결정 5** 만
- 코드: `packages/core/src/features/content-scheduler/store.ts` ·
  `packages/core/src/features/boss-scheduler/store.ts`(**둘 다 `sortByCachedLevel` 을 갖고 있다 —
  읽되 고치지 마라**) · `packages/core/src/features/boss-profit/` 의 캐릭터 그룹 ·
  `packages/app-rn/src/components/molecules/CharacterRail/` ·
  `packages/app-rn/src/app/content-scheduler/` · `packages/app-rn/src/app/boss-scheduler/` ·
  `packages/app-rn/src/app/boss-profit/character-groups.ts`
- **step 0 산출물**: `storage/character-selection.ts`

## 배경 — 왜 core 정렬을 고치면 안 되는가

`sortByCachedLevel`(레벨 내림차순)은 컨텐츠·보스 스토어 **안**에 있고 **Capacitor 가 그 정렬로 산다.**
거기서 «저장 배열 순서» 로 바꾸면 웹뷰 앱의 화면 순서까지 함께 바뀌어 이 task 의 적용 범위(RN 만)를
넘는다. 그래서 **core 는 안정된 기준 순서를 그대로 내고, RN 이 그 위에 사용자 순서를 얹는다.**

## 작업

### 1. 순서를 얹는 순수 함수 하나

`packages/app-rn/src/lib/tracked-order.ts`(경로 재량):

```ts
/** trackedCharacters 저장 순서대로 다시 세운다. 목록에 없는 ocid 는 뒤에 원래 순서로 남긴다. */
export function orderByTracked<T extends { ocid: string }>(items: T[], orderedOcids: string[]): T[]
```

- **`orderedOcids` 에 없는 항목을 버리지 마라** — 뒤에 그대로 붙인다(경계 상태에서 캐릭터가 화면에서
  사라지는 것이 가장 나쁜 실패다).
- 순수 함수 + 테스트. 스토어를 import 하지 마라.

### 2. 세 자리에 적용한다

- **컨텐츠 스케줄러 초상화 레일**([[ADR-142]])
- **보스 스케줄러 초상화 레일**
- **보스 수익 캐릭터 그룹**(`character-groups.ts` 가 이미 순서를 만드는 자리다)

각 화면이 스토어의 `characters` 를 그릴 때 이 함수를 **한 번** 통과시킨다. `orderedOcids` 의 출처는
`getTrackedCharacterOcids()`(스토어가 이미 들고 있으면 그 값을 쓰고, 조회를 새로 늘리지 마라).

### 3. 단위 정정 마무리

`docs` 의 [[ADR-144]] 결정 8 대로 화면에 남은 «명» 을 «개» 로 바꾼다. RN 에서 캐릭터를 «명» 으로 세는
자리는 다음 둘뿐이다(직접 찾아 확인하라):

- 설정 「캐릭터 관리」 행 배지(step 6 에서 이미 고쳤다면 확인만)
- 옛 피커 모달 설명문(«최소 한 명은 선택해주세요») — 그 모달이 아직 남아 있다면 «최소 1개는
  선택해주세요» 로. **`app-capacitor` 의 같은 문구는 건드리지 마라.**

### 4. 테스트 먼저

- `orderByTracked`: 순서 반영 · 목록에 없는 항목은 **뒤에 유지** · 빈 목록이면 입력 그대로
- 세 화면: 저장 순서가 화면 순서다(스토어가 레벨 순으로 줘도 결과는 저장 순서)
- **core 스토어 테스트가 그대로 통과한다**(레벨 정렬이 살아 있다는 뜻 — Capacitor 회귀 가드)

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-cma-order
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - **`packages/core` 의 `sortByCachedLevel` 을 고치지 않았는가**(고쳤다면 적용 범위를 넘은 것이다)
   - 순서 함수가 스토어를 모르는 순수 함수인가
   - 조회(`getTrackedCharacterOcids`)를 새로 늘리지 않았는가
   - `app-capacitor` 문구를 건드리지 않았는가
3. `phases/character-multi-account/index.json` 의 step 9 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "순서 함수 위치·적용한 세 자리·단위 정정 자리·core 무수정 확인"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`sortByCachedLevel` 을 «저장 순서» 로 바꾸지 마라.** 이유: 그 함수는 Capacitor 화면도 정렬한다.
  core 는 기준 순서를 내고 RN 이 얹는 구조를 지켜라.
- **순서 플래그를 core 에 새로 만들지 마라.** 이유: [[ADR-143]] 결정 8 이 «갈리는 자리는 한 곳» 을
  조건으로 계정 범위 플래그 하나만 허락했다.
- **`orderedOcids` 에 없는 캐릭터를 화면에서 빼지 마라.** 이유: 저장 목록과 스토어 목록이 어긋나는
  한순간에 캐릭터가 통째로 사라진다.
- 기존 테스트를 깨뜨리지 마라.
