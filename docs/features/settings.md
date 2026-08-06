# 설정 (Settings)

> **범위**: API 키 관리·계정(메이플 ID) 변경·연결 해제·테마 선택·스케줄 관리 방법(트래킹 모드)·데이터 관리·앱 업데이트·footer 표기. 다른 기능 설명에 흩어져 있던 요구사항을 통합 정리.
> **관련 소스**: `app/settings/` · `features/settings/`(`changeApiKey`) · `storage/api-key`(`clearAuthConfig`) · `storage/cache-data`(`clearCacheData`/`getCacheDataSizes`) · `features/onboarding`(`RESET`) · `features/tracking-mode`(`copy.ts`) · `AccountFlowStatus` · `SettingsRow` · `TrackingModeModal`/`TrackingModeSelector` · `ThemeModal`/`ThemeSelector` · `CacheDataSection`/`CacheClearConfirm`.
> **관련 ADR**: [[ADR-007]] [[ADR-008]] [[ADR-009]] [[ADR-004]] [[ADR-035]] [[ADR-026]] [[ADR-027]] [[ADR-050]] [[ADR-051]] [[ADR-052]] [[ADR-058]] [[ADR-086]] [[ADR-104]]. **관련 문서**: [onboarding.md](./onboarding.md), [theme.md](./theme.md), [live-update.md](./live-update.md), [../foundation/nexon-api.md](../foundation/nexon-api.md), [../persistence/lifecycle.md](../persistence/lifecycle.md).

## 정책
진입 경로는 **하단 탭바 4번째 탭**(별도 헤더 아이콘 아님, 확정 2026-07-12).

- **계정(메이플 ID) 변경**: API 키 재입력 없이, 저장된 키로 `character/list` 를 다시 호출해 계정 선택 UI(`AccountSelectionList` 재사용)를 다시 보여준다. **계정이 1개여도 선택 UI를 보여준다**([[ADR-051]]) — 온보딩과 설정 두 경로가 "계정 수와 무관하게 항상 선택 화면 경유, 사용자가 '계속하기'로 확정해야 예열" 이라는 같은 규칙을 공유한다(상세 [onboarding.md](./onboarding.md)). **전원 조회 불가인 계정은 고를 수 없다**([[ADR-086]] 결정 8 — 같은 컴포넌트라 온보딩과 함께 적용). 계정 관련 로컬 기록(보스 수익·드랍 히스토리)은 삭제하지 않음([[ADR-008]] 참조 무결성). 이전 계정 캐릭터 기록도 보존, 현재 계정 캐릭터만 노출.

### 계정 변경은 캐릭터를 다시 고를 때까지 커밋하지 않는다 ([[ADR-086]] 결정 6, 2026-08-03)
흐름이 `확정 → 저장 → 예열 → 닫기` 에서 **`확정 → 예열 → 캐릭터 선택 → (저장 시점에) 커밋`** 으로 바뀐다.
- 커밋은 `setSelectedAccountId` + `setTrackedCharacterOcids` 두 쓰기를 **캐릭터 선택 저장 한 지점**에 모은다. 취소하거나 도중에 앱이 죽으면 **이전 계정이 온전히 그대로**다 — 온보딩의 "끝내지 않은 단계는 이전 상태를 깨지 않는다"([[ADR-086]] 결정 1)를 설정 경로에 그대로 적용한 것이다.
- 전에는 `selectedAccountId` 만 갱신하고 `trackedCharacters` 는 이전 계정 ocid 를 그대로 들고 있었다. 거기에 피커의 stub 단계가 계정 구분 없는 인덱스를 읽어(결정 9) **계정은 바뀌었는데 이전 계정 캐릭터가 보이는** 상태가 만들어졌다.
- 예열·로스터는 저장된 `selectedAccountId` 가 아니라 **후보 계정 id 를 인자로** 받는다(`resolveRegisteredCharacters(accountIdOverride?)`). 커밋 전 구간에 예열이 쓴 캐시는 **후보 계정의 인덱스**로 들어가므로 이전 계정 화면을 오염시키지 않고, 나중에 실제로 그 계정으로 전환하면 따뜻한 캐시로 재사용된다.
- **같은 계정을 다시 고르면** 아무 쓰기 없이 닫는다(추적 목록 보존).
- **연결 해제(로그아웃)**: `storage/api-key.ts` 의 `clearAuthConfig()` + `features/onboarding` 의 `RESET` 이벤트를 재사용해 온보딩 화면으로 복귀(신규 로직 없이 기존 두 조각 연결). 키 무효화 복구 경로도 이것(재온보딩).
- **데이터 관리(캐시 데이터 삭제)**: 지울 데이터를 **2그룹 중 선택**해서 지운다([[ADR-058]]) — "일반 데이터"(동기화 캐시·추적 목록·수동 추적 항목·공유 진행 원장·파티 설정)와 "보스 수익·드롭 기록"(복구 불가). 인증·사용자 설정 5개(`KEEP_KEYS`)는 어떤 선택에서도 보존되므로 이 기능으로 온보딩으로 돌아가지 않는다 — 연결 해제는 별도. 범위의 정확한 정의와 그룹 경계의 근거는 [../persistence/lifecycle.md](../persistence/lifecycle.md).
- **테마 선택**: 등록된 테마 중 선택 → 즉시 반영. 목록은 카테고리 섹션(기본·직업·보스) + 2열 프리뷰 타일이고 위에 라이트·다크 필터 칩이 붙는다([[ADR-104]]). **고른다고 모달이 닫히지는 않는다** — 모달 자신이 선택 테마 색으로 그려지므로 그 자리에서 갈아입혀 보게 두고, 닫기는 "완료" 버튼과 오버레이 탭이 맡는다([[ADR-104]] 결정 7). 상세 [theme.md](./theme.md).
- **스케줄 관리 방법(트래킹 모드)**: 자동/수동 전역 토글([[ADR-035]]). 상세는 아래 UI.
- **footer 표기**(확정 2026-07-13, 비제휴 고지 추가 2026-08-03): 화면 맨 아래에 앱 버전(`package.json`)·카피라이트("© {연도} 메이플 루틴")·이용약관 제6조④ 요구 영문 문구 "Data based on NEXON Open API"(원문 그대로, 의역 금지)·**비제휴 고지 "Maple Routine is not associated with NEXON Korea"**. 앱 전역 footer는 만들지 않음.
  - 비제휴 고지는 약관이 **요구하는 것이 아니라** 동종 서비스의 공통 관행을 따른 것이다(2026-08-03 조사) — maple.gg("Maple.GG is not associated with NEXON Korea")·chuchu.gg("This site is not associated with NEXON Korea")·maplescouter.com("Maplescouter is not associated with NEXON Korea and does not provide any warranty") 셋 다 출처 표기와 **함께** 비제휴 고지를 단다. 출처 표기만 있으면 넥슨 공식 서비스로 오인될 여지가 남는다.
  - **문구도 3사와 같은 영문 형태로 맞춘다**(사용자 결정 2026-08-04, 초안의 한글안 폐기). 같은 문구를 안내 사이트 footer(`site/template.html`)와 `PRIVACY.md` 말미도 공유한다.
- **개인정보 처리방침 링크**(2026-08-04, 스토어 요건): footer 맨 위에 `mapleroutine.store/privacy` 로 나가는 링크 한 줄. **Play 사용자 데이터 정책은 스토어 등록정보와 앱 안 양쪽에 링크를 요구한다** — 콘솔에 URL을 넣는 것만으로는 충족되지 않는다([../foundation/release.md](../foundation/release.md)).
  - **위치는 footer 맨 위**(버전 줄보다 위). 아래 세 줄은 고지 문구라 읽고 끝나지만 이것은 **눌러야 하는 것**이라, 정적 문구 사이에 끼면 링크로 안 읽힌다.
  - **색은 `text-text-muted` + `underline`.** 나머지 footer가 `text-text-disabled` 인데 그 톤으로 두면 "누를 수 있는 것"으로 보이지 않고, 온보딩 링크의 `text-primary-ink` 를 쓰면 footer에서 혼자 튄다. 한 단계만 밝히고 밑줄로 링크임을 표시한다.
  - **외부 링크 열기는 `<a target="_blank" rel="noopener noreferrer">`** — `ApiKeyForm` 의 `openapi.nexon.com` 링크와 같은 방식이다. 별도 브라우저 플러그인을 들이지 않는다.
  - URL은 `PRIVACY.md` 를 렌더링해 서빙하는 그 주소다([site.md](./site.md)) — 앱 안에 정책 본문 사본을 만들지 않는다. 사본을 두면 법적 문서가 두 벌이 된다.

## UI

### 이 화면에는 고정 헤더가 없다 ([[ADR-098]] 결정 3, 2026-08-06)
다른 화면들이 쓰는 `PageHeader` 셸이 없고 `p-4 space-y-4` 안의 평범한 `h1` 이다 — 그래서 스케줄러에서 관측된 **탭 복귀 프레임 튐**([[ADR-098]])이 이 화면에서는 구조적으로 일어날 수 없다(날아갈 고정 헤더가 없다). 화면 높이도 잰 값이 있다: 390px 폭 + iPhone 안전영역(59/34) 기준 **필요 높이 835pt** 라 대부분의 기기에서 스크롤 자체가 생기지 않는다(13 mini·SE 급에서만 20pt 남짓). 행이 늘어 세로가 길어지면 그때는 고정 헤더 도입 여부를 다시 판단할 것 — 도입한다면 공용 `PageHeader` 를 쓰면 되고, 그 셸이 이미 `fixed` 라 같은 결함을 물려받지 않는다.

### 설정 리스트 행 + 모달 — 2026-07-13
카드형 섹션 나열이 아니라 **하나의 리스트 컨테이너**(`rounded-[14px] bg-surface border border-border px-6`) 안에 행(`SettingsRow`)을 `divide-y divide-border` 로 이어붙임. 각 행 `py-4`, 왼쪽 라벨(`text-sm font-medium text-text`, 위험 동작은 `text-error`) + 오른쪽(기본 `ChevronRight text-text-muted`, `showChevron={false}` 가능), 행 전체가 버튼이라 탭하면 해당 모달. "계정 변경"·"스케줄 관리 방법"·"테마" 3개 행은 이 패턴, "연결 해제"만 확인 모달 직접 연다.
- **모달**: 공용 `components/Modal`([../foundation/design-system.md](../foundation/design-system.md)) — 계정 변경 모달·계정 선택 목록은 `card={false}` 로 자체 카드를 담음.
- **테마 행 오른쪽은 현재 테마 이름 배지 하나뿐이다** ([[ADR-104]] 결정 5, 2026-08-06) — 색 표식을 두지 않는다. 어떤 테마인지는 이름이 말하고, 그 색은 지금 눈앞의 화면 전체가 이미 말하고 있다.
- **테마 선택 모달(`ThemeSelector`)**: 라이트·다크 필터 칩(전체·라이트·다크, 기본 전체, 저장 안 함) + 카테고리 섹션 헤더 + **2열 프리뷰 타일**. 타일은 그 테마의 `bg`/`surface`/`surface2`/`primary`/`text` 로 미니 화면을 그린다 — `job-themes.json` 직접 import(비활성 테마 색이라 CSS 커스텀 프로퍼티로 부족). 거른 결과가 0인 섹션은 헤더째 감춘다. 선택 계약은 그대로 `aria-pressed` + `onSelect`. 정책·카테고리 소속은 [theme.md](./theme.md).
  - **버튼은 "완료" 하나**다(`mt-4 flex justify-end`, `TrackingModeModal`·`DisconnectConfirm` 과 같은 골격). 취소/적용 2단계를 쓰지 않는 이유는 선택이 이미 적용돼 **취소할 대상이 없기** 때문이다 — 되돌리려면 원래 테마를 다시 고르면 된다.
- **캐시 데이터 삭제 행/모달(`CacheDataSection`/`CacheClearConfirm`)**: 행 라벨은 위험 동작이라 `text-error`, 오른쪽에 총 용량(`getCacheDataSizes()` 그룹별 값의 합). 모달은 체크박스 2행(`role="checkbox"`, 행 전체가 탭 영역) — 각 행에 그룹 이름·설명·그룹 용량, "보스 수익·드롭 기록" 행에는 복구 불가 경고. **보존 항목("유지됨") 줄은 두지 않는다**([[ADR-058]] 결정 9). **기본은 두 그룹 모두 체크**라 열고 바로 삭제하면 기존 전체 삭제와 같고, 전부 해제하면 삭제 버튼이 비활성이다([[ADR-058]] 결정 6). 삭제 중에는 두 버튼과 체크박스가 비활성(`isClearing`). 삭제 후 흐름은 선택과 무관하게 동일 — 타임아웃 경쟁 → 스플래시 → `closeBossProfitDb()` → 리로드([[ADR-050]], 결정 7). **실패·타임아웃이면 리로드 뒤에 토스트로 알린다**([[ADR-065]] 결정 3) — 리로드가 화면 신호를 파괴하므로 `storage/pending-notice`(sessionStorage)에 플래그를 남기고 부팅 후 "캐시를 일부만 삭제했습니다"를 띄운다. 리로드를 막거나 부분 삭제를 되돌리는 조치는 하지 않는다. Preferences가 아니라 sessionStorage인 이유는 "리로드는 넘기되 앱 종료와 함께 사라진다"가 이 알림의 수명이기 때문이다.
- **스케줄 관리 방법 행/모달(`TrackingModeModal`/`TrackingModeSelector`, [[ADR-035]] 결정 1)**: 자동/수동 전역 전환. 행 라벨·모달 제목 "스케줄 관리 방법"(2026-07-25 개편, 이전 "트래킹 모드" — 내부 컴포넌트/store 이름은 `TrackingMode*` 그대로). 오른쪽 배지에 현재 모드("자동"/"수동"). 옵션 목록은 `ThemeSelector` 와 동일 선택 카드 패턴(`aria-pressed`, 선택 시 `border-primary bg-primary-tint`).

**선택과 적용은 분리한다** ([[ADR-035]] 결정 23, 2026-08-03) — 옵션 탭은 **고르는 것일 뿐**이고, 모달이 고른 값을 자기 상태로 들고 있다가 "적용"에서 한 번만 `setMode` 를 부른다.
```
버튼:   우측 정렬 취소(고스트) + 적용 — DisconnectConfirm/CacheClearConfirm 과 같은 골격
        취소  rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text
        적용  rounded-full bg-primary text-on-primary px-5 py-2.5 text-sm font-semibold
              (파괴적 동작이 아니라 진행 동작이라 저 둘의 border-error 가 아니다)
적용 중: 버튼 안 MapleSpinner size={16} + 라벨 "적용 중" + disabled + aria-busy
```
- **현재 모드와 같으면 적용 버튼이 비활성**이다 — 바뀐 것이 없으면 누를 것도 없다. 닫기는 취소·오버레이가 맡는다.
- 수동 전환 시 `setMode` 가 시드([[ADR-035]] 결정 14(a)) 끝날 때까지 resolve 안 되므로 그동안 **옵션·취소도 비활성**이고 **오버레이 클릭 닫힘 금지**(저장 도중 못 닫음 원칙)는 그대로다.
- 옵션 카드 안쪽 구조는 아래 "트래킹 모드 옵션 카드" — 온보딩과 공유한다. 이제 **흐름(선택 → 확정 버튼)까지 온보딩 `TrackingModeStep` 과 같다**.

#### 트래킹 모드 옵션 카드 — 온보딩과 공유하는 내부 구조 ([[ADR-035]] 결정 22, 2026-08-03)
카피(`features/tracking-mode/copy.ts`)와 **카드 안쪽 구조**를 온보딩 `TrackingModeStep` 과 공유한다 — 한쪽만 고치면 같은 선택지가 두 화면에서 다르게 생긴다. 카피는 세 필드다: `title`(자동/수동) · `description`(한 문장) · `caution`(그 모드의 한계 한 문장, 신규). 문구 전문과 그 이유는 [[ADR-035]] 결정 22.
```
카드 안쪽:  flex items-start gap-3
            아이콘  h-5 w-5 flex-none text-primary-ink — 자동 Gamepad2 / 수동 ListChecks (배지 없이 단독)
            제목    text-sm font-semibold text-text
            설명    text-sm text-text-muted   ← 접지 않고 항상 표시(고르기 전에 비교하는 화면)
주의 줄:    mt-2 flex items-start gap-1.5 rounded-[8px] bg-info-tint px-2.5 py-1.5 text-xs text-info-ink
            + Info h-3.5 w-3.5 flex-none (strokeWidth 1.75), 아이콘 행 아래 카드 폭 전체
```
- 주의 줄이 `error` 가 아니라 **정보 톤**인 이유는 `UnavailableNotice` 와 같다 — 사용자가 고칠 수 없는 알려진 제약이라 error 색은 과하다([[ADR-060]] 결정 5). 규격도 그 컴포넌트의 compact 변형을 카드 안 크기로 축소해 승계했다. **컴포넌트 자체를 재사용하지 않는 것은** `UnavailableNotice` 가 문구를 자기 안에 고정으로 갖기 때문이다(임의 문구를 못 받는다).
- 선택 표시는 테두리+틴트뿐이고 **체크 마크를 두지 않는다** — 보스 관리 화면 선례와 통일.
- **바깥 카드 클래스(`rounded-[10px] border ... px-4 py-3`)는 `AccountSelectionList`/`ThemeSelector` 와 계속 공유**한다. 바뀐 것은 안쪽뿐이다.

## 후속 task (미구현)
- 크래시 리포팅 opt-in 토글([[ADR-008]], `lib/error-reporting` 미구현), 알림 권한 재요청 안내, 미예약 알림 개수 표시([[ADR-004]] 64개 한도 우선순위 정책 자체가 미구현).

## 열린 질문
- 설정 화면 섹션 순서/그룹핑(계정/알림/개인정보 등) 미논의.
- 계정 변경 시 실수 방지 확인 다이얼로그 넣을지 — [[ADR-051]] 이후 맥락이 달라졌다. 계정이 1개여도 선택 목록을 반드시 보고 "계속하기"로 확정하게 되어 확정 행위 자체가 이미 한 번 있으므로, 다이얼로그를 더한다면 "실수 방지"보다는 "기존 계정 데이터 영향 고지" 쪽 이유가 필요하다.

## 폐기된 정책 (history)
- ~~테마 대표 컬러 점(`ThemeSwatchDots`) — `primary`/`secondary`/`third` 를 `h-4 w-4 rounded-full` 로 겹쳐(`-space-x-1`) 설정 행 배지와 모달 선택지 **양쪽에** 재사용~~ → 모달은 프리뷰 타일이 대신하고 설정 행에서는 색 표식을 **없앤다**. 사용처가 0이 되어 컴포넌트·테스트째 삭제([[ADR-104]] 결정 5, 2026-08-06).
- ~~트래킹 모드 옵션은 탭하는 순간 `setMode` 가 실행되고(확인 단계 없음), 적용 중에는 본문 하단에 `MapleSpinner size=18` + "적용하고 있어요"를 인라인으로 띄운다. 같은 모드 재선택은 즉시 닫힘~~ → 선택 → `취소`/`적용` 2단계, 대기는 적용 버튼 안 16px + "적용 중", 같은 모드면 적용 비활성([[ADR-035]] 결정 23, 2026-08-03).
- ~~트래킹 모드 옵션은 제목 1줄 + 긴 설명 문단 2~3문장(자동 91자·수동 84자)뿐이고, 옵션·CTA 모두 기존 선택 카드 클래스를 그대로 쓴다(신규 스타일 금지)~~ → 카피를 `title`/`description`/`caution` 세 필드로 쪼개고 카드 **안쪽**에 아이콘·정보 톤 주의 박스를 둔다([[ADR-035]] 결정 22, 2026-08-03, 이슈 #59). 바깥 카드 클래스 공유는 유지.
- ~~계정 변경은 `accountId` 만 즉시 갱신하고 추적 목록은 그대로 둔다~~ → 캐릭터 재선택까지 커밋 보류, 저장 시점에 두 쓰기를 함께([[ADR-086]] 결정 6, 2026-08-03).
- ~~"API 키 재입력" 행/모달(`ApiKeyModal`)~~ → 제거(2026-07-25). 키 무효화 복구는 "연결 해제" 후 재온보딩. [[ADR-008]] 재입력 유도 배너는 미구현 보류(설정 store `changeApiKey` 로직은 되살릴 여지로 남겨 둠).
- ~~"트래킹 모드" 행/모달 제목~~ → "스케줄 관리 방법"으로 개명(2026-07-25, 내부 이름은 유지).
- ~~"데이터 관리"(캐시 삭제) 섹션이 "앱 업데이트" 아래~~ → 위로 올림(2026-07-25).
