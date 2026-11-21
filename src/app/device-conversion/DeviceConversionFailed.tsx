/**
 * 기기 변환이 실패했을 때 앱을 가리는 패널. 잠금 화면과 같은 껍데기(`ModalSurface`)에 스크림을 직접 깐다.
 *
 * 새 앱 코드는 옛 모양의 기록 표를 읽지 못해서 변환 없이 앱을 열지 않는다. 기록은 트랜잭션이 되돌려 그대로다.
 */
import { View } from 'react-native'

import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { ModalSurface } from '../../components/organisms/Modal/Modal'
import { retryDeviceConversion } from '../../features/device-conversion/run'

export function DeviceConversionFailed(): React.JSX.Element {
  return (
    <View testID="device-conversion-failed" className="absolute inset-0 items-center justify-center bg-scrim px-4">
      <ModalSurface>
        <ErrorState
          title="기록을 옮기지 못했습니다"
          description="기기에 저장된 기록은 그대로입니다. 다시 시도해주세요."
          action={{ label: '다시 시도', onClick: () => void retryDeviceConversion() }}
        />
      </ModalSurface>
    </View>
  )
}
