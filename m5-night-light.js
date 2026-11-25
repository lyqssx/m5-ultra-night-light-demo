const byId = (id) => document.getElementById(id);
const control = byId('control');
const settings = byId('settings');
const controlContent = control.querySelector('.control-content');
const settingsButton = byId('open-settings');
const lightHelpButton = byId('auto-light-help');
const lightHelpOverlay = byId('light-help-overlay');
const autoLightDuration = byId('auto-light-duration');
const lightCountdown = byId('light-countdown');
const lightSwitch = byId('manual-light');
const autoSwitch = byId('auto-setting');
const brightnessInput = byId('brightness-input');
const brightnessControl = byId('brightness');
const pauseButton = byId('pause');
const finishButton = byId('finish-session');
const customButton = byId('custom-duration');
const minutes = byId('custom-minutes');
const seconds = byId('custom-seconds');
const durationButtons = [...document.querySelectorAll('[data-duration]')];

const settingsKey = 'm5-ultra-night-light';

let autoEnabled = true;
let duration = 30;
let customSelected = false;
let lightOn = false;
let brightness = 50;
let automaticTimer = null;
let session = 'running';
let dialog = null;
let settingsReturnTarget = settingsButton;
let finishTimer = null;

function restorePreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey));
    if (typeof saved?.enabled === 'boolean') autoEnabled = saved.enabled;
    if (Number.isInteger(saved?.duration) && saved.duration >= 1 && saved.duration <= 3599) {
      duration = saved.duration;
      customSelected = saved.custom === true;
    }
  } catch {
    // Some embedded browsers restrict storage for local files.
  }
}

function savePreferences() {
  try {
    localStorage.setItem(settingsKey, JSON.stringify({
      enabled: autoEnabled,
      duration,
      custom: customSelected
    }));
  } catch {
    // Keep the changes available in the current session.
  }
}

function formatDuration(total, locale = "en") {
  const wholeMinutes = Math.floor(total / 60);
  const remaining = total % 60;
  return [
    wholeMinutes ? wholeMinutes + (locale === 'zh' ? ' 分钟' : 'm') : '',
    remaining ? remaining + (locale === 'zh' ? ' 秒' : 's') : ''
  ].filter(Boolean).join(' ');
}

function updateBrightness() {
  brightnessInput.value = brightness;
  byId('brightness-value').textContent = brightness + '%';
  brightnessControl.style.setProperty('--brightness', brightness + '%');
  brightnessControl.style.setProperty('--brightness-ratio', brightness / 100);
  brightnessControl.dataset.level = brightness;
}

function setLight(enabled) {
  clearTimeout(automaticTimer);
  automaticTimer = null;
  lightCountdown.hidden = true;
  lightCountdown.textContent = '';
  lightOn = enabled;
  lightSwitch.classList.toggle('on', enabled);
  lightSwitch.setAttribute('aria-checked', String(enabled));
  brightnessControl.hidden = !enabled;
  control.classList.toggle('has-light', enabled);
  if (enabled) {
    updateBrightness();
    revealBrightness();
  }
}

function startAutomaticCountdown() {
  const deadline = performance.now() + duration * 1000;

  function tick() {
    const millisecondsLeft = deadline - performance.now();
    if (millisecondsLeft <= 0) {
      setLight(false);
      return;
    }

    const secondsLeft = Math.ceil(millisecondsLeft / 1000);
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, '0');
    lightCountdown.textContent = minutes + ':' + seconds;
    lightCountdown.hidden = false;
    automaticTimer = setTimeout(tick, millisecondsLeft - (secondsLeft - 1) * 1000);
  }

  tick();
}

function revealBrightness() {
  if (control.hidden || brightnessControl.hidden) return;
  const cardBottom = brightnessControl.closest('.light-card').getBoundingClientRect().bottom;
  const visibleBottom = controlContent.getBoundingClientRect().bottom;
  if (cardBottom > visibleBottom) controlContent.scrollTop += Math.ceil(cardBottom - visibleBottom + 4);
}

function updateSettings() {
  autoSwitch.classList.toggle('on', autoEnabled);
  autoSwitch.setAttribute('aria-checked', String(autoEnabled));
  byId('duration-settings').hidden = !autoEnabled;
  const durationLabel = formatDuration(duration);
  autoLightDuration.textContent = autoEnabled ? durationLabel : 'Off';
  byId('light-help-title').textContent = autoEnabled ? '暂停自动亮灯已开启' : '暂停自动亮灯已关闭';
  byId('light-help-description').textContent = autoEnabled
    ? '暂停吸奶时，夜灯会自动亮起，方便查看奶碗中的奶量。夜灯会在 ' + formatDuration(duration, 'zh') + '后熄灭，你可以在设置中更改亮灯时长。'
    : '暂停吸奶时，夜灯不会自动亮起，你仍可以手动开灯。可前往设置开启自动亮灯，并选择亮灯时长。';
  byId('auto-setting-copy').textContent = autoEnabled
    ? 'When you pause pumping, the light turns on so you can check the milk level, then turns off after the time below.'
    : 'Turn this on to light the milk cup when you pause. You can still turn on the light manually from Pump Control.';

  for (const button of durationButtons) {
    button.setAttribute('aria-pressed', String(!customSelected && Number(button.dataset.duration) === duration));
  }
  customButton.setAttribute('aria-pressed', String(customSelected));
  customButton.textContent = customSelected ? durationLabel : 'Custom';
}

function showSettings(returnTarget) {
  settingsReturnTarget = returnTarget;
  control.hidden = true;
  settings.hidden = false;
  settings.querySelector('.settings-content').scrollTop = 0;
  if (returnTarget === lightHelpButton) {
    byId('light-settings').scrollIntoView({ block: 'nearest' });
    autoSwitch.focus({ preventScroll: true });
    return;
  }
  byId('settings-back').focus({ preventScroll: true });
}

function openDialog(overlay, trigger) {
  const page = control.hidden ? settings : control;
  dialog = { overlay, trigger, page };
  page.inert = true;
  overlay.hidden = false;
  overlay.querySelector('button').focus({ preventScroll: true });
}

function closeDialog(restoreFocus = true) {
  const { overlay, trigger, page } = dialog;
  overlay.hidden = true;
  page.inert = false;
  dialog = null;
  if (restoreFocus) trigger.focus({ preventScroll: true });
}

function setSession(nextState) {
  session = nextState;
  pauseButton.setAttribute('aria-pressed', String(session === 'paused'));
  pauseButton.setAttribute('aria-label', {
    running: 'Pause pumping', paused: 'Resume pumping', ended: 'Start pumping'
  }[session]);
  pauseButton.classList.toggle('is-ended', session === 'ended');
  finishButton.disabled = session === 'ended';
}

settingsButton.addEventListener('click', () => showSettings(settingsButton));
lightHelpButton.addEventListener('click', () => openDialog(lightHelpOverlay, lightHelpButton));
byId('close-light-help').addEventListener('click', () => closeDialog());
byId('light-help-settings').addEventListener('click', () => {
  closeDialog(false);
  showSettings(lightHelpButton);
});
byId('settings-back').addEventListener('click', () => {
  settings.hidden = true;
  control.hidden = false;
  revealBrightness();
  settingsReturnTarget.focus({ preventScroll: true });
});

lightSwitch.addEventListener('click', () => setLight(!lightOn));
brightnessInput.addEventListener('input', () => {
  const value = Number(brightnessInput.value);
  if (value === 0) {
    brightness = 50;
    setLight(false);
    lightSwitch.focus({ preventScroll: true });
    return;
  }
  brightness = value;
  updateBrightness();
});

pauseButton.addEventListener('click', () => {
  if (session !== 'running') {
    setSession('running');
    return;
  }
  setSession('paused');
  if (autoEnabled && !lightOn) {
    setLight(true);
    startAutomaticCountdown();
  }
});

function finishSession() {
  setSession('ended');
  setLight(false);
}

function beginFinish() {
  if (!finishButton.disabled) finishTimer = setTimeout(finishSession, 750);
}
function cancelFinish() {
  clearTimeout(finishTimer);
}

finishButton.addEventListener('pointerdown', beginFinish);
finishButton.addEventListener('pointerup', cancelFinish);
finishButton.addEventListener('pointerleave', cancelFinish);
finishButton.addEventListener('pointercancel', cancelFinish);
finishButton.addEventListener('keydown', (event) => {
  if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) beginFinish();
});
finishButton.addEventListener('keyup', cancelFinish);
finishButton.addEventListener('blur', cancelFinish);

autoSwitch.addEventListener('click', () => {
  autoEnabled = !autoEnabled;
  savePreferences();
  updateSettings();
});
for (const button of durationButtons) {
  button.addEventListener('click', () => {
    duration = Number(button.dataset.duration);
    customSelected = false;
    savePreferences();
    updateSettings();
  });
}

customButton.addEventListener('click', () => {
  minutes.value = Math.floor(duration / 60);
  seconds.value = duration % 60;
  seconds.setCustomValidity('');
  openDialog(byId('custom-overlay'), customButton);
});
byId('close-custom').addEventListener('click', () => closeDialog());
for (const input of [minutes, seconds]) {
  input.addEventListener('input', () => seconds.setCustomValidity(''));
}
byId('custom-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const chosenDuration = Number(minutes.value) * 60 + Number(seconds.value);
  if (chosenDuration === 0) {
    seconds.setCustomValidity('Enter a duration greater than zero.');
    seconds.reportValidity();
    return;
  }
  duration = chosenDuration;
  customSelected = true;
  savePreferences();
  updateSettings();
  closeDialog();
});

document.addEventListener('keydown', (event) => {
  if (!dialog) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDialog();
  }
  if (event.key === 'Tab') {
    const controls = [...dialog.overlay.querySelectorAll('button, input')];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

restorePreferences();
updateSettings();
