// ==========================================================================
// THE HAUNTING OF HOLLOW HILL - CLIENT SCRIPT
// Features: Real WebRTC Mic Decibel Analyzer, Webcam PiP, Procedural Audio Synth
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initDesignTabs();
  initRoomChamberSwitcher();
  initFlashlightTracking();
  initSensorControllers();
  initSoundSimulationButtons();
  initRelicInteraction();
  initProceduralAmbientAudio();
});

// --------------------------------------------------------------------------
// 1. Concept Art Tab Navigation
// --------------------------------------------------------------------------
function initDesignTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const cards = document.querySelectorAll('.design-card');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      cards.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `card-${tab.dataset.target}`;
      const targetCard = document.getElementById(targetId);
      if (targetCard) {
        targetCard.classList.add('active');
      }
    });
  });
}

// --------------------------------------------------------------------------
// 2. Viewport Flashlight Mouse Tracker
// --------------------------------------------------------------------------
function initFlashlightTracking() {
  const viewport = document.getElementById('viewport-box');
  const flashlight = document.getElementById('flashlight');

  if (!viewport || !flashlight) return;

  viewport.addEventListener('mousemove', (e) => {
    const rect = viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    flashlight.style.left = `${x}px`;
    flashlight.style.top = `${y}px`;
  });
}

// --------------------------------------------------------------------------
// 3. Microphone & Webcam Live Integration
// --------------------------------------------------------------------------
let audioContext = null;
let analyserNode = null;
let micStream = null;
let camStream = null;
let isMicActive = false;
let isCamActive = false;
let thresholdDB = 30; // user adjustable via slider
let scareCooldown = false;

function initSensorControllers() {
  const btnMic = document.getElementById('btn-enable-mic');
  const btnCam = document.getElementById('btn-enable-cam');
  const slider = document.getElementById('mic-sensitivity');
  const sliderVal = document.getElementById('sensitivity-value');

  if (slider && sliderVal) {
    slider.addEventListener('input', (e) => {
      thresholdDB = parseInt(e.target.value);
      if (thresholdDB <= 20) sliderVal.textContent = 'Ultra Sensitive (Hears Breathing)';
      else if (thresholdDB <= 40) sliderVal.textContent = 'High (Realistic)';
      else sliderVal.textContent = 'Forgiving (Loud Sounds Only)';
    });
  }

  // Toggle Real Microphone
  if (btnMic) {
    btnMic.addEventListener('click', async () => {
      if (!isMicActive) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setupAudioAnalyser(micStream);
          isMicActive = true;
          btnMic.classList.add('active');
          btnMic.querySelector('strong').textContent = 'Microphone Active';
          document.getElementById('diag-mic-status').textContent = 'Live Audio Connected';
          document.getElementById('diag-mic-status').style.color = '#39ff14';
        } catch (err) {
          console.warn('Microphone permission denied or not available:', err);
          alert('Microphone access was denied or is not available. You can still use the "Simulate Sounds" buttons to test the noise detection mechanic!');
        }
      } else {
        stopMicrophone();
        btnMic.classList.remove('active');
        btnMic.querySelector('strong').textContent = 'Enable Microphone';
        document.getElementById('diag-mic-status').textContent = 'Disconnected';
        document.getElementById('diag-mic-status').style.color = '';
      }
    });
  }

  // Toggle Real Camera
  if (btnCam) {
    btnCam.addEventListener('click', async () => {
      const videoEl = document.getElementById('webcam-video');
      const placeholder = document.getElementById('cam-placeholder');

      if (!isCamActive) {
        try {
          camStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 640 }, height: { ideal: 480 } } 
          });
          videoEl.srcObject = camStream;
          videoEl.style.display = 'block';
          placeholder.style.display = 'none';
          isCamActive = true;
          btnCam.classList.add('active');
          btnCam.querySelector('strong').textContent = 'Webcam Active (Night Vision)';
          document.getElementById('diag-cam-status').textContent = 'Live Feed (Night Vision)';
          document.getElementById('diag-cam-status').style.color = '#39ff14';
          startSimulatedHeartRate();
        } catch (err) {
          console.warn('Camera permission denied or not available:', err);
          alert('Camera access was denied or not available on this device.');
        }
      } else {
        if (camStream) {
          camStream.getTracks().forEach(t => t.stop());
        }
        videoEl.style.display = 'none';
        placeholder.style.display = 'flex';
        isCamActive = false;
        btnCam.classList.remove('active');
        btnCam.querySelector('strong').textContent = 'Enable Webcam';
        document.getElementById('diag-cam-status').textContent = 'Disconnected';
        document.getElementById('diag-cam-status').style.color = '';
      }
    });
  }
}

function setupAudioAnalyser(stream) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const source = audioContext.createMediaStreamSource(stream);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 512;
  analyserNode.smoothingTimeConstant = 0.3;
  source.connect(analyserNode);

  monitorAudioLevels();
}

function monitorAudioLevels() {
  if (!isMicActive || !analyserNode) return;

  const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(dataArray);

  // Compute RMS Volume
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  const rms = Math.sqrt(sum / dataArray.length);
  // Normalize to approximate decibel range (0 - 100)
  const normalizedLevel = Math.min(100, Math.round((rms / 128) * 100));

  updateDecibelHUD(normalizedLevel);

  requestAnimationFrame(monitorAudioLevels);
}

function stopMicrophone() {
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
  }
  isMicActive = false;
  updateDecibelHUD(0);
}

function updateDecibelHUD(level) {
  const meterFill = document.getElementById('meter-fill');
  const dbVal = document.getElementById('db-value');
  const meterStatus = document.getElementById('meter-status');
  const dangerBanner = document.getElementById('danger-banner');
  const ghost = document.getElementById('ghost-entity');
  const diagEntity = document.getElementById('diag-entity-state');

  if (!meterFill) return;

  meterFill.style.width = `${Math.max(4, level)}%`;
  dbVal.textContent = level > 0 ? `${level} dB` : '-∞ dB';

  if (level >= thresholdDB) {
    // Too loud! Entity triggered
    meterStatus.textContent = 'CRITICAL • TOO LOUD!';
    meterStatus.style.color = '#ff2b2b';
    dangerBanner.style.display = 'block';
    ghost.classList.add('active-hunt');

    diagEntity.textContent = 'HUNTING PLAYER (Agitated by sound)';
    diagEntity.className = 'state-hunting';

    if (!scareCooldown) {
      triggerJumpscareStinger();
      scareCooldown = true;
      setTimeout(() => { scareCooldown = false; }, 3500);
    }
  } else if (level > thresholdDB * 0.5) {
    // Alert zone
    meterStatus.textContent = 'CAUTION • NOISE DETECTED';
    meterStatus.style.color = '#ffaa00';
    dangerBanner.style.display = 'none';
    ghost.classList.remove('active-hunt');
    diagEntity.textContent = 'Alerted (Listening closely)';
    diagEntity.className = 'state-alert';
  } else {
    // Safe
    meterStatus.textContent = 'SAFE • QUIET';
    meterStatus.style.color = '#39ff14';
    dangerBanner.style.display = 'none';
    ghost.classList.remove('active-hunt');
    diagEntity.textContent = 'Dormant (In Shadows)';
    diagEntity.className = 'state-dormant';
  }
}

// --------------------------------------------------------------------------
// 4. Simulated Sounds (When user doesn't have a mic or wants quick test)
// --------------------------------------------------------------------------
function initSoundSimulationButtons() {
  document.getElementById('btn-sim-whisper')?.addEventListener('click', () => {
    simulateSoundBurst(18, 1200);
  });
  document.getElementById('btn-sim-footstep')?.addEventListener('click', () => {
    simulateSoundBurst(35, 1500);
  });
  document.getElementById('btn-sim-scream')?.addEventListener('click', () => {
    simulateSoundBurst(85, 2500);
  });
}

function simulateSoundBurst(targetLevel, durationMs) {
  let elapsed = 0;
  const interval = 50;
  const timer = setInterval(() => {
    elapsed += interval;
    const current = Math.max(0, targetLevel * (1 - elapsed / durationMs));
    updateDecibelHUD(Math.round(current));
    if (elapsed >= durationMs) {
      clearInterval(timer);
      updateDecibelHUD(0);
    }
  }, interval);
}

// --------------------------------------------------------------------------
// 5. Relic Grab Gameplay Interaction
// --------------------------------------------------------------------------
function initRelicInteraction() {
  const relic = document.getElementById('relic-target');
  const successBanner = document.getElementById('success-banner');
  const diagRelic = document.getElementById('diag-relic-status');
  const diagEscape = document.getElementById('diag-escape');

  if (!relic) return;

  relic.addEventListener('click', () => {
    relic.style.transform = 'scale(1.5) rotate(20deg)';
    relic.style.opacity = '0';
    triggerRelicGrabSound();

    setTimeout(() => {
      relic.style.display = 'none';
      successBanner.style.display = 'block';
      diagRelic.textContent = 'Cursed Samhain Skull (Extracted!)';
      diagRelic.style.color = '#39ff14';
      diagEscape.textContent = 'UNLOCKED! Run to Foyer Gate!';
      diagEscape.style.color = '#ffaa00';
    }, 400);
  });
}

// --------------------------------------------------------------------------
// 6. Simulated Player Heart Rate
// --------------------------------------------------------------------------
function startSimulatedHeartRate() {
  const bpmCounter = document.getElementById('fake-bpm');
  setInterval(() => {
    if (!isCamActive) return;
    const ghost = document.getElementById('ghost-entity');
    const isHunting = ghost.classList.contains('active-hunt');
    const baseBpm = isHunting ? 145 : 98;
    const variance = Math.floor(Math.random() * 8) - 4;
    bpmCounter.textContent = `♥ ${baseBpm + variance} BPM`;
  }, 1200);
}

// --------------------------------------------------------------------------
// 7. Procedural Halloween Horror Audio Engine (Web Audio API)
// --------------------------------------------------------------------------
let synthCtx = null;
let isAmbiencePlaying = false;
let droneOsc = null;
let droneGain = null;

function initProceduralAmbientAudio() {
  const toggleBtn = document.getElementById('toggle-ambient-audio');
  const icon = document.getElementById('audio-icon');

  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    if (!synthCtx) {
      synthCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (synthCtx.state === 'suspended') {
      synthCtx.resume();
    }

    if (!isAmbiencePlaying) {
      startAmbientDrone();
      isAmbiencePlaying = true;
      icon.textContent = '🔇';
      toggleBtn.classList.add('active');
    } else {
      stopAmbientDrone();
      isAmbiencePlaying = false;
      icon.textContent = '🔊';
      toggleBtn.classList.remove('active');
    }
  });
}

function startAmbientDrone() {
  if (!synthCtx) return;

  // Deep Sub-Bass Horror Drone (45Hz modulated)
  droneOsc = synthCtx.createOscillator();
  const filter = synthCtx.createBiquadFilter();
  droneGain = synthCtx.createGain();

  droneOsc.type = 'sawtooth';
  droneOsc.frequency.setValueAtTime(48, synthCtx.currentTime);

  // Eerie filter sweep
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(140, synthCtx.currentTime);

  droneGain.gain.setValueAtTime(0.01, synthCtx.currentTime);
  droneGain.gain.exponentialRampToValueAtTime(0.2, synthCtx.currentTime + 2);

  droneOsc.connect(filter);
  filter.connect(droneGain);
  droneGain.connect(synthCtx.destination);

  droneOsc.start();
}

function stopAmbientDrone() {
  if (droneGain && synthCtx) {
    droneGain.gain.exponentialRampToValueAtTime(0.0001, synthCtx.currentTime + 1);
    setTimeout(() => {
      droneOsc?.stop();
      droneOsc?.disconnect();
    }, 1000);
  }
}

function triggerJumpscareStinger() {
  if (!synthCtx) {
    synthCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (synthCtx.state === 'suspended') synthCtx.resume();

  // Dissonant screech tone
  const osc1 = synthCtx.createOscillator();
  const osc2 = synthCtx.createOscillator();
  const stingerGain = synthCtx.createGain();

  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(800, synthCtx.currentTime);
  osc1.frequency.exponentialRampToValueAtTime(120, synthCtx.currentTime + 0.8);

  osc2.type = 'square';
  osc2.frequency.setValueAtTime(850, synthCtx.currentTime);
  osc2.frequency.exponentialRampToValueAtTime(110, synthCtx.currentTime + 0.8);

  stingerGain.gain.setValueAtTime(0.3, synthCtx.currentTime);
  stingerGain.gain.exponentialRampToValueAtTime(0.001, synthCtx.currentTime + 0.8);

  osc1.connect(stingerGain);
  osc2.connect(stingerGain);
  stingerGain.connect(synthCtx.destination);

  osc1.start();
  osc2.start();
  osc1.stop(synthCtx.currentTime + 0.85);
  osc2.stop(synthCtx.currentTime + 0.85);
}

function triggerRelicGrabSound() {
  if (!synthCtx) {
    synthCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (synthCtx.state === 'suspended') synthCtx.resume();

  const osc = synthCtx.createOscillator();
  const gain = synthCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, synthCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(520, synthCtx.currentTime + 0.5);

  gain.gain.setValueAtTime(0.25, synthCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, synthCtx.currentTime + 0.6);

  osc.connect(gain);
  gain.connect(synthCtx.destination);

  osc.start();
  osc.stop(synthCtx.currentTime + 0.6);
}

// --------------------------------------------------------------------------
// 8. Chamber Switching Controller
// --------------------------------------------------------------------------
function initRoomChamberSwitcher() {
  const switchBtns = document.querySelectorAll('.room-switch-btn');
  const previewBtns = document.querySelectorAll('.chamber-preview-btn');
  const simBg = document.getElementById('sim-bg');
  const relicTarget = document.getElementById('relic-target');

  const roomData = {
    corridor: {
      bg: 'assets/room_corridor.jpg',
      relicDisplay: 'none',
      diagRoom: 'Creaking Corridor'
    },
    bedroom: {
      bg: 'assets/room_bedroom.jpg',
      relicDisplay: 'none',
      diagRoom: 'Moonlit Bedroom'
    },
    parlor: {
      bg: 'assets/room_parlor.jpg',
      relicDisplay: 'none',
      diagRoom: 'Victorian Parlor'
    },
    crypt: {
      bg: 'assets/room_crypt.jpg',
      relicDisplay: 'flex',
      relicBottom: '28%',
      relicRight: '22%',
      diagRoom: 'Occult Crypt Altar'
    }
  };

  function setRoom(roomId) {
    const data = roomData[roomId];
    if (!data || !simBg) return;

    simBg.style.backgroundImage = `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.1), rgba(0,0,0,0.65)), url('${data.bg}')`;
    simBg.style.backgroundSize = 'cover';
    simBg.style.backgroundPosition = 'center';

    switchBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.room === roomId);
    });

    if (relicTarget && !relicTarget.dataset.collected) {
      relicTarget.style.display = data.relicDisplay;
      if (data.relicBottom) relicTarget.style.bottom = data.relicBottom;
      if (data.relicRight) relicTarget.style.right = data.relicRight;
    }
  }

  // Set default initial room
  setRoom('corridor');

  switchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setRoom(btn.dataset.room);
    });
  });

  previewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setRoom(btn.dataset.room);
      document.getElementById('live-demo')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}
