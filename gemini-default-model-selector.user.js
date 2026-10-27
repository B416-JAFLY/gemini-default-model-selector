// ==UserScript==
// @name         Gemini Default Model Selector
// @name:zh-CN   Gemini 默认模型选择器
// @namespace    https://github.com/B416-JAFLY/gemini-default-model-selector
// @version      0.3.2
// @description  Automatically select your preferred Gemini model and thinking level for every new chat.
// @description:zh-CN 为 Gemini 新对话自动选择默认模型与思考等级，并提供随时可修改的设置面板。
// @author       B416-JAFLY
// @license      MIT
// @match        https://gemini.google.com/app*
// @match        https://gemini.google.com/u/*/app*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/B416-JAFLY/gemini-default-model-selector/main/gemini-default-model-selector.user.js
// @updateURL    https://raw.githubusercontent.com/B416-JAFLY/gemini-default-model-selector/main/gemini-default-model-selector.user.js
// ==/UserScript==

(() => {
  'use strict';

  const SCRIPT_ID = 'gemini-default-model-selector';
  const SETTINGS_KEY = 'settings-v1';
  const MODEL_CACHE_KEY = 'model-cache-v1';
  const POSITION_KEY = 'launcher-position-v1';
  const HOME_PATH = /^(?:\/u\/[^/]+)?\/app\/?$/;
  const MODE_BUTTON_SELECTOR = [
    'button[data-test-id="bard-mode-menu-button"]',
    'button.input-area-switch',
    'button[aria-label*="模式选择器"]',
    'button[aria-label*="mode selector" i]',
  ].join(',');
  const THINKING_ITEM_VALUE = 'thinking_level';
  const THINKING_ITEM_PATTERN = /^(思考等级|thinking(\s+level)?)$/i;
  const SEND_BUTTON_SELECTOR = [
    'button[aria-label*="发送"]',
    'button[aria-label*="Send" i]',
    'button[data-test-id*="send" i]',
    '[data-test-id*="send" i] button',
    'gem-icon-button.send-button button',
  ].join(',');
  const COMPOSER_SELECTOR = [
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'rich-textarea',
  ].join(',');
  const INPUT_IDLE_DELAY = 1400;
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    modelKey: 'flash',
    modelLabel: '3.8 Flash',
    thinking: 'high',
  });
  const FALLBACK_MODELS = [
    { key: 'flash-lite', label: '3.5 Flash-Lite' },
    { key: 'flash', label: '3.8 Flash' },
    { key: 'pro', label: '3.1 Pro' },
    { key: 'argon', label: '4 Argon' },
  ];

  const isChinese = (document.documentElement.lang || navigator.language || '')
    .toLowerCase()
    .startsWith('zh');

  const text = isChinese ? {
    button: '默认模型',
    buttonTitle: '设置 Gemini 默认模型（可拖动调整位置）',
    title: 'Gemini 默认模型选择器',
    subtitle: '设置会保存在油猴中，并在每次进入新对话首页时自动应用。',
    enabled: '自动应用默认设置',
    model: '默认模型',
    thinking: '思考等级',
    thinkingLow: '低（快速高效）',
    thinkingMedium: '中（深度适中）',
    thinkingHigh: '高（超级详尽）',
    loading: '正在读取 Gemini 当前可用模型…',
    liveModels: '已读取当前可用模型。',
    fallbackModels: '暂时无法读取模型菜单，显示缓存或通用选项。',
    save: '保存并立即应用',
    cancel: '取消',
    reset: '恢复默认',
    saved: '默认设置已保存',
    applied: '已应用默认模型设置',
    unavailable: '找不到所选模型，请重新打开设置并选择当前可用模型。',
    thinkingUnavailable: '未能设置所选思考等级，可能该模型不支持或菜单未响应。',
    resetDone: '已恢复为 3.8 Flash + 高思考等级',
    deferred: '检测到输入框正在使用，模型切换会在你完成输入后进行。',
    submitFallback: '默认模型暂未就绪，已按当前模型继续发送。',
  } : {
    button: 'Default model',
    buttonTitle: 'Configure Gemini default model (drag to move)',
    title: 'Gemini Default Model Selector',
    subtitle: 'Settings are stored by your userscript manager and applied on every new-chat home page.',
    enabled: 'Automatically apply defaults',
    model: 'Default model',
    thinking: 'Thinking level',
    thinkingLow: 'Low (fast & efficient)',
    thinkingMedium: 'Medium (balanced)',
    thinkingHigh: 'High (comprehensive)',
    loading: 'Reading currently available Gemini models…',
    liveModels: 'Current models loaded.',
    fallbackModels: 'Could not read the model menu; showing cached or generic choices.',
    save: 'Save and apply now',
    cancel: 'Cancel',
    reset: 'Reset defaults',
    saved: 'Default settings saved',
    applied: 'Default model settings applied',
    unavailable: 'The selected model is unavailable. Open settings and choose a current model.',
    thinkingUnavailable: 'The selected thinking level could not be applied.',
    resetDone: 'Reset to 3.8 Flash + High thinking level',
    deferred: 'The editor is in use. Model switching will resume after you finish typing.',
    submitFallback: 'The default model was not ready, so the prompt was sent with the current model.',
  };

  let gmdmsPolicy = null;
  function getTrustedPolicy() {
    if (gmdmsPolicy) return gmdmsPolicy;
    const tt = window.trustedTypes || (typeof unsafeWindow !== 'undefined' && unsafeWindow.trustedTypes);
    if (tt?.createPolicy) {
      try {
        gmdmsPolicy = tt.createPolicy('gmdms-policy', {
          createHTML: (s) => s,
        });
      } catch {
        try {
          gmdmsPolicy = tt.createPolicy('gmdms-policy-' + Date.now(), {
            createHTML: (s) => s,
          });
        } catch {
          gmdmsPolicy = tt.defaultPolicy || null;
        }
      }
    }
    return gmdmsPolicy;
  }

  function setSafeHTML(element, html) {
    const policy = getTrustedPolicy();
    if (policy) {
      element.innerHTML = policy.createHTML(html);
    } else {
      element.innerHTML = html;
    }
  }

  function normalizeThinking(val) {
    if (val === 'extended') return 'high';
    if (val === 'standard') return 'low';
    if (val === 'high' || val === 'medium' || val === 'low') return val;
    return 'high';
  }

  let settings = loadSettings();
  let ui = null;
  let working = false;
  let navigationId = 1;
  let lastAppliedNavigationId = 0;
  let lastAttemptNavigationId = 0;
  let pendingAutoApply = false;
  let lastUserInputAt = 0;
  let userSelectedModel = false;
  let replayingSubmit = false;
  let submitting = false;
  let scheduleTimer = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function loadSettings() {
    const saved = GM_getValue(SETTINGS_KEY, {});
    const merged = { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
    merged.thinking = normalizeThinking(merged.thinking);
    return merged;
  }

  function saveSettings(next) {
    settings = { ...DEFAULT_SETTINGS, ...next };
    settings.thinking = normalizeThinking(settings.thinking);
    GM_setValue(SETTINGS_KEY, settings);
  }

  function loadModelCache() {
    const cached = GM_getValue(MODEL_CACHE_KEY, []);
    return Array.isArray(cached) ? cached : [];
  }

  function saveModelCache(models) {
    GM_setValue(MODEL_CACHE_KEY, models.map(({ key, label, sublabel, modeId }) => ({
      key,
      label,
      sublabel,
      modeId,
    })));
  }

  function isHomePage() {
    return location.hostname === 'gemini.google.com' && HOME_PATH.test(location.pathname);
  }

  function isVisible(element) {
    if (!element?.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  }

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function modelKeyFromLabel(label, modeId = '') {
    const normalized = normalize(label).toLowerCase();
    if (/argon/.test(normalized)) return 'argon';
    if (/flash[\s-]*lite/.test(normalized)) return 'flash-lite';
    if (/(^|\s)flash($|\s)/.test(normalized)) return 'flash';
    if (/(^|\s)pro($|\s)/.test(normalized)) return 'pro';
    return modeId ? `mode:${modeId}` : `label:${normalized}`;
  }

  function modeButton() {
    return [...document.querySelectorAll(MODE_BUTTON_SELECTOR)].find(isVisible) || null;
  }

  function sendButton() {
    const directBtn = document.querySelector('button[aria-label*="发送"], button[aria-label*="Send" i]');
    if (directBtn && isVisible(directBtn) && !directBtn.disabled && directBtn.getAttribute('aria-disabled') !== 'true') {
      return directBtn;
    }
    for (const el of document.querySelectorAll(SEND_BUTTON_SELECTOR)) {
      const target = el.tagName === 'BUTTON' ? el : el.querySelector('button');
      if (target && isVisible(target) && !target.disabled && target.getAttribute('aria-disabled') !== 'true') {
        return target;
      }
    }
    return null;
  }

  function composerElement(element) {
    if (!(element instanceof Element)) return null;
    return element.closest(COMPOSER_SELECTOR);
  }

  function activeComposer() {
    return composerElement(document.activeElement);
  }

  function composerHasContent() {
    const element = activeComposer() || document.querySelector(COMPOSER_SELECTOR);
    if (!element) return false;
    const text = (element.value || element.textContent || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
    return text.length > 0;
  }

  function modeControlElement(element) {
    if (!(element instanceof Element)) return null;
    return element.closest(
      `${MODE_BUTTON_SELECTOR}, [role="menu"], [role="menuitem"], gem-menu, gem-menu-item`,
    );
  }

  function captureComposerFocus() {
    const element = activeComposer();
    if (!element) return null;

    const snapshot = {
      element,
      capturedAt: Date.now(),
      inputAtCapture: lastUserInputAt,
    };
    if ('selectionStart' in element && typeof element.selectionStart === 'number') {
      snapshot.selectionStart = element.selectionStart;
      snapshot.selectionEnd = element.selectionEnd;
      snapshot.selectionDirection = element.selectionDirection;
    } else {
      const selection = document.getSelection();
      if (selection?.rangeCount && element.contains(selection.anchorNode)) {
        snapshot.range = selection.getRangeAt(0).cloneRange();
      }
    }
    return snapshot;
  }

  function restoreComposerFocus(snapshot) {
    if (!snapshot?.element?.isConnected || lastUserInputAt > snapshot.inputAtCapture) return;
    snapshot.element.focus({ preventScroll: true });
    if (snapshot.range) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(snapshot.range);
    } else if ('selectionStart' in snapshot.element && snapshot.selectionStart != null) {
      snapshot.element.setSelectionRange(
        snapshot.selectionStart,
        snapshot.selectionEnd,
        snapshot.selectionDirection,
      );
    }
  }

  function inputRecentlyUsed() {
    return lastUserInputAt > 0 && Date.now() - lastUserInputAt < INPUT_IDLE_DELAY;
  }

  function userEditedAfter(snapshot) {
    return Boolean(snapshot && lastUserInputAt > snapshot.inputAtCapture);
  }

  function shouldPauseForUserInput({ allowFocusedComposer = false } = {}) {
    if (inputRecentlyUsed() || (!allowFocusedComposer && composerHasContent())) {
      pendingAutoApply = true;
      if (inputRecentlyUsed()) {
        scheduleAutoApply(INPUT_IDLE_DELAY - (Date.now() - lastUserInputAt) + 80);
      }
      return true;
    }
    return false;
  }

  function currentModeText(button = modeButton()) {
    if (!button) return '';
    const primary = button.querySelector('.picker-primary-text')?.textContent;
    if (primary) return normalize(primary);
    return normalize(`${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`);
  }

  function currentModelKey(button = modeButton()) {
    return modelKeyFromLabel(currentModeText(button));
  }

  function currentThinkingMode(button = modeButton()) {
    if (!button) return 'low';
    const secondary = button.querySelector('.picker-secondary-text')?.textContent?.trim().toLowerCase() || '';
    const fullText = normalize(`${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`).toLowerCase();
    if (secondary.includes('高') || /high/i.test(secondary) || fullText.includes('高') || /\bhigh\b/i.test(fullText)) {
      return 'high';
    }
    if (secondary.includes('中') || /medium|mid/i.test(secondary) || fullText.includes('中') || /\bmedium\b/i.test(fullText)) {
      return 'medium';
    }
    return 'low';
  }

  function currentMatchesModel(preferredSettings, button = modeButton()) {
    if (!button) return false;
    if (!preferredSettings.modelKey.startsWith('mode:') && !preferredSettings.modelKey.startsWith('label:')) {
      return currentModelKey(button) === preferredSettings.modelKey;
    }
    return currentModeText(button).toLowerCase().includes(normalize(preferredSettings.modelLabel).toLowerCase());
  }

  function menuItemLabel(item) {
    return normalize(item.querySelector('.label')?.textContent || item.textContent?.trim().split('\n')[0]);
  }

  function menuItemSublabel(item) {
    return normalize(item.querySelector('.sublabel')?.textContent);
  }

  function visibleMenuItems() {
    return [...document.querySelectorAll('[role="menuitem"]')].filter(isVisible);
  }

  function isThinkingMenuItem(item) {
    if (item.getAttribute('value') === THINKING_ITEM_VALUE) return true;
    const label = menuItemLabel(item);
    return THINKING_ITEM_PATTERN.test(label);
  }

  function readVisibleModels() {
    return visibleMenuItems()
      .filter((item) => !isThinkingMenuItem(item))
      .map((element) => {
        const label = menuItemLabel(element);
        const modeId = element.getAttribute('data-mode-id') || '';
        return {
          element,
          label,
          sublabel: menuItemSublabel(element),
          modeId,
          key: modelKeyFromLabel(label, modeId),
        };
      });
  }

  function thinkingMenuTrigger() {
    return (
      document.querySelector(`gem-menu-item[value="${THINKING_ITEM_VALUE}"], [role="menuitem"][value="${THINKING_ITEM_VALUE}"]`) ||
      visibleMenuItems().find((item) => THINKING_ITEM_PATTERN.test(menuItemLabel(item))) ||
      null
    );
  }

  function thinkingLevelFromItem(item) {
    const label = menuItemLabel(item).toLowerCase();
    const sublabel = menuItemSublabel(item).toLowerCase();
    const combined = `${label} ${sublabel}`;
    if (label === '高' || /high|详尽|comprehensive/i.test(combined)) return 'high';
    if (label === '中' || /medium|适中|balanced/i.test(combined)) return 'medium';
    if (label === '低' || /low|高效|快速|fast/i.test(combined)) return 'low';
    return null;
  }

  async function openThinkingSubmenu() {
    const trigger = thinkingMenuTrigger();
    if (!trigger) return [];

    const controlsId = trigger.getAttribute('aria-controls');
    if (controlsId) {
      const existingMenu = document.getElementById(controlsId);
      if (existingMenu && isVisible(existingMenu)) {
        const items = [...existingMenu.querySelectorAll('[role="menuitem"]')].filter(isVisible);
        if (items.length) return items;
      }
    }

    trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    trigger.click();

    const items = await waitFor(() => {
      let container = controlsId ? document.getElementById(controlsId) : null;
      if (!container) {
        const menus = [...document.querySelectorAll('gem-menu[role="menu"]')].filter(isVisible);
        if (menus.length > 1) {
          container = menus[menus.length - 1];
        }
      }
      if (container) {
        const menuItems = [...container.querySelectorAll('[role="menuitem"]')].filter(isVisible);
        if (menuItems.length) return menuItems;
      }
      return null;
    }, 3000);

    return items || [];
  }

  async function selectThinkingLevel(targetLevel) {
    if (currentThinkingMode() === targetLevel) return true;

    const menu = await openModeMenu();
    if (!menu.length) return false;

    const trigger = thinkingMenuTrigger();
    if (!trigger) {
      await closeModeMenu();
      return false;
    }

    const subItems = await openThinkingSubmenu();
    const targetItem = subItems.find((item) => thinkingLevelFromItem(item) === targetLevel);
    if (!targetItem) {
      await closeModeMenu();
      return false;
    }

    targetItem.click();
    return true;
  }

  async function waitFor(getValue, timeout = 12000, interval = 150) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = getValue();
      if (value) return value;
      await sleep(interval);
    }
    return null;
  }

  async function openModeMenu() {
    let models = readVisibleModels();
    if (models.length) return models;

    const button = await waitFor(modeButton);
    if (!button) return [];
    button.click();
    models = await waitFor(() => {
      const items = readVisibleModels();
      return items.length ? items : null;
    }, 5000);
    return models || [];
  }

  async function closeModeMenu(focusSnapshot = null) {
    if (!visibleMenuItems().length) return;
    modeButton()?.click();
    await waitFor(() => !visibleMenuItems().length, 2000);
    if (visibleMenuItems().length) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      await waitFor(() => !visibleMenuItems().length, 1000);
    }
    restoreComposerFocus(focusSnapshot);
  }

  async function discoverModels() {
    const menuWasOpen = visibleMenuItems().length > 0;
    const models = await openModeMenu();
    if (!menuWasOpen) await closeModeMenu();
    if (models.length) saveModelCache(models);
    return models.map(({ key, label, sublabel, modeId }) => ({ key, label, sublabel, modeId }));
  }

  function desiredModel(models, preferredSettings) {
    return models.find((model) => model.key === preferredSettings.modelKey) ||
      models.find((model) => normalize(model.label) === normalize(preferredSettings.modelLabel));
  }

  function isDesiredState(preferredSettings) {
    const button = modeButton();
    return button &&
      currentMatchesModel(preferredSettings, button) &&
      currentThinkingMode(button) === preferredSettings.thinking;
  }

  async function applyDefaults({
    force = false,
    quiet = false,
    allowFocusedComposer = false,
    focusSnapshot: suppliedFocusSnapshot = null,
  } = {}) {
    if (working || !isHomePage() || (!force && !settings.enabled)) return false;
    if (isDesiredState(settings)) return true;
    if (!force && shouldPauseForUserInput({ allowFocusedComposer })) {
      if (!quiet) showToast(text.deferred);
      return false;
    }

    const focusSnapshot = suppliedFocusSnapshot || captureComposerFocus();
    working = true;
    try {
      const button = await waitFor(modeButton);
      if (!button || !isHomePage()) return false;
      if (!force && shouldPauseForUserInput({ allowFocusedComposer })) return false;

      // Always select base model first if it does not match
      if (!currentMatchesModel(settings, button)) {
        const models = await openModeMenu();
        if (!force && (shouldPauseForUserInput({ allowFocusedComposer }) || userEditedAfter(focusSnapshot))) {
          await closeModeMenu(captureComposerFocus() || focusSnapshot);
          return false;
        }
        const target = desiredModel(models, settings);
        if (!target?.element) {
          await closeModeMenu();
          if (!quiet) showToast(text.unavailable, true);
          return false;
        }

        if (!force && (shouldPauseForUserInput({ allowFocusedComposer }) || userEditedAfter(focusSnapshot))) {
          await closeModeMenu(captureComposerFocus() || focusSnapshot);
          return false;
        }
        target.element.click();
        restoreComposerFocus(focusSnapshot);

        const modelSelected = await waitFor(() => {
          const updated = modeButton();
          return updated && currentMatchesModel(settings, updated) && updated;
        }, 5000);

        if (!modelSelected) {
          if (!quiet) showToast(text.unavailable, true);
          return false;
        }
        await sleep(150);
      }

      // Check and apply thinking level
      if (currentThinkingMode() !== settings.thinking) {
        if (!force && (shouldPauseForUserInput({ allowFocusedComposer }) || userEditedAfter(focusSnapshot))) return false;

        const thinkingApplied = await selectThinkingLevel(settings.thinking);
        restoreComposerFocus(focusSnapshot);

        if (!thinkingApplied) {
          if (!quiet) showToast(text.thinkingUnavailable, true);
          return false;
        }
      }

      const applied = await waitFor(() => isDesiredState(settings), 5000);
      if (applied && !quiet) showToast(text.applied);
      restoreComposerFocus(focusSnapshot);
      return Boolean(applied);
    } finally {
      working = false;
    }
  }

  function promptSubmitKey(event) {
    return event.key === 'Enter' &&
      !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey &&
      !event.isComposing && !event.repeat;
  }

  function shouldInterceptSubmit() {
    return isHomePage() && settings.enabled && !userSelectedModel &&
      Boolean(modeButton()) && !isDesiredState(settings) && Boolean(sendButton());
  }

  async function continueSubmit(originalButton, focusSnapshot) {
    let applied = false;
    try {
      applied = await applyDefaults({
        force: true,
        quiet: true,
        allowFocusedComposer: true,
        focusSnapshot,
      });
    } catch (error) {
      console.warn(`[${SCRIPT_ID}] submit-time model selection failed`, error);
    }

    restoreComposerFocus(focusSnapshot);
    await sleep(80);

    const button = await waitFor(() => {
      const current = sendButton();
      if (current) return current;
      if (originalButton?.isConnected && originalButton.tagName === 'BUTTON') return originalButton;
      return null;
    }, 3000);

    if (!button) {
      if (!applied && !isDesiredState(settings)) showToast(text.submitFallback, true);
      // Fallback: simulate Enter key on composer
      const composer = focusSnapshot?.element || activeComposer() || document.querySelector('.ql-editor');
      if (composer) {
        replayingSubmit = true;
        try {
          composer.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true,
          }));
        } finally {
          setTimeout(() => {
            replayingSubmit = false;
            submitting = false;
          }, 150);
        }
        return;
      }
      submitting = false;
      return;
    }

    if (!applied && !isDesiredState(settings)) showToast(text.submitFallback, true);

    replayingSubmit = true;
    try {
      button.click();
    } catch (err) {
      console.warn(`[${SCRIPT_ID}] button.click failed, trying enter on composer`, err);
      const composer = focusSnapshot?.element || activeComposer() || document.querySelector('.ql-editor');
      if (composer) {
        composer.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
          composed: true,
        }));
      }
    } finally {
      setTimeout(() => {
        replayingSubmit = false;
        submitting = false;
      }, 150);
    }
  }

  function interceptSubmit(event, originalButton = sendButton()) {
    if (replayingSubmit || submitting || !shouldInterceptSubmit()) return;
    const focusSnapshot = captureComposerFocus();
    event.preventDefault();
    event.stopImmediatePropagation();
    submitting = true;
    void continueSubmit(originalButton, focusSnapshot);
  }

  function mergedModelChoices(liveModels) {
    const candidates = [
      ...liveModels,
      ...loadModelCache(),
      ...FALLBACK_MODELS,
      { key: settings.modelKey, label: settings.modelLabel },
    ];
    const seen = new Set();
    return candidates.filter((model) => {
      if (!model?.key || seen.has(model.key)) return false;
      seen.add(model.key);
      return true;
    });
  }

  function renderModelOptions(models) {
    const select = ui.shadow.querySelector('[data-field="model"]');
    select.replaceChildren();
    for (const model of mergedModelChoices(models)) {
      const option = document.createElement('option');
      option.value = model.key;
      option.dataset.label = model.label;
      option.textContent = model.sublabel ? `${model.label} — ${model.sublabel}` : model.label;
      option.selected = model.key === settings.modelKey;
      select.append(option);
    }
  }

  async function openSettings() {
    ensureUi();
    const panel = ui.shadow.querySelector('[data-panel]');
    const status = ui.shadow.querySelector('[data-status]');
    panel.hidden = false;
    ui.shadow.querySelector('[data-field="enabled"]').checked = settings.enabled;
    ui.shadow.querySelector('[data-field="thinking"]').value = settings.thinking;
    renderModelOptions([]);
    status.textContent = text.loading;
    status.dataset.error = 'false';

    const models = await discoverModels();
    renderModelOptions(models);
    status.textContent = models.length ? text.liveModels : text.fallbackModels;
    status.dataset.error = models.length ? 'false' : 'true';
  }

  function closeSettings() {
    ui?.shadow.querySelector('[data-panel]')?.setAttribute('hidden', '');
  }

  async function handleSave() {
    const modelSelect = ui.shadow.querySelector('[data-field="model"]');
    const selected = modelSelect.selectedOptions[0];
    saveSettings({
      enabled: ui.shadow.querySelector('[data-field="enabled"]').checked,
      modelKey: modelSelect.value,
      modelLabel: selected?.dataset.label || selected?.textContent || modelSelect.value,
      thinking: ui.shadow.querySelector('[data-field="thinking"]').value,
    });
    closeSettings();
    showToast(text.saved);
    lastAppliedNavigationId = 0;
    lastAttemptNavigationId = 0;
    pendingAutoApply = false;
    if (isHomePage()) await applyDefaults({ force: true, allowFocusedComposer: true });
  }

  function handleReset() {
    saveSettings(DEFAULT_SETTINGS);
    ui.shadow.querySelector('[data-field="enabled"]').checked = true;
    ui.shadow.querySelector('[data-field="thinking"]').value = DEFAULT_SETTINGS.thinking;
    renderModelOptions([]);
    showToast(text.resetDone);
  }

  function showToast(message, isError = false) {
    ensureUi();
    const toast = ui.shadow.querySelector('[data-toast]');
    toast.textContent = message;
    toast.dataset.error = String(isError);
    toast.hidden = false;
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function getSavedLauncherPosition() {
    try {
      const pos = GM_getValue(POSITION_KEY, null);
      if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
        const maxLeft = Math.max(10, window.innerWidth - 130);
        const maxTop = Math.max(10, window.innerHeight - 45);
        return {
          left: Math.min(Math.max(8, pos.left), maxLeft),
          top: Math.min(Math.max(8, pos.top), maxTop),
        };
      }
    } catch {}
    return null;
  }

  function makeLauncherDraggable(launcher) {
    let isPointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    const dragThreshold = 5;

    const savedPos = getSavedLauncherPosition();
    if (savedPos) {
      launcher.style.left = `${savedPos.left}px`;
      launcher.style.top = `${savedPos.top}px`;
      launcher.style.right = 'auto';
      launcher.style.bottom = 'auto';
    }

    launcher.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      isPointerDown = true;
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = launcher.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      try {
        launcher.setPointerCapture(e.pointerId);
      } catch {}
    });

    launcher.addEventListener('pointermove', (e) => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!isDragging && Math.hypot(dx, dy) > dragThreshold) {
        isDragging = true;
        launcher.classList.add('dragging');
      }
      if (isDragging) {
        let nextLeft = initialLeft + dx;
        let nextTop = initialTop + dy;
        const maxLeft = window.innerWidth - launcher.offsetWidth - 8;
        const maxTop = window.innerHeight - launcher.offsetHeight - 8;
        nextLeft = Math.min(Math.max(8, nextLeft), maxLeft);
        nextTop = Math.min(Math.max(8, nextTop), maxTop);
        launcher.style.left = `${nextLeft}px`;
        launcher.style.top = `${nextTop}px`;
        launcher.style.right = 'auto';
        launcher.style.bottom = 'auto';
      }
    });

    const stopDrag = (e) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      try {
        launcher.releasePointerCapture(e.pointerId);
      } catch {}

      if (isDragging) {
        launcher.classList.remove('dragging');
        const rect = launcher.getBoundingClientRect();
        GM_setValue(POSITION_KEY, { left: Math.round(rect.left), top: Math.round(rect.top) });
        launcher.dataset.dragEndedAt = String(Date.now());
        setTimeout(() => {
          isDragging = false;
        }, 50);
      }
    };

    launcher.addEventListener('pointerup', stopDrag);
    launcher.addEventListener('pointercancel', stopDrag);

    launcher.addEventListener('click', (e) => {
      const dragEndedAt = Number(launcher.dataset.dragEndedAt || 0);
      if (isDragging || (dragEndedAt && Date.now() - dragEndedAt < 250)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      }
    }, true);

    window.addEventListener('resize', () => {
      const rect = launcher.getBoundingClientRect();
      const maxLeft = window.innerWidth - launcher.offsetWidth - 8;
      const maxTop = window.innerHeight - launcher.offsetHeight - 8;
      if (rect.left > maxLeft || rect.top > maxTop) {
        const newLeft = Math.min(Math.max(8, rect.left), maxLeft);
        const newTop = Math.min(Math.max(8, rect.top), maxTop);
        launcher.style.left = `${newLeft}px`;
        launcher.style.top = `${newTop}px`;
        launcher.style.right = 'auto';
        launcher.style.bottom = 'auto';
        GM_setValue(POSITION_KEY, { left: Math.round(newLeft), top: Math.round(newTop) });
      }
    });
  }

  function ensureUi() {
    if (ui?.host?.isConnected) return;

    const host = document.createElement('div');
    host.id = SCRIPT_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    setSafeHTML(shadow, `
      <style>
        :host { all: initial; }
        *, *::before, *::after { box-sizing: border-box; }
        button, select, input { font: inherit; }
        .launcher {
          position: fixed; right: 18px; bottom: 92px; z-index: 2147483645;
          display: flex; align-items: center; gap: 7px; padding: 10px 14px;
          border: 1px solid color-mix(in srgb, #7cacf8 42%, transparent);
          border-radius: 999px; color: #eaf2ff; background: rgba(31, 36, 48, .92);
          box-shadow: 0 8px 28px rgba(0, 0, 0, .26); cursor: grab;
          font: 600 13px/1.1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          backdrop-filter: blur(12px);
          user-select: none; -webkit-user-select: none;
          touch-action: none;
          transition: background .15s ease, box-shadow .15s ease, border-color .15s ease;
        }
        .launcher:hover {
          background: rgba(44, 52, 68, .97);
          box-shadow: 0 10px 32px rgba(0, 0, 0, .32);
        }
        .launcher.dragging {
          cursor: grabbing !important;
          transform: scale(1.04);
          box-shadow: 0 14px 38px rgba(0, 0, 0, .45);
          opacity: 0.95;
        }
        .launcher:focus-visible, .btn:focus-visible, select:focus-visible, input:focus-visible {
          outline: 3px solid rgba(138, 180, 248, .48); outline-offset: 2px;
        }
        .gear { width: 16px; height: 16px; fill: currentColor; }
        .overlay {
          position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: center;
          padding: 20px; background: rgba(7, 10, 16, .58); backdrop-filter: blur(4px);
          font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        [hidden] { display: none !important; }
        .dialog {
          width: min(470px, 100%); padding: 24px; border: 1px solid rgba(138, 180, 248, .28);
          border-radius: 20px; color: #e8eaed; background: #202124;
          box-shadow: 0 24px 80px rgba(0, 0, 0, .46);
        }
        h2 { margin: 0; font-size: 21px; line-height: 1.25; letter-spacing: -.2px; }
        .subtitle { margin: 8px 0 20px; color: #bdc1c6; }
        .toggle { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; font-weight: 600; }
        .toggle input { width: 18px; height: 18px; accent-color: #8ab4f8; }
        .field { display: grid; gap: 7px; margin-top: 14px; }
        .field > span { font-weight: 600; }
        select {
          width: 100%; padding: 10px 12px; border: 1px solid #5f6368; border-radius: 10px;
          color: #e8eaed; background: #292a2d;
        }
        .status { min-height: 21px; margin: 12px 0 0; color: #9aa0a6; font-size: 12px; }
        .status[data-error="true"] { color: #f6aea9; }
        .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 9px; margin-top: 22px; }
        .btn { padding: 9px 13px; border: 0; border-radius: 999px; cursor: pointer; font-weight: 650; }
        .btn.secondary { color: #d2e3fc; background: transparent; }
        .btn.secondary:hover { background: rgba(138, 180, 248, .10); }
        .btn.primary { color: #10233f; background: #a8c7fa; }
        .btn.primary:hover { background: #b7d2ff; }
        .btn.reset { margin-right: auto; color: #bdc1c6; background: transparent; }
        .toast {
          position: fixed; left: 50%; bottom: 28px; z-index: 2147483647;
          max-width: min(440px, calc(100vw - 32px)); transform: translateX(-50%);
          padding: 11px 16px; border-radius: 10px; color: #e8f0fe; background: #303134;
          box-shadow: 0 8px 30px rgba(0, 0, 0, .34); font: 600 13px/1.4 -apple-system, sans-serif;
        }
        .toast[data-error="true"] { color: #3c0b08; background: #f6aea9; }
        @media (prefers-color-scheme: light) {
          .launcher { color: #174ea6; background: rgba(255, 255, 255, .94); }
          .dialog { color: #202124; background: #fff; }
          .subtitle, .status, .btn.reset { color: #5f6368; }
          select { color: #202124; background: #fff; }
          .toast { color: #202124; background: #fff; }
        }
        @media (max-width: 560px) {
          .launcher span { display: none; }
          .dialog { padding: 20px; }
        }
      </style>
      <button class="launcher" data-open title="${text.buttonTitle}" aria-label="${text.buttonTitle}">
        <svg class="gear" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94a7.6 7.6 0 0 0 .05-.94 7.6 7.6 0 0 0-.05-.94l2.03-1.58a.49.49 0 0 0 .12-.64l-1.92-3.32a.49.49 0 0 0-.61-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94L14.38 2.8A.5.5 0 0 0 13.89 2h-3.78a.5.5 0 0 0-.49.4l-.36 2.52c-.59.24-1.13.55-1.64.94L5.24 4.9a.5.5 0 0 0-.62.22L2.73 8.44a.5.5 0 0 0 .12.64l2.02 1.58c-.03.31-.05.63-.05.94s.02.63.05.94l-2.02 1.58a.5.5 0 0 0-.12.64l1.89 3.32a.5.5 0 0 0 .62.22l2.38-.96c.51.39 1.05.7 1.64.94l.36 2.52a.5.5 0 0 0 .49.4h3.78a.5.5 0 0 0 .49-.4l.36-2.52c.59-.24 1.13-.55 1.63-.94l2.39.96a.49.49 0 0 0 .61-.22l1.92-3.32a.49.49 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"/></svg>
        <span>${text.button}</span>
      </button>
      <div class="overlay" data-panel hidden>
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="gmdms-title">
          <h2 id="gmdms-title">${text.title}</h2>
          <p class="subtitle">${text.subtitle}</p>
          <label class="toggle"><input type="checkbox" data-field="enabled"> ${text.enabled}</label>
          <label class="field"><span>${text.model}</span><select data-field="model"></select></label>
          <label class="field"><span>${text.thinking}</span><select data-field="thinking">
            <option value="low">${text.thinkingLow}</option>
            <option value="medium">${text.thinkingMedium}</option>
            <option value="high">${text.thinkingHigh}</option>
          </select></label>
          <p class="status" data-status aria-live="polite"></p>
          <div class="actions">
            <button class="btn reset" data-reset>${text.reset}</button>
            <button class="btn secondary" data-cancel>${text.cancel}</button>
            <button class="btn primary" data-save>${text.save}</button>
          </div>
        </section>
      </div>
      <div class="toast" data-toast hidden role="status" aria-live="polite"></div>
    `);

    document.body.append(host);
    ui = { host, shadow, toastTimer: 0 };
    const launcher = shadow.querySelector('[data-open]');
    makeLauncherDraggable(launcher);
    launcher.addEventListener('click', openSettings);
    shadow.querySelector('[data-cancel]').addEventListener('click', closeSettings);
    shadow.querySelector('[data-save]').addEventListener('click', handleSave);
    shadow.querySelector('[data-reset]').addEventListener('click', handleReset);
    shadow.querySelector('[data-panel]').addEventListener('click', (event) => {
      if (event.target.matches('[data-panel]')) closeSettings();
    });
    shadow.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSettings();
    });
  }

  async function autoApply() {
    ensureUi();
    if (!isHomePage() || !settings.enabled || lastAppliedNavigationId === navigationId) return;
    if (userSelectedModel || visibleMenuItems().length) return;

    // Only pause if user is actually typing or already wrote prompt content
    if (inputRecentlyUsed() || composerHasContent()) {
      pendingAutoApply = true;
      if (inputRecentlyUsed()) {
        scheduleAutoApply(INPUT_IDLE_DELAY - (Date.now() - lastUserInputAt) + 80);
      }
      return;
    }

    if (lastAttemptNavigationId === navigationId && !pendingAutoApply) return;

    pendingAutoApply = false;
    lastAttemptNavigationId = navigationId;
    const applied = await applyDefaults({ quiet: true, allowFocusedComposer: true });
    if (applied) lastAppliedNavigationId = navigationId;
  }

  function scheduleAutoApply(delay = 200) {
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(autoApply, delay);
  }

  function navigationChanged() {
    navigationId += 1;
    lastAttemptNavigationId = 0;
    lastAppliedNavigationId = 0;
    pendingAutoApply = false;
    userSelectedModel = false;
    scheduleAutoApply(150);
  }

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      navigationChanged();
      return result;
    };
  }

  addEventListener('popstate', navigationChanged);
  document.addEventListener('input', (event) => {
    if (composerElement(event.target)) {
      lastUserInputAt = Date.now();
      pendingAutoApply = true;
    }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (composerElement(event.target) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      lastUserInputAt = Date.now();
      pendingAutoApply = true;
    }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (composerElement(event.target) && promptSubmitKey(event)) interceptSubmit(event);
  }, true);
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest(SEND_BUTTON_SELECTOR) : null;
    const realBtn = target?.tagName === 'BUTTON' ? target : target?.querySelector('button');
    if (realBtn && isVisible(realBtn)) interceptSubmit(event, realBtn);
  }, true);
  document.addEventListener('pointerdown', (event) => {
    if (event.isTrusted && modeControlElement(event.target)) {
      userSelectedModel = true;
      pendingAutoApply = false;
    }
  }, true);
  document.addEventListener('focusout', (event) => {
    if (composerElement(event.target) && !modeControlElement(event.relatedTarget)) {
      if (!composerHasContent()) {
        scheduleAutoApply(150);
      }
    }
  }, true);
  new MutationObserver(() => {
    ensureUi();
    scheduleAutoApply();
  }).observe(document.documentElement, { childList: true, subtree: true });

  GM_registerMenuCommand(text.buttonTitle, openSettings);
  ensureUi();
  scheduleAutoApply();
})();
