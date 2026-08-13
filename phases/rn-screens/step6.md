# Step 6: profit-shared

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/boss-profit.md` (정독하라)**
- **`/docs/migration/parity-inventory.md` §2.5** — «최고 위험 구역»
- `/docs/ADR.md` 에서 아래 표의 ADR 만 열어라
- `packages/app-capacitor/src/app/boss-profit/**` 중 **아래 9개**(화면 넷은 step 7·8 몫)
- `packages/app-capacitor/src/app/boss-profit/__tests__/**` (9개 — **명세로 읽어라**)
- **이전 step 산출물**: 셸 · 에셋 코드젠(`item-icons`·`boss-icons`) · `src/components/**` ·
  step 4·5 가 정한 화면 관례

## 배경 — 다음 step 이 이 저장소에서 가장 위험한 화면이다

`BossProfitScreen`(ADR 32개)을 치기 전에 **그 아래를 먼저 세운다.** 이 step 은 화면이 아니라
**화면이 딛고 설 것들**이다.

| 파일 | ADR 계약 |
|---|---|
| `boss-profit-context.tsx` | 068, 085, 087, 094, 100 |
| `character-groups.ts` | 036, 038, 046, 054, 059, 069, 094, 124 |
| `BossProfitBossRow.tsx` | 032, 038, 041, 049, 063, 094, 100, 124 |
| `BossDropSheet.tsx` | 038, 040, 041, 069 |
| `HeadlineChips.tsx` | 046, 047, 049, 054, 087, 094 |
| `ItemRevenuePopover.tsx` | 049, 068, 071, 124 |
| `AccordionBody.tsx` | 068, 094 |
| `CharacterAvatar.tsx` | 015, 018, 049, 054, 059, 094 |
| `CharacterIssue.tsx` | 047, 049, 054, 063, 067, 068, 094 |

## 작업

### 1. **[[ADR-124]] 가 넷에 걸려 있다 — 이것부터 읽어라**

*"미입력은 0원이 아니다."* 화면에 안 보이는 판단이고, 틀리면 **사용자 기록이 조용히 거짓이 된다**
([[ADR-128]] 결정 6 이 예로 든 바로 그 종류).

- 이 성질은 **실기기에서 실측 검증됐다**(`docs/migration/data.md` — SQLite `NULL` 이 `0` 으로
  접히지 않는 것을 주입한 행으로 확인). 저장소 층은 이미 지켜진다.
- 이 step 이 지켜야 하는 것은 **표시 층**이다: `null` 을 `0` 으로 렌더하거나, `??  0` 으로
  뭉개거나, 합계에 포함시키지 마라. TypeScript 가 `number | null` 을 주는 자리를 전부 확인하라.
- **테스트로 고정하라.** 이 계약은 눈으로 안 보인다.

### 2. `character-groups.ts` 는 화면이 아니다 — 로직이다

ADR 8개가 걸린 순수 로직에 가깝다. **core 로 옮길 것처럼 보이지만 옮기지 마라** —
`packages/core` 무수정이 이 단계의 규칙이고, 그 이동은 별도 결정이다. 지금은 `app-rn` 쪽으로
이식하되, **core 로 갈 후보라는 사실을 주석과 summary 에 적어라.**

### 3. `ItemRevenuePopover` — RN 에 팝오버가 없다

웹은 절대 배치 + 바깥 클릭이었다. RN 에서 무엇으로 그릴지 정하라 — 3단계의 `Modal`(별도 네이티브
윈도우)·`BottomSheet` 중 하나거나, 화면 안 절대 배치다. **[[ADR-049]] 가 정한 «어디에 뜨는가»** 를
읽고 고르고, **고른 이유를 적어라.**

### 4. `BossDropSheet` — [[ADR-038]]·[[ADR-039]]·[[ADR-040]]·[[ADR-069]]

3단계의 `BottomSheet` organism 위에 선다. **다시 만들지 마라.**
[[ADR-040]] (드랍 연출 on/off 설정)과 [[ADR-069]] (월드 리프)를 확인하라 — 후자는 [[ADR-128]] 이
*"화면에 안 보이는 엣지 케이스"* 로 지목한 것이다.

### 5. `CharacterAvatar` — 에셋

step 1 코드젠 이후 실제로 그림이 나오는지 확인하라. 안 나오면 무엇이 남았는지 적어라.

### 6. [[ADR-087]] — 숫자가 올라가는 연출

`AnimatedMeso`(atom)와 core `use-count-up` 훅이 3단계에 있다. **[[ADR-087]] 결정 6·7·8 과 정정 1 은
«호출부 identity 키»에 산다** — 3단계가 *"키는 화면을 옮길 때 정해진다"* 며 남겨 둔 자리가 여기다.
키가 틀리면 값이 바뀔 때 애니메이션이 안 돌거나 엉뚱한 값에서 시작한다.

### 7. 웹 테스트 9개는 명세다 — 이식하지 마라

## Acceptance Criteria

```bash
npm test           # vitest 증감 0 + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-profit-shared-check
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 9개가 전부 있는가? 각 행의 ADR 을 전부 읽고 확인했는가?
   - **[[ADR-124]] «미입력 ≠ 0원» 이 표시 층에서 지켜지는가? 테스트가 있는가?**
   - [[ADR-087]] 의 identity 키를 정했는가?
   - `ItemRevenuePopover` 를 무엇으로 그렸고 왜인가?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-screens/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 9개·ADR-124 표시 층 처리와 테스트·팝오버 선택과 근거·ADR-087 키·에셋 표시 여부·육안 대조 목록"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`null` 을 `0` 으로 뭉개지 마라**(`?? 0`·`Number(x)`·합계 포함). 이유: [[ADR-124]] — 사용자
  기록이 조용히 거짓이 된다. 이 저장소가 *"확신 없는 것을 단정하지 않는다"* 로 반복해 온 원칙이다.
- **`character-groups.ts` 를 `packages/core` 로 옮기지 마라.** 이유: 이 단계의 규칙은 core 무수정이고
  그 이동은 별도 결정이다. 후보라는 사실만 적어라.
- **`BottomSheet`·`Modal` 을 다시 만들지 마라.** 3단계에 있다.
- **게임 레퍼런스 수치를 추정해 하드코딩하지 마라.** ([[ADR-006]])
- **`BossProfitScreen`·`DropHistoryScreen`·`DropPriceScreen`·`DropPricePad` 를 여기서 만들지 마라.**
  step 7·8 몫이다.
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
