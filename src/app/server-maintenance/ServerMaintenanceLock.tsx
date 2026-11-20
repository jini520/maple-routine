/**
 * 우리 서버를 점검하는 동안 앱을 가리는 잠금 화면. 게임 데이터 잠금(`GameDataLock`)과 같은 패널.
 *
 * 버튼이 없다. 점검은 눌러서 풀리는 실패가 아니고, 풀리는 것은 `features/server-maintenance/store` 가 다시 물어 정한다.
 */
import { View } from 'react-native'

import { WrenchIcon } from '../../components/atoms'
import { InsetRow } from '../../components/molecules/InsetRow/InsetRow'
import { ModalHeader } from '../../components/molecules/ModalHeader/ModalHeader'
import { ModalSurface } from '../../components/organisms/Modal/Modal'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** `12월 2일 06:00` 꼴의 한국 시각. 기기의 시간대를 읽지 않는다. */
function formatUntil(until: number): string {
  const kst = new Date(until + KST_OFFSET_MS)
  const hours = String(kst.getUTCHours()).padStart(2, '0')
  const minutes = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 ${hours}:${minutes}`
}

export interface ServerMaintenanceLockProps {
  /** 종료 예정 시각(ms). 없거나 지났으면 `null` 이고 칸을 그리지 않는다. */
  until: number | null
}

export function ServerMaintenanceLock(props: ServerMaintenanceLockProps): React.JSX.Element {
  return (
    <View testID="server-maintenance-lock" className="absolute inset-0 items-center justify-center bg-scrim px-4">
      <ModalSurface>
        <View className="gap-4">
          <ModalHeader
            icon={WrenchIcon}
            tone="primary"
            title="서버 점검 중입니다"
            description="점검이 끝나면 자동으로 다시 열립니다"
          />
          {props.until !== null && <InsetRow label="종료 예정" value={formatUntil(props.until)} />}
        </View>
      </ModalSurface>
    </View>
  )
}
