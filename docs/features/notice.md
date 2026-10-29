# 공지

운영자가 쓰는 앱 공지와 넥슨이 올리는 게임 공지를 보여 준다. 공지는 today 배너 · 더보기 첫 화면 · 알림 탭
세 곳에서 열린다. 왜 이렇게 만들었는지는 [[ADR-057]] 에 있다. 공지 알림의 구독과 권한은
[notifications.md](./notifications.md) 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `types/notice.ts` | `Notice` · `NoticeKind`(다섯) · `NoticeBlock` · `NoticeLookup` |
| `server/notices.ts` | 우리 서버의 앱 공지 목록 · 상세 조회. 실패와 빈 응답을 나눈다 |
| `nexon/notice/client.ts` | 넥슨 공지 넷의 목록 · 상세 조회와 `Notice` 변환 |
| `nexon/notice/contents.ts` | 넥슨 본문 HTML 을 블록으로 바꾼다(`parseContents`) |
| `features/notice/notice-feed.ts` | 분류마다 받아 사본을 바꾼다 · 상세를 서버와 넥슨으로 나눠 부른다 |
| `features/notice/notice-copy.ts` | 조회 결과를 사본과 배너의 닫은 기록에 반영 |
| `features/notice/notice-display.ts` | 화면에 적는 제목 · 기간 · 빈 문구 · 배너 비율 |
| `features/notice/format.ts` | 발행일 표기(`2026. 9. 10.`) |
| `features/notice/receive.ts` | 푸시 `data` 를 공지로 읽는다 |
| `features/notice/use-notice-delivery.ts` | 공지 푸시가 앱에 닿는 세 경우 |
| `features/notice/pick-banner-notice.ts` · `banner-store.ts` | today 배너에 띄울 공지 |
| `storage/notices.ts` | 분류별 공지 사본 |
| `storage/notice-banner.ts` | 배너에서 닫은 공지 id |
| `app/today/NoticeBanner.tsx` | today 공지 배너 |
| `app/settings/SettingsScreen.tsx` | 더보기. 소식 섹션 다섯 |
| `app/settings/NoticeBannerRail.tsx` · `notice-banner-motion.ts` | 이벤트 · 캐시샵 배너 넘기기와 점. 숨은 칸과 점은 다시 그리지 않게 만든다([[ADR-057]] 결정 12) |
| `app/settings/NoticeBannerArt.tsx` · `NoticeBannerCard.tsx` · `NoticeLines.tsx` · `NoticeSkeleton.tsx` | 배너 칸 · 목록 카드 · 글 줄 · 스켈레톤 |
| `app/settings/SettingsNoticesScreen.tsx` | 분류별 목록 화면(`/settings/notices`) |
| `app/settings/SettingsNoticeDetailScreen.tsx` · `NoticeBlocks.tsx` | 상세 화면(`/settings/notices/detail`)과 본문 블록 |
| `navigation/AppNavigation.tsx` | 알림 탭으로 연 상세를 스택이 준비된 뒤에 연다 |
| `maple-routine-server` 의 `src/modules/notices/` · `src/modules/push/push-text.ts` | 넥슨 목록 수집 · 알림 발송 · 알림 문구 |

## 분류

| 분류 | 더보기 섹션 이름 | 받는 곳 | 더보기에서 보여 주는 것 |
|---|---|---|---|
| `app` | `NOTICE` | 우리 서버 `GET /v1/notices?limit=20&kind=app` | 최근 글 3줄 |
| `event` | `진행 중인 이벤트` | 넥슨 `/maplestory/v1/notice-event` | 배너 넘기기 |
| `cashshop` | `캐시샵 업데이트` | 넥슨 `/maplestory/v1/notice-cashshop` | 배너 넘기기 |
| `game` | `공지 사항` | 넥슨 `/maplestory/v1/notice` | 최근 글 3줄 |
| `update` | `업데이트` | 넥슨 `/maplestory/v1/notice-update` | 최근 글 2줄 |

넥슨 공지는 사용자의 API 키로 받는다. 키가 없으면 넥슨 넷은 받지 않고 사본을 그린다.

## 받기와 사본

| 언제 | 받는 것 |
|---|---|
| 더보기에 들어올 때 | 다섯 분류 모두. 실패해도 알리지 않는다 |
| 더보기 · 목록 화면을 당길 때 | 보던 분류. 전부 실패하면 `소식을 불러오지 못했습니다` |
| 목록 화면을 열 때 | 그 분류 |
| 상세 화면을 열 때 | 그 공지의 상세 |
| today 를 당길 때 · 포그라운드에서 공지 푸시가 올 때 | 앱 공지 20건 |

| 조회 결과 | 사본(Preferences `notices`) |
|---|---|
| 성공 | 그 분류를 응답으로 통째로 바꾼다 |
| 빈 목록 | 그 분류를 비운다 |
| 실패 | 그대로 둔다. 화면은 사본을 그린다 |

상세 본문(블록)과 푸시 내용은 기기에 저장하지 않는다.

## 상세 화면

| 상태 | 화면 |
|---|---|
| 조회 전 | 사본의 공지. 본문이 비었으면 `본문을 받는 중이에요` |
| 조회 성공 | 받은 공지. 블록이 있으면 블록을 그린다 |
| 조회 실패 | 사본의 공지. 본문이 비었으면 `본문을 받지 못했어요` |
| 없음(서버 404 · 넥슨 400 `OPENAPI00004`) · 사본에도 없음 | `공지를 찾을 수 없습니다`. 사본과 닫은 기록에서 뺀다 |
| `link` 가 있을 때 | `자세히 보기` 가 인앱 브라우저로 연다 |

헤더 제목은 그 공지의 제목이고 줄을 바꿔 전부 적는다. 찾는 중이거나 찾지 못했으면 `공지사항` 이다.

| 분류 | 날짜 · 링크 줄 | 본문 |
|---|---|---|
| 앱 공지 · 게임 공지 · 업데이트 | 본문 카드 위. 왼쪽에 발행일, 오른쪽에 `자세히 보기` | 카드 안 |
| 이벤트 · 캐시샵 | 그림 위. 왼쪽에 기간(없는 이벤트는 발행일), 오른쪽에 `자세히 보기` | 카드 없이 화면 폭 전체 |

목록 화면의 이벤트 · 캐시샵 카드는 그림 · 제목 · 기간이다. 테두리와 구분선은 없다.

그림은 `expo-image` 로 그려 기기에 남긴다. 본문 그림을 받는 동안에는 목록의 배너 그림을 그 자리에 깐다.
본문 HTML 에서 화면에 안 보이는 글자(그림 위의 투명 글자)와 업데이트 맨 위의 목차는 버린다.

## today 배너

| 동작 | 결과 |
|---|---|
| today 에 들어올 때 | 기기의 사본에서 가장 최근 앱 공지 하나를 고른다. 그것을 닫았으면 배너가 없다 |
| 헤더를 누를 때 | 본문 두 줄과 버튼 둘을 펼치거나 접는다 |
| `다시 보지 않기` | 그 공지를 배너에서 닫는다. 목록과 상세에는 남는다 |
| `자세히 보기` | 상세 화면을 연다 |

today 의 다른 위젯은 [[ADR-058]] 에 있다.

## 공지 알림

| 앱 상태 | 공지 푸시가 오면 |
|---|---|
| 포그라운드 | 알림이 뜨지 않는다. today 배너가 서버에 다시 묻는다 |
| 백그라운드 · 꺼짐에서 탭 | 상세 화면을 연다 |
| 백그라운드 · 꺼짐에서 도착만 | 앱은 모른다. 다음 조회에서 들어온다 |

서버는 1분마다 넥슨 목록을 받아 새 글만 알린다. 이벤트는 썬데이 메이플만 알린다.

| 분류 | 알림 제목 | 알림 내용 |
|---|---|---|
| `app` | 운영자가 쓴 알림 제목. 없으면 공지 제목 | 운영자가 쓴 알림 내용. 없으면 공지 본문 |
| `game` | `새 공지 사항이 올라왔어요.` | 공지 제목 |
| `update` | `새 업데이트를 확인해보세요.` | 공지 제목 |
| `event` | `새로운 이벤트가 시작돼요.` | 공지 제목 |
| `cashshop` | `캐시 아이템이 업데이트 됐어요.` | 앞의 날짜를 뗀 공지 제목 |
