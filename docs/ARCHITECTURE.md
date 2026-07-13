# 아키텍처

> 이 문서는 `docs/ADR.md`를 전제로 작성되었습니다. Capacitor / Vite+React / 로컬 저장 전용 / 백그라운드 상시 알림 모두 확정. 일간/주간 진행 상태는 Nexon Open API로 동기화하되, 사용자 개인이 발급받은 API 키를 기기에 저장해 직접 호출하는 방식이라 백엔드는 필요 없음([[ADR-007]] 신규 — 2026-07-09). 에러 핸들링·복원력 정책은 [[ADR-008]] 참고. 직업 기반 테마 시스템은 뼈대만 확정([[ADR-009]], 컬러 값 미정). 최상위 화면 구조는 "일간/주간 스케줄러"(리셋 주기 기준)에서 "컨텐츠/보스 스케줄러"(콘텐츠 종류 기준)로 개편됨([[ADR-013]], 2026-07-11). 보스 수익 계산기는 완료 감지 시 파티원 수를 자동 기록하고 캐릭터별 드롭다운 레이아웃을 쓰도록 확장됨([[ADR-014]], 2026-07-11). "캐릭터 관리" 피커는 레벨순 정렬 + 캐릭터 이미지 카드형 그리드로 개선되고 `character/basic` API 병렬 조회가 추가됨([[ADR-015]], 2026-07-12). 보스 스케줄러·컨텐츠 스케줄러의 탭 토글은 활성 상태에 배지와 동일한 pill 스타일을 재사용하고, 보스 목록은 개별 카드 나열(두상이 보이는 일러스트 bleed + 보스별 크롭 설정)로 개편됨([[ADR-018]], 2026-07-13, 설계만·구현 전). 보스 스케줄러에 캐릭터+보스+난이도 단위 상시 "파티 관리" 설정(신규 SQLite 테이블 `boss_party_settings`)이 추가되어 보스 카드에 솔로/파티 배지·주간/월간 탭 아래 솔로/파티 서브 필터가 생기고, 보스 수익 계산기의 완료 감지 시 파티원 수 기본값도 이 설정으로 통일됨([[ADR-019]], 2026-07-13, 설계만·구현 전). 별도 공개 웹 서비스 제공은 보류(MVP 범위 밖)이며, 이 문서는 Capacitor 앱(WebView) 기준으로만 작성되었습니다.

## 디렉토리 구조
```
src/
├── app/                    # 라우트별 화면 (React Router)
│   ├── onboarding/          # API 키 입력 + 계정(메이플 ID) 선택 화면
│   ├── content-scheduler/  # 컨텐츠 스케줄러 화면 — 일간 탭(daily_contents) + 주간 탭(weekly_contents), 월간 탭 없음 ([[ADR-013]])
│   ├── boss-scheduler/     # 보스 스케줄러 화면 — 주간 탭(cycle: bossWeekly) + 월간 탭(cycle: bossMonthly), 일간 탭 없음([[ADR-007]] bossDaily 무시 정책 유지, [[ADR-013]]). 각 탭 아래 전체/솔로/파티 서브 필터([[ADR-019]], 설계만·구현 전)
│   ├── hunting-timer/      # 사냥 타이머 화면
│   ├── boss-profit/        # 주간 보스 수익 계산기 화면
│   ├── item-drop/          # 물욕 아이템 드랍 현황 화면
│   └── settings/            # API 키 재입력, 계정(메이플 ID) 변경, 연결 해제, 테마 선택(레테/렌). 크래시 리포팅 토글·알림 권한 재요청 안내·미예약 알림 개수 표시는 후속 task
├── features/                # 기능별 도메인 로직 (UI 상태 + 비즈니스 로직)
│   ├── onboarding/           # API 키 입력 → 계정 목록 조회 → 계정 선택 흐름
│   ├── content-scheduler/    # 일간 콘텐츠 + 주간 콘텐츠 상태 ([[ADR-013]], 기존 daily-scheduler/weekly-scheduler 통합)
│   ├── boss-scheduler/       # 주간 보스 + 월간 보스 상태, cycle별 분리 ([[ADR-013]]). 캐릭터+보스+난이도 단위 파티 인원 설정("파티 관리", `boss_party_settings`)과 솔로/파티 필터 상태도 이 feature가 소유([[ADR-019]], 설계만·구현 전)
│   ├── hunting-timer/
│   ├── boss-profit/
│   ├── item-drop/
│   ├── settings/              # API 키·계정(메이플 ID) 변경, 연결 해제 (2026-07-12 정리 — 그동안 app/settings만 언급되고 이 폴더는 누락돼 있었음)
│   └── theme/                 # 선택된 테마(레테/렌) 상태, storage/theme.ts로 영속화 ([[ADR-009]] 재개, 2026-07-12)
├── data/                    # 게임 레퍼런스 데이터 (보스 목록, 결정 가격표, 드랍 테이블, 보스 반지 상자 확률표) — 버전 명시. job-themes.json(테마별 13토큰 컬러, [[ADR-009]])은 "레테"·"렌" 값 확정 — 설정 화면 task에서 파일로 반영(재개, 2026-07-12)
├── nexon/                   # Nexon Open API 클라이언트 ([[ADR-007]]) — 사용자 개인 API 키로 직접 호출, 서버 없음
│   ├── character/            # GET /maplestory/v1/character/list로 계정 소속 캐릭터 목록 자동 조회(수동 등록 폼 없음). GET /maplestory/v1/character/basic(ocid별, [[ADR-015]])로 "캐릭터 관리" 피커의 캐릭터 이미지(`character_image`)·`access_flag`를 병렬 조회
│   └── schedule/             # 스케줄러 Open API 호출 + src/data/ 참조 테이블과의 매핑(난이도 영↔한글, 보스명 정규화, cycle 기반 bossDaily 필터링)
├── storage/                 # 로컬 저장소 접근 레이어 (SQLite/Preferences 어댑터, Nexon API 키·동기화 캐시 포함). 신규 `boss-party-settings.ts`가 `boss-profit.ts`와 동일 SQLite DB(`boss_profit`)에 `boss_party_settings` 테이블 추가 예정 — 캐릭터+보스+난이도 단위 상시 파티 인원 설정, `boss_profit_records`(주차별 완료 기록)와 별도([[ADR-019]], 설계만·구현 전)
├── native/                  # Capacitor 플러그인 래퍼 + 커스텀 네이티브 플러그인 JS 인터페이스
│   ├── hunting-timer/       # 상시 알림(Android Chronometer / iOS Live Activity) 커스텀 플러그인 래퍼
│   └── notification-sync/   # 알림 발송 직전 백그라운드에서 Nexon API 재확인 후 조건부 발송 (WorkManager / BGAppRefreshTask, [[ADR-004]])
├── components/              # 공용 UI 컴포넌트
│   ├── BossPortrait/         # 보스 초상화 표시 공용 컴포넌트([[ADR-011]]) — feature 2(주간 스케줄러)·4(보스 수익 계산기)·5(물욕 아이템)가 보스를 나타낼 때 공통으로 씀. lib/boss-icons로 이미지 조회, 없으면 플레이스홀더. 원형 `object-cover` 렌더링 그대로 유지([[ADR-018]]) — 보스 스케줄러의 새 보스 카드(개별 bleed 일러스트)는 이 컴포넌트를 쓰지 않고 `app/boss-scheduler/BossScreen.tsx` 안에 로컬 컴포넌트로 구현(기존 BossList/StatusDot과 동일한 위치)
│   ├── CharacterTrackingPicker/  # "캐릭터 관리" 피커([[ADR-012]]) — 레벨 내림차순 정렬 + 캐릭터 이미지 카드형 그리드([[ADR-015]]). 컨텐츠/보스 스케줄러 화면이 동일 컴포넌트 공유
│   └── Modal/                 # 오버레이 모달 공용 래퍼(2026-07-13) — CharacterTrackingPicker/DisconnectConfirm에 있던 오버레이 마크업을 공용화. `card` prop으로 카드 스타일 유무 전환(설정 화면의 ApiKeyModal/AccountModal이 card=false로 자체 카드형 컴포넌트를 그대로 담을 때 사용, `docs/UI_GUIDE.md` "설정 리스트 행 + 모달" 참고)
├── assets/
│   ├── items/                # 물욕템 아이콘 이미지([[ADR-011]]) — 사용자가 직접 추가한 기존 파일 그대로 사용(영문 내부 코드명 스타일, 예: dark_boss_ring.png). src/data/item-icons.json이 한글 아이템명↔파일명 매핑 테이블
│   │   └── rings/             # 특수 스킬 반지 전용 서브폴더([[ADR-011]]) — GMS 영문명으로 파일명 정리 완료(예: Ring_of_Restraint.png). boss-ring-boxes.json의 iconFile 필드가 매핑 테이블
│   └── bosses/                # 보스 초상화 이미지([[ADR-011]], 파일명 컨벤션 정정 [[ADR-018]] 2026-07-13). 사용자가 직접 추가한 파일(예: kaling.webp = {portraitSlug}.webp) — 난이도별 파일이던 것을 보스당 1장(webp)으로 통합. weekly-bosses.json의 portraitSlug 필드가 매핑 테이블
├── lib/                     # 범용 유틸리티 (일간/주간 리셋 시각 계산, 포맷터 등)
│   ├── reset-clock          # 일간 00:00 KST / 주간 목요일 00:00 KST 계산 — 기기 타임존과 무관하게 항상 KST 기준으로 환산(해외 로밍/타임존 변경 기기 대응, 엣지 케이스 참고)
│   ├── item-icons           # 아이템명으로 src/data/item-icons.json(일반 아이템) 또는 boss-ring-boxes.json의 iconFile(반지, "링"으로 끝나는 이름은 items/rings/ 하위)을 조회([[ADR-011]]). 매핑 없는 항목은 플레이스홀더로 폴백 — 파일 경로를 계산하지 않고 매핑 테이블에서 조회하는 방식으로 변경됨(2026-07-11 정정)
│   ├── boss-icons            # weekly-bosses.json의 portraitSlug로 assets/bosses/{portraitSlug}.webp를 조회(난이도 무관 — 정정 [[ADR-018]] 2026-07-13, `getBossPortraitUrl(portraitSlug)`에서 difficulty 파라미터 제거). portraitSlug 없으면 플레이스홀더로 폴백. `getBossPortraitCrop(portraitSlug)` 추가([[ADR-018]]) — data/boss-portrait-crops.json에서 `{ size, position }`(CSS background-size/position 값)을 조회, 매핑 없으면 `{ size: 'cover', position: 'center' }`로 폴백. 새 보스 카드 전용이며 위 BossPortrait 원형 렌더링에는 쓰이지 않음
│   └── error-reporting       # 설정에서 opt-in 시에만 Sentry(또는 유사 서비스)로 익명 에러 전송, 개인 식별 정보 제외 ([[ADR-008]])
└── types/                   # TypeScript 타입 정의
```

## 패턴
Feature 단위 구조. 각 `features/*` 폴더가 해당 기능의 상태와 로직을 소유하고, `storage/`·`native/`·`nexon/`은 외부 의존성(로컬 저장소, 네이티브 API, Nexon Open API)을 격리하는 공용 어댑터 레이어로 둔다. 이렇게 분리해두면 (1) feature 코드가 Capacitor API나 Nexon API 응답 형식을 직접 알 필요가 없어 테스트가 쉬워지고, (2) 추후 [[ADR-003]]이 바뀌거나 Nexon API 스펙이 바뀌더라도 해당 어댑터 내부 구현만 교체하면 된다. `content-scheduler`·`boss-scheduler`는 로컬에 쓰기 위한 상태를 직접 소유하지 않고 `nexon/schedule`이 반환하는 동기화 캐시를 읽기 전용으로 구독한다(기존 `daily-scheduler`/`weekly-scheduler`를 [[ADR-013]]으로 통합·재편, 2026-07-11). `boss-scheduler`는 캐시의 `bossContents`를 `cycle`(weekly/monthly)로 분리해 화면 내 주간/월간 탭 각각에 전달한다.

`hunting-timer`는 온전히 `storage/`에 직접 쓰는 독립 feature다. `boss-profit`·`item-drop`은 혼합 패턴이다 — **보스 목록**은 `content-scheduler`·`boss-scheduler`와 동일하게 `nexon/schedule`의 동기화 캐시를 읽기 전용으로 구독하고([[ADR-007]], [[ADR-011]]), **그 위에 사용자가 남기는 기록**(파티원 수, 아이템 획득·컨테이너 결과, 수익 계산 결과)은 `storage/`에 직접 쓴다. 즉 "무엇을 기록할 수 있는지"는 Nexon API 동기화 데이터가 결정하고, "실제로 기록한 값"은 완전히 로컬 소유다.

## 데이터 흐름
```
[온보딩 — 최초 1회, [[ADR-007]]]
설정 화면에서 사용자가 openapi.nexon.com에서 발급받은 개인 API 키 입력(안내는 링크 + 샘플 이미지 + 설명 문구, 앱 내 단계별 위저드 아님 — 확정)
  → storage/의 보안 영역(Keychain/Keystore 또는 암호화된 Preferences)에 저장
  → nexon/character가 GET /maplestory/v1/character/list 호출
  → 응답의 account_list가 2개 이상이면 "어느 메이플 ID를 쓸지" 선택 화면 표시(features/onboarding). 각 계정은 character_list 중 최고 레벨 캐릭터의 닉네임+직업+레벨로 표기(예: "낟낟 · 렌 Lv.293") — account_id 해시는 노출 안 함
  → storage/에는 apiKey와 선택된 accountId만 저장한다. **정정(2026-07-11)**: ~~선택된 계정의 character_list를 storage/에 캐싱~~ — 캐릭터명·직업·레벨이 언제든 바뀔 수 있어(개명, 전직, 레벨업) 캐싱하지 않기로 변경. 캐릭터 목록이 필요한 화면(컨텐츠/보스 스케줄러 등)은 그때마다 nexon/character를 다시 호출해 조회한다. **재정정(2026-07-12, [[ADR-016]])**: 위 "캐싱하지 않음"은 여전히 유효하다(매번 재검증) — 다만 캐릭터별 `character/basic`·스케줄 응답 자체는 [[ADR-016]]의 캐시(즉시 표시용, 항상 재검증)에 저장하고, 계정이 확정되는 즉시 전체 캐릭터에 대해 진행률 표시와 함께 예열한다(아래 참고).
  → 이후 설정 화면에서 계정을 다시 선택(변경)할 수 있음(확정)
  → **[[ADR-016]] 신규(2026-07-12) — 온보딩 완료 직전 전체 캐릭터 데이터 예열**: 계정이 확정되면(단일 계정 자동 확정 또는 다중 계정 중 선택) `OnboardingStatus`에 추가된 `'prefetching'` 상태로 전환해 진행률 바를 표시한다. 이 계정의 전체 캐릭터(추적 대상 여부 무관) 각각에 대해 `character/basic` → (`access_flag: true`인 경우만) `scheduler/character-state` 순서의 독립 파이프라인을 병렬로 실행하고, 하나가 끝날 때마다(`Promise.all`로 뭉쳐 기다리지 않고) 그 즉시 `storage/character-basic-cache`·`storage/scheduler-cache`에 기록하며 진행률을 갱신한다. 개별 캐릭터 실패는 그 캐릭터만 캐시 없이 넘어가고 전체를 막지 않는다. 전체가 끝나야 `'completed'`로 전환된다.

이후 동기화 (앱 실행/포그라운드 복귀/새로고침 버튼):
  → **([[ADR-016]] 신규, 2026-07-12) 캐시 우선 표시**: `features/content-scheduler`·`features/boss-scheduler`의 `refresh()`는 실제 API 재호출 *전에* 각 ocid의 `storage/scheduler-cache` 값이 있으면 그걸로 먼저 `characters`를 채워 화면에 그린다(`status: 'loading'`이어도 이미 있는 `characters`는 계속 보여준다 — 로딩 중엔 목록 자체를 안 그리던 기존 동작에서 정정). 그 다음은 아래와 동일하게 항상 재검증한다.
  → nexon/schedule이 저장된 API 키 + 캐릭터별 ocid로 GET /maplestory/v1/scheduler/character-state 호출. **정정(2026-07-11, [[ADR-012]])**: ~~계정의 전체 캐릭터를 대상으로 호출~~ — 화면에서 사용자가 "캐릭터 관리"로 고른 추적 대상 캐릭터에 대해서만 호출한다(계정에 캐릭터가 많으면 전체 순차 호출이 느려지므로). 캐릭터 후보 목록 자체("캐릭터 관리" 피커용)는 `nexon/character`의 `GET /maplestory/v1/character/list` 호출로 별도 조회하고 스케줄 동기화와는 분리한다. **정정(2026-07-12, [[ADR-015]])**: ~~이름만 필요~~ — 피커가 이미지 카드형으로 바뀌면서 `character/list`로 얻은 ocid 전체에 대해 `GET /maplestory/v1/character/basic`을 병렬 호출해 이미지(`character_image`)·`access_flag`까지 함께 조회한다. `access_flag: "false"`인 캐릭터는 후보 목록에서 제외하고, 나머지는 레벨 내림차순으로 정렬해 보여준다. **([[ADR-017]] 결정 6, 2026-07-12)**: `character/list`는 캐싱하지 않으므로 피커를 열 때마다 이 네트워크 응답을 기다려야 하는데, 그동안은 `storage/character-basic-cache.ts`의 인덱스(`getAllCachedCharacterBasicOcids`, 지금까지 `character/basic`으로 캐싱된 적 있는 전체 ocid 목록 — 추적 여부 무관)로 즉시 stub 후보 목록을 먼저 그린다 — `character/list` 응답이 오면 계정 전체 후보 목록으로 그대로 교체된다. **정정(2026-07-11, [[ADR-013]])**: ~~추적 목록이 일간/주간 화면별로 독립(`trackedCharacters:daily`/`trackedCharacters:weekly`)~~ — 화면이 컨텐츠/보스로 재편되며 추적 목록도 `trackedCharacters:content`/`trackedCharacters:boss`로 바뀐다. 앱이 새 키를 처음 쓰는 시점에 기존 `daily` 값은 `content`로, 기존 `weekly` 값은 `content`·`boss` 양쪽으로 1회 복사하는 마이그레이션을 거친다([[ADR-013]] 참고)
  → 실패 시([[ADR-008]]) 에러 유형별로 분기하고 마지막 캐시를 그대로 표시, 여기서 흐름 중단
  → 응답의 daily_contents/weekly_contents/boss_contents를 파싱(필드 단위 방어적 파싱, [[ADR-008]])
  → boss_contents 중 cycle이 bossWeekly/bossMonthly인 것만 사용(bossDaily는 무시, [[ADR-013]]에서도 이 정책 재확인 — 보스 스케줄러에 일간 탭을 두지 않음)
  → src/data/ 참조 테이블로 보스명·난이도 표기 정규화(영↔한글, 양쪽 공백 제거 후 비교, apiAlias 예외 매핑). 매핑 안 되는 항목은 원문 그대로 "알 수 없는 콘텐츠"로 표시. **정정(2026-07-11)**: ~~이 정규화를 nexon/이 전부 수행~~ — 난이도 영↔한글 변환은 `nexon/normalize.ts`가 담당하지만, 보스명 매칭(양쪽 공백 제거 비교, apiAlias 예외)은 `nexon/`이 아니라 `lib/boss-matching`이 담당하고 그 결과를 `features/boss-scheduler`가 소비한다(**정정(2026-07-11, [[ADR-013]])**: ~~features/weekly-scheduler가 소비~~) — `nexon/`이 `src/data/`를 몰라야 독립적으로 테스트 가능하다는 레이어 분리 원칙 유지
  → storage/에 "마지막 동기화 결과 캐시" + 동기화 시각으로 저장
  → boss_contents에서 새로 complete_flag: true로 바뀐 보스가 있어도 features/boss-profit에 별도 안내(배지 등)를 표시하지 않는다(확정, 2026-07-09, 자동 유도 UI 없음 — 이 부분은 [[ADR-014]] 이후에도 유지). **정정(2026-07-11, [[ADR-014]])**: ~~사용자가 화면에 직접 들어와 파티원 수를 입력한다~~ → 화면에 들어오지 않아도 수익 기록 자체는 자동 생성된다(아래 "보스 수익 계산기" 흐름 참고), 사용자는 값을 확인/수정하고 싶을 때만 화면에 들어온다
  → features/content-scheduler(일간 탭: dailyContents, 주간 탭: weeklyContents), features/boss-scheduler(주간 탭: cycle=weekly인 bossContents, 월간 탭: cycle=monthly인 bossContents)가 캐시를 읽어 읽기 전용으로 표시(완전 읽기 전용, 앱 내 수동 체크 없음 — 확정, [[ADR-007]]. 화면 재편은 [[ADR-013]], 2026-07-11 — 기존 features/daily-scheduler·features/weekly-scheduler를 대체)
  → **`CharacterSelectDropdown` 캐릭터 순서·초기 선택 (신규, 2026-07-12, [[ADR-017]])**: 드롭다운 순서는 `storage/character-basic-cache`의 `level`을 병합해 `CharacterTrackingPicker`([[ADR-015]])와 동일하게 레벨 내림차순(동레벨이면 `compareByName`)으로 정렬한다 — 캐시 단계(`trackedOcids` 저장 순서)와 동기화 단계(`syncSchedules`가 계정 전체 캐릭터 목록에서 필터링한 순서, line 64 참고)가 서로 달라 생기던 순서 불일치를 없앤다. 이와 별개로 컨텐츠/보스 스케줄러 둘 다 신규 키 `lastSelectedCharacter:content`/`lastSelectedCharacter:boss`(Preferences)에 사용자가 마지막으로 고른 ocid를 저장해두고, 화면 진입 시 `characters[0]` 폴백보다 이 값을 우선한다 — 정렬 통일만으로는 레벨 캐시가 아직 없는 캐릭터가 섞였을 때 순서가 잠깐 어긋날 수 있어, 두 단계 사이에서 보이는 캐릭터가 바뀌는 것처럼 보이던 버그를 직접적으로 막는 장치다. 실제로 보고된 증상은 보스 스케줄러뿐이지만 컨텐츠 스케줄러도 동일한 코드 패턴이라 같은 버그가 아직 드러나지 않았을 뿐일 수 있어, 증상 재현을 기다리지 않고 두 화면 모두에 선제 적용한다
  → features/item-drop은 같은 캐시에서 "등록된(`registration_flag: true`) 주간 보스 목록"만 읽기 전용으로 구독한다([[ADR-011]]). **정정(2026-07-11)**: ~~features/boss-profit도 동일하게 "등록된 주간 보스 목록"을 구독~~ — features/boss-profit은 등록 여부가 아니라 **처치된(`complete_flag: true`) 보스만** 구독·표시하고, 수익 계산도 처치된 보스만을 대상으로 한다(등록만 하고 아직 안 잡은 보스는 수익 계산기에 나타나지 않음 — `docs/PRD.md` "4. 주간 보스 수익 계산기" 참고, 사용자 확정). 두 feature 모두 이 목록 자체는 편집 불가하고, 사용자가 남기는 기록(파티원 수·아이템 획득)만 별도로 storage/에 쓴다

[알림 발송 판단 — 실시간 재확인, [[ADR-004]] 확정 2026-07-09]
알림 예정 시각 도달
  → 백그라운드 트리거(Android WorkManager / iOS BGAppRefreshTask 또는 BGProcessingTask)
  → nexon/schedule로 Nexon API 실시간 재호출(예약 시점에 예약만 해두고 무조건 발송하는 게 아니라, 발송 직전 조건을 다시 확인)
  → 성공 시 최신 상태 기준으로 미완료 여부 판단, storage/ 캐시도 갱신
  → 재호출 실패(오프라인·429 등, [[ADR-008]])면 마지막 캐시 기준으로 폴백
  → 미완료 항목이 있으면 로컬 알림 표시. 64개 한도 초과 시 우선순위 정책 적용([[ADR-004]])
  → (iOS 플랫폼 제약) BGAppRefreshTask/BGProcessingTask는 OS가 정확한 실행 시각을 보장하지 않음 — 사용자가 지정한 알림 시각과 실제 재확인 시각 사이에 오차가 있을 수 있음(베스트 에포트, 알려진 한계)

[파티 관리 — 보스 스케줄러 화면 상단 "파티 관리" 버튼에서 설정(정정, 2026-07-13 — 카드 탭에서 변경), 완료 여부·주차와 무관한 상시 데이터. [[ADR-019]]]
"파티 관리" 버튼 탭(캐릭터 관리 버튼 옆)
  → 모달(`PartyManagementModal`) — 보스 드롭다운(캐릭터의 스케줄러 등록 여부와 무관한 전체 보스 목록, `weekly-bosses.json`의 weekly+eventWeekly+monthly, 정정 2026-07-13) → 난이도 뱃지 선택(보스 카드와 동일한 DifficultyBadge 재사용, 선택지는 `boss-crystal-prices.json`에서 해당 보스명으로 조회, 선택 표시는 정정 2026-07-13으로 테두리 없이 투명도 차이만) → 파티원 수 -/+ 스테퍼(1인~해당 (보스,난이도) `maxPartySize`, 새 게임 데이터 아님 — 기존 `boss-crystal-prices.json`의 검증 범위 그대로 재사용, [[ADR-006]], 경계에서 버튼 비활성화로 범위 밖 값 입력 자체를 차단) → "저장" 클릭 시 저장
  → storage/에 (ocid, boss, difficulty) 유니크 키로 `boss_party_settings` upsert(1로 저장하면 솔로 취급과 동일 — 별도 삭제 API 없이 1로 덮어써서 표현)
  → features/boss-scheduler가 이 값을 읽어 해당 보스 카드에 파티 배지("n인")를 즉시 반영. 설정이 없는 보스는 솔로로 표시(폴백 없이 바로 1 취급)
  → 같은 화면의 전체/솔로/파티 서브 필터는 이 값(설정 없음=솔로 포함)으로 현재 탭(주간/월간)의 보스 목록을 클라이언트 사이드에서 필터링한다 — 별도 API 재호출 없음

[보스 수익 계산기 / 물욕 아이템 드랍 — 보스 목록은 Nexon 동기화 캐시 구독, 기록 자체는 로컬 전용. [[ADR-010]]·[[ADR-011]]으로 확장]
보스 수익 계산기 진입
  → features/boss-profit이 위 동기화 캐시에서 **처치된(`complete_flag: true`) 보스**만 cycle 무관(weekly+monthly 모두 — 검은마법사 포함)하게 구독해 **보스 목록**으로 표시(등록 여부는 무관, line 69 참고). **정정(2026-07-12, [[ADR-017]])**: 구독 자체는 cycle 무관을 유지하되(월간 보스 기록은 계속 자동 생성·누적), 이 화면의 **표시**는 당분간 주간(cycle: weekly)으로 한정한다 — 월간 노출 방법(탭 등)은 미정
  → **캐시 우선 표시(2026-07-12, [[ADR-017]])**: [[ADR-016]]과 동일하게 `syncSchedules` 재검증 전 `getCachedSchedulerState`로 화면을 먼저 채운다(컨텐츠/보스 스케줄러에만 있던 캐시를 이 화면까지 확장)
  → 추적 대상 캐릭터는 boss-scheduler(핵심 기능 2)와 동일하게 `trackedCharacters:boss`를 재사용한다(이 화면 전용의 별도 캐릭터 추적 UI 없음, 확정 2026-07-11)
  → 보스별로 `boss-crystal-prices.json`에서 정가를 조회해 `partySizeScaling.formula`(`floor(priceMeso / partySize)`)로 수익 계산, `priceMeso`가 없는 보스(벨로나)는 "가격 미확정"으로 표시
  → **자동 기록 ([[ADR-014]], 2026-07-11 신규)**: 아직 로컬 기록이 없는 (ocid, boss, difficulty, periodKey) 조합을 만나면 즉시 `boss_profit_records`에 upsert한다 — 사용자가 화면에 들어오는 것과 무관하게 동기화 시점에 바로 반영됨. **정정(2026-07-13, [[ADR-019]])**: ~~기본 파티원 수는 `period_key` 조건 없이 가장 최근 `recorded_at` 레코드 1건을 조회해 그 `party_size`를 이어 쓰고(없으면 1)~~ → 이 조회는 폐기하고, 대신 `storage/boss-party-settings`에서 같은 (ocid, boss, difficulty)의 `boss_party_settings`을 조회해 있으면 그 `party_size`, 없으면 1을 기본값으로 쓴다(위 "[파티 관리]" 블록 참고 — 보스 카드의 배지·필터와 항상 같은 소스를 보게 하기 위함)
  → **화면 레이아웃 ([[ADR-014]])**: features/boss-profit은 캐릭터별로 그룹핑한 뒤 각 그룹의 "이번 주"(cycle: weekly) 합계를 계산해 드롭다운 헤더에 노출하고, 전체 캐릭터의 "이번 주" 합계를 화면 최상단에 별도로 표시한다. ~~월간 보스(검은마법사) 합계는 상단 총합에 포함하지 않고 각 캐릭터 드롭다운 내부에서 "이번 달" 구분으로만 표시~~ → **정정(2026-07-12, [[ADR-017]])**: 아코디언을 펼쳤을 때 헤더의 합계와 그 안 섹션 타이틀("이번 주 합계 N 메소")이 같은 숫자를 중복 표시하고 있어 섹션 타이틀의 합계 문구는 제거(합계는 헤더에만 유지), 월간 보스 "이번 달" 구분 표시는 이 화면에서 당분간 제거

물욕 아이템 드랍 진입
  → features/item-drop이 위 동기화 캐시에서 `cycle: bossWeekly` + `registration_flag: true`인 보스만 이름 기준으로 중복 제거해 **보스 목록**으로 표시(난이도 표기 없음, [[ADR-011]])
  → 보스 선택 시 `item-drop-table.json`에서 그 보스 이름과 일치하는 모든 난이도 엔트리를 합쳐 아이템 후보를 구성(이름 기준 중복 제거, 난이도 무관)
  → 각 아이템 버튼은 `lib/item-icons`로 `assets/items/` 이미지 경로를 조회해 표시(없으면 플레이스홀더)

사용자 입력 (파티원 수 입력 / 아이템 획득 버튼 클릭 — 컨테이너형 아이템(보스 반지 상자·장신구 상자)이면 `boss-ring-boxes.json`/`accessory-boxes.json` 후보 목록에서 실제로 나온 결과를 추가로 선택)
  → features/* 컴포넌트 (React state 갱신)
  → storage/ 레이어 (로컬 DB 읽기·쓰기 — 컨테이너 아이템은 선택된 결과까지 함께 저장)
  → 보스 수익 계산기는 결정 판매 수익 + 물욕템 환산 가치(`priceMeso` 확정된 항목만 합산, 미확정 항목은 "가격 미확정"으로 별도 표시)를 이번 주/월간 탭으로 표시
  → **확정(2026-07-11) — 1차 구현 범위**: 물욕템 환산 가치 합산·"이번 주 / 월간 추이" 탭·히스토리 차트는 물욕 아이템 드랍(핵심 기능 5) 구현 이후 후속 작업으로 미룬다. 1차 구현은 결정 판매 수익 계산 + "이번 주" 표시까지만 다룬다
  → UI 반영

[사냥 타이머]
타이머 시작
  → features/hunting-timer가 사용자 지정 주기(N분)를 native/hunting-timer 레이어에 전달
  → (Android) 커스텀 플러그인이 Foreground Service 시작 + Chronometer 알림 표시 + 주기 사운드 재생
  → (iOS) 커스텀 플러그인이 Live Activity 시작(경과 시간 표시) + 주기 사운드는 로컬 알림/오디오 세션으로 트리거
  → 타이머 정지 시 상시 알림/Live Activity 종료 및 예약 해제 ( [[ADR-005]] )

[설정 화면 — 여러 화면 설명에 흩어져 있던 요구사항을 통합 정리, 2026-07-12. 진입 경로는 하단 탭바 4번째 탭(확정, 2026-07-12)]
설정 화면 진입
  → API 키 재입력/변경: storage/의 보안 영역에 새 키를 덮어쓰고 nexon/character로 재검증([[ADR-007]], [[ADR-003]])
  → 계정(메이플 ID) 변경: API 키 재입력 없이, 저장된 키로 character/list를 다시 호출해 계정 선택 UI(`AccountSelectionList` 재사용)를 다시 보여주고, 선택된 accountId만 storage/에 갱신한다(확정, 2026-07-12). 캐릭터 관련 로컬 기록(보스 수익·드랍 히스토리)은 삭제하지 않음([[ADR-008]] 참조 무결성)
  → 연결 해제(로그아웃, 확정, 2026-07-12): `storage/api-key.ts`의 `clearAuthConfig()`와 `features/onboarding`의 `RESET` 이벤트를 그대로 재사용해 온보딩 화면으로 되돌아간다 — 별도 신규 로직 없이 기존 두 조각을 연결하는 수준
  → 테마 선택(재개, 2026-07-12, [[ADR-009]]): 레테/렌 중 선택하면 features/theme의 Zustand 스토어가 갱신되고 storage/theme.ts에 영속화, `:root[data-theme]` 오버라이드로 즉시 반영
  → 다음 항목은 이번 task 범위 밖(후속 task로 미룸, 2026-07-12): 크래시 리포팅 opt-in 토글([[ADR-008]], `lib/error-reporting` 미구현), 알림 권한 재요청 안내, 미예약 알림 개수 표시([[ADR-004]] 64개 한도 우선순위 정책 자체가 미구현)
```

## 상태 관리
- Nexon 스케줄러 데이터는 사용자 본인 계정에서 오는 원본 데이터이지만, 앱 입장에서는 "외부에서 동기화해오는 읽기 전용 데이터"라는 점에서 서버 상태와 비슷하게 다룬다 — 동기화 상태(로딩/성공/실패), 마지막 동기화 시각, 캐시된 응답을 `nexon/schedule`이 노출하고 `storage/`에 영속화한다.
- 앱 전역에서 공유해야 하는 클라이언트 상태(현재 선택된 캐릭터, 선택된 테마([[ADR-009]]), Nexon API 키 등록 여부, 타이머 진행 상태 등)는 Zustand로 관리한다(확정, 2026-07-09).
- 영속 데이터(Nexon API 키, 동기화 캐시, 보스 처치/수익 기록, 드랍 히스토리, 선택된 테마)는 `storage/`에 저장하고, 앱 시작 시 로드해 클라이언트 상태로 hydration.

## 테마 시스템 ([[ADR-009]])
직업 고유 컬러 기반 다중 테마 지원 예정. **정정(2026-07-12)**: Primary 하나만 파생 공식으로 확장하는 방식은 폐기, 테마마다 13개 시맨틱 토큰(`bg`/`surface`/`surface-2`/`border`/`border-strong`/`primary`/`primary-hover`/`primary-text`/`secondary`/`info-tint`/`error`/`text`/`text-muted`/`text-disabled`)을 값으로 직접 갖는다. 현재 "레테"(다크)·"렌"(라이트, 2026-07-12 재수정) 2개 테마의 실제 컬러 값이 확정됐다(값은 `docs/UI_GUIDE.md` "테마 시스템" 표 참고, `src/data/job-themes.json` 반영은 구현 단계에서 진행).

**구현 범위 축소(2026-07-12)**: 런타임 전환 기능은 당장 만들지 않는다 — "렌" 13토큰 값을 `src/index.css`의 `@theme` 블록에 정적으로 반영해 활성 팔레트를 레테→렌으로 교체하는 것까지만 이번 범위다. 아래는 전환 기능이 실제로 필요해질 때의 목표 설계다.

**재개(2026-07-12, 설정 화면 task 범위 포함)**: 위 "구현 범위 축소"로 미뤄뒀던 런타임 전환 인프라를 이번에 구현한다. Tailwind v4 `@theme` 블록이 기본(레테) 테마 값을 정의하고, `:root[data-theme="..."] { --color-*: ...; }`로 오버라이드. Tailwind v4 유틸리티(`bg-primary`, `text-text` 등)는 이미 `var(--color-*)`를 참조하므로 `features/*`·`components/` 코드 변경 없이 `data-theme` 속성 전환만으로 테마가 바뀐다. 선택된 테마는 위 "상태 관리"와 동일하게 Zustand(`src/features/theme/store.ts`) + `storage/theme.ts`(기존 `api-key.ts`와 같은 `Preferences` 기반 어댑터 패턴) 영속화로 관리하고, `AppShell`의 `restoreFromStorage` 흐름과 같은 위치에서 앱 시작 시 hydration한다. 설정 화면에서는 레테/렌 두 값 중 하나를 고르는 최소 범위 선택 UI만 제공한다(직업 기반 자동 매핑은 여전히 미정이라 범위 밖).

기존 `--color-gold`/`--color-gold-bright`/`--color-magenta`/`--color-neutral-warm` 토큰은 13토큰 스키마에 없어 폐기하고 사용처를 마이그레이션한다(`gold`→`secondary`, `magenta`→`error`, `neutral-warm`→`text-muted` 통합, `gold-bright`는 미사용 확인 후 폐기) — 상세는 [[ADR-009]] 2026-07-12 정정 참고. 이 마이그레이션은 정적 교체 범위에 포함되어 지금 진행한다.

테마 이름과 실제 직업(전직) 매핑, 테마 단위(대분류/세부 전직)는 여전히 미정.

## 네이티브 연동 ([[ADR-001]])
- `@capacitor/local-notifications`: 일간/주간 미완료 알림 예약 ([[ADR-004]])
- **커스텀 네이티브 플러그인** (Swift/Kotlin 직접 작성, 공식 Capacitor 플러그인으로 커버 안 됨): 사냥 타이머의 상시 알림(Android Foreground Service + Chronometer, iOS Live Activity) 및 주기 사운드 ([[ADR-005]])
- `@capacitor-community/sqlite` (또는 Preferences API): 로컬 데이터 저장, Nexon API 키 포함 ([[ADR-003]])
- 플랫폼별 백그라운드 정책 차이(특히 iOS Live Activity의 16.1+ 버전 제약)는 `native/` 레이어에서 흡수해, 상위 `features/*` 코드가 플랫폼 분기를 알 필요가 없도록 한다.

## Nexon Open API 연동 ([[ADR-007]])
- 공통 HTTP 클라이언트(`nexon/client` 정도로 통합): 실제 호출 도메인은 `https://open.api.nexon.com/`(문서 사이트 `openapi.nexon.com`과 다름). 모든 요청 헤더에 `x-nxopen-api-key: <저장된 개인 API 키>`를 포함. 호출 제한은 개발 단계 기준 초당 5건/일 1,000건 — 여러 캐릭터를 동기화할 때도 병렬이 아니라 초당 5건 이내로 순차 호출하도록 큐잉한다.
- **타임아웃**: 10초로 확정(2026-07-09). 공식 문서에 권장값이 없어 모바일 API 호출 관례상 채택.
- **호출량 한도**: 개발 단계 한도(초당 5건/일 1,000건)는 신경 쓰지 않는다(확정, 2026-07-09) — 이 앱은 사용자가 이미 다른 서비스로 승인받은 서비스 단계 API 키(초당 500건/일 2,000만 건)를 그대로 사용하므로, 개발 단계 호출량 상한 검증 자체가 불필요하다.
- `nexon/character`: `GET /maplestory/v1/character/list`를 호출해 캐릭터 목록을 가져온다(확정, 2026-07-09). 캐릭터명+월드를 수동 입력하는 "캐릭터 등록 폼"은 없다. 응답은 `{ account_list: [{ account_id, character_list: [{ ocid, character_name, world_name, character_class, character_level }] }] }` 형태 — **하나의 API 키가 여러 `account_id`(메이플 ID)를 반환할 수 있다**(사용자 실측 확인, 2026-07-09). `account_list.length > 1`이면 `features/onboarding`이 계정 선택 UI를 띄우고, 선택된 `account_id`의 `character_list`만 앱에 등록한다. `ocid`는 길이가 계정마다 다르므로(32~65자 관찰) 고정폭을 가정하지 않고 불투명 문자열로 다룬다.
- `nexon/schedule`: `GET /maplestory/v1/scheduler/character-state`를 ocid별로 호출해 응답을 파싱한다(엔드포인트 확정, 2026-07-09). `daily_contents`/`weekly_contents`/`boss_contents` 배열을 앱 도메인 모델로 변환한다.
  - `boss_contents`는 `cycle` 필드로 `bossDaily`/`bossWeekly`/`bossMonthly`를 구분한다(확정, 2026-07-09 실측). **`bossWeekly`·`bossMonthly`만 사용하고 `bossDaily`는 무시**한다 — 힐라(하드)·핑크빈(카오스) 등 일간으로 격하된 보스가 실제로 `bossDaily`로 온다는 게 실측으로 확인됨([[ADR-006]]과 일치).
  - 보스명·난이도 표기를 `src/data/`의 참조 테이블과 매핑할 때: 난이도는 영문 소문자 ↔ 한글로 변환하고, 보스명은 **양쪽 문자열에서 공백을 전부 제거한 뒤 비교**한다(공백이 API 쪽에 더 있을 때도, 우리 데이터 쪽에 더 있을 때도 있어서 한쪽으로 가정하면 안 됨 — 예: API `검은 마법사` vs 데이터 `검은마법사`, 반대로 API `블러디퀸` vs 데이터 `블러디 퀸`). 공백 제거로도 못 잡는 예외(예: API `시즌 보스 메이린` ↔ 데이터 `메이린`)는 `weekly-bosses.json`의 `apiAlias` 필드로 명시적으로 매핑한다.
- 이 레이어가 없으면 `features/daily-scheduler`·`features/weekly-scheduler`가 Nexon 응답의 원시 필드(`registration_flag`가 문자열인 점 등)를 직접 알아야 하므로, 격리 목적상 반드시 이 레이어를 거친다.
- 별도 서버/프록시 없음 — API 키는 사용자 기기에만 저장되고, 호출도 기기에서 Nexon Open API로 직접 나간다 ([[ADR-003]]).
- 이용약관에 따른 출처 표기는 영문 원문 "Data based on NEXON Open API"를 **설정 화면 하단**(앱 버전·카피라이트와 함께)에 상시 노출한다(**정정, 2026-07-13** — 앱 전역 footer는 만들지 않음, [[ADR-007]] "이용약관 준수 사항" 참고).
- **확정(2026-07-09)**: `character/list`는 API 키가 등록된 Nexon 계정 소속 캐릭터만 반환하며, 다른 Nexon 계정의 캐릭터는 반환하지 않는다. 다른 계정 캐릭터를 보려면 그 계정으로 발급받은 별도의 API 키가 필요하다.

## 게임 레퍼런스 데이터 ([[ADR-006]])
`src/data/`에 여섯 파일로 구성되며, 사용자가 데이터를 확정해 반영. 앞의 세 파일은 보스명(`boss`)+난이도(`difficulty`)를 공통 키로 사용해 서로 조인한다.
- `weekly-bosses.json`: 주간 보스(24종) + 이벤트 주간 보스(1종) + 월간 보스(1종)의 명단·난이도 구성. [[ADR-007]] 도입 이후 이 파일은 "앱 내 보스 선택 UI용 목록"이 아니라 "Nexon API 응답(`boss_contents[].content_name`/`difficulty`, 영문·공백 표기)을 우리 한글 표기와 매핑하기 위한 참조 테이블" 역할로 바뀐다 — `weeklyBossSelectionLimit`(12마리)도 UI 제약이 아니라 API 응답의 `weekly_boss_clear_limit_count`와 대조용 참고값이 된다. `eventWeekly`(시즌보스, 현재 메이린만)는 이 12마리 제한에서 예외이므로, "n/12" 같은 카운터 UI를 만들 때 `weekly` 섹션 보스만 분모·분자에 포함하고 `eventWeekly`는 별도 표시해야 한다(확정, 2026-07-09). 벨로나는 미출시 보스라 `status: "unreleased"`로 표시. 카이는 시즌이 종료된 레거시 보스라 목록에서 제외. 각 보스 항목의 `portraitSlug`([[ADR-011]])는 `assets/bosses/`의 초상화 파일명(`{portraitSlug}.webp`, 난이도 무관 — 정정 [[ADR-018]] 2026-07-13) 조회 키 — 아직 이미지 없는 보스(현재 벨로나만)는 필드 자체가 없음
- `boss-crystal-prices.json`: 보스×난이도별 "강력한 힘의 결정" 정가(1인 기준). 파티원 1인당 실수령액은 `partySizeScaling.formula`(`floor(priceMeso / partySize)`)로 계산. 벨로나는 `priceMeso: null`. 메이린(이벤트 주간 보스)은 결정이 아닌 황금 메소 주머니 총 가치(1개=1000만 메소) 기준으로 채움 — 개별 entry의 `note` 참고
- `item-drop-table.json`: 보스×난이도별 보상 전체(고정 보상/장비/소비 아이템/주문서/기타/최초 격파 카테고리)를 원본 그대로 보유. 물욕템 버튼 UI에 노출할 항목은 이 중 일부를 선별해 사용 — 선별은 코드가 임의로 하지 않고 사용자가 지정. 아이템별 시세(`priceMeso`, [[ADR-010]])는 아직 미반영 — 컨벤션만 정해두고 실제 값이 확정될 때 채움
- `boss-ring-boxes.json`([[ADR-010]], [[ADR-011]]): `item-drop-table.json`의 `consumable` 카테고리에 이미 존재하는 "OO옥의 보스 반지 상자" 5종(녹옥/홍옥/흑옥/백옥/생명의)에 대해, 박스 이름을 키로 레벨별 확률표·반지별 확률표를 보유. 앞의 세 파일과 달리 `boss`/`difficulty`로 조인하지 않고 아이템 `name` 문자열로 `item-drop-table.json`과 연결한다. 확률은 실제 획득 결과를 추정하는 데 쓰지 않고, 사용자가 획득 기록 시 고를 후보 목록으로만 사용. 각 반지 항목의 `iconFile`은 `assets/items/rings/`의 GMS 영문 파일명(나무위키 확인, 컨티뉴어스 링만 사용자 지시로 직접 명명)
- `accessory-boxes.json`([[ADR-010]], 신규): "혼돈의 칠흑 장신구 상자"·"메이린의 칠흑 장신구 상자"(이름만 다르고 후보 목록 동일 — 사용자 확인)의 후보 아이템 7종을 보유. `boss-ring-boxes.json`과 같은 조인 방식(아이템 `name` 문자열)을 쓰지만, 레벨 개념이 없고 개별 확률(%)도 게임 내에 공개되지 않아 후보 목록만 있고 확률 필드는 전부 `null`
- `item-icons.json`([[ADR-011]], 신규): 일반 물욕템(반지 제외)의 "한글 아이템명 → `assets/items/`의 기존 파일명" 매핑 테이블. `item-drop-table.json`에 필드로 넣지 않는 이유는 같은 아이템이 여러 보스에 반복 등장해 중복이 심해지기 때문. 확신도 높은 매칭만 반영, 후보가 여럿이라 확정 못 한 파일은 사용자 확인 대기 중([[ADR-011]] 미확정 목록 참고)

`src/data/`에는 위 여섯 파일 외에 UI 표시 전용 설정 파일도 하나 있다 — 게임 밸런스/수치 데이터가 아니므로 [[ADR-006]]("게임 데이터는 사용자 확인 후 반영")의 대상이 아니다:
- `boss-portrait-crops.json`([[ADR-018]], 신규): 보스 스케줄러의 새 보스 카드에서 일러스트를 bleed 배치할 때 쓰는 보스별 크롭 값. `portraitSlug`를 키로 `{ size: string, position: string }`(CSS `background-size`/`background-position` 값 그대로) 매핑. 일러스트마다 인물 구도가 달라 값이 제각각이라(예: 카링 `size: "300% auto"`, 스우 `size: "190% auto"`) 하드코딩 대신 이 파일로 분리했다. 값은 AI가 임의로 채우지 않고 사용자가 각 일러스트를 넣을 때마다 직접 조정 — 매핑 없는 `portraitSlug`는 `{ size: "cover", position: "center" }`로 폴백(`lib/boss-icons.getBossPortraitCrop`). `BossPortrait`(원형, 보스 수익 계산기·물욕 아이템 화면)는 이 파일을 참조하지 않는다.

## 에러 핸들링 및 복원력 ([[ADR-008]])
정책의 이유·트레이드오프는 ADR-008 참고. 이 섹션은 계층별 구현 지점을 정리한다.

| 실패 유형 | 감지 위치 | 처리 |
|---|---|---|
| 네트워크 없음/타임아웃/5xx | `nexon/schedule` 호출 wrapper | 마지막 캐시 유지, `storage/`의 동기화 상태를 `error`로 표시, UI에 "마지막 동기화 n분 전" + 새로고침 버튼 |
| 401/403 (키 무효) | `nexon/schedule` 응답 인터셉터 | 캐시 유지, 전역 상태(Zustand)에 `apiKeyInvalid: true` 세팅 → 설정 화면 진입 유도 배너. 무효 키로 자동 재시도 금지 |
| 429 (rate limit, 에러 코드 `OPENAPI00007`) | 공통 HTTP 클라이언트 응답 인터셉터 | 지수 백오프로 다음 허용 시각 저장, 그 전까지 새로고침 버튼 disabled 처리. 평소엔 초당 5건 큐잉으로 애초에 429를 거의 안 만나야 정상 |
| 캐릭터 목록 조회 실패(`character/list`) | `nexon/character` 호출 wrapper | API 키 입력 직후 실패하면 "캐릭터 목록을 가져오지 못했습니다" 표시 + 재시도 버튼(키 자체가 무효라면 401/403 처리로 귀결) |
| 개별 캐릭터 `character/basic` 조회 실패(캐릭터 관리 피커, [[ADR-015]]) | `nexon/character` 병렬 호출 개별 실패 | 그 캐릭터만 이름/레벨(`character/list` 값)로 플레이스홀더 이미지와 함께 표시. 401/403/429처럼 전역 실패면 `syncSchedules`와 동일하게 피커 전체를 에러 상태로 표시(개별 폴백과 구분) |
| 응답 스키마 불일치 | `nexon/schedule` 파서 | 항목 단위 try/catch, 실패한 항목만 "표시 불가"로 스킵, 나머지는 정상 반영 |
| 응답이 JSON이 아님(WAF/CDN 차단 페이지 등) | `nexon/client` 공통 HTTP 클라이언트 | JSON 파싱 자체를 try/catch, 네트워크 실패와 동일하게 마지막 캐시 유지로 처리 |
| 매핑 테이블에 없는 보스명/콘텐츠명 | `nexon/schedule` 정규화 로직 | 원문 그대로 "알 수 없는 콘텐츠"로 표시(크래시 금지) |
| 로컬 저장소 쓰기 실패 | `storage/` 어댑터 | 호출부에 실패를 그대로 전파, UI가 "저장 안 됨" 토스트 표시(무시 금지) |
| 온보딩 중 API 키 저장 실패 | `storage/` 보안 영역 쓰기 | 온보딩 미완료 처리, "키 저장에 실패했습니다" + 재시도 유도(일반 저장 실패보다 명시적으로 처리) |
| 알림 권한 거부(최초 요청 시) | `native/` 초기화 시점 | 기능 진입 시 권한 요청, 거부 시 설정 화면에서 재요청 안내 |
| 알림 권한이 런타임 중 취소됨 | 알림 예약/재확인 직전 | 예약 전 권한 상태 재확인, 꺼져 있으면 예약 스킵 + 배너 안내 |
| 알림 64개 한도 초과 | 알림 재예약 로직 | [[ADR-004]] 우선순위 정책대로 일부만 예약(사냥 타이머 폴백 알림도 동일 풀에 포함해 계산), 나머지는 설정 화면에 미예약 알림 개수 표시 |
| Foreground Service/Live Activity 시작 실패 | `native/hunting-timer` | 상시 알림 없이 완료 알림/사운드만 로컬 알림으로 폴백 |
| 알림 재확인 시점 API 재호출 실패 | `native/notification-sync` | 마지막 캐시 기준으로 폴백해 알림 발송 여부 판단 ([[ADR-004]]) |
| 예기치 않은 크래시/예외 | 앱 전역 에러 바운더리 | `lib/error-reporting`가 opt-in 상태일 때만 Sentry로 전송(개인 식별 정보 제외). opt-out이면 아무 데도 전송 안 되고 사용자 리뷰/문의로만 알게 됨 ([[ADR-008]]) |

**참조 무결성**: `src/data/`에서 보스가 제거돼도(카이 사례, [[ADR-006]]) 과거 로컬 기록은 삭제하지 않는다. 조회 시 참조 테이블에 없는 키를 만나면 "(더 이상 지원하지 않는 콘텐츠)"로 표시.

**멱등성**: 보스 수익 기록은 `(characterId, boss, difficulty, weekOf)`를 유니크 키로 삼아 upsert한다 — 같은 주에 여러 번 동기화해도 중복 생성되지 않는다.

## 엣지 케이스
- **신규 캐릭터, 게임 내 스케줄러 미등록**: `registration_flag`가 전부 `"false"`인 상태 — 에러가 아니라 정상적인 빈 상태(empty state) UI로 처리하고, "게임에서 스케줄러에 등록해주세요" 안내
- **리셋 경계 시각**: Nexon 서버는 한국시간(KST) 기준 목요일 00:00에 초기화됨을 확인(2026-07-09) — `lib/reset-clock`이 계산하는 일간 00:00 KST / 주간 목요일 00:00 KST 리셋 시각과 정확히 일치하므로, 리셋 경계 불일치 리스크는 해소됨
- **멀티 디바이스**: 같은 API 키를 여러 기기에 입력해도 각 기기가 독립적으로 캐시를 가짐(기기 간 동기화 없음). 버그 아님, [[ADR-003]]의 자연스러운 결과
- **캐릭터 서버 이전/개명**: 캐릭터 목록을 캐싱하지 않고 항상 nexon/character를 다시 호출해 조회하므로(2026-07-11 정정, 위 "데이터 흐름" 참고), 별도의 캐시 무효화 로직 없이 다음 조회에서 자연히 최신 상태로 반영된다
- **캐릭터 식별 기준**: 캐릭터명은 개명·표기 변경이 가능하므로, 로컬 저장소·수익 기록 등 모든 캐릭터 식별은 캐릭터명이 아니라 항상 ocid를 기준으로 관리한다(확정, 2026-07-09)
- **벨로나 출시**: `status: "unreleased"`가 남아있는 상태에서 Nexon API가 실제 데이터를 반환하기 시작하면, 참조 테이블(`weekly-bosses.json`) 갱신 전까지 표기가 어긋날 수 있음 — 출시 공지 시 데이터 갱신 필요
- **파티원 수 입력값 검증**: 0 이하 또는 비정상적으로 큰 값 입력 방지(양의 정수, 상한은 게임 최대 파티 인원 기준 — 정확한 상한은 PRD "확인이 필요한 사항" 참고)
- **동일 캐릭터 중복**: `character/list` 응답에 동일 캐릭터가 중복으로 오는 경우를 대비해 ocid 기준으로 dedup 처리
- **`account_list`가 비어있거나 선택된 계정의 `character_list`가 빈 배열**: API 키는 유효하지만 캐릭터가 없는 경우(신규 발급 등) — 에러가 아니라 "이 계정에 캐릭터가 없습니다" 빈 상태로 처리
- **계정(메이플 ID) 변경**: 설정에서 다른 계정으로 바꾸면 기존에 등록된 캐릭터 기반의 로컬 기록(보스 수익·드랍 히스토리)을 유지할지 여부 — 삭제하지 않고 그대로 두되(참조 무결성 원칙, [[ADR-008]]), UI에서는 현재 선택된 계정의 캐릭터만 노출
- **동률 레벨 계정 대표 캐릭터 표기**: 계정 선택 화면에서 "가장 레벨 높은 캐릭터"로 계정을 대표 표기하는데([[ADR-007]]), 동일 계정 내 캐릭터 레벨이 동률인 경우 캐릭터명으로 정렬해 첫 번째를 대표로 삼는다(확정, 2026-07-09) — 정렬 우선순위는 한글 > 알파벳 > 숫자이며, 그룹 내부에서는 한글 가나다순·알파벳 abc순·숫자 123순으로 비교한다
- **게임 내 캐릭터 삭제**: 서버 이전/개명(캐릭터 유지, ocid만 갱신)과 달리 캐릭터 자체가 게임에서 삭제된 경우. 보스 참조 데이터 제거 시와 동일한 원칙(과거 기록은 지우지 않는다, [[ADR-008]] 참조 무결성)을 확장 적용해, 로컬 기록은 보존하고 조회 시 캐릭터명을 "삭제된 캐릭터"로 표시한다(확정, 2026-07-09)
- **사냥 타이머 강제 종료 후 재실행 시 동작**: 앱 강제 종료 시 타이머가 초기화된다는 경고를 표시한다. 종료 후 재실행하면 타이머는 진행 상태를 이어가지 않고 실행되지 않은(정지) 상태로 시작한다(확정, 2026-07-09)
- **기기 시스템 시계가 부정확한 경우**: `lib/reset-clock`은 기기 타임존 차이는 보정하지만, 기기 자체의 시각이 틀린 경우(수동으로 시간을 조작한 기기 등)는 보정하지 않는다 — 알려진 한계로 남김(서버 시각과 대조하는 검증은 MVP 범위 밖)

## 테스트 전략
- `lib/reset-clock`: 단위 테스트로 KST 자정 경계, 목요일 경계, 월/연 경계를 검증. 기기 타임존이 KST가 아닐 때도 항상 KST 기준으로 계산되는지 확인
- `nexon/schedule` 파싱/정규화: 실제 응답 예시(ADR-007 샘플)를 fixture로 사용한 단위 테스트 — 문자열 flag 파싱, 영↔한 난이도 매핑, 양방향 공백 정규화(공백이 API에 더 많은 경우·데이터에 더 많은 경우 둘 다), `apiAlias` 매핑(시즌 보스 메이린 등), `bossDaily` 필터링, 매핑 테이블에 없는 항목의 폴백 처리
- `nexon/schedule` 에러 경로: 네트워크 실패·401·429·스키마 불일치·JSON 파싱 실패를 각각 모킹한 단위 테스트 (ADR-008 표의 각 행에 대응하는 테스트가 있어야 함)
- `nexon/character`: `account_list`/`character_list`가 빈 배열인 경우, 동일 ocid 중복 응답 시 dedup 처리, 동률 레벨 계정 대표 캐릭터 선정(캐릭터명 기준 정렬 — 한글>알파벳>숫자) 각각의 단위 테스트
- 캐릭터 관리 피커 정렬·필터링([[ADR-015]]): 레벨 내림차순 정렬(동률 시 기존 `compareByName` 기준 2차 정렬), `access_flag: "false"` 캐릭터가 후보 목록에서 제외되는지, `character/basic` 병렬 호출 중 일부만 실패해도 나머지 캐릭터는 정상 표시되는지 검증하는 단위 테스트를 기능 구현 시 추가
- `nexon/client` 큐잉 로직: 여러 캐릭터를 동기화할 때 초당 5건(개발 단계) 이내로 순차 호출되는지, 429 응답 시 지수 백오프가 다음 허용 시각을 정확히 계산하는지 검증하는 단위 테스트
- 라우트 가드: 온보딩(API 키 등록)이 완료되지 않은 상태로 일간/주간/타이머 등 다른 화면에 진입 시 온보딩으로 리다이렉트되는지 검증하는 테스트
- 보스 수익 계산 포뮬러: `floor(priceMeso / partySize)`의 단위 테스트 — 파티원 1명(솔로), 최대 인원, 0/음수 등 잘못된 입력
- 파티원 수 자동 기록([[ADR-014]], 기본값 소스는 [[ADR-019]]로 정정): 같은 (ocid, boss, difficulty)에 `boss_party_settings`이 있을 때 그 값을 기본값으로 쓰는지, 없을 때 1로 기록되는지, 사용자가 특정 주(달)만 값을 수정해도(주차별 override) 다른 주차의 기록·`boss_party_settings` 자체는 바뀌지 않는지 검증하는 단위 테스트를 기능 구현 시 추가
- 파티 관리([[ADR-019]], 설계만·구현 전): `boss_party_settings` upsert가 (ocid, boss, difficulty) 유니크 키로 정확히 동작하는지, 1로 저장 시 솔로 취급되는지(배지 사라짐), 설정이 없는 보스가 솔로 필터에 포함되는지, 전체/솔로/파티 필터가 현재 활성 탭(주간/월간)의 목록에만 적용되고 다른 탭 상태에 영향을 주지 않는지 검증하는 단위 테스트를 기능 구현 시 추가
- 캐릭터별 드롭다운 합계([[ADR-014]]): 캐릭터별 "이번 주" 소계와 화면 상단 전체 합계가 각 캐릭터 소계의 합과 일치하는지, 월간 보스 수익이 상단 합계에서 제외되는지 검증하는 단위 테스트를 기능 구현 시 추가
- 물욕템 환산 수익 합산([[ADR-010]]): `priceMeso`가 `null`인 항목은 합계에서 제외하고 "가격 미확정"으로 별도 집계되는지, 컨테이너 아이템(보스 반지 상자)은 선택된 결과(레벨·반지명)까지 함께 저장되는지 검증하는 단위 테스트를 기능 구현 시 추가
- 데이터 정합성: 기존 `src/data/__tests__/data-consistency.test.ts`·`boss-ring-boxes.test.ts`에 더해, 참조 테이블에서 보스가 제거된 뒤에도 과거 기록 조회가 죽지 않는지 검증하는 테스트를 기능 구현 시 추가
- 알림 스케줄링: 64개 한도 초과 시나리오를 모킹해 우선순위 정책대로 예약되는지 검증하는 단위 테스트
- `native/notification-sync`: 알림 시각 트리거 시 API 재호출 성공/실패 각 경로를 모킹한 단위 테스트 — 실패 시 마지막 캐시로 정확히 폴백하는지 확인
- `lib/error-reporting`: opt-in이 꺼져 있을 때 아무것도 전송되지 않는지, 켜져 있을 때만 전송되는지, 전송 페이로드에 캐릭터명·API 키 등 개인 식별 정보가 섞이지 않는지 검증하는 단위 테스트
- 네이티브 플러그인(사냥 타이머 상시 알림, Live Activity, 백그라운드 알림 재확인): 유닛 테스트로 검증하기 어려우므로, 실기기 기준 수동 QA 체크리스트로 대체 — 백그라운드 전환, 강제 종료 후 재실행, 배터리 최적화 활성화 상태, iOS 16.1 미만 기기 폴백 동작, iOS BGAppRefreshTask가 지정 시각에 정확히 안 돌 때의 동작을 실제 기기에서 확인
- 골든 패스 수동 테스트 시나리오: 앱 최초 실행 → API 키 입력 → 캐릭터 목록 자동 조회 → 동기화 → 일간/주간 화면 표시 → 보스 완료 감지 → 파티원 수 입력 → 수익 계산 확인까지 전체 흐름을 실제 캐릭터로 1회 이상 수동 검증
