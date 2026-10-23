# 로그인

넥슨을 부를 인증 수단을 받아 기기에 저장하고, 그 수단으로 더 조회할 수 없게 되면 사용자에게 알려 다시
로그인하게 한다. 인증 수단은 API 키와 넥슨 로그인 두 가지다. API 키에 관한 결정은 [[ADR-024]],
넥슨 로그인에 관한 결정은 [[ADR-025]] 에 있다.

넥슨 로그인 입구는 `NEXON_LOGIN_ENABLED` 로 켜고 끈다. 넥슨의 프로덕션 승인이 나서 지금은 켜져 있다
(`true`). 그래서 사용자는 넥슨 로그인과 API 키 중 하나를 고른다.

앱을 켰을 때 어느 화면이 나오는지는 [[ADR-026]], 키 발급 안내 사이트는 [[ADR-015]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `app/auth/SignInScreen.tsx` | 로그인 화면. 머리 · 넥슨 블록 · 키 블록 |
| `app/auth/ApiKeyForm.tsx` | 키 입력 블록. 접고 펼치기 · 표시 토글 · 링크 둘 |
| `app/auth/DevelopmentStageKeyModal.tsx` | 개발 단계 키를 막았을 때 폼 위에 뜨는 모달 |
| `app/auth/ApiKeyNoticeModal.tsx` | 저장된 수단으로 조회할 수 없을 때 어느 화면에서든 뜨는 모달 |
| `app/auth/api-key-links.ts` | 키 발급 안내 주소와 넥슨 오픈 API 주소. 폼과 모달이 함께 쓴다 |
| `features/auth/state.ts` | `AuthStatus` · `AuthError` · `ApiKeyNoticeKind` 와 리듀서 |
| `features/auth/store.ts` | `signIn` · `noticeApiKeyIssue` · `confirmApiKeyNotice` · `signInWithNexonAccount` · `signOutNexonLogin` · `signOut` |
| `features/auth/format.ts` | 키 입력 실패 토스트 문구(`formatAuthError`) |
| `features/auth/use-api-key-notice.ts` | 조회 오류를 알림으로 넘기는 훅 |
| `features/auth/nexon-login.ts` | 넥슨 로그인 한 번(`signInWithNexon`) |
| `features/auth/prune-covered-keys.ts` | 로그인 뒤 같은 계정의 키를 지운다 |
| `features/auth/nexon-login-enabled.ts` | `NEXON_LOGIN_ENABLED`. 넥슨 로그인 입구를 켜고 끈다 |
| `features/auth/saved-key.ts` | 저장된 첫 키 읽기 · 넥슨 로그인이 있는지 확인 |
| `features/auth/current-credential.ts` | 넥슨을 부르기 직전에 저장된 설정에서 자격을 고른다 |
| `features/auth/server-identity.ts` | 우리 서버에 보낼 신원 헤더(`Authorization: Bearer` 또는 `x-api-key-hash`) |
| `lib/nexon-credential.ts` | 저장된 설정에서 자격을 고르는 순수 함수 |
| `lib/covered-keys.ts` | 로그인이 모두 포함하는 키를 고르는 판정 |
| `nexon/key-stage.ts` | 키가 개발 단계인지 확인하는 판정(`probeApiKeyStage`) |
| `nexon/errors.ts` | `isInvalidApiKeyError` · `NexonSignInRequiredError` |
| `nexon/developer-keys.ts` | 로그인 사용자가 프렌즈 밖 경로에 쓰는 개발자 키 둘 |
| `server/nexon-auth.ts` | 로그인 시작 · 세션 받기 · 세션 거두기 |
| `storage/api-key.ts` | 인증 수단 목록 저장(`getAuthConfig` · `setApiKey` · `setNexonLogin` · `removeApiKey` · `clearNexonLogin` · `clearAuthConfig`) |
| `components/molecules/NexonLoginButton/` | 넥슨이 준 이미지 한 장으로 만든 로그인 버튼 |
| `native/browser.ts` | 앱이 여는 웹 주소를 인앱 브라우저로 연다. 못 열면 시스템 브라우저로 넘긴다 |
| `app/settings/SettingsScreen.tsx` | 더보기 탭 맨 위 넥슨 로그인 버튼 |
| `app/settings/SettingsAccountDataScreen.tsx` · `app/settings/SignOutConfirm.tsx` | 넥슨 로그아웃 줄과 확인 모달 |

## 저장하는 것

| 수단 | 개수 | 저장하는 값 |
|---|---|---|
| 넥슨 로그인 | 0 ~ 1 | 우리 서버가 발급한 세션. 넥슨 토큰은 서버에만 있다 |
| API 키 | 0 이상 | 키 값과 이름(`label`). 이름은 사용자가 붙이지 않으면 비어 있다 |

둘 다 없으면 로그인 화면이 나오고, 하나라도 있으면 앱이 열린다. 넥슨을 부를 때는 로그인이 있으면 로그인을,
없으면 첫 번째 키를 쓴다.

## 로그인 화면

| 블록 | 입구가 꺼져 있을 때(지금) | 입구가 켜져 있을 때 |
|---|---|---|
| 머리 | 앱 아이콘 · `내 메이플 스토리 스케줄 정보 조회를 위해서` · `API 키 입력이 필요해요.` | 둘째 줄이 `로그인 또는 API 키 입력이 필요해요.` |
| 넥슨 | 없음 | `게임 데이터 활용 로그인으로 시작하기` · `게임 데이터 활용 로그인이란?` · 로그인 버튼 |
| API 키 | 펼친 채로 보인다. 머리는 누를 수 없다 | 접힌 채로 보인다. 머리를 누르면 펼쳐진다 |

키 블록을 펼치면 다음이 나온다.

| 항목 | 동작 |
|---|---|
| 입력칸 | 기본은 가림. 오른쪽 눈 아이콘으로 보이게 한다. 자동 대문자 · 자동 수정 · 맞춤법 검사는 끈다 |
| `openapi.nexon.com에서 확인` | 넥슨 오픈 API 를 인앱 브라우저로 연다 |
| `확인` | 키를 검증한다. 검증하는 동안 폼은 그대로 두고 버튼만 스피너로 바뀐다 |
| `API 키 발급 방법 보기` | 키 발급 안내 사이트(`mapleroutine.store/api-key`)를 인앱 브라우저로 연다 |
| 안내 문구 | `입력한 키는 이 기기에만 저장되고, 넥슨 밖으로는 키 자체가 나가지 않아요` |

로그인 화면으로 돌아왔을 때 저장된 키가 있으면 입력칸에 채워 둔다.

## 키를 넣으면

| 결과 | 사용자가 보는 것 |
|---|---|
| 검증 성공 · 개발 단계 아님 | `API 키를 확인했어요` 토스트. 다음 단계로 간다 |
| 무효 키 | `API 키가 유효하지 않습니다` 토스트. 폼이 그대로 있다 |
| 429 | `호출 한도를 초과했습니다` 토스트 |
| 네트워크 오류 | `네트워크 오류가 발생했습니다` 토스트 |
| 저장 실패 | `기기에 저장하지 못했습니다. 다시 시도해주세요` 토스트 |
| 개발 단계 키 | 토스트 없이 `이 키로는 연결할 수 없습니다` 모달. 닫으면 폼으로 돌아간다 |

## 저장된 수단으로 조회할 수 없게 되면

앱을 쓰다가 조회가 아래 셋 가운데 하나로 실패하면, 지금 화면 위에 닫을 수 없는 모달이 뜬다. `확인` 을 누르면
더 쓸 수 없게 된 수단만 지운다. 남은 수단이 있으면 앱을 계속 쓰고, 없으면 로그인 화면으로 간다.

| 원인 | 제목 | 본문 | 확인을 누르면 지우는 것 |
|---|---|---|---|
| 무효 키 | `API 키가 더 이상 유효하지 않습니다` | `키 입력 화면으로 이동합니다.` | 실패한 키 하나 |
| 429 | `호출 한도를 초과했습니다` | `서비스 단계 키로 다시 입력해주세요.` | 실패한 키 하나 |
| 넥슨 로그인 만료 | `넥슨 로그인이 만료됐습니다` | `다시 로그인해주세요.` | 넥슨 로그인 |

키를 다시 넣으면 추적 캐릭터를 다시 묻지 않고 앞서 하던 단계로 돌아간다. 새 키에 저장된 추적 캐릭터가
하나도 없으면 캐릭터 설정부터 다시 한다.

## 넥슨 로그인 (입구가 켜져 있을 때)

| 위치 | 언제 보이나 |
|---|---|
| 로그인 화면 넥슨 블록 | 늘 |
| 더보기 탭 맨 위 | 넥슨 로그인이 없을 때 |

| 결과 | 사용자가 보는 것 |
|---|---|
| 성공 | `넥슨 계정을 연결했어요` 토스트. 같은 계정의 API 키는 지운다 |
| 실패 | `넥슨 로그인에 실패했습니다` 토스트 |
| 사용자가 창을 닫음 | 아무 일도 없다 |
| 로그인은 됐지만 캐릭터 목록을 못 받음 | 토스트 없이 앱을 열지 않는다 |

## 로그아웃과 연결 해제

둘 다 설정의 `계정 및 데이터` 화면에 있다. `넥슨 로그아웃` 은 넥슨 로그인이 있을 때만 보인다.

| | 확인 모달 | 지우는 것 | 남기는 것 |
|---|---|---|---|
| 넥슨 로그아웃 | `로그아웃할까요?` · 주 버튼 `로그아웃` | 넥슨 로그인(서버 세션 포함) | API 키 · 앱 데이터 |
| 연결 해제 | `연결을 해제할까요?` · 주 버튼 `취소` | 인증 수단 전부 | 앱 데이터 |

로그아웃 뒤에 수단이 하나도 남지 않으면 로그인 화면으로 간다.
