# Step 5: boss-scheduler

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/boss-scheduler.md`**
- **`/docs/migration/parity-inventory.md` §2.4**
- `/docs/ADR.md` 에서 아래 표의 ADR 만 열어라
- `packages/app-capacitor/src/app/boss-scheduler/**` (**옮길 원본 2개, 1,166줄**)
- `packages/app-capacitor/src/app/boss-scheduler/__tests__/**` (6개 — **명세로 읽어라**)
- **이전 step 산출물**: 셸 · 에셋 코드젠(`boss-icons` 가 여기 쓰인다) · `src/components/**` ·
  **step 4 가 정한 당겨서 새로고침 갈래**

## 배경 — 파일은 둘인데 ADR 은 26개다

| 파일 | ADR 계약 |
|---|---|
| `BossScreen` | 015, 016, 017, 018, 019, 031, 035, 047, 053, 060, 061, 062, 063, 064, 072, 073, 077, 083, 096, 098, 099, 101, 115, 116, 120, 121 |
| `BossManageScreen` | 031, 035, 055, 056, 061, 065, 096, 098, 099, 120, 121 |

`BossScreen` 은 이 저장소에서 **`BossProfitScreen` 다음으로 무거운 화면**이다(ADR 26개, 파일 하나).
파일 수에 속지 마라 — step 4 보다 오래 걸린다.

## 작업

### 1. step 4 의 선택을 물려받아라

당겨서 새로고침([[ADR-073]]·[[ADR-074]])·헤더 스페이서([[ADR-112]]·[[ADR-123]])·스크롤 소유
([[ADR-099]])는 step 4 가 이미 정했다. **다르게 하지 마라** — 두 탭이 같은 제스처에 다르게 반응하면
그 자체가 회귀다. 다르게 해야 한다면 **이유를 적어라.**

### 2. [[ADR-031]] — 시즌 보스 판정

`isChallengersWorld` 다. 3단계가 확인한 바로는 **이것은 에셋이 아니라 JSON 이라 그대로 살아 있다**
(대체 구현이 같은 JSON 을 읽어 답한다). 화면에서 다시 판정하지 마라.

### 3. [[ADR-121]] — 파티 인원

`PartySizeStepper`(molecule)·`PartySizeModal`(organism)·`DifficultySegment`(molecule)가 3단계에
있다. **여기서 다시 만들지 마라.** 이 화면은 그것들을 **배치하고 값을 잇는다.**

[[ADR-006]] 을 기억하라 — **보스 목록·난이도·인원 같은 게임 레퍼런스 수치를 임의로 추정해
하드코딩하지 마라.** 값은 `packages/core/src/data/` 에 있고, 없으면 **만들지 말고 blocked 로 멈춰라.**

### 4. [[ADR-019]]·[[ADR-018]] — 보스 카드

카드 구성이다. `Card`·`Badge`·`DifficultyBadge`·`BossPortrait` 가 아래 계층에 있다.
`BossPortrait` 은 step 1 의 에셋 코드젠으로 그림이 살아났을 수 있다 — **실제로 그려지는지 확인**하고,
CSS `background-size`/`position` → RN 기하 변환이 필요하면 그 계산을 여기서 한다(3단계가
*"에셋이 들어온 뒤에야 쓸 수 있다"* 며 미뤄 둔 자리다).

### 5. [[ADR-064]] — `media-scope`

보스 카드가 `media-scope` 안에 있어 같은 레시피가 카드 기준을 본다. 3단계가 `<MediaScope>` 로
옮겨 뒀다. **테마 이름으로 분기하지 마라**([[ADR-064]] 결정 8).

### 6. 웹 테스트 6개는 명세다 — 이식하지 마라

## Acceptance Criteria

```bash
npm test           # vitest 증감 0 + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-boss-check
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 2개가 다 있는가? **`BossScreen` 의 ADR 26개를 하나씩 확인했는가?**
   - step 4 와 같은 PTR·헤더·스크롤 동작인가? 다르면 이유를 적었는가?
   - **게임 수치를 하드코딩하지 않았는가?** ([[ADR-006]])
   - `BossPortrait` 그림이 실제로 나오는가? 안 나오면 무엇이 남았는지 적었는가?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-screens/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 2개·BossScreen ADR 26개 확인 결과·초상 기하 변환·step 4 와 갈린 것·육안 대조 목록"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **게임 레퍼런스 수치(보스 목록·난이도·결정석 가격·드랍 테이블)를 추정해 하드코딩하지 마라.**
  이유: CLAUDE.md CRITICAL · [[ADR-006]]. 값이 없으면 **blocked 로 멈춰라.**
- **step 4 가 정한 PTR·헤더·스크롤 동작을 이유 없이 바꾸지 마라.** 두 탭이 다르게 반응하면 회귀다.
- **molecule·organism 을 다시 만들지 마라.** 3단계에 있다.
- **테마 이름으로 분기하지 마라.**
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
