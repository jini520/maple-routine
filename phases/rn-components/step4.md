# Step 4: molecules

## 읽어야 할 파일

- `/docs/README.md` · `/docs/foundation/design-system.md`
- **`/docs/migration/parity-inventory.md` §3** (컴포넌트별 ADR 계약표)
- **`/docs/foundation/error-resilience.md`** (`EmptyState`·`ErrorState` 가 그 정책의 표면이다)
- `/docs/ADR.md` 에서 아래 표의 ADR 만 열어라
- `packages/app-capacitor/src/components/molecules/**` (**옮길 원본 11개**)
- **이전 step 산출물**: `packages/app-rn/src/components/atoms/**` · 계층 의존 테스트 · 대체한 `className` 목록

## 배경

| 컴포넌트 | ADR 계약 |
|---|---|
| `BossPortrait` | — |
| `CharacterSelectDropdown` | 001, 096 |
| `DifficultySegment` | 121 |
| `EmptyState` | 060, 066 |
| `EmptyState/UnavailableNotice` | 060, 067, 068 |
| `ErrorState` | 060, 061, 062, 114, 116 |
| `ErrorState/StaleBanner` | 016, 017, 062, 094, 114 |
| `LoadingState` | 016, 061 |
| `PartySizeStepper` | 121 |
| `PullToRefreshIndicator` | 047, 061, 073, 074 |
| `ValuableDropBadge` | 045, 046, 071 |

## 작업

### 1. atoms 를 조합해 만들어라

**molecules 는 atoms 만 import 한다.** organisms·templates 를 부르면 계층 위반이고 테스트가 잡는다.

### 2. 성격이 다른 셋을 주의하라

**`PullToRefreshIndicator`** — 웹에서는 `lib/use-pull-to-refresh.ts` 가 DOM 이벤트로 당김을 재고
이 컴포넌트가 그 진행률을 그렸다. **RN 에는 `RefreshControl` 이 있다**(`migration/README.md`
«삭제되는 화면 전환 machinery»). [[ADR-073]]·[[ADR-074]] 가 정한 **표식과 임계 동작**을 읽고,
`RefreshControl` 로 되는 부분과 안 되는 부분을 갈라 적어라. 모션은 step 7 대상이다.

**`ErrorState`·`EmptyState`** — `error-resilience.md` 의 정책이 이 둘로 드러난다. 문구·분기·
액션 유무([[ADR-060]]: *"액션이 없는 자리에 비활성 버튼을 두지 않는다"*)를 그대로 보존하라.
**문구를 다듬지 마라** — 이 저장소는 에러 문구를 전수 조사해 다듬은 이력이 있다.

**`CharacterSelectDropdown`** — [[ADR-001]] 참조가 붙어 있다(웹뷰 전제의 동작). 무엇이 웹뷰 때문이고
무엇이 제품 결정인지 읽고 갈라라.

### 3. `ValuableDropBadge` 의 모션은 step 7

[[ADR-045]]·[[ADR-046]]·[[ADR-071]] 이 걸려 있고 `valuable-drop-glow`·`valuable-drop-spin` 등
`@keyframes` 를 쓴다. **정적 형태까지만** 만들고 주석·summary 에 미완을 적어라.

### 4. RN 트리 스냅샷 · `className` 대체 기록

step 3 의 관례를 그대로 따르고, 새로 대체한 `className` 이 있으면 목록에 **추가**하라.

## Acceptance Criteria

```bash
npm test           # vitest 199파일/3044개(증감 0) + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-mol-check
```

계층 규칙 — molecules 는 organisms·templates 를 import 하지 않아야 한다:

```bash
grep -rnE "from '.*(organisms|templates)/" packages/app-rn/src/components/molecules | grep -v __tests__
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 11개가 전부 있는가?
   - 각 컴포넌트의 **ADR 을 전부 읽고 확인했는가**?
   - 에러·빈 상태 **문구가 원본과 같은가**?
   - 계층 의존을 어기지 않았는가?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-components/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 11개·ADR 확인 결과·PullToRefresh 갈래·모션 미구현 목록"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

**"같아 보인다"고 쓰지 마라.** 화면이 없다.

## 금지사항

- **에러·빈 상태 문구를 다듬지 마라.** 이유: 전수 조사로 정리된 문구다. 바꾸면 그 작업이 조용히 되돌아간다.
- **액션이 없는 자리에 비활성 버튼을 두지 마라.** 이유: [[ADR-060]]·`error-resilience.md` 원칙.
- **모션을 여기서 구현하지 마라.** step 7 대상이다.
- **계층 의존을 어기지 마라.**
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
