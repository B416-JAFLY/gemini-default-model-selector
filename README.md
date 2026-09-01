# Gemini 默认模型选择器

[English](README_EN.md)

一个轻量的 Tampermonkey/Violentmonkey 用户脚本。它会在你进入 Gemini 新对话首页时，自动选择预先设定的默认模型与思考强度。

## 功能

- 自动读取 Gemini 当前展示的模型列表，不依赖固定版本号。
- 支持 Flash-Lite、Flash、Pro，以及 Gemini 后续展示的其他模型。
- 可选择“标准（模型默认）”或“扩展思考”。
- 默认设置为 **Flash + 扩展思考**。
- 同时兼容 `gemini.google.com/app` 与 `gemini.google.com/u/0/app` 等多账号地址。
- 仅在新对话首页自动应用，不会强行修改已有对话的模型。
- 设置保存在用户脚本管理器本地，不会发送到任何服务器。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)。
2. [点击这里安装脚本](https://raw.githubusercontent.com/B416-JAFLY/gemini-default-model-selector/main/gemini-default-model-selector.user.js)。
3. 打开 Gemini，新对话页面会自动应用默认设置。

## 修改默认设置

有两种入口：

- 点击 Gemini 页面右下角的“默认模型”悬浮按钮。
- 打开用户脚本管理器菜单，选择“设置 Gemini 默认模型”。

在面板中选择默认模型和思考强度，然后点击“保存并立即应用”。模型列表会从当前 Gemini 页面动态读取，因此 Gemini 更新模型版本号后通常不需要更新脚本。

## 关于“思考强度”

Gemini 网页目前只提供两种可直接选择的状态：模型默认思考与“扩展思考”。脚本按照页面真实能力提供这两档设置；如果 Google 以后增加低、中、高等档位，项目可以在后续版本中继续扩展。

## 开发与检查

项目不依赖第三方包。克隆后可运行：

```bash
npm run check
```

该命令会检查用户脚本的 JavaScript 语法。

## 已知限制

Gemini 是持续更新的网页应用。如果 Google 修改模型菜单的可访问性标签或页面结构，脚本可能需要同步调整。脚本找不到已保存的模型时不会随意选择其他模型，可打开设置面板重新选择当前可用项。

## 许可证

[MIT](LICENSE)
