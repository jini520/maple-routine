// app.json 을 읽어서 AdMob 앱 ID만 환경 변수 값으로 바꾼다.
//
// 앱 ID(`~` 가 들어간 값)는 `expo prebuild` 가 AndroidManifest.xml 과 Info.plist 에 넣는 값이다.
// 광고 단위 ID와 달리 런타임에 읽는 값이 아니라서 JS 쪽에서는 손댈 수 없고, 여기서만 갈아끼울 수
// 있다.
//
// ## ⚠️ OTA 지문
//
// `runtimeVersion` 정책이 `fingerprint` 이고, app.json 은 파일이 아니라 **해석된 설정**으로
// 지문에 들어간다(`expoConfig` contents 소스). 즉 여기서 나온 값이 달라지면 지문이 달라지고,
// 스토어 바이너리가 받던 OTA 가 끊긴다.
//
// **릴리스 빌드는 반드시 .env 를 채우고 만들어야 한다.** 값이 없으면 아래 테스트 앱 ID로
// 떨어지는데, 그 빌드는 지문이 다르고 광고도 안 나간다.
//
// ## 값이 없을 때
//
// Google 이 공개한 테스트 앱 ID로 떨어진다. .env 없이도 `expo start` 와 개발 빌드가 돌아야 하기
// 때문이다. 이 값들은 AdMob 계정과 무관해서 잘못 눌러도 위험이 없다.
// 출처: https://developers.google.com/admob/android/quick-start#sample_app_id
const TEST_APP_IDS = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
}

const ADS_PLUGIN = 'react-native-google-mobile-ads'

module.exports = ({ config }) => ({
  ...config,
  plugins: config.plugins.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== ADS_PLUGIN) return plugin
    return [
      ADS_PLUGIN,
      {
        ...plugin[1],
        androidAppId: process.env.EXPO_PUBLIC_ADS_APP_ID_ANDROID || TEST_APP_IDS.android,
        iosAppId: process.env.EXPO_PUBLIC_ADS_APP_ID_IOS || TEST_APP_IDS.ios,
      },
    ]
  }),
})
