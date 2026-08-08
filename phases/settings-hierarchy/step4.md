# Step 4: account-data-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `features/settings.md` · `persistence/lifecycle.md`)
- `/docs/ADR.md` (슬림 인덱스 — **[[ADR-118]]** 결정 2·3·4·6 이 계약이다. `/docs/adr/ADR-118.md`.
  캐시 삭제의 정책은 `/docs/adr/ADR-058.md`, 삭제 후 흐름은 `/docs/adr/ADR-117.md` 결정 8)
- `src/app/boss-scheduler/BossManageScreen.tsx` (하위 페이지 표준 골격)
- `src/app/settings/SettingsAboutScreen.tsx` (step 3 산출물 — **같은 헤더 골격을 쓴다**)
- `src/app/settings/CacheDataSection.tsx` (**흡수 대상**) · `__tests__/CacheDataSection.test.tsx`
- `src/app/settings/CacheClearConfirm.tsx` · `AccountModal.tsx` · `DisconnectConfirm.tsx` (그대로 재사용)
- `src/app/settings/SettingsScreen.tsx` (지금 이 화면들이 붙어 있는 자리 — 이 step 에서는 **고치지 않는다**)
- `src/features/settings/store.ts` (`disconnect`) · `src/features/settings/cache-data.ts`

## 배경

[[ADR-118]] 결정 3 — **이슈 #135 가 요구한 "파괴적 행 분리"가 실제로 일어나는 자리가 이 화면이다.**

```
← 계정 및 데이터
┌────────────────────────┐
│ 계정 변경             › │   ← AccountModal 을 연다
└────────────────────────┘
┌────────────────────────┐
│ 캐시 데이터 삭제 12.4 MB │   ← 위험 색, chevron 없음
│ 연결 해제               │   ← 위험 색, chevron 없음
└────────────────────────┘
```

두 파괴적 행이 **별도 카드**로 내려간다. 카드에 제목은 달지 않는다 — 위험 색과 카드 경계가 이미 말한다.

**라우트 배선은 step 6 몫**이라 이 step 이 끝난 시점에 이 화면은 아직 도달할 수 없다.

## 작업

### 1. `src/app/settings/SettingsAccountDataScreen.tsx` 신규

```ts
export interface SettingsAccountDataScreenProps {
  /** 테스트 주입용 — 기본은 window.location.reload */
  reload?: () => void
}

export function SettingsAccountDataScreen(
  props?: SettingsAccountDataScreenProps,
): React.JSX.Element
```

`reload` 프롭은 **지금 `CacheDataSection` 이 가진 것과 같은 계약**이다(테스트가 실제 리로드를 못 하므로
주입한다). 그 프롭이 왜 있는지 주석도 함께 옮겨라.

구성:

- **헤더** — `PageHeader` + `뒤로`(`ArrowLeft`, `aria-label="뒤로"`) + `<h1>계정 및 데이터</h1>`.
  뒤로는 `useScreenNavigate()('/settings')`. step 3 의 `SettingsAboutScreen` 과 **같은 마크업**을 쓴다.
- **카드 1** — `SettingsRow label="계정 변경"` → `AccountModal` 을 연다. **우측에 현재값을 두지 않는다**
  ([[ADR-118]] 결정 6 — `accountId` 는 불투명하고 대표 캐릭터는 파생·변동값이라 단정할 수 없다).
  chevron 만 붙는다.
- **카드 2**(`px-6 divide-y divide-border`) — 두 행 모두 `danger` + `showChevron={false}`:
  - `캐시 데이터 삭제` — 우측에 총 용량. 값은 `loadCacheDataSizes()` 의 `general + bossRecords` 합이고
    ([[ADR-058]] 결정 8), **조회 전에도 `- KB` 로 자리를 잡는다**([[ADR-061]] 결정 7 — 빈 문자열이면 값이
    툭 나타나며 행이 밀린다). 지금 `CacheDataSection` 의 그 주석과 처리를 그대로 옮겨라.
  - `연결 해제` — `DisconnectConfirm` 을 연다.
- **모달 셋**은 카드 **밖**의 형제로 둔다 — `AccountModal` · `CacheClearConfirm` · `DisconnectConfirm`.
  카드 안에 두면 `divide-y` 의 형제로 잡혀 구분선이 하나 더 그려진다.

로직은 지금 `SettingsScreen`(계정 모달 열기 · 연결 해제 확인 · `isDisconnecting`)과 `CacheDataSection`
(용량 로드 · `isClearing` · `clearCacheDataAndReload`)에 있는 것을 **그대로** 가져온다. 새로 만들지 마라.

### 2. `src/app/settings/CacheDataSection.tsx` 삭제

이 화면이 그 컴포넌트의 역할을 통째로 흡수한다(유일한 호출부였던 `SettingsScreen` 은 step 6 에서
캐시 행을 잃는다). 컴포넌트를 남겨 두면 `<section>` + `<h2>데이터 관리</h2>` 라는 **없어진 구조**가
코드에만 남는다.

- `CacheDataSection.tsx` 와 `__tests__/CacheDataSection.test.tsx` 를 삭제하고, **그 테스트 케이스들을
  새 화면 테스트로 옮겨라**(용량 표시·`- KB` 자리잡기·삭제 확인 모달·`isClearing` 비활성 등). 커버리지를
  잃지 마라 — 옮기는 것이지 버리는 것이 아니다.
- `CacheClearConfirm.tsx` 와 그 테스트는 **건드리지 마라**(모달 자체는 그대로다).

**주의**: 이 step 이 끝나면 `SettingsScreen.tsx` 가 `CacheDataSection` 을 import 하는 채로 남아 빌드가
깨진다. 그래서 **`SettingsScreen.tsx` 에서 그 import 와 `<CacheDataSection />` 한 줄만** 함께 지워라
(그 화면의 나머지 재구성은 step 6 몫이다 — 카드·행·footer 는 손대지 마라).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 새 error 0 (baseline: 0 errors / 17 warnings)
npm test        # 기준선 177 파일 / 2695 테스트 기준 — 파일 수는 ±0 (1 삭제 + 1 신규)
git status --short src/app/settings/   # CacheDataSection 2파일 삭제 + 새 화면 2파일 + SettingsScreen 수정
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **테스트를 먼저 쓰고 구현하라(TDD).** 최소 이 케이스들:
   - 제목 `계정 및 데이터` + `뒤로` → `/settings`
   - `계정 변경` 행에 chevron 이 있고 **우측 값은 없다**
   - `캐시 데이터 삭제`·`연결 해제` 두 행이 **계정 변경과 다른 카드**에 있다 (이 step 의 핵심 —
     DOM 상 서로 다른 카드 요소에 속하는지 단언하라)
   - 두 위험 행 모두 chevron 이 없다 (`settings-row-chevron` 부재)
   - 용량 조회 전 `- KB`, 조회 후 포맷된 값
   - `캐시 데이터 삭제` 탭 → `CacheClearConfirm` 이 열리고, 확인하면 `clearCacheDataAndReload` 가
     선택과 함께 불린다 (주입한 `reload` 가 불리는지까지)
   - `연결 해제` 탭 → `DisconnectConfirm` 이 열리고, 확인하면 `disconnect` 가 불린다
3. **판별력을 확인하라** — 두 위험 행을 계정 변경과 같은 카드로 합쳤을 때 **"다른 카드에 있다" 케이스만**
   실패하는지 실행으로 확인하고 되돌려라. 그 결과를 summary 에 적어라.
4. 아키텍처 체크리스트:
   - CLAUDE.md CRITICAL — `app/` 에서 `storage/` 를 **직접** import 하지 않는가?
     캐시 삭제는 `features/settings/cache-data` 를 거친다(`storage/cache-data` 의 타입 import 는
     지금 `CacheDataSection` 이 하던 그대로 유지해도 된다 — 타입만 가져온다).
   - 새 색·새 크기를 만들지 않았는가? 위험 색은 기존 `danger` 프롭이 주는 `text-error-ink`.
5. 결과에 따라 `phases/settings-hierarchy/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/App.tsx` 에 라우트를 추가하지 마라.** 이유: step 6 이 셋을 한 번에 배선한다.
- **`SettingsScreen.tsx` 에서 `CacheDataSection` import·사용 두 줄 말고 다른 것을 고치지 마라.**
  이유: 그 화면의 재구성은 step 6 의 단일 책임이다. 여기서 미리 손대면 두 step 이 같은 파일을 두 번
  갈아엎어 변경 이유가 섞인다.
- **삭제 후 흐름(타임아웃 경쟁 → `closeBossProfitDb()` → 스플래시 → 리로드)을 바꾸지 마라.**
  이유: [[ADR-117]] 결정 8 이 그 **순서**를 최근에 고쳤다(커버가 닫기 뒤여야 한다 — 먼저 올리면 사용자가
  브랜드 주황 화면에 갇히고 터치도 죽는다, 이슈 #175). `clearCacheDataAndReload` 를 그대로 부르기만 하라.
- **`CacheClearConfirm` 의 체크박스 2그룹·기본 전체 선택·복구 불가 경고를 바꾸지 마라.**
  이유: [[ADR-058]] 이 정한 정책이다.
- **`AccountModal` 의 계정 변경 흐름을 바꾸지 마라.** 이유: [[ADR-086]] 결정 6 이 "캐릭터를 다시 고를 때까지
  커밋하지 않는다"를 정해 두었다. 이 step 은 그 모달을 **여는 자리만** 옮긴다.
- 기존 테스트를 깨뜨리지 마라
