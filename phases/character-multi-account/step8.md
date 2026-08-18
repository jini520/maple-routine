# Step 8: onboarding-step

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/features/onboarding.md` 전문** — 특히 「단계는 앱마다 다르다」 표와 「추적 캐릭터 선택 단계」
- **`/docs/adr/ADR-143.md` 결정 1·7·10** · **`/docs/adr/ADR-144.md` 결정 1**
- `/docs/ADR.md` 에서 **[[ADR-035]] 결정 13·15 · [[ADR-086]] 결정 7·8 · [[ADR-016]] · [[ADR-113]] ·
  [[ADR-116]] 결정 3** 만
- 코드: `packages/app-rn/src/app/onboarding/`(`OnboardingScreen`·`AccountSelectionList`·
  `ContentCharacterStep`·`TrackingModeStep`·`ApiKeyForm`) · `packages/app-rn/src/app/settings/`
  (`AccountModal`·`AccountFlowStatus`) · 각 `__tests__/`
- **step 2 산출물**: 계정 범위 플래그와 재개 파생 · **step 6 산출물**: 캐릭터 관리 화면 본문

## 작업

### 1. 온보딩이 세 단계가 된다

`OnboardingScreen` 의 `status` switch 에서:

- **`selectingContentCharacters`** 는 step 6 이 만든 **캐릭터 관리 본문**을 페이지로 그린다.
  머리는 제목 블록(«관리할 캐릭터를 선택해주세요» + 보조문 — 다른 온보딩 단계와 같은 모양),
  CTA 는 **「계속하기」 하나**(0개면 비활성, [[ADR-086]] 결정 7).
- **`selectingAccount`·`prefetching` 은 RN 에서 도달할 수 없는 상태**가 됐다(step 2). 그 case 는
  남겨 두되(리듀서를 안 고쳤으므로 타입상 존재한다) **화면은 그리지 않아도 된다** — 어떻게 처리했는지
  summary 에 적어라.
- **「계정 다시 선택」 탈출구(`emptyAction`)를 없앤다** — 계정을 고르는 단계가 없으므로 그 목적지가
  사라졌다([[ADR-143]] 결정 10). 그 자리의 출구는 드롭다운이다.

### 2. RN 에서 죽은 화면을 지운다

- `app/onboarding/AccountSelectionList.tsx`
- `app/settings/AccountModal.tsx` · `app/settings/AccountFlowStatus.tsx`
- 그 테스트·스냅샷
- 설정 하위 페이지에서 「계정 변경」 카드를 뺀다(`SettingsAccountDataScreen` — 그 화면은 이제 카드
  하나다: 캐시 삭제 · 연결 해제)

**`packages/core` 의 `features/settings/store.ts` 계정 플로우와 `features/onboarding/use-account-probes.ts`
는 지우지 마라** — Capacitor 가 계속 쓴다(`docs/migration/README.md` 원칙 3).

### 3. 지운 것을 테스트가 지키게 하라

- 온보딩: `selectingContentCharacters` 에서 **드롭다운이 있는 본문**이 그려진다 ·
  CTA 가 「계속하기」다 · 0개면 비활성
- 설정: 「계정 변경」 행·모달이 **없다**
- 삭제한 파일을 import 하는 코드가 남아 있지 않다(타입 체크가 잡는다)

### 4. 문서 점검 (CLAUDE.md 프로세스)

`docs/features/onboarding.md`·`settings.md` 의 해당 절이 **구현 완료 상태**를 반영하는지 확인하고,
«구현 전» 표기를 정리하라. 문서를 새로 쓰라는 뜻이 아니라 **상태 표기만** 맞추는 것이다.

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-cma-onboarding
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `packages/core` 의 계정 플로우 코드를 **지우지 않았는가**(Capacitor 가 쓴다)
   - `packages/app-capacitor` 의 온보딩·설정을 건드리지 않았는가
   - 온보딩 본문이 step 6 의 컴포넌트를 **재사용**하는가(사본을 만들지 않았는가)
3. `phases/character-multi-account/index.json` 의 step 8 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "지운 파일 목록·도달 불가 상태 처리 방식·온보딩 본문 공유 방법·문서 상태 표기 갱신 여부"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`packages/core` 의 `features/settings` 계정 플로우·`use-account-probes`·`prefetch` 를 지우지 마라.**
  이유: Capacitor 앱이 패리티 도달까지 계속 배포된다.
- **온보딩용으로 본문을 복사하지 마라.** 이유: 같은 화면이 두 벌이 되면 반드시 갈라진다
  (지금 `CharacterTrackingGrid` 가 두 자리에서 공유되는 구조가 그 선례다).
- **`app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
