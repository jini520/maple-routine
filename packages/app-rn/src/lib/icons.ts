/**
 * 이 앱이 쓰는 lucide 아이콘 — **`className` 이 풀리도록 등록한 뒤** 다시 내보낸다
 * (등록의 원리와 매핑 근거는 `nativewind-interop.ts` 의 `withIconInterop`).
 *
 * ## 왜 `lucide-react-native` 인가
 *
 * 웹은 `lucide-react` 로 DOM `<svg>` 를 그린다. RN 판은 같은 아이콘 세트를 `react-native-svg` 로
 * 그리는 공식 포트이고, **버전을 웹과 같은 1.24.0 으로 고정**했다 — 그림이 갈리면 같은 아이콘이
 * 두 앱에서 다르게 보인다(`design-system.md` 「아이콘」· [[ADR-066]] 결정 3 이 lucide 규격을
 * 조건으로 단 것과 같은 이유).
 *
 * ## 목록을 한 파일에 모아 두는 이유
 *
 * 등록을 빼먹으면 **에러도 경고도 없이 클래스만 사라진다**(색·크기 없는 아이콘). 아이콘을 쓰는
 * 파일마다 등록을 흩어 두면 그 실패가 어디서 시작됐는지 알 수 없으므로, **import 자리를 여기
 * 하나로 좁힌다** — `lucide-react-native` 를 직접 import 하는 곳이 이 파일뿐이면 빠뜨릴 자리도 없다.
 *
 * ## 배럴이 아니라 **아이콘별 경로**로 가져온다 (실측)
 *
 * `import { Users } from 'lucide-react-native'` 는 배럴을 타고 **아이콘 1,900개를 전부** 그래프에
 * 넣는다. Metro 는 기본적으로 트리셰이킹을 하지 않으므로 그대로 번들에 실린다 — 같은 8개를 쓰는
 * 두 방식을 재 보면 이렇다(2026-08-12, `expo export --platform android`).
 *
 *   배럴   3,365 모듈 · 5.5 MB
 *   개별   1,626 모듈 · 3.7 MB   ← **1.8 MB 차이**
 *
 * OTA 로 나가는 앱이라 이 차이가 매 배포의 다운로드 크기가 된다([[ADR-092]]·[[ADR-093]] 이 웹에서
 * 재던 것과 같은 축). **여기 목록이 늘어도 배럴로 되돌리지 말 것.**
 *
 * 이름은 lucide 의 **정규 이름**(kebab-case 파일명)이다 — 웹이 쓰는 `AlertTriangle` 은 옛 별칭이라
 * 런타임 모듈이 없고(`icons/alert-triangle.mjs` 가 없다 — 타입 선언만 있다) 실물은
 * `triangle-alert` 다. 그림은 같고, 이 파일에서 웹과 같은 이름으로 다시 내보낸다.
 */

import ArrowLeft from 'lucide-react-native/icons/arrow-left'
import Ban from 'lucide-react-native/icons/ban'
import BookOpen from 'lucide-react-native/icons/book-open'
import Castle from 'lucide-react-native/icons/castle'
import Check from 'lucide-react-native/icons/check'
import ChevronDown from 'lucide-react-native/icons/chevron-down'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import CircleAlert from 'lucide-react-native/icons/circle-alert'
import CircleCheckBig from 'lucide-react-native/icons/circle-check-big'
import Clock from 'lucide-react-native/icons/clock'
import CloudDownload from 'lucide-react-native/icons/cloud-download'
import ExternalLink from 'lucide-react-native/icons/external-link'
import Eye from 'lucide-react-native/icons/eye'
import EyeOff from 'lucide-react-native/icons/eye-off'
import FileText from 'lucide-react-native/icons/file-text'
import Flag from 'lucide-react-native/icons/flag'
import Gamepad2 from 'lucide-react-native/icons/gamepad-2'
import Gauge from 'lucide-react-native/icons/gauge'
import Info from 'lucide-react-native/icons/info'
import KeyRound from 'lucide-react-native/icons/key-round'
import LayoutGrid from 'lucide-react-native/icons/layout-grid'
import ListChecks from 'lucide-react-native/icons/list-checks'
import MapPin from 'lucide-react-native/icons/map-pin'
import Medal from 'lucide-react-native/icons/medal'
import Minus from 'lucide-react-native/icons/minus'
import Moon from 'lucide-react-native/icons/moon'
import Plus from 'lucide-react-native/icons/plus'
import RefreshCw from 'lucide-react-native/icons/refresh-cw'
import RotateCcw from 'lucide-react-native/icons/rotate-ccw'
import Settings from 'lucide-react-native/icons/settings'
import Signal from 'lucide-react-native/icons/signal'
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal'
import Sparkles from 'lucide-react-native/icons/sparkles'
import Star from 'lucide-react-native/icons/star'
import Store from 'lucide-react-native/icons/store'
import Sun from 'lucide-react-native/icons/sun'
import Swords from 'lucide-react-native/icons/swords'
import TriangleAlert from 'lucide-react-native/icons/triangle-alert'
import Users from 'lucide-react-native/icons/users'
import X from 'lucide-react-native/icons/x'

import { withIconInterop } from './nativewind-interop'

/** 실패 토스트 — `Toast`(error). 웹의 `AlertCircle` 은 옛 별칭이고 실물이 `circle-alert` 다. */
export const AlertCircleIcon = withIconInterop(CircleAlert)
/** 실패·경고 — `ErrorState` · `StaleBanner` · `ErrorBoundary`. */
export const AlertTriangleIcon = withIconInterop(TriangleAlert)
/** 하위 페이지의 「뒤로」 — 설정 하위 화면 다섯([[ADR-118]] 결정 2 · [[ADR-120]] 결정 9). */
export const ArrowLeftIcon = withIconInterop(ArrowLeft)
/** 조회 불가 캐릭터 — `CharacterTrackingGrid`. */
export const BanIcon = withIconInterop(Ban)
/** 안내가 하나도 없을 때 — `SettingsFeatureGuideListScreen` 빈 상태([[ADR-060]]). */
export const BookOpenIcon = withIconInterop(BookOpen)
/** 에픽 던전 카테고리 — `ContentManageScreen` 그룹 헤더·행([[ADR-035]] 결정 18). */
export const CastleIcon = withIconInterop(Castle)
/** 선택 표식 — `CacheClearConfirm` 체크박스 · `ThemeSelector` 선택 타일. */
export const CheckIcon = withIconInterop(Check)
/** 성공 토스트 — `Toast`(success). 웹의 `CheckCircle2` 실물은 `circle-check-big` 이다. */
export const CheckCircle2Icon = withIconInterop(CircleCheckBig)
/** 드롭다운 화살표 — `CharacterSelectDropdown`. */
export const ChevronDownIcon = withIconInterop(ChevronDown)
/** "누르면 무언가 열린다" — `SettingsRow` · 안내 목록 행 · 개발 노트 항목([[ADR-118]] 결정 4). */
export const ChevronRightIcon = withIconInterop(ChevronRight)
/** 아직 집계 전(pending 톤) — `UnavailableNotice`. */
export const ClockIcon = withIconInterop(Clock)
/** 새 업데이트 있음 — `UpdatePromptModal`(update-available). */
export const CloudDownloadIcon = withIconInterop(CloudDownload)
/** 앱 밖으로 나가는 이동 — `ApiKeyForm` 의 두 링크([[ADR-110]]). */
export const ExternalLinkIcon = withIconInterop(ExternalLink)
/** API 키 표시 토글(가림 상태) — `ApiKeyForm`. */
export const EyeIcon = withIconInterop(Eye)
/** API 키 표시 토글(표시 상태) — `ApiKeyForm`. */
export const EyeOffIcon = withIconInterop(EyeOff)
/** 기록된 변경 내역이 없을 때 — `SettingsReleaseNotesScreen` 빈 상태([[ADR-060]]). */
export const FileTextIcon = withIconInterop(FileText)
/** 길드 카테고리 — `ContentManageScreen` 그룹 헤더·행. */
export const FlagIcon = withIconInterop(Flag)
/** 자동 트래킹 모드 — `TrackingModeStep`([[ADR-035]] 결정 22: "게임에서 정한 것을 따른다"). */
export const Gamepad2Icon = withIconInterop(Gamepad2)
/** 호출 한도 초과 — `ApiKeyNoticeModal`(rateLimited). 타이머 계열을 피한 근거는 그 파일에 있다. */
export const GaugeIcon = withIconInterop(Gauge)
/** 조회 불가(정보 톤) — `UnavailableNotice` · 정보 토스트 `Toast`(info). */
export const InfoIcon = withIconInterop(Info)
/** API 키 무효 — `ApiKeyNoticeModal`(invalid). */
export const KeyRoundIcon = withIconInterop(KeyRound)
/** 메이플 유니온 카테고리 — `ContentManageScreen` 그룹 헤더·행. */
export const LayoutGridIcon = withIconInterop(LayoutGrid)
/** 수동 트래킹 모드 — `TrackingModeStep`([[ADR-035]] 결정 22: "앱에서 고른다"). */
export const ListChecksIcon = withIconInterop(ListChecks)
/** 일일/주간 퀘스트 카테고리 — `ContentManageScreen` 그룹 헤더·행. */
export const MapPinIcon = withIconInterop(MapPin)
/** 무릉도장 카테고리 — `ContentManageScreen` 그룹 헤더·행. */
export const MedalIcon = withIconInterop(Medal)
/** 파티원 수 감소 — `PartySizeStepper`. */
export const MinusIcon = withIconInterop(Minus)
/** 다크 테마 표식 — `ThemeSelector` 타일([[ADR-104]] 결정 2). */
export const MoonIcon = withIconInterop(Moon)
/** 파티원 수 증가 — `PartySizeStepper`. */
export const PlusIcon = withIconInterop(Plus)
/** 토스트 액션의 기본 아이콘('다시 시도' 전제 — [[ADR-063]]) — `Toast`. */
export const RefreshCwIcon = withIconInterop(RefreshCw)
/** '다시 시작' — `ErrorBoundary` 폴백. */
export const RotateCcwIcon = withIconInterop(RotateCcw)
/** 토스트 액션이 기본 아이콘을 덮을 수 있음을 지키는 자리 — `Toast` 테스트([[ADR-063]]). */
export const SettingsIcon = withIconInterop(Settings)
/** 모바일 데이터 확인 — `UpdatePromptModal`(confirm-cellular). */
export const SignalIcon = withIconInterop(Signal)
/** 솔로·파티 필터가 가린 빈 상태 — `BossScreen`([[ADR-060]] 결정 2 의 컨텍스트 아이콘). */
export const SlidersHorizontalIcon = withIconInterop(SlidersHorizontal)
/** 고가 드롭 반짝임 — `ValuableDropBadge` · 업데이트 완료 안내 `UpdatePromptModal`(updated). */
export const SparklesIcon = withIconInterop(Sparkles)
/** 즐겨찾기(추적 중) 표식 — `CharacterTrackingGrid`. */
export const StarIcon = withIconInterop(Star)
/** 스토어 업데이트 필요 — `UpdatePromptModal`(store-required). */
export const StoreIcon = withIconInterop(Store)
/** 라이트 테마 표식 — `ThemeSelector` 타일([[ADR-104]] 결정 2). */
export const SunIcon = withIconInterop(Sun)
/** 몬스터파크 카테고리 — `ContentManageScreen` 그룹 헤더·행. */
export const SwordsIcon = withIconInterop(Swords)
/** 파티원 표식 — `PartySizeStepper`(compact) · 파티 인원 라벨 `PartySizeModal`. */
export const UsersIcon = withIconInterop(Users)
/** 닫기 — `Toast` · `PartySizeModal`. */
export const XIcon = withIconInterop(X)
