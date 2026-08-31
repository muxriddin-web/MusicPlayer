(() => {
  'use strict';

  // ---------- elements ----------
  const audio = document.getElementById('audio');
  const player = document.getElementById('player');

  const progress = document.getElementById('progress');
  const progressFill = document.getElementById('progress-fill');
  const progressBuffer = document.getElementById('progress-buffer');
  const progressThumb = document.getElementById('progress-thumb');
  const currentTimeEl = document.getElementById('current-time');
  const totalTimeEl = document.getElementById('total-time');

  const playPauseBtn = document.getElementById('play-pause-btn');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const shuffleBtn = document.getElementById('shuffle-btn');
  const repeatBtn = document.getElementById('repeat-btn');
  const favoriteBtn = document.getElementById('favorite-btn');
  const connectBtn = document.getElementById('connect-btn');
  const fileInput = document.getElementById('local-file-input');
  const speedBtn = document.getElementById('speed-btn');

  const songTitleEl = document.getElementById('song-title');
  const artistNameEl = document.getElementById('artist-name');

  const volumeSlider = document.getElementById('volume-slider');
  const volumeIconBtn = document.getElementById('volume-icon');

  const disc = document.getElementById('disc');
  const discArt = document.getElementById('disc-art');
  const canvas = document.getElementById('visualizer');
  const ctx = canvas.getContext('2d');

  const queueToggle = document.getElementById('queue-toggle');
  const queueClose = document.getElementById('queue-close');
  const queuePanel = document.getElementById('queue');
  const queueScrim = document.getElementById('queue-scrim');
  const queueList = document.getElementById('queue-list');
  const queueEmpty = document.getElementById('queue-empty');
  const queueTabs = document.querySelectorAll('.queue__tab');
  const queueUploadBtn = document.getElementById('queue-upload-btn');

  const toastEl = document.getElementById('toast');

  // ---------- state ----------
  let playlist = [
    { id: 't1', src: './audio/lost-in-dreams-abstract-chill-downtempo-cinematic-future-beats-270241.mp3', title: 'Lost in Dreams', artist: 'Abstract Chill', local: false },
    { id: 't2', src: './audio/nightfall-future-bass-music-228100.mp3', title: 'Nightfall', artist: 'Future Bass', local: false },
    { id: 't3', src: './audio/showreel-music-promo-advertising-opener-vlog-background-intro-theme-261601.mp3', title: 'Showreel Music', artist: 'Vlog Opener', local: false },
    { id: 't4', src: './audio/spinning-head-271171.mp3', title: 'Spinning Head', artist: 'Electronic', local: false },
    { id: 't5', src: './audio/stylish-deep-electronic-262632.mp3', title: 'Stylish Deep', artist: 'Deep Electronic', local: false },
    { id: 't6', src: './audio/vlog-music-beat-trailer-showreel-promo-background-intro-theme-274290.mp3', title: 'Vlog Music Beat', artist: 'Background Intro', local: false }
  ];

  let currentIndex = 0;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 0; // 0 off, 1 repeat-all(context), 2 repeat-one
  let favorites = new Set();
  let activeTab = 'all';
  let isDraggingProgress = false;
  let speeds = [1, 1.25, 1.5, 1.75, 0.75];
  let speedIdx = 0;

  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let rafId = null;

  // ---------- helpers ----------
  function formatTime(sec) {
    if (!isFinite(sec) || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2800);
  }

  function trackHueGradient(track) {
    // deterministic gradient angle per track so each disc art differs a touch
    let hash = 0;
    for (let i = 0; i < track.title.length; i++) hash = (hash * 31 + track.title.charCodeAt(i)) % 360;
    return hash;
  }

  function applyDiscArt(track) {
    const hue = trackHueGradient(track);
    discArt.style.background = `conic-gradient(from ${hue}deg, var(--cyan), var(--violet), var(--pink), var(--cyan))`;
  }

  // ---------- core playback ----------
  function loadTrack(index, autoPlay = true) {
    if (!playlist.length) {
      songTitleEl.textContent = "Qo'shiq yo'q";
      artistNameEl.textContent = '—';
      return;
    }
    currentIndex = ((index % playlist.length) + playlist.length) % playlist.length;
    const track = playlist[currentIndex];

    audio.src = track.src;
    audio.load();
    audio.playbackRate = speeds[speedIdx];

    songTitleEl.textContent = track.title;
    artistNameEl.textContent = track.artist || "Noma'lum ijrochi";
    applyDiscArt(track);
    updateFavoriteIcon();
    renderQueue();
    updateMediaSession(track);

    if (autoPlay) {
      playAudio();
    } else {
      setPlayingState(false);
    }
  }

  function playAudio() {
    ensureAudioGraph();
    audio.play().then(() => {
      setPlayingState(true);
    }).catch(() => {
      setPlayingState(false);
    });
  }

  function setPlayingState(playing) {
    isPlaying = playing;
    playPauseBtn.classList.toggle('is-playing', playing);
    playPauseBtn.querySelector('i').className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    disc.classList.toggle('is-spinning', playing);
    if (playing) startVisualizer(); else stopVisualizer();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }

  function togglePlayPause() {
    if (!playlist.length) return;
    if (isPlaying) {
      audio.pause();
      setPlayingState(false);
    } else {
      playAudio();
    }
  }

  function playNext(fromEnded = false) {
    if (!playlist.length) return;
    if (repeatMode === 2 && fromEnded) {
      audio.currentTime = 0;
      playAudio();
      return;
    }
    if (isShuffle) {
      if (playlist.length === 1) { loadTrack(0); return; }
      let next;
      do { next = Math.floor(Math.random() * playlist.length); } while (next === currentIndex);
      loadTrack(next);
      return;
    }
    if (fromEnded && repeatMode === 0 && currentIndex === playlist.length - 1) {
      loadTrack(0, false);
      return;
    }
    loadTrack(currentIndex + 1);
  }

  function playPrev() {
    if (!playlist.length) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    loadTrack(currentIndex - 1);
  }

  // ---------- progress ----------
  function updateProgressUI() {
    if (isDraggingProgress) return;
    const dur = audio.duration;
    const cur = audio.currentTime;
    if (dur) {
      const pct = (cur / dur) * 100;
      progressFill.style.width = pct + '%';
      progressThumb.style.left = pct + '%';
      progress.setAttribute('aria-valuenow', Math.round(pct));
      currentTimeEl.textContent = formatTime(cur);
    }
    if (audio.buffered.length) {
      const end = audio.buffered.end(audio.buffered.length - 1);
      const bufPct = dur ? (end / dur) * 100 : 0;
      progressBuffer.style.width = bufPct + '%';
    }
  }

  function seekFromClientX(clientX) {
    const rect = progress.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    ratio = Math.min(1, Math.max(0, ratio));
    const dur = audio.duration || 0;
    progressFill.style.width = (ratio * 100) + '%';
    progressThumb.style.left = (ratio * 100) + '%';
    currentTimeEl.textContent = formatTime(ratio * dur);
    return ratio * dur;
  }

  progress.addEventListener('pointerdown', (e) => {
    isDraggingProgress = true;
    progress.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  });
  progress.addEventListener('pointermove', (e) => {
    if (!isDraggingProgress) return;
    seekFromClientX(e.clientX);
  });
  function endDrag(e) {
    if (!isDraggingProgress) return;
    isDraggingProgress = false;
    const time = seekFromClientX(e.clientX);
    if (isFinite(time)) audio.currentTime = time;
  }
  progress.addEventListener('pointerup', endDrag);
  progress.addEventListener('pointercancel', () => { isDraggingProgress = false; });
  progress.addEventListener('keydown', (e) => {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
  });

  // ---------- favorites ----------
  function updateFavoriteIcon() {
    const track = playlist[currentIndex];
    const active = track && favorites.has(track.id);
    favoriteBtn.classList.toggle('is-active', !!active);
    favoriteBtn.querySelector('i').className = active ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
  }

  function toggleFavorite(trackId) {
    if (favorites.has(trackId)) favorites.delete(trackId);
    else favorites.add(trackId);
    updateFavoriteIcon();
    renderQueue();
  }

  favoriteBtn.addEventListener('click', () => {
    const track = playlist[currentIndex];
    if (track) toggleFavorite(track.id);
  });

  // ---------- shuffle / repeat ----------
  function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('is-active', isShuffle);
    showToast(isShuffle ? "Aralash yoqildi" : "Aralash o'chirildi");
  }

  function cycleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.classList.toggle('is-active', repeatMode !== 0);
    const icon = repeatBtn.querySelector('i');
    icon.className = repeatMode === 2 ? 'fa-solid fa-repeat' : 'fa-solid fa-repeat';
    repeatBtn.title = repeatMode === 0 ? 'Takrorlash: o\'chiq' : repeatMode === 1 ? "Takrorlash: ro'yxat" : "Takrorlash: bitta qo'shiq";
    showToast(repeatMode === 0 ? "Takrorlash o'chirildi" : repeatMode === 1 ? "Ro'yxatni takrorlash" : "Bitta qo'shiqni takrorlash");
  }

  // ---------- speed ----------
  function cycleSpeed() {
    speedIdx = (speedIdx + 1) % speeds.length;
    audio.playbackRate = speeds[speedIdx];
    speedBtn.textContent = speeds[speedIdx].toFixed(2).replace(/0$/, '').replace(/\.$/, '.0') + 'x';
  }

  // ---------- volume ----------
  function updateVolumeIcon() {
    const icon = volumeIconBtn.querySelector('i');
    if (audio.muted || audio.volume === 0) icon.className = 'fa-solid fa-volume-xmark';
    else if (audio.volume < 0.5) icon.className = 'fa-solid fa-volume-low';
    else icon.className = 'fa-solid fa-volume-high';
  }

  volumeSlider.addEventListener('input', function () {
    audio.volume = parseFloat(this.value);
    audio.muted = audio.volume === 0;
    updateVolumeIcon();
  });

  let lastVolume = 1;
  volumeIconBtn.addEventListener('click', () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = lastVolume || 1;
      volumeSlider.value = audio.volume;
    } else {
      lastVolume = audio.volume;
      audio.muted = true;
      audio.volume = 0;
      volumeSlider.value = 0;
    }
    updateVolumeIcon();
  });

  // ---------- file upload ----------
  function openFilePicker() { fileInput.click(); }
  connectBtn.addEventListener('click', openFilePicker);
  queueUploadBtn.addEventListener('click', openFilePicker);

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const startIndex = playlist.length;
    files.forEach((file, i) => {
      const blobUrl = URL.createObjectURL(file);
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
      playlist.push({
        id: 'local-' + Date.now() + '-' + i,
        src: blobUrl,
        title: cleanTitle,
        artist: 'Qurilmadagi fayl',
        local: true
      });
    });
    showToast(files.length > 1 ? `${files.length} ta fayl qo'shildi` : 'Fayl qo\u02bbshildi');
    renderQueue();
    loadTrack(startIndex, true);
    fileInput.value = '';
  });

  function removeTrack(id) {
    const track = playlist.find(t => t.id === id);
    if (!track) return;
    const removingCurrent = playlist[currentIndex] && playlist[currentIndex].id === id;
    const idx = playlist.findIndex(t => t.id === id);
    playlist.splice(idx, 1);
    if (track.local) URL.revokeObjectURL(track.src);
    favorites.delete(id);

    if (!playlist.length) {
      audio.pause();
      audio.removeAttribute('src');
      setPlayingState(false);
      songTitleEl.textContent = "Qo'shiq yo'q";
      artistNameEl.textContent = '—';
      renderQueue();
      return;
    }
    if (idx < currentIndex) currentIndex--;
    if (removingCurrent) {
      loadTrack(Math.min(currentIndex, playlist.length - 1), isPlaying);
    } else {
      renderQueue();
    }
  }

  // ---------- queue panel ----------
  function openQueue() {
    queuePanel.classList.add('is-open');
    queueScrim.classList.add('is-open');
    queuePanel.setAttribute('aria-hidden', 'false');
  }
  function closeQueue() {
    queuePanel.classList.remove('is-open');
    queueScrim.classList.remove('is-open');
    queuePanel.setAttribute('aria-hidden', 'true');
  }
  queueToggle.addEventListener('click', () => {
    queuePanel.classList.contains('is-open') ? closeQueue() : openQueue();
  });
  queueClose.addEventListener('click', closeQueue);
  queueScrim.addEventListener('click', closeQueue);

  queueTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      queueTabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      activeTab = tab.dataset.tab;
      renderQueue();
    });
  });

  function renderQueue() {
    const list = activeTab === 'favorites'
      ? playlist.filter(t => favorites.has(t.id))
      : playlist;

    queueList.innerHTML = '';
    queueEmpty.hidden = list.length !== 0;

    list.forEach((track) => {
      const realIndex = playlist.indexOf(track);
      const li = document.createElement('li');
      li.className = 'queue__item' + (realIndex === currentIndex ? ' is-current' : '');

      const badge = document.createElement('div');
      badge.className = 'queue__item__badge';
      badge.innerHTML = realIndex === currentIndex && isPlaying
        ? '<i class="fa-solid fa-volume-high"></i>'
        : `<i class="fa-solid fa-music"></i>`;

      const text = document.createElement('div');
      text.className = 'queue__item__text';
      const title = document.createElement('p');
      title.className = 'queue__item__title';
      title.textContent = track.title;
      const artist = document.createElement('p');
      artist.className = 'queue__item__artist';
      artist.textContent = track.artist || "Noma'lum ijrochi";
      text.appendChild(title);
      text.appendChild(artist);

      const favBtn = document.createElement('button');
      favBtn.className = 'queue__item__fav' + (favorites.has(track.id) ? ' is-active' : '');
      favBtn.innerHTML = favorites.has(track.id) ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
      favBtn.setAttribute('aria-label', 'Sevimli');
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(track.id);
      });

      li.appendChild(badge);
      li.appendChild(text);
      li.appendChild(favBtn);

      if (track.local) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'queue__item__fav';
        removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        removeBtn.setAttribute('aria-label', "O'chirish");
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeTrack(track.id);
        });
        li.appendChild(removeBtn);
      }

      li.addEventListener('click', () => loadTrack(realIndex, true));
      queueList.appendChild(li);
    });
  }

  // ---------- visualizer ----------
  function ensureAudioGraph() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return;
    }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch (err) {
      analyser = null;
    }
  }

  function drawIdleRing() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawVisualizer() {
    if (!analyser) { rafId = requestAnimationFrame(drawVisualizer); return; }
    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(data);

    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const baseRadius = w / 2 - 14;
    const bars = 48;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < bars; i++) {
      const value = data[i % bufferLength] || 0;
      const barLen = 4 + (value / 255) * 26;
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + Math.cos(angle) * baseRadius;
      const y1 = cy + Math.sin(angle) * baseRadius;
      const x2 = cx + Math.cos(angle) * (baseRadius + barLen);
      const y2 = cy + Math.sin(angle) * (baseRadius + barLen);

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, 'rgba(34,211,238,0.9)');
      grad.addColorStop(1, 'rgba(139,92,246,0.9)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    rafId = requestAnimationFrame(drawVisualizer);
  }

  function startVisualizer() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(drawVisualizer);
  }
  function stopVisualizer() {
    cancelAnimationFrame(rafId);
    drawIdleRing();
  }

  // ---------- media session ----------
  function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || "Noma'lum ijrochi",
      album: 'Nova Player'
    });
    navigator.mediaSession.setActionHandler('play', playAudio);
    navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); setPlayingState(false); });
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext(false));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) audio.currentTime = details.seekTime;
    });
  }

  // ---------- keyboard shortcuts ----------
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
    else if (e.code === 'ArrowUp') { audio.volume = Math.min(1, audio.volume + 0.05); volumeSlider.value = audio.volume; audio.muted = false; updateVolumeIcon(); }
    else if (e.code === 'ArrowDown') { audio.volume = Math.max(0, audio.volume - 0.05); volumeSlider.value = audio.volume; updateVolumeIcon(); }
    else if (e.key.toLowerCase() === 'n') playNext(false);
    else if (e.key.toLowerCase() === 'p') playPrev();
    else if (e.key === 'Escape') closeQueue();
  });

  // ---------- audio element events ----------
  audio.addEventListener('loadedmetadata', () => {
    totalTimeEl.textContent = formatTime(audio.duration);
  });
  audio.addEventListener('timeupdate', updateProgressUI);
  audio.addEventListener('progress', updateProgressUI);
  audio.addEventListener('ended', () => playNext(true));
  audio.addEventListener('error', () => {
    const track = playlist[currentIndex];
    showToast(`"${track ? track.title : 'Fayl'}" yuklanmadi, keyingisiga o'tilmoqda`);
    setTimeout(() => { if (playlist.length > 1) playNext(false); }, 900);
  });
  audio.addEventListener('waiting', () => player.classList.add('is-buffering'));
  audio.addEventListener('canplay', () => player.classList.remove('is-buffering'));

  playPauseBtn.addEventListener('click', togglePlayPause);
  prevBtn.addEventListener('click', playPrev);
  nextBtn.addEventListener('click', () => playNext(false));
  shuffleBtn.addEventListener('click', toggleShuffle);
  repeatBtn.addEventListener('click', cycleRepeat);
  speedBtn.addEventListener('click', cycleSpeed);

  // ---------- init ----------
  drawIdleRing();
  audio.volume = parseFloat(volumeSlider.value);
  updateVolumeIcon();
  renderQueue();
  loadTrack(0, false);
})();
