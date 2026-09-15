/**
 * 문의 메일 주소. 받는 사람 · 제목 · 본문(버그 신고 안내와 기기 정보 줄)이 채워진 `mailto:` 다.
 *
 * 서버로 보내지 않고 메일 앱을 연다. 사용자가 자기 메일로 직접 보내는 것이라 스토어 설명의 `운영자에게 전송되지
 * 않습니다` 와 개인정보 처리방침이 그대로다.
 *
 * 플랫폼 분기를 화면에 인라인으로 적지 않고 여기 두는 이유는 두 갈래를 다 재기 위해서다.
 */

export const CONTACT_EMAIL = 'support.mapleroutine@gmail.com'

const SUBJECT = '[메이플 루틴 문의]'

/** 문의 페이지(`site/support.md`)의 `버그를 신고하실 때` 를 줄인 안내. */
const BODY_LINES = [
  '(문의 내용을 적어 주세요)',
  '',
  '',
  '',
  '----',
  '버그를 신고하실 때는 어느 화면에서 무엇을 했는지와',
  '화면 캡처를 함께 보내 주세요.',
  'API 키가 보이면 가려 주세요.',
  '',
]

/** 본문 끝 줄에 적는 기기 정보. API 키 · 캐릭터 정보는 들지 않는다. */
export interface ContactDevice {
  platform: string
  /** 화면이 보이는 앱 버전(`useRunningAppVersion`). `package.json` 은 OTA 버전이라 스토어 바이너리와 따로 움직인다 */
  appVersion: string
  osVersion: string
  /** 안드로이드 모델명. iOS 는 네이티브 모듈 없이 못 읽어 `null` 이다 */
  model: string | null
}

/** `Platform` 에서 쓰는 칸만. 테스트가 두 플랫폼 값을 넘기려고 좁혔다. `constants` 의 모양은 플랫폼마다 달라 읽는 자리에서 가른다. */
export interface PlatformLike {
  OS: string
  Version: string | number
  constants: object
}

/**
 * 플랫폼 값에서 기기 정보를 읽는다.
 *
 * 안드로이드의 `Platform.Version` 은 API 레벨 숫자라 버전 이름인 `constants.Release` 를 쓴다. 모델명은 안드로이드만
 * RN 코어(`constants.Model`)로 읽힌다. iOS 모델명은 `expo-device` 가 필요해 다음 스토어 릴리스에 더한다(네이티브
 * 모듈을 더하면 지문이 바뀌어 이미 나간 바이너리가 OTA 를 못 받는다).
 */
export function contactDeviceOf(platform: PlatformLike, appVersion: string): ContactDevice {
  if (platform.OS === 'android') {
    const constants = platform.constants as { Release?: string; Model?: string }
    return {
      platform: platform.OS,
      appVersion,
      osVersion: constants.Release ?? String(platform.Version),
      model: constants.Model ?? null,
    }
  }
  return { platform: platform.OS, appVersion, osVersion: String(platform.Version), model: null }
}

const OS_NAME: Record<string, string> = { ios: 'iOS', android: 'Android' }

/** `앱 1.0.10 / SM-F711N / Android 15`. 모델명이 없거나 빈 글자면 그 칸을 뺀다. */
export function contactDeviceLine(device: ContactDevice): string {
  const os = `${OS_NAME[device.platform] ?? device.platform} ${device.osVersion}`
  const model = device.model === null || device.model === '' ? [] : [device.model]
  return [`앱 ${device.appVersion}`, ...model, os].join(' / ')
}

/** 제목과 본문은 인코딩한다. 한글 · 줄바꿈 · `&` 가 날것으로 들어가면 메일 앱이 주소를 중간에서 자른다. */
export function contactMailUrl(device: ContactDevice): string {
  const body = [...BODY_LINES, contactDeviceLine(device)].join('\n')
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`
}
