import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mapleroutine.app',
  appName: '메이플 루틴',
  webDir: 'dist',
  plugins: {
    // Capgo 매니지드 백엔드(plugin.capgo.app)를 쓰지 않고 GitHub Releases 자체 호스팅만 사용하므로,
    // 네이티브 자동 체크는 끄고 통계 전송도 비활성화한다(native/live-update.ts가 수동으로 체크한다, ADR-022).
    CapacitorUpdater: {
      autoUpdate: 'off',
      statsUrl: '',
    },
  },
};

export default config;
