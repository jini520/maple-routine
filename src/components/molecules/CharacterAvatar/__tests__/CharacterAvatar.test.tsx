// 여덟 자리가 각자 그리던 얼굴 원을 이 부품이 든다.
import { View } from 'react-native'

import { FACE_CROP_BOX, FACE_SOURCE_IMAGE_SIZE } from '../../../../lib/face-crop'
import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { Text } from '../../../atoms'
import { CharacterAvatar } from '../CharacterAvatar'

const 폴백 = (
  <View testID="폴백">
    <Text>?</Text>
  </View>
)

describe('CharacterAvatar', () => {
  it('지름만큼의 원으로 자른다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar testID="얼굴" imageUrl="https://example.test/a.png" name="아무개" size={36} />,
    )

    expect(flattenStyle(getByTestId('얼굴').props.style)).toMatchObject({
      width: 36,
      height: 36,
      borderRadius: 9999,
      overflow: 'hidden',
    })
  })

  // 그림 뒤로 비치던 회색은 걷었다. 바탕이 필요한 것은 폴백뿐이라 그쪽이
  // 자기 몫으로 든다. 부품이 기본값으로 깔면 그 결정이 여덟 자리에서 한꺼번에 되살아난다.
  it('원에는 배경색을 두지 않는다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar testID="얼굴" imageUrl="https://example.test/a.png" name="아무개" size={36} />,
    )

    expect(flattenStyle(getByTestId('얼굴').props.style).backgroundColor).toBeUndefined()
  })

  //  이 걷으려는 그것이다. 복사본이 셋 있었고 하나는 값이 달랐다.
  it('크롭은 `lib/face-crop` 의 표에서 나온다. 지름에 따라 배율이 바뀐다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar imageTestID="그림" imageUrl="https://example.test/a.png" name="아무개" size={56} />,
    )

    const 배율 = 56 / FACE_CROP_BOX.size
    expect(flattenStyle(getByTestId('그림').props.style)).toMatchObject({
      position: 'absolute',
      width: FACE_SOURCE_IMAGE_SIZE * 배율,
      left: -FACE_CROP_BOX.x * 배율,
      top: -FACE_CROP_BOX.y * 배율,
    })
  })

  it('이름을 읽어 준다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar imageTestID="그림" imageUrl="https://example.test/a.png" name="아무개" size={36} />,
    )

    expect(getByTestId('그림').props.accessibilityLabel).toBe('아무개')
  })

  it('그림이 없으면 받은 폴백을 그 자리에 그린다', async () => {
    const { getByTestId, queryByTestId } = await renderAtom(
      <CharacterAvatar imageTestID="그림" imageUrl={null} name="아무개" size={36} fallback={폴백} />,
    )

    expect(queryByTestId('그림')).toBeNull()
    expect(getByTestId('폴백')).toBeDefined()
  })

  // 대표 캐릭터 위젯은 `imageUrl` 이 `string` 이라 폴백이 없다. 그 자리에서 빈 원이 나오면 안 된다.
  it('폴백을 안 받으면 그림이 없을 때 아무것도 안 그린다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar testID="얼굴" imageUrl={null} name="아무개" size={36} />,
    )

    expect(getByTestId('얼굴').children).toHaveLength(0)
  })

  it('바깥이 준 클래스가 원에 함께 붙는다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar testID="얼굴" imageUrl={null} name="아무개" size={36} className="shrink-0" />,
    )

    expect(flattenStyle(getByTestId('얼굴').props.style)).toMatchObject({ flexShrink: 0 })
  })
})

// 표식은 원 **밖**에 서야 한다. 그림을 자르는 `overflow-hidden` 이 원 안의 것을 함께 자른다.
describe('조회 불가 표식', () => {
  it('참이면 얼굴에 표식이 붙는다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar imageUrl={null} name="지내우시" size={26} unavailable />,
    )

    expect(getByTestId('portrait-unavailable')).toBeTruthy()
  })

  it('안 적으면 안 붙는다', async () => {
    const { queryByTestId } = await renderAtom(
      <CharacterAvatar imageUrl={null} name="지내우시" size={26} />,
    )

    expect(queryByTestId('portrait-unavailable')).toBeNull()
  })

  // 얼굴이 자리마다 달라 고정값으로 두면 작은 얼굴을 덮는다.
  it('표식이 얼굴 크기를 따라간다', async () => {
    const 작은 = await renderAtom(
      <CharacterAvatar imageUrl={null} name="가" size={20} unavailable testID="작은" />,
    )
    const 큰 = await renderAtom(
      <CharacterAvatar imageUrl={null} name="나" size={44} unavailable testID="큰" />,
    )

    const 작은표식 = flattenStyle(작은.getByTestId('portrait-unavailable').props.style).width
    const 큰표식 = flattenStyle(큰.getByTestId('portrait-unavailable').props.style).width
    expect(Number(큰표식)).toBeGreaterThan(Number(작은표식))
  })

  // 배치 클래스는 바깥 상자가 져야 한다. 안쪽은 자르는 일만 한다.
  it('표식이 붙어도 `testID` 는 바깥 상자 하나다', async () => {
    const { getAllByTestId } = await renderAtom(
      <CharacterAvatar imageUrl={null} name="지내우시" size={26} unavailable testID="얼굴" />,
    )

    expect(getAllByTestId('얼굴')).toHaveLength(1)
  })
})
