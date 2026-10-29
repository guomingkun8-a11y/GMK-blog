(function () {
  const base = window.__GMK_BASE__ || "/";
  const PREF_KEY = "gmk-music-enabled";

  const btn = document.getElementById("gmk-music");
  const panel = document.getElementById("gmk-music-panel");
  if (!btn || !panel) return;

  const names = JSON.parse(btn.dataset.tracks || "[]");
  const tracks = names.map((name) => base + "music/" + encodeURIComponent(name));
  if (!tracks.length) return;

  // 面板内元素
  const rangeEl = document.getElementById("gmk-music-range");
  const currentEl = document.getElementById("gmk-music-current");
  const durationEl = document.getElementById("gmk-music-duration");
  const playBtn = panel.querySelector("[data-music-play]");
  const prevBtn = panel.querySelector("[data-music-prev]");
  const nextBtn = panel.querySelector("[data-music-next]");

  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = 0.5;

  // 洗牌循环
  let order = shuffle(tracks.map((_, i) => i));
  let pos = 0;
  let index = order[0];
  audio.src = tracks[index];
  let playing = false;
  let failed = 0;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function setPlaying(next) {
    playing = next;
    btn.classList.toggle("is-playing", next);
    btn.setAttribute("aria-pressed", String(next));
    updatePlayIcon();
  }

  function updatePlayIcon() {
    playBtn.innerHTML = playing ? "&#10074;&#10074;" : "&#9654;";
    playBtn.setAttribute("aria-label", playing ? "暂停" : "播放");
  }

  function loadTrack() {
    durationEl.textContent = "0:00";
    currentEl.textContent = "0:00";
    rangeEl.value = "0";
    audio.src = tracks[index];
    if (playing) play();
  }

  function nextTrack() {
    pos += 1;
    if (pos >= order.length) {
      order = shuffle(order);
      pos = 0;
    }
    index = order[pos];
    loadTrack();
  }

  function prevTrack() {
    pos -= 1;
    if (pos < 0) pos = order.length - 1;
    index = order[pos];
    loadTrack();
  }

  function play() {
    const currentIndex = index;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        if (index === currentIndex) setPlaying(true);
      }).catch(() => {
        if (index === currentIndex) setPlaying(false);
      });
    }
  }

  function toggle() {
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      failed = 0;
      play();
    }
  }

  // 打开/关闭面板
  function openPanel() {
    panel.hidden = false;
  }
  function closePanel() {
    panel.hidden = true;
  }

  // ===== 事件绑定 =====
  // 点唱片 → 弹出面板（不再直接播放/暂停）
  btn.addEventListener("click", () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  // 点击面板外区域关闭
  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    closePanel();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) closePanel();
  });

  playBtn.addEventListener("click", toggle);
  nextBtn.addEventListener("click", nextTrack);
  prevBtn.addEventListener("click", prevTrack);

  // 进度条：拖动时更新
  rangeEl.addEventListener("input", () => {
    if (!audio.duration) return;
    audio.currentTime = (rangeEl.value / 100) * audio.duration;
    currentEl.textContent = fmt(audio.currentTime);
  });

  // 音频事件
  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      rangeEl.value = pct;
      currentEl.textContent = fmt(audio.currentTime);
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    durationEl.textContent = fmt(audio.duration);
    rangeEl.max = "100";
  });

  audio.addEventListener("ended", () => {
    failed = 0;
    nextTrack();
  });

  audio.addEventListener("error", () => {
    if (!playing) return;
    if (++failed >= tracks.length) {
      setPlaying(false);
      return;
    }
    nextTrack();
  });

  // 恢复上次的播放偏好：仅在有明确开启记录时自动播放
  let saved = null;
  try {
    saved = localStorage.getItem(PREF_KEY);
  } catch (e) {}
  if (saved === "on") play();
  setPlaying(false); // 初始图标为播放态，除非上面已开播
  updatePlayIcon();
})();
