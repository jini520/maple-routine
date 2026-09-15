// 문의 메일 주소.
//
// 플랫폼 분기를 화면에 인라인으로 적으면 두 갈래 중 한쪽만 테스트가 볼 수 있다. 순수 함수라 양쪽을 다 잰다.
import { CONTACT_EMAIL, contactDeviceLine, contactDeviceOf, contactMailUrl } from '../contact-mail'

describe('contactDeviceOf', () => {
  // 안드로이드의 `Platform.Version` 은 API 레벨 숫자라 버전 이름을 따로 읽는다.
  it('안드로이드는 API 레벨이 아니라 버전 이름과 모델명을 읽는다', () => {
    expect(
      contactDeviceOf({ OS: 'android', Version: 35, constants: { Release: '15', Model: 'SM-F711N' } }, '1.0.10'),
    ).toEqual({ platform: 'android', appVersion: '1.0.10', osVersion: '15', model: 'SM-F711N' })
  })

  // iOS 모델명은 네이티브 모듈이 있어야 읽혀 다음 스토어 릴리스에 더한다.
  it('iOS 는 `Platform.Version` 이 곧 버전이고 모델명이 없다', () => {
    expect(contactDeviceOf({ OS: 'ios', Version: '18.5', constants: {} }, '1.0.10')).toEqual({
      platform: 'ios',
      appVersion: '1.0.10',
      osVersion: '18.5',
      model: null,
    })
  })
})

describe('contactDeviceLine', () => {
  it('안드로이드는 앱 버전 / 모델 / OS 버전이다', () => {
    expect(contactDeviceLine({ platform: 'android', appVersion: '1.0.10', osVersion: '15', model: 'SM-F711N' })).toBe(
      '앱 1.0.10 / SM-F711N / Android 15',
    )
  })

  it('iOS 는 모델 칸 없이 앱 버전 / OS 버전이다', () => {
    expect(contactDeviceLine({ platform: 'ios', appVersion: '1.0.10', osVersion: '18.5', model: null })).toBe(
      '앱 1.0.10 / iOS 18.5',
    )
  })

  it('모델명이 빈 글자면 그 칸을 뺀다', () => {
    expect(contactDeviceLine({ platform: 'android', appVersion: '1.0.10', osVersion: '15', model: '' })).toBe(
      '앱 1.0.10 / Android 15',
    )
  })
})

describe('contactMailUrl', () => {
  const url = contactMailUrl({ platform: 'android', appVersion: '1.0.10', osVersion: '15', model: 'SM-F711N' })
  const query = new URLSearchParams(url.slice(url.indexOf('?') + 1))

  it('받는 사람이 문의 주소다', () => {
    expect(url.startsWith(`mailto:${CONTACT_EMAIL}?`)).toBe(true)
    expect(CONTACT_EMAIL).toBe('support.mapleroutine@gmail.com')
  })

  it('제목은 `[메이플 루틴 문의]` 다', () => {
    expect(query.get('subject')).toBe('[메이플 루틴 문의]')
  })

  // 본문에는 문의 자리 · 버그 신고 안내 · 기기 정보 줄만 넣는다. API 키 · 캐릭터 정보는 안 넣는다.
  it('본문은 문의 자리 · 버그 신고 안내 · 기기 정보 줄이다', () => {
    expect(query.get('body')).toBe(
      [
        '(문의 내용을 적어 주세요)',
        '',
        '',
        '',
        '----',
        '버그를 신고하실 때는 어느 화면에서 무엇을 했는지와',
        '화면 캡처를 함께 보내 주세요.',
        'API 키가 보이면 가려 주세요.',
        '',
        '앱 1.0.10 / SM-F711N / Android 15',
      ].join('\n'),
    )
  })

  // 한글 · 줄바꿈 · 공백이 날것으로 들어가면 메일 앱이 주소를 중간에서 자른다.
  it('제목과 본문을 인코딩한다', () => {
    expect(url).not.toMatch(/[\s가-힣]/)
  })
})
