// 크롭 표 → RN 배치 변환의 계약.
//
// 웹에는 이 테스트의 짝이 없다 — 거기서는 크롭 값이 CSS 로 그대로 흘러가 브라우저가 해석했고,
// 검사할 변환이 존재하지 않았다. RN 에서는 우리가 그 해석을 대신하므로 **틀려도 에러가 안 나고
// 그림만 이상하게 잘린다.** 정확히 그 종류의 실패라 계약을 코드로 못 박는다.
import { imageCropStyle, resolveImageCropLayout } from '../image-crop'

/** 실제 크롭 표에 있는 모양(`daily-quest-region-crops.json`) 하나. */
const CROP = { size: '220% auto', position: '60% 40%' }
const NATURAL = { width: 800, height: 400 }

describe('resolveImageCropLayout — CSS 배경 크롭 → RN 배치', () => {
  it('`N% auto` 는 부모 폭 기준 폭 + 고유 종횡비가 된다', () => {
    const layout = resolveImageCropLayout(CROP, NATURAL)

    expect(layout).toEqual({
      kind: 'sized',
      width: '220%',
      aspectRatio: 2,
      left: '60%',
      top: '40%',
      translateX: '-60%',
      translateY: '-40%',
    })
  })

  // CSS `background-position` 의 퍼센트는 **두 기준의 뺄셈**이다(부모 − 자기). 한쪽만 옮기면
  // 그림이 통째로 밀려 나가므로, 두 값이 부호만 다른 짝이라는 것이 계약이다.
  it('position 퍼센트는 부모 기준 오프셋과 자기 기준 역이동의 짝이다', () => {
    const layout = resolveImageCropLayout({ size: '150% auto', position: '0% 100%' }, NATURAL)

    // `-0` 은 문자열이 되며 부호를 잃는다(`${-0}%` → `'0%'`) — 0 은 뺄 것이 없어 결과가 같다.
    expect(layout).toMatchObject({ left: '0%', translateX: '0%', top: '100%', translateY: '-100%' })
  })

  it('100% 를 넘는 position 도 그대로 통과한다 — 크롭 표에 실제로 있다', () => {
    expect(resolveImageCropLayout({ size: '170% auto', position: '110% 100%' }, NATURAL)).toMatchObject({
      left: '110%',
      translateX: '-110%',
    })
  })

  it('고유 크기를 모르면 cover 로 떨어진다 — 그림을 안 그리는 것이 아니다', () => {
    expect(resolveImageCropLayout(CROP, null)).toEqual({ kind: 'cover' })
    expect(resolveImageCropLayout(CROP, { width: 0, height: 0 })).toEqual({ kind: 'cover' })
  })

  // step 5 실측 — jest 의 에셋 대역(`{ testUri }`)이 크기 없이 오는데 `undefined <= 0` 은 false 라
  // 가드를 통과했고 `aspectRatio: NaN` 이 나갔다. NaN 은 에러가 아니라 레이아웃이 조용히 무너지는 값이다.
  it.each([
    ['둘 다 없음', { width: undefined, height: undefined }],
    ['높이만 없음', { width: 800, height: undefined }],
    ['NaN', { width: Number.NaN, height: 400 }],
    ['무한대', { width: 800, height: Number.POSITIVE_INFINITY }],
  ])('크기가 숫자가 아니면(%s) cover 다 — NaN 종횡비를 내보내지 않는다', (_label, natural) => {
    expect(resolveImageCropLayout(CROP, natural as unknown as { width: number; height: number })).toEqual({
      kind: 'cover',
    })
  })

  it('`cover`/`center` 기본 크롭도 cover 다', () => {
    expect(resolveImageCropLayout({ size: 'cover', position: 'center' }, NATURAL)).toEqual({ kind: 'cover' })
  })
})

describe('imageCropStyle', () => {
  it('cover 는 상자를 꽉 채운다', () => {
    expect(imageCropStyle({ kind: 'cover' })).toEqual({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: undefined,
      height: undefined,
    })
  })

  it('sized 는 퍼센트 배치 + 역이동 transform 이다', () => {
    expect(imageCropStyle(resolveImageCropLayout(CROP, NATURAL))).toEqual({
      position: 'absolute',
      width: '220%',
      height: undefined,
      aspectRatio: 2,
      left: '60%',
      top: '40%',
      transform: [{ translateX: '-60%' }, { translateY: '-40%' }],
    })
  })

  // **두 갈래 다 두 축의 이름이 나와야 한다**. 안 적은 축에는 에셋의 고유 픽셀
  // 크기가 남고(RN 이 스타일 맨 아래에 그것을 깐다), 그러면 `sized` 는 `aspectRatio` 를 잃어
  // 늘어나고 `cover` 는 `right`/`bottom` 을 잃어 상자를 못 채운다 — 둘 다 **에러 없이** 그렇게 된다.
  //
  // 값이 아니라 **키의 존재**를 묻는다: `toEqual` 은 `{height: undefined}` 와 `{}` 를 같게 보므로
  // 위 두 케이스만으로는 이 계약이 안 적힌다(둘 다 통과한다).
  it.each([
    ['cover', { kind: 'cover' } as const],
    ['sized', resolveImageCropLayout(CROP, NATURAL)],
  ])('%s 는 두 축을 다 이름 부른다 — 안 적은 축은 고유 크기가 살아남는다', (_label, layout) => {
    const style = imageCropStyle(layout)

    expect(Object.keys(style)).toContain('width')
    expect(Object.keys(style)).toContain('height')
  })
})
