# Gemini Default Model Selector

[中文](README.md)

A lightweight Tampermonkey/Violentmonkey userscript that automatically selects your preferred Gemini model and thinking level whenever you enter the new-chat home page.

## Features

- Reads the model list currently displayed by Gemini instead of relying on fixed version numbers.
- Supports 3.5 Flash-Lite, 3.8 Flash, 3.1 Pro, 4 Argon, and other models that Gemini may expose later.
- Full support for the new 3-tier thinking levels: **Low (fast & efficient)**, **Medium (balanced)**, and **High (comprehensive)**.
- Defaults to **3.8 Flash + High thinking level**.
- **Instant Silent Pre-switch**: Automatically applies within ~0.2s of landing on the page; accurately differentiates between page autofocus and active typing, ensuring single-enter submission.
- **Double Submit Replay Guarantee**: Multi-event pointer and keyboard synthetic dispatch ensures prompt submission never requires a second Enter.
- **Draggable Floating Pill**: The floating settings button can be dragged to any position on screen and remembers its location.
- Compatible with Gemini's strict **Trusted Types (CSP)** policy.
- Supports both `gemini.google.com/app` and multi-account URLs such as `gemini.google.com/u/0/app`.
- Applies only on the new-chat home page and does not force a model change in existing conversations.
- Stores preferences locally in the userscript manager and sends nothing to an external server.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. [Click here to install the userscript](https://raw.githubusercontent.com/B416-JAFLY/gemini-default-model-selector/main/gemini-default-model-selector.user.js).
3. Open Gemini. Your defaults will be applied on the new-chat page.

## Changing the defaults

You can open settings in either of these ways:

- Click the **Default model** floating pill button (drag to move, click to open settings).
- Open your userscript manager menu and choose **Configure Gemini default model**.

Choose a model and thinking level, then click **Save and apply now**. The model list is read dynamically from Gemini, so model version changes generally do not require a userscript update.

## Focus Protection & Instant Readiness

Gemini automatically focuses the empty prompt editor upon load. The userscript distinguishes between initial empty focus and active user typing:
- If the editor is empty and no keystrokes occurred, it applies defaults in the background and restores the cursor;
- If typing has begun, it pauses to protect your input;
- If submitted before switching completes, it automatically switches and replays the submission seamlessly without requiring a second Enter.

## About “Thinking Level”

The Gemini web interface has transitioned from binary extended thinking to a 3-tier submenu (Low, Medium, High). This userscript fully supports discovering, expanding, and selecting these submenu options seamlessly.

## Development and checks

The project has no third-party dependencies. After cloning, run:

```bash
npm run check
```

This checks the userscript's JavaScript syntax.

## License

[MIT](LICENSE)
