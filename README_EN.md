# Gemini Default Model Selector

[中文](README.md)

A lightweight Tampermonkey/Violentmonkey userscript that automatically selects your preferred Gemini model and thinking intensity whenever you enter the new-chat home page.

## Features

- Reads the model list currently displayed by Gemini instead of relying on fixed version numbers.
- Supports Flash-Lite, Flash, Pro, and other models that Gemini may expose later.
- Lets you choose between standard model-default thinking and extended thinking.
- Defaults to **Flash + extended thinking**.
- Supports both `gemini.google.com/app` and multi-account URLs such as `gemini.google.com/u/0/app`.
- Applies only on the new-chat home page and does not force a model change in existing conversations.
- Pauses while the editor is focused or the user is typing, so the model menu cannot steal the caret; it resumes after the editor is left.
- If the user presses Enter or clicks Send while the editor remains focused, it checks the defaults first and then continues the original submission.
- Stores preferences locally in the userscript manager and sends nothing to an external server.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. [Click here to install the userscript](https://raw.githubusercontent.com/B416-JAFLY/gemini-default-model-selector/main/gemini-default-model-selector.user.js).
3. Open Gemini. Your defaults will be applied on the new-chat page.

## Changing the defaults

You can open settings in either of these ways:

- Click the **Default model** floating button in the lower-right corner of Gemini.
- Open your userscript manager menu and choose **Configure Gemini default model**.

Choose a model and thinking intensity, then click **Save and apply now**. The model list is read dynamically from Gemini, so model version changes generally do not require a userscript update.

## Focus protection

Gemini often loads its editor before the model selector. The userscript recognizes the `contenteditable` editor, recent keyboard input, and a model menu opened by the user. It does not open the model menu while you are typing or overwrite a manual model choice; it resumes applying the defaults after you leave the editor.

When a prompt is submitted before the defaults are ready, the userscript briefly intercepts that submission, selects the configured model, and then triggers Gemini's Send button. It does not intercept a submission when the desired model is already selected; if a configured model is temporarily unavailable, it continues with the current model so the prompt is not lost.

## About “thinking intensity”

The Gemini web interface currently exposes two directly selectable states: the model default and extended thinking. The userscript mirrors those real options. If Google adds low, medium, or high levels later, the project can extend the setting in a future release.

## Development and checks

The project has no third-party dependencies. After cloning, run:

```bash
npm run check
```

This checks the userscript's JavaScript syntax.

## Known limitation

Gemini is a continuously changing web application. If Google changes the accessible labels or structure of its model menu, the userscript may need an update. When a saved model cannot be found, the script does not silently choose a different one; open settings and select a currently available model.

## License

[MIT](LICENSE)
