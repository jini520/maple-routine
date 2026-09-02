// [[ADR-204]] 결정 1·2. 여덟 자리가 각자 그리던 얼굴 원을 이 부품이 든다.
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

  // [[ADR-188]] 결정 1 — 그림 뒤로 비치던 회색을 걷었다. 바탕이 필요한 것은 폴백뿐이라 그쪽이
  // 자기 몫으로 든다. 부품이 기본값으로 깔면 그 결정이 여덟 자리에서 한꺼번에 되살아난다.
  it('원에는 배경색을 두지 않는다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar testID="얼굴" imageUrl="https://example.test/a.png" name="아무개" size={36} />,
    )

    expect(flattenStyle(getByTestId('얼굴').props.style).backgroundColor).toBeUndefined()
  })

  // [[ADR-204]] 결정 3 이 걷으려는 그것이다. 복사본이 셋 있었고 하나는 값이 달랐다.
  it('크롭은 `lib/face-crop` 의 표에서 나온다 — 지름에 따라 배율이 바뀐다', async () => {
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
