# Step 3: settings

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/settings.md`** · `/docs/foundation/design-system.md`
- **`/docs/migration/parity-inventory.md` §2.6**
- `/docs/ADR.md` 에서 아래 표의 ADR 만 열어라
- `packages/app-capacitor/src/app/settings/**` (**옮길 원본 20개, 1,849줄**)
- `packages/app-capacitor/src/app/settings/__tests__/**` (16개 — **명세로 읽어라**)
- **이전 step 산출물**: 셸 · 에셋 코드젠 · `src/navigation/**` · `src/components/**`

## 배경 — 파일은 가장 많지만 ADR 밀도는 낮다

| 파일 | ADR 계약 |
|---|---|
| `SettingsScreen` | 058, 061, 098, 099, 118, 120, 125 |
| `SettingsAboutScreen` | 035, 085, 099, 112, 118, 120 |
| `SettingsAccountDataScreen` | 035, 058, 061, 118, 120 |
| `SettingsPrivacyScreen` | 062, 118, 120 |
| `SettingsReleaseNotesScreen` | 060, 118, 119, 120, 125 |
| `SettingsFeatureGuideListScreen` | 018, 060, 125 |
| `SettingsFeatureGuideScreen` | 125 |
| `AppUpdateSection` | 026, 027, 061, 118, 126 |
| `AccountModal` · `AccountFlowStatus` | 086 / 086, 113, 114 |
| `ThemeModal` · `ThemeSelector` | 035, 104 / 018, 064, 104 |
| `TrackingModeModal` · `TrackingModeSelector` | 035, 061 / 035, 060 |
| `CacheClearConfirm` | 052, 058, 061 |
| `DisconnectConfirm` | 061 |
| `SettingsRow` · `SettingsLinkRow` · `row-class.ts` | 118 |
| `error-message.ts` | 114 |

**[[ADR-118]] 이 절반에 걸려 있다** — 설정 화면의 행·섹션 규격이다. 그것부터 읽고 시작하면
나머지가 빨라진다.

## 작업

### 1. [[ADR-125]] — 라우트 둘이 같은 화면을 그린다

3단계가 내비게이션에서 이미 세웠다(`SettingsFeatureGuide` · `SettingsReleaseNoteGuide` 두 이름이
같은 컴포넌트를 가리킨다). 이 step 은 그 자리에 진짜 화면을 넣는다 — **사본을 만들지 마라.**
`section` 파라미터(웹의 `?s=`)도 이미 라우트 타입에 있다.

### 2. `AppUpdateSection` — OTA 가 아직 안 이어져 있다

[[ADR-128]] 결정 7 때문에 `LiveUpdatePort` 는 던진다. **화면은 만들되 확인 경로를 부르지 마라.**
[[ADR-026]]·[[ADR-027]]·[[ADR-126]] 이 정한 표시 상태를 갈라 적고, 어느 상태가 지금 도달 불가인지
summary 에 남겨라.

### 3. `ThemeSelector` — [[ADR-104]]·[[ADR-064]]

테마 목록·미리보기다. 3단계가 세운 테마 시스템 위에 선다(`ThemeProvider` · `vars()`).
**테마 이름 목록을 손으로 적지 마라** — `job-themes.json` 에서 판다([[ADR-064]] 결정 10).

배경이 있는 테마(혼테일·검은마법사)는 step 1 의 에셋 코드젠으로 살아났을 수 있다. **실제로
그려지는지 확인**하고, 안 되면 무엇이 남았는지 적어라([[ADR-088]]).

### 4. `CacheClearConfirm` — [[ADR-052]]·[[ADR-058]]

캐시 삭제 **범위**가 결정이다. `storage/` 어댑터를 거치고(CLAUDE.md CRITICAL), 지우는 키 집합이
[[ADR-052]] 가 정한 것과 같은지 확인하라. **여기서 범위를 넓히거나 좁히지 마라.**

### 5. `SettingsPrivacyScreen` 은 **2단 스택**이다

이 앱에서 유일하게 `/settings/about` 위에 한 단 더 쌓인다([[ADR-120]] 결정 11). 3단계 라우트 표에
`SettingsPrivacy` 로 이미 있다 — 어디서 push 하는지 확인하라(`SettingsAboutScreen` 의 행).

### 6. 웹 테스트 16개는 명세다 — 이식하지 마라

## Acceptance Criteria

```bash
npm test           # vitest 증감 0 + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-settings-check
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 20개가 전부 있는가? 각 행의 ADR 을 전부 읽고 확인했는가?
   - 안내 상세를 **한 컴포넌트**가 그리는가(사본 아님)? ([[ADR-125]])
   - 테마 목록을 손으로 적지 않았는가?
   - 캐시 삭제 범위가 [[ADR-052]] 그대로인가?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-screens/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 20개·ADR 확인 결과·OTA 미도달 상태 목록·테마 배경 실제 표시 여부·육안 대조 목록"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`LiveUpdatePort` 를 부르지 마라.** 아직 던진다.
- **캐시 삭제 범위를 바꾸지 마라.** 이유: [[ADR-052]] 가 정한 것이고, 넓히면 사용자 데이터가 사라진다.
- **안내 상세를 두 벌로 만들지 마라.** ([[ADR-125]] 결정 3)
- **테마 이름을 손으로 나열하지 마라.** ([[ADR-064]] 결정 10)
- **문구를 다듬지 마라.**
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.

---

## 재개 안내 (2026-08-12 추가 — 세션 한도로 중단됐다가 이어짐)

앞선 실행이 **20개 중 14개**를 만들고 커밋(`97e8fa7`)한 뒤 세션 사용량 한도(HTTP 429)로 끊겼다.
작업 실패가 아니라 호출이 거부된 것이다.

### 지금 **빌드가 깨져 있다** — 이것부터 고쳐라

```
src/app/settings/SettingsScreen.tsx:44 - TS2307
  Cannot find module './use-settings-navigation'
```

`SettingsScreen` 이 import 하는 `use-settings-navigation` 이 **아직 없다**(쓰기 직전에 끊겼다).
`npx tsc --noEmit` 이 이것 하나로 실패한다.

### 이미 있는 것 (14 — 다시 만들지 마라)

`AccountFlowStatus` · `AccountModal` · `AppUpdateSection` · `CacheClearConfirm` ·
`DisconnectConfirm` · `error-message.ts` · `row-class.ts` · `SettingsLinkRow` · `SettingsRow` ·
`SettingsScreen` · `ThemeModal` · `ThemeSelector` · `TrackingModeModal` · `TrackingModeSelector`

### 없는 것 (6 — 전부 화면이다)

- `SettingsAboutScreen` (035, 085, 099, 112, 118, 120)
- `SettingsAccountDataScreen` (035, 058, 061, 118, 120)
- `SettingsPrivacyScreen` (062, 118, 120) — **`/settings/about` 위 2단 스택**
- `SettingsReleaseNotesScreen` (060, 118, 119, 120, 125)
- `SettingsFeatureGuideListScreen` (018, 060, 125)
- `SettingsFeatureGuideScreen` (125) — **위 목록과 개발 노트 둘이 공유하는 한 벌**

### 테스트가 하나도 없다

커밋된 14개에 대한 RN 테스트가 **한 파일도 없다**(jest 스위트 72개는 전부 이전 step 것이다).
웹 테스트 16개를 **명세로 읽고** 새로 써라 — 본문 «작업 6» 그대로다.

### 그 외

- step 0 이 규명한 **NativeWind transform 함정**을 기억하라(`migration/README.md` «4-0단계 결과»):
  조건부 `className` 에서 transform 이 첫 렌더에 없다가 나중에 생기면 **힙을 다 쓴다.** 두 상태
  모두 transform 을 갖게 하라(`rotate-0` ↔ `rotate-180`). 설정 화면에는 펼침 화살표가 여럿이다.
- step 1 이 에셋 코드젠을 끝냈다 — `feature-guides` 가 이제 **실제로 온다.** 안내 목록·상세가
  빈 화면이 아닌지 확인하라.
- AC 를 처음부터 끝까지 다시 돌려라.
