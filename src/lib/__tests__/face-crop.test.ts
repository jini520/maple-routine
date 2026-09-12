// 얼굴 크롭 표 → RN 배치 변환의 계약.
//
// **틀려도 에러가 안 나고 그림만 이상하게 잘린다.** 300×300 전신 룩을 확대·이동해 얼굴만 원 안에
// 남기는 계산이라, 값이 조금 어긋나면 정수리나 목이 잘린 얼굴이 조용히 나온다.
//
// `zoom` 이 붙으면서 특히 필요해졌다. 아홉 자리가 이 함수 하나를 쓰는데 기본값이 흔들리면 앱의 모든
// 얼굴이 함께 움직인다. 그래서 **`zoom` 1 이 옛 식과 한 픽셀도 다르지 않다**를 첫 케이스로 둔다.
import { FACE_AVATAR_SIZE, FACE_CROP_BOX, FACE_SOURCE_IMAGE_SIZE, faceCropStyle } from '../face-crop'

/** `zoom` 이 붙기 전의 식. 이 파일이 지키는 기준선이다. */
function 옛식(size: number) {
  const scale = size / FACE_CROP_BOX.size
  return {
    width: FACE_SOURCE_IMAGE_SIZE * scale,
    height: FACE_SOURCE_IMAGE_SIZE * scale,
    left: -FACE_CROP_BOX.x * scale,
    top: -FACE_CROP_BOX.y * scale,
  }
}

describe('기본 크롭', () => {
  /*
   * 회귀 가드. `zoom` 을 안 주는 자리가 여덟이고, 그 여덟은 이 변경으로 움직이면 안 된다.
   *
   * `left`·`top` 을 정확히 비교하지 않는 이유는 **식을 중심 기준으로 다시 썼기 때문**이다.
   * `size/2 - (x + 24) * scale` 과 `-x * scale` 은 대수적으로 같지만 부동소수 연산 순서가 달라
   * 마지막 비트가 갈린다(44px 의 `top` 에서 1e-13). 픽셀로는 0 이고, 1e-9 는 실제 드리프트라면
   * 반드시 넘는 값이다.
   */
  it.each([26, 32, FACE_AVATAR_SIZE, 40, 44, 56, 72])('%spx 에서 옛 식과 같다', (size) => {
    const 지금 = faceCropStyle(size)
    const 옛 = 옛식(size)

    expect(지금.width).toBe(옛.width)
    expect(지금.height).toBe(옛.height)
    expect(지금.left).toBeCloseTo(옛.left, 9)
    expect(지금.top).toBeCloseTo(옛.top, 9)
  })

  it('인자를 안 주면 공용 아바타 지름이다', () => {
    expect(faceCropStyle()).toEqual(faceCropStyle(FACE_AVATAR_SIZE))
  })

  // 크롭 박스가 프레임을 꽉 채운다는 것이 기본값의 정의다.
  it('박스가 프레임을 꽉 채운다', () => {
    const { width } = faceCropStyle(48)

    expect(width).toBe(FACE_SOURCE_IMAGE_SIZE)
  })
})

// `zoom` 은 **박스를 넓혀** 얼굴을 작게 보이게 한다. 원을 키우는 것이 아니라 같은 원에서 얼굴이
// 차지하는 몫을 줄이는 값이다.
describe('zoom', () => {
  const SIZE = 40

  it('1 보다 크면 그림이 작아진다. 얼굴 둘레가 더 보인다', () => {
    const 기본 = faceCropStyle(SIZE)
    const 넓게 = faceCropStyle(SIZE, 1.35)

    expect(넓게.width).toBeLessThan(기본.width)
    expect(넓게.width).toBeCloseTo(기본.width / 1.35, 5)
  })

  it('1 보다 작으면 더 확대된다', () => {
    expect(faceCropStyle(SIZE, 0.5).width).toBeGreaterThan(faceCropStyle(SIZE).width)
  })

  /*
   * **중심이 안 움직인다.** 이 관계가 이 값의 핵심이다.
   *
   * 박스의 왼쪽 위를 프레임에 붙이는 옛 식을 그대로 두고 박스만 넓히면 얼굴이 왼쪽 위로 쏠린다.
   * 프레임 중심에 놓이는 원본 좌표가 `zoom` 과 무관하게 같아야 한다.
   */
  it.each([1, 1.35, 2])('zoom %s 에서 프레임 중심이 같은 원본 좌표를 본다', (zoom) => {
    const { left, top, width } = faceCropStyle(SIZE, zoom)
    const scale = width / FACE_SOURCE_IMAGE_SIZE

    // 프레임 중심(SIZE/2)이 원본의 어느 픽셀인가.
    expect((SIZE / 2 - left) / scale).toBeCloseTo(FACE_CROP_BOX.x + FACE_CROP_BOX.size / 2, 5)
    expect((SIZE / 2 - top) / scale).toBeCloseTo(FACE_CROP_BOX.y + FACE_CROP_BOX.size / 2, 5)
  })

  it('가로와 세로가 같은 배율이다. 얼굴이 안 늘어난다', () => {
    const { width, height } = faceCropStyle(SIZE, 1.35)

    expect(width).toBe(height)
  })
})
