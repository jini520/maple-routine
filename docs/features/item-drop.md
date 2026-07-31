# 물욕 아이템 드랍 (Item Drop)

> **범위**: 보스별 물욕템 획득 기록, 랜덤 컨테이너 결과 선택, 드롭 입력 시트, 고가 아이템 리스트. 수익 합산·고가 드롭 연출은 [boss-profit.md](./boss-profit.md), 게임 데이터 파일은 [../foundation/game-data.md](../foundation/game-data.md).
> **관련 소스**: `app/item-drop/` · `features/item-drop/` · `features/drop-effect/` · `storage/boss-drop-records`·`storage/drop-effect` · `lib/item-icons`·`lib/drop-effect-frames`·`lib/drop-effect-layout`·`lib/boss-drops`(`pruneUnobtainableDrops`·`planConfirmedDifficultyDropMigration`) · `DropEffectOverlay` · `scripts/measure-drop-effect-origins.py`(origin 재계측) · `BossDropSheet`(vaul Drawer) · `src/data/item-drop-table.json`·`boss-ring-boxes.json`·`accessory-boxes.json`·`item-icons.json`·`valuable-drops.json`.
> **관련 ADR**: [[ADR-011]] [[ADR-010]] [[ADR-038]] [[ADR-039]] [[ADR-040]] [[ADR-041]] [[ADR-045]] [[ADR-048]] [[ADR-069]]. **관련 문서**: [../foundation/game-data.md](../foundation/game-data.md), [boss-profit.md](./boss-profit.md).

## 정책
- **드롭 기록의 키는 `(ocid, boss, difficulty, period_key, drop_index)`** 이고, 그래서 **처치 난이도가 나중에 달라지면 이관이 필요하다**([[ADR-069]] 결정 4) — 익스트림으로 등록해두고 드롭까지 기록한 뒤 백필이 하드로 확정하면 그 드롭은 고아가 된다. 확정 시점에 옛 난이도 키의 드롭을 확정 키로 옮기고, **그 난이도에서 획득 불가능한 항목(`pruneUnobtainableDrops` 탈락분)은 삭제한다** — 거짓 기록이 환산 가치·고가 드롭 연출에 섞이는 것을 막는다(사용자 판단). 상세는 [boss-profit.md](./boss-profit.md) "자동 기록"(2026-07-31 구현 완료 — 계산은 `planConfirmedDifficultyDropMigration`, 쓰기는 store).
- **화면 구조**: 2단계 — 드랍 탭 진입 시 **보스 목록** → 하나 선택 시 그 보스의 **물욕템 그리드 + 획득 히스토리**.
- **보스 목록 출처**([[ADR-011]]): 독립 목록이 아니라 보스 스케줄러와 동일한 동기화 캐시에서 `cycle: bossWeekly` + `registration_flag: true` 인 보스만 이름 기준 dedup(수동 등록 불가). 월간 보스(검은마법사)는 현재 제외(의도 여부 확인 필요). 난이도 표기 없음.
- **난이도 무관 아이템 노출**([[ADR-011]]): 보스 선택 시 `item-drop-table.json` 에서 그 보스명과 일치하는 **모든 난이도** 엔트리 아이템을 이름 기준 합쳐 표시 — 유저가 실제 처치 난이도를 게임에 정확히 등록 안 했을 수 있어 난이도로 거르면 실제 획득 아이템이 누락될 위험 때문.
- **아이템 이미지**([[ADR-011]]): 텍스트가 아니라 이미지 버튼. `lib/item-icons` 로 `assets/items/` 조회(일반 아이템은 `item-icons.json`, 반지는 `boss-ring-boxes.json` 의 `iconFile` — "링"으로 끝나면 `items/rings/`). 매핑 없으면 플레이스홀더.
- **아이콘 캔버스 여백 규칙**(2026-07-30): 표시부는 전부 고정 정사각 박스(`h-6`/`h-8`/`h-9`) + `object-contain`이라 **렌더 크기를 결정하는 건 파일의 절대 해상도가 아니라 "불투명 아트워크 / 캔버스" 비율**이다. 여백 없이 딱 잘린 파일은 박스를 꽉 채워 옆 아이콘보다 커 보인다. **기준 = 아트워크가 캔버스의 약 90%**(투명 여백 포함, 예: 32×32 캔버스에 29×29 아트워크). 새 아이콘을 넣을 때 크롭이 타이트하면 리샘플링 없이 **투명 테두리만 덧대** 비율을 맞춘다.
- **획득 기록**: 버튼 탭 = "획득"(획득 일자 포함). 컨테이너형이 아닌 일반 아이템은 확인창 없이 탭 즉시 기록 + 토스트. 캐릭터별/보스별 히스토리 조회. 잘못 등록한 기록은 히스토리에서 개별 삭제/취소 가능(삭제 확인 다이얼로그 여부 미정).
- **랜덤 컨테이너 결과 기록**([[ADR-010]]): "OO옥의 보스 반지 상자"·"혼돈의 칠흑 장신구 상자"처럼 개봉 결과가 확률로 정해지는 아이템은 기록 시 실제로 나온 결과(레벨·반지 종류, 장신구 종류)를 후보 목록에서 선택해 함께 저장(확률 자동 추정 금지). 후보는 `boss-ring-boxes.json`·`accessory-boxes.json`.
- 획득 기록은 아이템별 고정 시세로 환산해 [보스 수익](./boss-profit.md) 합계에 포함([[ADR-010]]).

## 드롭 입력 시트 ([[ADR-038]], [[ADR-040]])
보스 수익 주간 화면 보스 행 탭 → 바텀시트 드롭 피커. **이번엔 기록만**(시세 반영이 최종 목표이나 갱신 소스 미정·크롤링 유력 — 레코드는 재평가 가능 구조로 저장하고 가격은 별도 소스 분리). 신규 `boss_drop_records` 테이블(어댑터 미러 + `latestSyncSnapshot` 이중 갱신).
- **난이도 무관 통합 표시**([[ADR-040]] 결정 1): `getBossDropCandidates(boss)` 가 전 난이도 장비·소비를 name+slot 으로 dedupe·`difficulties` 부착. 각 타일에 등장 난이도를 약자 컬러 칩(`DifficultyChip`) 표기.
- **고정 드롭**([[ADR-040]] 결정 3): 값이 난이도마다 달라 선택 기능 제거, `getBossFixedDrops(boss)` 로 난이도별 그룹 읽기 전용 표시.
- **카테고리 헤더 아이콘**([[ADR-040]] 결정 4): lucide — 장비 `Sword`, 소비 `FlaskConical`, 고정 `Pin`.
- **랜덤 상자 드릴다운**: 반지 상자·칠흑 장신구 상자는 시트 내 드릴다운으로 개봉 결과 직접 선택 기록. 반지 상자 결과([[ADR-041]]): 백옥 기준 목록·저가치 반지 '기타' 묶음·반지→레벨 선택 순서·연마석 레벨 없음.
- **고가 연출 on/off 토글**([[ADR-040]] 결정 6): 시트 헤더에 전역 토글(`storage/drop-effect`·`features/drop-effect`, 기본 표시). 고가 아이템 드롭 시 전체화면 연출(ScreenEff/DropEff 프레임 시퀀스, 검은배경 JPEG+black-crush+`mix-blend:screen` 으로 29MB→~2MB, 원본 PNG 미커밋·최적화본만 커밋). 고가 리스트 `valuable-drops.json`([[ADR-038]] 1차 + [[ADR-040]] 익셉셔널 해머 추가). 보스 수익 목록의 고가 강조는 [boss-profit.md](./boss-profit.md) [[ADR-045]].
- **DropEff 프레임 정렬**([[ADR-048]]): 프레임 비트맵 크기가 제각각(가로 38~285px)이라 하단-중앙 앵커로는 기둥 축이 최대 26px 흔들린다. 최적화 과정에서 유실된 WZ `origin`을 템플릿 정합으로 복원해 `lib/drop-effect-layout.ts` 테이블(39프레임 `[x, y]`)로 두고, `DropEffectOverlay`가 그 점을 화면 앵커에 맞춘다(`transformOrigin:'0 0'` + `translate(-x·S,-y·S) scale(S)`, `src`와 `transform` 동시 갱신). y는 전부 비트맵 하단(= 지면선) 고정.
- **ScreenEff 배율 고정**([[ADR-048]] 결정 5): ScreenEff 크롭은 이미 버스트 원점 기준 중앙 정렬이라 origin 테이블이 필요 없다. 문제는 `object-fit:cover` 가 프레임마다 자기 크기로 배율을 따로 잡아 버스트가 들썩이는 것(390x844 기준 1.232~2.198, 프레임 0→1 에서 42% 점프). 기준 프레임(1146x685)이 화면을 덮는 배율 하나를 전 프레임에 적용한다 — `left-1/2 top-1/2` + `translate(-50%,-50%) scale(S)`, `max-w-none`(preflight 해제).
- **프레임 픽셀·좌표 동시 교체**([[ADR-048]] 결정 6): `img.src` 교체는 비동기라(39프레임 전부 대입 직후 `complete=false`) 좌표만 먼저 옮기면 이전 프레임이 새 origin 으로 그려져 산발적으로 한 프레임 튄다. 마운트 시 DropEff 프레임을 미리 디코드해 두고(ref 로 보유), 그래도 준비 전이면 `applyDropFrame` 이 좌표를 유지한 채 반환한다(매 tick 재호출로 자동 복구). 표시 여부도 같은 함수가 관리.

### 바텀시트 = vaul(Drawer) ([[ADR-039]])
자체 `createPortal` 바텀시트를 vaul 라이브러리로 교체(자체구현은 데스크톱 마우스 드래그 닫기 불가·스냅 복귀·fling 없음). 공개 API(`onClose`/`children`/`testId`)·시각 스킨(오버레이 `bg-scrim`·`rounded-t-[20px]`·`z-[60]`·그랩 핸들·`max-h-[82vh]`·safe-area 패딩) 유지해 `BossDropSheet` 무변경. 부모 조건부 마운트는 내부 `open` 상태 + `onAnimationEnd`(닫힘 후 `onClose`). 포커스 트랩·Esc·`aria` vaul 내장. jsdom 폴리필(pointer capture·`scrollIntoView`·`matchMedia`·`ResizeObserver`) `setupFiles` 추가. 네이티브 변경 없어 OTA 배포 가능.

## 열린 질문
- 월간 보스(검은마법사)를 이 목록에 포함할지.
- 이미지 파일 포맷·권장 해상도.
- 같은 아이템이 난이도별 수량만 다를 때(예 "주문의 흔적" 160개 vs 240개) 합쳐 보여줄 때 수량 표시 방식.
- 물욕템 개별 시세 전무([[ADR-010]]) — 개봉 결과 개별 반지/장신구 거래 가능 여부.

## 폐기된 정책 (history)
- ~~보스 목록을 독립 목록으로 관리~~ → 보스 스케줄러 동기화 캐시로 통일([[ADR-011]]).
- ~~ARCHITECTURE 의 "이 기능은 Nexon API 무관" 서술~~ → 보스 목록이 동기화 캐시 구독이라 정정([[ADR-011]]).
- ~~자체 `createPortal` 바텀시트~~ → vaul(Drawer)로 교체([[ADR-039]]).
- ~~드롭을 난이도별로 나눠 표시 + 고정 드롭 선택 기능~~ → 난이도 무관 통합 표시, 고정 드롭 읽기 전용([[ADR-040]], [[ADR-038]] 최초 설계 반전).
