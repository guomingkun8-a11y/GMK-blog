(function () {
  const base = window.__GMK_BASE__ || "/";
  const PREF_KEY = "gmk-music-enabled";
  const btn = document.getElementById("gmk-music");
  if (!btn) return;

  const names = JSON.parse(btn.dataset.tracks || "[]");
  const tracks = names.map(
    (name) => base + "music/" + encodeURIComponent(name)
  );
  if (!tracks.length) return;

  let saved = null;
  try {
    saved = localStorage.getItem(PREF_KEY);
  } catch (e) {
    /* ignore */
  }

  const audio = new Audio();
  audio.preload = "none";
  audio.volume = 0.5;
  // 洗牌循环：打乱后的播放顺序，一轮播完再重新洗牌
  let order = shuffle(tracks.map((_, i) => i));
  let pos = 0; // 在 order 中的位置
  let index = order[0];
  audio.src = tracks[index]; // 设置初始播放源
  let playing = false;
  let failed = 0;
  let shouldPlay = saved !== "off";

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function nextTrack() {
    pos += 1;
    if (pos >= order.length) {
      order = shuffle(order);
      pos = 0;
    }
    index = order[pos];
    audio.src = tracks[index];
  }

  function setPlaying(next) {
    playing = next;
    btn.classList.toggle("is-playing", next);
    btn.setAttribute("aria-pressed", String(next));
    btn.setAttribute("aria-label", next ? "暂停音乐" : "播放音乐");
    btn.title = `${next ? "暂停" : "播放"}音乐：${names[index]}`;
  }

  function play() {
    const currentIndex = index;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        if (index === currentIndex && shouldPlay) setPlaying(true);
      }).catch(() => {
        if (index === currentIndex) setPlaying(false);
      });
    }
  }

  btn.addEventListener("click", () => {
    if (!audio.paused || playing) {
      shouldPlay = false;
      audio.pause();
      setPlaying(false);
      try {
        localStorage.setItem(PREF_KEY, "off");
      } catch (e) {}
    } else {
      shouldPlay = true;
      failed = 0;
      play();
      try {
        localStorage.setItem(PREF_KEY, "on");
      } catch (e) {}
    }
  });

  audio.addEventListener("ended", () => {
    failed = 0;
    nextTrack();
    setPlaying(playing);
    play();
  });

  audio.addEventListener("error", () => {
    if (!shouldPlay) return;
    if (++failed >= tracks.length) {
      setPlaying(false);
      btn.title = "音乐暂不可用";
      return;
    }
    nextTrack();
    setPlaying(playing);
    play();
  });

  if (shouldPlay) play();
})();
