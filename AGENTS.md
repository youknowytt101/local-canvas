本地画布：cosmos-lite 的原生前端（Expo / React Native），照 Cosmos 2.33 安卓包的技术栈和源码移植，连同一 Wi-Fi 里电脑上的 cosmos-lite 服务。

## 核心目标

1. **最终产物是 iOS 的 ipa**：在这个仓库的 GitHub Actions 上编（不签名），用 Sideloadly + 免费 Apple ID 装到 iPhone。打包链路坏了比任何页面都优先修。
2. **原生重写、和 Cosmos 一致**：页面、组件、数值、文案、动效照 Cosmos 2.33 的源码做；用户自己定过的偏离照旧保留（记在 cosmos-lite 的 README“界面”一节和差距表 ⑳）；照不了的写明“近似”。
3. **服务端不换**：数据、搜索、AI 都在电脑上的 cosmos-lite（GraphQL + 令牌登录 + 局域网访问）；那边的网页前端只修 bug，新功能只做在这里。安卓是同一套代码，顺带。

进度按 cosmos-lite `HANDOFF.md` 的 6.140 起记：0 地基 → 1 导航外壳 → 2 首页 → 3 查看器 → 4 保存和收藏夹 → 5 搜索 → 6 添加和上传 → 7 画布 → 8 探索 / 商城 / 活动 / 设置 / 引导 → 9 正式版。

## 规矩

- **技术栈照 Cosmos，不照 Expo 模板**：导航是 React Navigation（RootNavigator → MainNavigator → BottomTabNavigator，每个标签一个原生页面栈，底部胶囊 DynamicBar 画在最外层），不是 Expo Router；样式用 react-native-unistyles 3；状态用 zustand；视频用 expo-video（用户 2026-11-02 定的偏离：Cosmos 用 react-native-video 7，但它还是 beta、要靠补丁绕 bug；不要打补丁，见 cosmos-lite HANDOFF 6.175）；存储用 react-native-mmkv 4 + expo-secure-store。
- **先读 Cosmos 再写**：反编译出的源码在 `E:\cosmos-projects\Cosmos\source\src`（第三轮还原：结构化的 if / 循环，函数名、导入导出是原名；旧的 `restored\src` 有 hermes-dec 翻译错误，已删）。只有常量的模块不在里面（写成 `from "library:1747"`），去 `analysis\04-modules-v7\modules\<id>.js` 读；负数可能显示成大整数（`4294967294` 是 −2）。数值、文案照它；照不了的地方写清楚是“近似”，记进 cosmos-lite 的 `HANDOFF.md`。
- **这是公开仓库**：不放 Cosmos Oracle 字体文件（商业字体，运行时从电脑服务的 `/public/fonts/` 加载）、不复制反编译原文件和 `zh.json`。
- **不打补丁**：库的 bug 不用 patch-package 绕（用户 2026-11-02：“我要在根本上解决”），换合适的库或从用法上解决。
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
