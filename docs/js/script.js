// アプリケーションの状態
let audioContext = null;
let oscillator = null;
let gainNode = null;
let isPlaying = false;
let autoPlayEnabled = true;
let autoPlayInterval = null;
let countdown = null;
let nextPlayTime = null;

// ローカルストレージのキー
const STORAGE_KEYS = {
  VOLUME: 'motion_sickness_prevention_volume',
  INTERVAL: 'motion_sickness_prevention_interval',
  AUTO_PLAY: 'motion_sickness_prevention_auto_play'
};

// DOM要素
const playButton = document.getElementById('playButton');
const stopButton = document.getElementById('stopButton');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const intervalInput = document.getElementById('intervalInput');
const autoPlayToggle = document.getElementById('autoPlayToggle');
const timerElement = document.getElementById('timer');
const nextPlayElement = document.getElementById('nextPlay');

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
  // 保存された設定の読み込み
  loadSavedSettings();
  
  playButton.addEventListener('click', startTone);
  stopButton.addEventListener('click', () => stopTone(true)); // 明示的な停止
  volumeSlider.addEventListener('input', updateVolumeAndSave);
  autoPlayToggle.addEventListener('change', toggleAutoPlayAndSave);
  intervalInput.addEventListener('change', updateIntervalAndSave);
  
  // 初期値の設定
  updateVolumeDisplay();
  
  // 初期状態は「待機中」
  timerElement.textContent = '待機中';
  nextPlayElement.textContent = '';
});

// 保存された設定の読み込み
function loadSavedSettings() {
  // 音量の読み込み
  const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
  if (savedVolume !== null) {
    volumeSlider.value = savedVolume;
    updateVolumeDisplay();
  }
  
  // 再生間隔の読み込み
  const savedInterval = localStorage.getItem(STORAGE_KEYS.INTERVAL);
  if (savedInterval !== null) {
    intervalInput.value = savedInterval;
  }
  
  // 自動再生モードの読み込み
  const savedAutoPlay = localStorage.getItem(STORAGE_KEYS.AUTO_PLAY);
  if (savedAutoPlay !== null) {
    const isAutoPlayEnabled = savedAutoPlay === 'true';
    autoPlayToggle.checked = isAutoPlayEnabled;
    autoPlayEnabled = isAutoPlayEnabled;
  }
}

// 音量表示の更新
function updateVolumeDisplay() {
  volumeValue.textContent = volumeSlider.value;
}

// 音量の更新と保存
function updateVolumeAndSave() {
  updateVolumeDisplay();
  if (gainNode) {
    gainNode.gain.value = volumeSlider.value / 100 * 0.5; // 最大音量を0.5に制限
  }
  
  // 設定を保存
  localStorage.setItem(STORAGE_KEYS.VOLUME, volumeSlider.value);
}

// 音量の更新（保存なし - 内部用）
function updateVolume() {
  updateVolumeDisplay();
  if (gainNode) {
    gainNode.gain.value = volumeSlider.value / 100 * 0.5; // 最大音量を0.5に制限
  }
}

// 間隔の更新と保存
function updateIntervalAndSave() {
  // 値の検証
  let value = parseInt(intervalInput.value);
  if (isNaN(value) || value < 1) {
    intervalInput.value = 1;
  } else if (value > 120) {
    intervalInput.value = 120;
  }
  
  // 設定を保存
  localStorage.setItem(STORAGE_KEYS.INTERVAL, intervalInput.value);
  
  // 自動再生が有効で、かつ次の再生時間が設定されている場合のみインターバルをリセット
  if (autoPlayEnabled && nextPlayTime !== null) {
    resetAutoPlayInterval();
  }
}

// 純音の再生開始
function startTone() {
  if (isPlaying) return;
  
  // 自動再生モードの場合、カウントダウンをリセット
  if (autoPlayEnabled) {
    clearAutoPlayTimeout();
    nextPlayElement.textContent = '';
  }
  
  try {
    // AudioContextの初期化
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();
    
    // オシレーターの設定
    oscillator.type = 'sine'; // 正弦波（純音）
    oscillator.frequency.value = 100; // 100Hz
    
    // 音量の設定
    const volume = volumeSlider.value / 100 * 0.5; // 最大音量を0.5に制限
    gainNode.gain.value = volume;
    
    // 接続
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 再生開始
    oscillator.start();
    isPlaying = true;
    
    // UI更新
    playButton.disabled = true;
    stopButton.disabled = false;
    timerElement.textContent = '再生中: 60秒';
    
    // 1分間のカウントダウン
    let timeLeft = 60;
    countdown = setInterval(() => {
      timeLeft--;
      timerElement.textContent = `再生中: ${timeLeft}秒`;
      
      if (timeLeft <= 0) {
        stopTone();
      }
    }, 1000);
    
    // 1分後に自動停止
    setTimeout(() => {
      if (isPlaying) {
        stopTone();
      }
    }, 60000);
  } catch (error) {
    console.error('音声の再生中にエラーが発生しました:', error);
    alert('音声の再生中にエラーが発生しました。ブラウザがWeb Audio APIをサポートしていない可能性があります。');
  }
}

// 純音の再生停止
function stopTone(isManualStop = false) {
  if (!isPlaying) return;
  
  try {
    // 音声停止
    oscillator.stop();
    audioContext.close();
    clearInterval(countdown);
    
    // 状態リセット
    isPlaying = false;
    oscillator = null;
    gainNode = null;
    audioContext = null;
    
    // UI更新
    playButton.disabled = false;
    stopButton.disabled = true;
    timerElement.textContent = '待機中';
    
    // 明示的な停止の場合はカウントダウンも停止
    if (isManualStop) {
      clearAutoPlayTimeout();
      nextPlayElement.textContent = '';
    } 
    // 自動停止（1分経過後）の場合で自動再生モードが有効なら次の再生をスケジュール
    else if (autoPlayEnabled) {
      scheduleNextPlay();
    }
  } catch (error) {
    console.error('音声の停止中にエラーが発生しました:', error);
  }
}

// 自動再生モードの切り替えと保存
function toggleAutoPlayAndSave() {
  autoPlayEnabled = autoPlayToggle.checked;
  
  // 設定を保存
  localStorage.setItem(STORAGE_KEYS.AUTO_PLAY, autoPlayEnabled);
  
  // 自動再生モードをオフにした場合はカウントダウンをクリア
  if (!autoPlayEnabled) {
    clearAutoPlayTimeout();
    nextPlayElement.textContent = '';
  }
  // 注：自動再生モードをオンにしただけでは次回再生のスケジュールは行わない
  // 次回再生のスケジュールは再生完了後または再生ボタンが押された後にのみ行われる
}

// 次の再生をスケジュール
function scheduleNextPlay() {
  clearAutoPlayTimeout();
  
  const intervalMinutes = parseInt(intervalInput.value);
  const intervalMs = intervalMinutes * 60 * 1000;
  
  nextPlayTime = new Date(Date.now() + intervalMs);
  updateNextPlayDisplay();
  
  autoPlayInterval = setTimeout(() => {
    if (!isPlaying) {
      startTone();
    }
  }, intervalMs);
  
  // 1秒ごとに「次の再生まで」の表示を更新
  const displayInterval = setInterval(updateNextPlayDisplay, 1000);
  
  function updateNextPlayDisplay() {
    if (!autoPlayEnabled) {
      clearInterval(displayInterval);
      return;
    }
    
    const now = new Date();
    const diff = nextPlayTime - now;
    
    if (diff <= 0) {
      clearInterval(displayInterval);
      return;
    }
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    nextPlayElement.textContent = `次の再生まで: ${minutes}分${seconds}秒`;
  }
}

// 自動再生のタイムアウトをクリア
function clearAutoPlayTimeout() {
  if (autoPlayInterval) {
    clearTimeout(autoPlayInterval);
    autoPlayInterval = null;
  }
}

// 自動再生インターバルをリセット
function resetAutoPlayInterval() {
  if (autoPlayEnabled && nextPlayTime !== null) {
    clearAutoPlayTimeout();
    scheduleNextPlay();
  }
}
