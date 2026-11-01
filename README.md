# 本地画布（iOS / 安卓）

一个灵感收藏 App 的原生前端（Expo SDK 57 + React Native 0.86）。它不带服务端：连接同一 Wi-Fi 里电脑上运行的配套服务（cosmos-lite，不在这个仓库里），图片、搜索、AI 分析都在电脑上。

**目标**：在 GitHub 上编出能装到 iPhone 的 ipa（不签名，用 Sideloadly 装）；界面和交互逐页照 Cosmos 原生重写，安卓用同一套代码。

## 装到 iPhone（不需要 Mac，不需要付费开发者账号）

1. 打开本仓库的 **Actions → iOS ipa**，选最新一次成功的运行，下载产物：
   - `local-canvas-debug-unsigned.ipa`：开发版，代码由电脑上的开发服务实时下发（见下面“开发”）。
   - `local-canvas-release-unsigned.ipa`：正式版（在 Actions 里手动运行并选 Release，或打 `v*` 标签）。
2. 在 Windows / Mac 上装 [Sideloadly](https://sideloadly.io)，iPhone 用数据线连电脑，选这个 ipa，填自己的 Apple ID，开始安装。
3. iPhone 上：设置 → 隐私与安全性 → 打开“开发者模式”（重启一次）；设置 → 通用 → VPN 与设备管理 → 信任你的 Apple ID。
4. 免费 Apple ID 签的 App **7 天后过期**，用 Sideloadly 再签一次即可（数据不丢）；同时最多装 3 个这样的 App。

## 第一次打开

- 填电脑地址，例如 `192.168.1.5:4870`（电脑上的服务启动时会打出“同一网络的设备”那一行；服务端要打开 `lan.enabled`）。
- 允许“本地网络”权限，然后用用户名和密码登录（电脑上先在 设置 → 更新密码 里设好）。
- 字体从电脑上的服务加载；没连上时先用系统字体。

## 开发

```bash
npm ci
npx expo start --dev-client --lan     # 手机上的开发版连这台电脑（同一 Wi-Fi）
npx tsc --noEmit                      # 类型检查
npx expo run:android                  # 安卓模拟器 / 真机（安卓不用签名限制）
```

只改 JavaScript 不用重新打包；加了带原生代码的库，推到 `main` 后 Actions 会重新编开发版。

## 打包

`.github/workflows/ios.yml`：在 GitHub 的 macOS 机器上 `expo prebuild` → `pod install` → `xcodebuild`（不签名）→ 打成 `.ipa` 上传为产物。`ios/`、`android/` 是生成的，不进仓库。
