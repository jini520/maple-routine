# Step 4: character-row

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/adr/ADR-144.md` 결정 2·3·4·5 전문** — 카드 안쪽·이동·별·핸들
- **`/docs/adr/ADR-015.md`** — 얼굴 크롭 기법과 그 문서 머리의 **정정 박스**(직업 표시가 뒤집혔다)
- `/docs/foundation/design-system.md` 「캐릭터 카드 그리드」 절(+ 그 위의 RN 주석)
- `/docs/ADR.md` 에서 **[[ADR-129]] · [[ADR-135]] · [[ADR-101]] 결정 1** 만
- 코드: `packages/app-rn/src/components/organisms/CharacterTrackingPicker/CharacterTrackingGrid.tsx`
  (**얼굴 크롭·엠블럼·`naturalAspectStyle` 처리를 여기서 가져온다**) ·
  `packages/app-rn/src/components/molecules/` 의 기존 컴포넌트 관례 · `packages/app-rn/src/lib/icons.ts`
- **step 3 산출물**: `features/character-manage/` 의 `SelectedCharacterView`

## 배경 — 두 층이 **같은 카드**를 쓴다

위 층(선택됨)과 아래 층(후보)은 같은 것들의 **두 상태**다. 모양을 가르면 카드가 층을 옮길 때
«다른 물건» 으로 보인다. 그래서 컴포넌트는 하나이고 **좌우 슬롯만 갈린다.**

## 작업

`packages/app-rn/src/components/molecules/CharacterRow/` (신규):

```tsx
export interface CharacterRowProps {
  name: string
  level: number | null
  jobClass?: string
  world?: string
  imageUrl: string | null
  /** 조회 불가 — 2줄이 «조회할 수 없는 캐릭터» 로 바뀐다 */
  unavailable?: boolean
  /** 왼쪽 슬롯: 끌기 핸들(위 층에만) */
  leading?: React.ReactNode
  /** 오른쪽 슬롯: 위 층은 별+✕, 아래 층은 ＋ */
  trailing?: React.ReactNode
  onPress?: () => void
}
```

### 카드 안쪽 (사용자 지정)

```
(얼굴 34~40)  [스] 내옆에최성일
              Lv.285 아크메이지(썬, 콜)
```

- **1줄 = 월드 엠블럼 + 닉네임.** 이름이 주인공이라 월드는 **엠블럼만** 쓴다(글자로 적지 않는다).
  엠블럼은 `worldEmblemUrl` + `naturalAspectStyle`(`app-rn/src/lib/image-aspect.ts`) — 그 처리를
  안 하면 폭이 에셋 고유 크기로 남는다([[ADR-135]]).
- **2줄 = 레벨 + 직업.** `Lv.{level} {jobClass}`.
  - `level === null` 이면 레벨을 그리지 않는다. `jobClass` 가 없으면 직업을 그리지 않는다.
    **둘 다 없으면 2줄을 그리지 않는다** — 빈 줄을 남기지 마라.
  - `unavailable` 이면 2줄이 **«조회할 수 없는 캐릭터»**(`text-error-ink`)로 바뀐다.
- **얼굴**은 [[ADR-015]] 크롭 기법 그대로(`CharacterTrackingGrid` 의 상수·식을 그대로 옮기되 크기만
  행에 맞춘다). 이미지가 없으면 **이름 첫 글자**.
- 이름은 `numberOfLines={1}` + 말줄임. 2줄도 같다.

### 별·＋·핸들 (호출부가 슬롯으로 넣는다 — 이 컴포넌트는 모양만 안다)

같은 폴더에 작은 프리미티브로 둬라:

- **`RepresentativeStar`** — 채웠을 때 **배경·테두리 없이 `fill` 만**(`primary-ink`).
  «대표가 정해졌으면 나머지는 흐리게» 는 **부모가 `dimmed` 프롭으로** 내린다. **비활성이 아니다** —
  흐린 별도 눌린다(누르면 대표가 그리로 옮겨간다).
- **`DragHandle`** — **가로 3줄** 아이콘(lucide `Menu`). 접근성 이름은 「순서 변경」이다 —
  그 글리프의 이름이 «메뉴» 라고 해서 메뉴를 뜻하지 않는다.
- **`AddMark`** — `＋` 아이콘 하나. **대표 색을 쓰지 않는다**(`text-text-muted` 톤, 테두리·배경 없음).
  버튼이 아니라 «누르면 추가된다» 는 **표시**이고, 실제 탭 영역은 **행 전체**다.

### 테스트 먼저

- 2줄 조합 넷: 레벨+직업 / 레벨만 / 직업만 / 둘 다 없음(**2줄 자체가 없다**)
- `unavailable` → 2줄이 그 문구다
- 이미지 없으면 이니셜
- 별: 채움 상태에 **배경/테두리 스타일이 없다** · `dimmed` 여도 `onPress` 가 살아 있다
- 슬롯: `leading` 없이도 그려진다(아래 층)
- 스냅샷 기준선 하나

## Acceptance Criteria

```bash
npm test
npm run lint
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `components/molecules/` 에 있고 상위 계층(organisms/app)을 import 하지 않는가
     (계층 의존 방향 테스트가 이미 있다)
   - 스토어·저장소를 직접 읽지 않는가(전부 프롭)
   - 웹(`app-capacitor`)을 건드리지 않았는가
3. `phases/character-multi-account/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "CharacterRow 프롭·프리미티브 셋 이름·2줄 규칙"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **채운 별 뒤에 배경 배지(테두리+틴트)를 두지 마라.** 이유: 채운 별이 이미 «찬 것 vs 빈 것» 이라
  같은 말을 두 번 하게 되고, 그 배지 문법은 설정 행의 «값 배지» 것이다.
- **`＋` 에 대표 색을 쓰지 마라.** 이유: 화면에서 가장 눈에 띄는 것이 «추가» 아이콘 여러 개가 되고,
  한 번만 고르는 대표 별과 색이 겹친다.
- **흐린 별을 `disabled` 로 만들지 마라.** 이유: 그러면 대표를 바꿀 방법이 없어진다.
- **«임시 대표» 표시를 만들지 마라.** 이유: 사용자가 명시적으로 뺐다.
- 기존 테스트를 깨뜨리지 마라.
