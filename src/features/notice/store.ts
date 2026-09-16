/**
 * 공지 구독 상태. 스위치 넷이 값이고, 그 값이 곧 토픽 구독 여부다.
 *
 * **저장보다 구독이 먼저다.** FCM 구독이 실패했는데 켜졌다고 저장하면 스위치는 켜져 있고 알림은
 * 안 오는 상태가 남는다. 그 어긋남은 화면만 보고는 못 가린다. 그래서 구독이 성공한 뒤에만 적는다.
 *
 * **토글끼리 서로를 안 건드린다.** 하나를 켜다 실패해도 나머지 셋의 저장된 값은 그대로다.
 *
 * **요청은 한 줄로 선다.** 누른 값은 `pending` 에 바로 적히고, 구독과 저장은 `queue` 에서 하나씩 돈다.
 *
 * **켜 둔 토픽은 앱을 켤 때와 돌아올 때 다시 구독한다**(`resubscribe`). 토픽 구독은 FCM 등록 토큰에
 * 묶여 있어 토큰이 바뀌면 사라지는데, 앱은 구독 목록을 FCM 에 물을 수 없다.
 */
import { create } from 'zustand'

import {
  hasNotificationPermission,
  requestNotificationPermission,
} from '../../native/notifications'
import { subscribeToPushTopic, unsubscribeFromPushTopic } from '../../native/push'
import {
  getNoticeSubscriptions,
  getNotificationPermissionAsked,
  setNoticeSubscriptions,
  setNotificationPermissionAsked,
} from '../../storage/notice-settings'
import { NO_SUBSCRIPTIONS, type NoticeKind, type NoticeSubscriptions } from '../../types/notice'
import { DEFAULT_SUBSCRIPTIONS, NOTICE_TOPICS } from './topics'

function topicName(key: NoticeKind): string {
  // 표에 없는 열쇠는 타입이 막는다. 그래도 여기서 빈 문자열을 내면 FCM 이 던지므로 찾아서 준다.
  const found = NOTICE_TOPICS.find((one) => one.key === key)
  if (found === undefined) throw new Error(`모르는 토픽 ${key}`)
  return found.topic
}

/** 전체를 끌 때 누르는 분류. */
const ALL_KINDS = NOTICE_TOPICS.map((one) => one.key)

/** 전체를 켜거나 권한을 막 허용했을 때 누르는 기본 묶음. */
const DEFAULT_KINDS = NOTICE_TOPICS.filter((one) => DEFAULT_SUBSCRIPTIONS[one.key]).map(
  (one) => one.key,
)

interface NoticeState {
  /** 실제 구독. 구독이 성공한 뒤에만 바뀐다. */
  subscriptions: NoticeSubscriptions
  /** 눌렀는데 왕복이 안 끝난 값. 화면이 `subscriptions` 위에 덮어 그린다. */
  pending: Partial<NoticeSubscriptions>
  /**
   * 켜려 했는데 알림 권한이 없어 막혔다.
   *
   * 조용히 구독만 하면 스위치는 켜져 있고 알림은 안 오는데, 사용자는 그것을 고장으로 읽는다.
   * iOS 는 여기서 팝업을 다시 못 띄우므로 말해 주는 것 말고 할 수 있는 일이 없다.
   */
  blockedByPermission: boolean
  /**
   * 기기가 이 앱에 알림을 허용하고 있나. 아직 안 읽었으면 `null`.
   *
   * `blockedByPermission` 과 다른 사실이다. 그것은 `켜려다 막혔다` 라 켜기를 눌러 본 적이
   * 있어야 참이 되는데, 권한을 받아 켜 둔 뒤 나중에 기기에서 끈 사용자는 누른 적이 없다.
   * 그러면 스위치는 켜져 있고 알림은 안 오는데 화면이 아무 말도 안 한다.
   *
   * 못 읽었을 때 거짓으로 떨어뜨리지 않는다. 멀쩡한 기기를 꺼졌다고 말하게 된다.
   */
  permissionGranted: boolean | null
  /**
   * 권한을 읽어 `permissionGranted` 에 적는다. **묻지 않는다.**
   *
   * 화면에 들어온 것은 알림을 켜겠다고 말한 자리가 아니고, iOS 는 팝업을 한 번밖에 못 띄운다.
   *
   * @example
   * // 알림 설정 화면. 들어올 때마다 읽는다 - 기기 설정에 갔다 오는 사이 값이 바뀐다
   * useFocusEffect(useCallback(() => void refreshPermission(), [refreshPermission]))
   */
  refreshPermission: () => Promise<void>
  /** 저장된 값을 상태에 올린다. 토픽을 다시 구독하지 않는다. */
  restore: () => Promise<void>
  /**
   * 저장값이 켜짐인 토픽을 다시 구독한다. 권한이 없으면 안 보내고 묻지도 않는다.
   *
   * **던지지 않는다.** 실패는 알리지 않고 다음 계기(앱을 켤 때 · 포그라운드 복귀)에 다시 보낸다.
   */
  resubscribe: () => Promise<void>
  setSubscribed: (key: NoticeKind, subscribed: boolean) => Promise<void>
  /** 권한을 막 허용한 자리에서 기본 묶음을 켠다. */
  subscribeDefaults: () => Promise<void>
  /**
   * 전체 스위치. 끄면 켜져 있던 것을 전부 해제하고, 켜면 기본 묶음을 켠다.
   *
   * **끌 때 실제로 해제한다.** 화면에서 감추기만 하면 구독은 FCM 쪽에 남아, 스위치는 꺼져
   * 있는데 알림은 오는 상태가 된다.
   */
  setAllSubscribed: (subscribed: boolean) => Promise<void>
}

/**
 * 권한이 없을 때 한 번 더 시도한다. 받아 냈으면 참.
 *
 * **한 번도 안 물었으면 여기서 묻는다.** iOS 는 앱이 한 번도 안 물으면 설정에 그 앱의 알림
 * 항목을 아예 안 만든다. 그래서 그 상태로 설정에 보내면 갈 곳이 없는 막다른 길이 된다.
 * 스위치를 켜는 것도 사용자가 알림을 원한다고 말한 자리이므로 묻기에 맞다.
 *
 * **이미 물었으면 다시 안 묻는다.** 그때는 OS 가 팝업을 안 띄워서 부르나 마나이고, 설정으로
 * 보내는 것 말고 할 수 있는 일이 없다.
 */
async function ensurePermission(): Promise<boolean> {
  if (await getNotificationPermissionAsked()) return false

  // 묻기 전에 적는다. 팝업은 뜨는 순간 소모된다.
  await setNotificationPermissionAsked()
  return requestNotificationPermission().catch(() => false)
}

/** 구독 요청이 하나씩 도는 줄. 겹치면 늦게 끝난 쪽이 먼저 끝난 쪽의 저장을 덮는다. */
let queue: Promise<void> = Promise.resolve()

/** 요청을 줄 끝에 세우는 함수. 앞 요청이 실패해도 줄은 이어지고, 실패는 부른 쪽이 받는다. */
function enqueue(job: () => Promise<void>): Promise<void> {
  const done = queue.then(job)
  queue = done.catch(() => undefined)
  return done
}

/**
 * 줄에서 차례를 기다리는 재구독. 도는 중이거나 없으면 `null`.
 *
 * 기다리는 요청은 아직 권한도 저장값도 안 읽어서 새 요청을 합쳐도 결과가 같다. 도는 요청은 이미
 * 읽었을 수 있어 합치면 그 사이 켠 권한을 못 본다.
 */
let waitingResubscribe: Promise<void> | null = null

export const useNoticeStore = create<NoticeState>()((set, get) => {
  /** 권한을 읽어 상태에 적고 그 값을 주는 함수. **못 읽으면 적지 않고 던진다.** */
  async function readPermission(): Promise<boolean> {
    const granted = await hasNotificationPermission()
    set({ permissionGranted: granted })
    return granted
  }

  /** 구독하거나 해제하고, 성공하면 적는 함수. */
  async function apply(key: NoticeKind, subscribed: boolean): Promise<void> {
    if (subscribed) {
      // **켤 때만 권한을 본다.** 끄는 길은 권한과 무관하고, 거기서 막으면 권한 없는 사용자가
      // 구독을 해제할 방법이 없어진다.
      if (!(await readPermission()) && !(await ensurePermission())) {
        set({ blockedByPermission: true })
        return
      }
      // 팝업으로 방금 허용받았을 수 있다. 읽은 값이 거짓인 채로 남으면 화면이 멀쩡한 기기를
      // 꺼졌다고 말한다.
      set({ permissionGranted: true })
      await subscribeToPushTopic(topicName(key))
    } else {
      await unsubscribeFromPushTopic(topicName(key))
    }

    const next = { ...get().subscriptions, [key]: subscribed }
    await setNoticeSubscriptions(next)
    set({ subscriptions: next, blockedByPermission: false })
  }

  /**
   * 한 분류를 누른 값까지 데려가는 요청.
   *
   * 누른 값은 **차례가 왔을 때** 읽는다. 줄에 설 때 읽으면 켜기, 끄기, 켜기가 서버에 셋 다 간다.
   */
  async function settle(key: NoticeKind): Promise<void> {
    const target = get().pending[key]
    if (target === undefined) return

    try {
      // 저장된 값과 같으면 보낼 것이 없다. 또 부르면 FCM 왕복이 공짜로 늘고 실패할 자리도 는다.
      if (target !== get().subscriptions[key]) await apply(key, target)
    } finally {
      // 도는 사이 같은 스위치를 또 눌렀으면 그 값은 뒤에 선 요청 몫이라 남긴다.
      if (get().pending[key] === target) {
        const pending = { ...get().pending }
        delete pending[key]
        set({ pending })
      }
    }
  }

  /** 누른 값을 먼저 적고 분류마다 요청 하나를 줄에 세우는 함수. */
  function press(kinds: readonly NoticeKind[], subscribed: boolean): Promise<void> {
    const pending = { ...get().pending }
    for (const kind of kinds) pending[kind] = subscribed
    set({ pending })
    return Promise.all(kinds.map((kind) => enqueue(() => settle(kind)))).then(() => undefined)
  }

  return {
    subscriptions: NO_SUBSCRIPTIONS,
    pending: {},
    blockedByPermission: false,
    permissionGranted: null,
    async restore() {
      set({ subscriptions: await getNoticeSubscriptions() })
    },
    async refreshPermission() {
      // 못 읽어도 조용히 넘긴다. 다음에 화면에 들어올 때 다시 읽는다.
      await readPermission().catch(() => undefined)
    },
    resubscribe() {
      if (waitingResubscribe !== null) return waitingResubscribe

      const job = enqueue(async () => {
        waitingResubscribe = null
        // 권한은 묻지 않는다. 앱을 켤 때와 돌아올 때 뜨는 팝업은 iOS 의 한 번뿐인 기회를 맥락 없이 쓴다.
        // 읽은 값은 남긴다. 알림 설정 화면이 그것으로 `기기에서 꺼져 있어요` 를 그린다.
        if (!(await readPermission())) return

        // 켜짐은 차례가 왔을 때 읽는다. 줄에 설 때 읽으면 기다리는 사이 끈 토픽을 다시 구독한다.
        const { subscriptions } = get()
        for (const { key, topic } of NOTICE_TOPICS) {
          if (!subscriptions[key]) continue
          // 한 분류의 실패가 다른 분류를 막지 않는다.
          await subscribeToPushTopic(topic).catch(() => undefined)
        }
      }).catch(() => undefined)

      waitingResubscribe = job
      return job
    },
    setSubscribed(key, subscribed) {
      return press([key], subscribed)
    },
    setAllSubscribed(subscribed) {
      return press(subscribed ? DEFAULT_KINDS : ALL_KINDS, subscribed)
    },
    subscribeDefaults() {
      return press(DEFAULT_KINDS, true)
    },
  }
})
