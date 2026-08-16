# Step 6: manage-screen

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/adr/ADR-144.md` 전문** · **`/docs/adr/ADR-143.md` 결정 5·10 전문**
- **`/docs/features/settings.md`** 「캐릭터 관리」 항목 · **`/docs/features/content-scheduler.md`**
  「캐릭터 관리 피커 — 후보 목록 로딩」 절(로딩·실패·스탈 배너 정책의 원문)
- `/docs/ADR.md` 에서 **[[ADR-053]] · [[ADR-062]] · [[ADR-086]] 결정 7 · [[ADR-114]] 결정 3 ·
  [[ADR-115]] 결정 7 · [[ADR-116]] 결정 1·4 · [[ADR-140]] 결정 1·2·4·5 · [[ADR-131]]** 만
- 코드: `packages/app-rn/src/app/settings/SettingsScreen.tsx`(로스터 조회·저장·`openPicker` 배선의
  현재 모습) · `packages/app-rn/src/app/settings/reload-tab-stores.ts` ·
  `packages/app-rn/src/app/settings/use-settings-navigation.ts` ·
  `packages/app-rn/src/navigation/routes.ts` · `packages/app-rn/src/components/templates/ScreenScroll/`
- **step 3·4·5 산출물**: `features/character-manage/` · `CharacterRow` · `AccountSelect`

## 작업

### 1. 화면을 새로 만든다 — 모달이 아니라 **하위 페이지**

`packages/app-rn/src/app/settings/SettingsCharactersScreen.tsx`(이름 재량) + 라우트 등록.
설정 본화면의 「캐릭터 관리」 행은 이제 **모달을 열지 않고 이 화면을 push** 한다.

- **`openPicker` 파라미터 계약을 그대로 잇는다**([[ADR-140]] 결정 2) — 그 값으로 설정 탭에 도착하면
  이 화면을 곧바로 push 하고, 마운트 직후 `setParams` 로 파라미터를 지운다(안 지우면 탭을 떠났다
  돌아올 때마다 다시 열린다).
- 본문은 **온보딩과 공유할 수 있는 모양**으로 쪼개 둬라(step 8 이 그 본문을 페이지로 쓴다).
  머리(← + 제목 vs 제목 블록)와 CTA(닫기/저장 vs 계속하기)만 갈린다.
- [[ADR-131]]: **고정 영역을 만들지 마라.** 두 층과 액션이 함께 스크롤된다.

### 2. 두 층

| | 위 «선택된 캐릭터 n개» | 아래 «캐릭터 추가» |
|---|---|---|
| 자료 | `buildSelectedCharacterViews`(로컬 캐시) | `getCharacterPickerRoster({ accountId })` |
| 순서 | 저장 배열 순서 | 로스터가 준 순서(레벨 내림차순) |
| 좌우 슬롯 | 핸들 + 별·`✕` | `＋` |
| 네트워크 | **없다** | 계정을 처음 열 때만 |

- **선택은 «이동» 이다**([[ADR-144]] 결정 3): 아래 카드를 누르면 아래에서 빠져 **위 목록의 끝**에
  붙는다. 위에서 `✕` 로 빼면 **지금 열린 계정 소속이면** 아래로 돌아가고, 아니면 돌아가지 않는다.
- 위 층 라벨은 «선택된 캐릭터 n개» 뿐이다 — **«모든 메이플 ID» 같은 부연을 붙이지 마라.**
- 아래 층 라벨의 보조 표기는 «{전체}개 중 {표시}개 표시».
- 대표: 별 하나만 채워지고 **나머지는 흐리게**(누를 수는 있다). **대표가 없으면 아무 표시도 없다.**
- 순서 변경(끌기)은 **step 7** 이다. 이 step 에서는 배열 순서를 그대로 그리기만 한다.

### 3. 계정 전환과 TTL ([[ADR-144]] 결정 6)

- 드롭다운이 계정을 바꾸면 **아래 층만** 다시 돈다. 위 층은 건드리지 않는다.
- 계정별 결과를 화면 상태에 들고, **5분(`CHARACTER_BASIC_TTL_MS` 재사용) 안에 다시 열면 조회를
  시작하지 않는다.** 새 상수를 만들지 마라.
- **수명은 이 화면이다** — 화면을 나가면 사라진다(영속화 금지).
- **실패는 캐싱하지 않는다.** 판정 불가로 끝난 계정은 실패 표시 + 「다시 시도」이고, 그 재시도는
  **TTL 을 무시한다.**
- **TTL 을 알리는 표시를 화면에 두지 마라**(«방금 확인함» 류 금지).

### 4. 로딩·실패·빈 상태는 **아래 층 자리**에서 기존 정책 그대로

`content-scheduler.md` 「캐릭터 관리 피커」 절이 원문이다 — 캐시 우선 표시, 콜드 스타트 스피너,
`ErrorState` 원인별 문구·액션([[ADR-062]]·[[ADR-114]]), 스탈 배너, 401·429 진입점
(`useApiKeyNotice`, [[ADR-115]]·[[ADR-116]]). `SettingsScreen.tsx` 의 현재 배선을 그대로 옮겨라.

추가로 [[ADR-143]] 결정 10 의 두 화면:

- **전원 조회 불가 계정**: 후보 0건 + «이 메이플 ID 의 캐릭터는 모두 조회할 수 없어요». 출구는
  드롭다운이다(「계정 다시 선택」 같은 액션을 만들지 마라).
- **고를 수 있는 계정이 0개**: 화면 전체 빈 상태 + 키 재입력 경로.

### 5. 저장 ([[ADR-144]] 결정 7)

- `useContentSchedulerStore.getState().saveTrackedOcids(ocids, onProgress)` 를 **그대로 부른다**
  ([[ADR-140]] 결정 4 — 세 번째 사본을 만들지 마라). 대표 저장은 step 0 의 헬퍼로.
- 그 뒤 `reloadTabStores(['boss', 'profit'])`([[ADR-140]] 결정 5).
- **저장 활성 조건은 «집합 ∪ 순서 ∪ 대표»** — 셋 중 하나라도 다르면 활성. **0개면 비활성**
  ([[ADR-086]] 결정 7).
- 진행률 모달은 지금 `SettingsScreen` 이 쓰는 것을 그대로 재사용한다.

### 6. 설정 본화면 정리

- 「캐릭터 관리」 행: 배지 단위를 **«개»** 로(`3명` → `3개`, [[ADR-144]] 결정 8 이 [[ADR-140]] 결정 3의
  표기를 정정했다).
- 로스터 조회·피커 상태·저장 핸들러를 본화면에서 **새 화면으로 옮겨라** — 본화면에 남기지 마라.

### 7. 테스트 먼저

- 두 층 범위: 계정을 바꿔도 위 목록이 그대로다 · 대기·실패가 아래 자리에만 그려진다
- 이동: 누르면 아래에서 사라지고 위 **끝**에 붙는다 · `✕` → 열린 계정 소속이면 아래로 돌아온다
- 대표: 하나만 채워진다 · 나머지는 흐리되 눌린다 · 없으면 아무 표시 없다
- TTL: 같은 계정을 다시 열면 로스터 조회가 **한 번도 더 나가지 않는다** · 실패는 캐싱되지 않는다
- 저장: 집합/순서/대표 각각만 바꿔도 활성 · 0개면 비활성 · `saveTrackedOcids` 와 `reloadTabStores`
  호출 순서
- `openPicker` 로 들어오면 화면이 열리고 파라미터가 지워진다

## Acceptance Criteria

```bash
npm test
npm run lint
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-cma-check
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 저장 로직을 **새로 만들지 않고** 컨텐츠 스토어 액션을 불렀는가
   - 고정 영역(sticky/fixed)을 만들지 않았는가([[ADR-131]])
   - 새 TTL 상수를 만들지 않았는가
   - 지시받지 않은 문구(«모든 메이플 ID»·«방금 확인함»·«임시»)를 넣지 않았는가
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? 했다면 잘못된 것이다
3. `phases/character-multi-account/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "화면 파일·라우트 이름·본문 컴포넌트 분리 방식·TTL 보관 위치·저장 경로"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **끌어서 순서 바꾸기를 여기서 구현하지 마라.** 이유: step 7 의 몫이고, 제스처가 섞이면 이 step 의
  실패 원인이 흐려진다.
- **로스터 결과를 저장소에 영속화하지 마라.** 이유: `character/list` 는 캐싱하지 않기로 한 값이다.
- **「계정 다시 선택」 같은 옛 탈출구를 만들지 마라.** 이유: 계정을 고르는 단계가 없어졌고, 출구는
  드롭다운이다.
- **`＋` 를 별도 버튼으로 만들어 카드 탭을 막지 마라.** 이유: 누르는 자리는 카드 전체다.
- 기존 테스트를 깨뜨리지 마라.
