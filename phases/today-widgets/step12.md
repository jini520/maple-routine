# Step 12: today-screen

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/today.md` 전문**
- **`/docs/adr/ADR-147.md` 결정 4·5 + 정정 13**
- **`/docs/adr/ADR-132.md` 결정 7·8·11·12** — 첫 화면·동기화 트리거·하단 인셋·«개발 진행중» 자리표시자
- `/docs/adr/ADR-097.md` 결정 3·4 · `/docs/adr/ADR-101.md` · `/docs/adr/ADR-130.md`(RefreshControl)
- 코드: `packages/app-rn/src/app/today/TodayScreen.tsx`(**지금은 `UnderConstruction` 껍데기**) ·
  `packages/app-rn/src/app/content-scheduler/ContentScreen.tsx`(**진입 자동 재조회·당김 배선의 선례 —
  읽고 관례를 그대로 따라라**) · `packages/app-rn/src/components/templates/ScreenScroll/` ·
  `packages/app-rn/src/navigation/routes.ts`
- **step 0·5·6·7·8·9·10·11 산출물 전부**

## 배경

마지막 조립이다. 껍데기(`UnderConstruction`)를 걷고 격자를 올린다.

## 작업

### 1. `TodayScreen.tsx` 재작성

- `PageHeader` + `PageHeaderTitleRow` — 제목 `today`, 동기화 상태·새로고침은 **다른 스케줄러 화면과
  같은 관례**를 따른다(`ContentScreen` 을 읽어라). `PageHeaderTitleRow` 의 최소 높이 32
  ([[ADR-145]] 정정 1)를 지킨다.
- `ScreenScroll` — `hasTabBar` 기본값(`true`). 하단 인셋은 셸이 이미 처리한다([[ADR-132]] 결정 11).
- **스토어 넷을 구독**하고 그 상태 + `now` 로 `buildTodayViewModel` 을 부른다.
  - `useContentSchedulerStore` · `useBossSchedulerStore` · `useBossProfitStore` · `useDropHistoryStore`
  - `character-basic-cache` 에서 대표 프로필을 읽는 자리도 여기다(위젯이 아니다).
- `<WidgetGrid layout={TILE_LAYOUT} data={viewModel} />`.

### 2. 동기화 트리거 ([[ADR-132]] 결정 8)

- **`today` 는 스스로 동기화를 트리거하고 TTL 정책을 공유한다.** 게이트는 지금 것 그대로다
  (`auto: true` 로 부르는 자동 진입 경로).
- **step 0 의 단일 비행이 이 자리를 안전하게 만든다** — 그 step 이 없으면 이 화면이 첫 동기화를 내는
  동안 스케줄 탭 진입이 같은 호출을 한 번 더 낸다.
- **네 스토어를 각자 트리거하지 마라.** 위젯이 아니라 화면이 트리거하고, 그 횟수는 지금 다른 화면과
  같아야 한다. `prehydrate` 가 이미 예열한 스토어를 다시 강제 조회하지 않는다.

### 3. 당겨서 새로고침 ([[ADR-130]] 결정 1)

`RefreshControl` 을 `ScreenScroll` 에 넘긴다. `refreshing` 은 스토어 상태, `onRefresh` 는 **헤더
버튼과 같은 재조회**([[ADR-072]] 결정 2).

### 4. 라우트 확인 — **고치지 마라, 확인만 하라**

`routes.ts` 의 `INITIAL_TAB_ROUTE === 'Today'` 이고 `ROUTE_TABLE` 의 `/` 행은 **그대로 `Content`** 다
([[ADR-132]] 결정 7 — 그 행은 «웹이 `/` 에서 무엇을 보여 줬는가» 라는 기록이라 첫 화면과 다른 축이다).
**둘이 갈린 것 자체가 그 결정의 산물이므로 «불일치» 로 보고 고치지 마라.**

### 5. `UnderConstruction` 은 남는다

사냥 수익·지출·유틸리티 셋이 아직 쓴다([[ADR-132]] 결정 12). **그 컴포넌트를 지우지 마라.**

## 테스트

- `TodayScreen` 스냅샷 — 캐릭터 4명 기준의 기본 배치가 그려진다
- 진입 시 동기화 트리거가 **정확히 한 번** (다른 스케줄러 화면과 같은 횟수)
- TTL 게이트에 걸리면 트리거하지 않는다(회귀 가드)
- 당김이 헤더 버튼과 **같은 재조회**를 부른다
- 스토어가 비어 있어도(콜드 스타트) 크래시 없이 각 위젯의 빈 상태가 선다
- `INITIAL_TAB_ROUTE === 'Today'` **AND** `ROUTE_TABLE` 의 `/` → `Content` (둘을 함께 고정)

## 금지사항

- **위젯이 스토어를 구독하게 하지 마라.** 이유: [[ADR-147]] 결정 4 — 트리거가 위젯 수만큼 는다.
- **`ROUTE_TABLE` 의 `/` 행을 `Today` 로 바꾸지 마라.** 이유: 위 4번.
- **`UnderConstruction` 을 지우지 마라.** 이유: 화면 셋이 아직 쓴다.
- **`prehydrate.ts` 에 `drop-history` 를 더하지 마라.** 이유: [[ADR-147]] 대가 3 — 실측 뒤에 정한다.
  지금 넣으면 근거 없는 값이 된다.
- **타일 안에 스크롤을 넣지 마라.** 이유: 페이지 스크롤과 제스처를 두고 싸운다.
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

