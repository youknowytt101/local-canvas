本地画布：cosmos-lite 的原生前端（Expo / React Native），照 Cosmos 2.33 安卓包的技术栈和源码移植，连同一 Wi-Fi 里电脑上的 cosmos-lite 服务。

## 规矩

- **技术栈照 Cosmos，不照 Expo 模板**：导航是 React Navigation（RootNavigator → MainNavigator → BottomTabNavigator，每个标签一个原生页面栈，底部胶囊 DynamicBar 画在最外层），不是 Expo Router；样式用 react-native-unistyles 3；状态用 zustand；视频用 react-native-video 7；存储用 react-native-mmkv 4 + expo-secure-store。
- **先读 Cosmos 再写**：反编译出的源码在 `E:\cosmos-projects\Cosmos\restored\src`（另有 `analysis\04-modules\modules\<id>.js`）。数值、文案照它；照不了的地方写清楚是“近似”，记进 cosmos-lite 的 `HANDOFF.md`。
- **这是公开仓库**：不放 Cosmos Oracle 字体文件（商业字体，运行时从电脑服务的 `/public/fonts/` 加载）、不复制反编译原文件和 `zh.json`。
- **原生目录是生成的**：`ios/`、`android/` 由 `npx expo prebuild` 生成，别手改；原生配置写在 `app.json` 和配置插件里。
- **装库用 `npx expo install`**（给出和 SDK 57 配套的版本）；Expo 的 API 先看对应版本文档 `https://docs.expo.dev/versions/v57.0.0/`，别凭记忆。
- **打包不用 EAS**：GitHub Actions（`.github/workflows/ios.yml`）在 macOS 上编不签名的 ipa，用 Sideloadly + 免费 Apple ID 装。

## 命令

```bash
npx expo start --dev-client --lan   # 开发：手机上的开发版经 Wi-Fi 连这台电脑
npx tsc --noEmit                    # 类型检查
npx expo-doctor                     # 依赖和配置检查
npx expo run:android                # 在安卓模拟器上编译运行
```
