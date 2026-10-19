# 앱 진입

앱을 켰을 때 어느 화면이 뜨는지, 탭이 열리기 전에 거치는 온보딩 화면, 앱을 새로 켰을 때 첫 화면을 어떻게
채우는지를 다룬다. 온보딩 순서와 스택은 [[ADR-026]] 에, 새로 켰을 때의 규칙은 [[ADR-027]] 에 이유가 있다.

로그인 화면의 내용은 `features/auth.md`([[ADR-024]] · [[ADR-025]]), 캐릭터를 고르는 본문은
`features/character.md`([[ADR-029]]), MVP 등급 카드는 `features/mvp-grade.md`([[ADR-050]]) 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `features/app-entry/stage.ts` | `EntryStage` 와 저장된 값에서 단계를 정하는 `deriveEntryStage` |
| `features/app-entry/store.ts` | 부팅(`resolveFromStorage`) · 로그인 직후(`resolveAfterSignIn`) · 캐릭터 설정 완료(`completeCharacterSetup`) · MVP 온보딩 완료(`finishMvpOnboarding`) |
| `navigation/RootNavigator.tsx` | `ready` 가 아니면 온보딩 화면 넷을, `ready` 면 탭과 하위 페이지를 등록한다 |
| `app/auth/SignInScreen.tsx` | 로그인 화면. 부팅이 찾은 단계까지 스택을 다시 쌓는다 |
| `app/character-setup/CharacterSetupScreen.tsx` | 캐릭터 설정 화면. 제목 · `계속하기` · 최소 1개 조건 · 저장 배선만 있고 본문은 `CharacterManageBody` 다 |
| `app/mvp-grade/MvpGradeOnboarding.tsx` | MVP 등급 고르기 · 확인 화면 |
| `components/templates/EntryScroll/EntryScroll.tsx` | 온보딩 화면의 스크롤과 아래 고정 버튼 줄, 뒤로가기 버튼이 있는 헤더 줄 |
| `features/mvp-grade/onboarding.ts` | MVP 화면으로 갈지 정하는 `needsMvpOnboarding` |
| `storage/mvp-grade-prefs.ts` | MVP 화면에서 꺼졌는지 표시하는 `mvpOnboardingPending` |
| `features/auth/saved-key.ts` | 로그인 화면에 채울 저장된 키(`loadSavedApiKey`) |
| `features/tracking-mode/seed.ts` | 수동 모드일 때 체크리스트를 채우는 `seedManualTrackedContent` |
| `app/AppShell.tsx` | 부팅 때 진입 단계를 정하고, 앱이 열리면 탭 스토어를 미리 읽는다 |
| `app/prehydrate.ts` · `features/prehydrate.ts` | 탭 스토어 셋을 차례대로 미리 읽는 `prehydrateTabStores` |

## 진입 단계

```
signIn → characterSetup → mvpGrade → ready
```

`EntryStage` 는 온보딩을 어디까지 끝냈는지를 나타낸다. 부팅과 로그인 직후에 저장된 값을 보고 정한다.

| 저장된 값 | 진입 단계 | 뜨는 화면 |
|---|---|---|
| 인증 설정이 없다 | `signIn` | 로그인 |
| 추적 캐릭터가 없거나 빈 배열이다 | `characterSetup` | 로그인 위에 캐릭터 설정 |
| `mvpOnboardingPending` 이 켜져 있다 | `mvpGrade` | 로그인 · 캐릭터 설정 위에 MVP 등급 고르기 |
| 그 밖 | `ready` | 탭 |

로그인했는지는 `features/auth` 의 `AuthStatus` 가 따로 관리한다. 진입 단계는 그 위에 캐릭터와 MVP 등급을
골랐는지를 더해 화면을 정한다. 로그아웃하면 `reset` 으로 `signIn` 에 돌아간다.

## 온보딩 화면

| 화면 | 라우트 | 다음으로 | 뒤로 |
|---|---|---|---|
| 로그인 | `SignIn` | 로그인이 성공하면 `CharacterSetup` 을 push | 안드로이드 뒤로 버튼을 누르면 앱이 백그라운드로 간다 |
| 캐릭터 설정 | `CharacterSetup` | `계속하기`. 물어볼 메이플 ID 가 있으면 `MvpGradePick` 을 push, 없으면 앱을 연다 | 로그인 |
| MVP 등급 고르기 | `MvpGradePick` | `다음` 으로 `MvpGradeConfirm` 을 push | 캐릭터 설정 |
| MVP 등급 확인 | `MvpGradeConfirm` | `시작하기` 로 저장하고 앱을 연다 | MVP 등급 고르기 |

- 네 화면은 한 스택에 있어서 기기 뒤로가기와 헤더 줄의 뒤로가기 버튼이 모두 동작한다. 로그인 화면에는
  뒤로가기 버튼이 없다.
- 로그인 화면으로 돌아오면 저장된 키가 입력칸에 채워져 있다.
- 앱이 열리면(`ready`) 스택 전체가 탭으로 바뀌고, 온보딩 화면으로는 돌아가지 않는다.
- 스케줄 관리 방법(자동 · 수동)은 온보딩에서 묻지 않는다. 고른 적이 없으면 자동으로 동작하고, 설정에서
  바꾼다.

## 캐릭터 설정 화면

제목은 `관리할 캐릭터를 선택해주세요` 다. 본문은 설정의 캐릭터 관리 화면과 같은 `CharacterManageBody` ·
`useCharacterManage` 를 쓰고, 어떻게 고르는지는 [[ADR-029]] 에 있다.

| 상태 | 동작 |
|---|---|
| 아무도 고르지 않았다 | `계속하기` 가 꺼져 있다 |
| 저장 중 | `계속하기` 에 스피너가 돌고 꺼진다 |
| 수동 모드라 체크리스트를 채우는 중 | 화면 전체가 스피너와 `체크리스트를 준비하고 있어요` 로 바뀐다 |
| 후보 · 계정 조회가 429 | 키 재입력 안내 모달이 뜬다([[ADR-024]]) |
| 후보 · 계정 조회가 401 | 모달 없이 이 화면의 오류로 남고 `다시 시도` 를 준다([[ADR-024]]) |

`계속하기` 를 누르면 고른 순서대로 추적 캐릭터를 저장하고, 그다음 대표 캐릭터를 쓴다. 이때 알림 권한도
한 번 묻는다([[ADR-057]]).

## 앱을 새로 켰을 때

| 상황 | 동작 |
|---|---|
| 탭 스토어가 추적 목록을 아직 읽지 않았다(`null`) | 빈 상태가 아니라 로딩을 그린다 |
| 앱이 열렸다(`ready`) | 컨텐츠 → 보스 → 보스 수익 스토어를 차례대로 미리 읽는다. 하나가 실패해도 나머지를 읽는다 |
| 미리 읽는 중에 화면도 같은 스토어를 읽는다 | 진행 중인 회차 하나로 합친다 |
| 캐시가 있다 | 캐시로 먼저 그리고, 새 응답이 오면 덮어쓴다 |
| 캐시 없이 캐릭터 후보 목록을 연다 | 확인된 캐릭터부터 목록에 넣는다. 한 명도 확인하지 못했으면 빈 목록을 보내지 않는다 |
| 후보를 받다가 401 · 403 · 429 가 났다 | 그 뒤로는 목록을 보내지 않고 오류를 넘긴다 |
