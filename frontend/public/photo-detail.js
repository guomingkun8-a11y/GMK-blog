function initPhotoDetail() {
  const grid = document.querySelector("[data-photo-grid]");
  const detail = document.querySelector("[data-photo-detail]");
  if (!grid || !detail || grid.dataset.photoReady) return;
  grid.dataset.photoReady = "true";

  const detailImg = detail.querySelector("[data-photo-detail-img]");
  const detailTitle = detail.querySelector("[data-photo-detail-title]");
  const detailDesc = detail.querySelector("[data-photo-detail-desc]");
  const detailDate = detail.querySelector("[data-photo-detail-date]");
  const backButton = detail.querySelector(".photo-detail__back");
  const photos = window.__GMK_PHOTOS__ || [];
  const buttons = [...grid.querySelectorAll("[data-photo-index]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const duration = 520;
  let activeIndex = -1;
  let busy = false;
  let previousOverflow = "";

  function movePhoto(image, from, to) {
    const copy = image.cloneNode(false);
    copy.className = "photo-detail__moving-image";
    copy.style.left = `${from.left}px`;
    copy.style.top = `${from.top}px`;
    copy.style.width = `${from.width}px`;
    copy.style.height = `${from.height}px`;
    copy.style.visibility = "visible";
    detail.append(copy);

    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const sx = to.width / from.width;
    const sy = to.height / from.height;
    const animation = copy.animate(
      [
        { transform: "translate(0, 0) scale(1)" },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      ],
      { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
    );
    return animation.finished.catch(() => {}).then(() => copy.remove());
  }

  async function open(index) {
    if (busy || detail.open || !photos[index]) return;
    busy = true;
    activeIndex = index;
    const source = buttons[index].querySelector("img");
    const from = source.getBoundingClientRect();
    const photo = photos[index];

    detailImg.src = photo.src;
    detailImg.alt = photo.alt || "";
    detailTitle.textContent = photo.title || "";
    detailDesc.textContent = photo.desc || "";
    detailDate.textContent = photo.date || "";
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    backButton.disabled = true;
    detail.showModal();
    detail.classList.add("is-open");

    if (!reducedMotion.matches) {
      const to = detailImg.getBoundingClientRect();
      source.style.visibility = "hidden";
      detailImg.style.visibility = "hidden";
      const moving = movePhoto(source, from, to);
      detail.classList.add("is-content-visible");
      await moving;
      detailImg.style.visibility = "";
    } else {
      detail.classList.add("is-content-visible");
    }
    detail.classList.add("is-ready");
    backButton.disabled = false;
    backButton.focus({ preventScroll: true });
    busy = false;
  }

  async function close() {
    if (busy || !detail.open || activeIndex < 0) return;
    busy = true;
    backButton.disabled = true;
    const source = buttons[activeIndex].querySelector("img");
    detail.classList.remove("is-content-visible", "is-open", "is-ready");

    if (!reducedMotion.matches) {
      const from = detailImg.getBoundingClientRect();
      const to = source.getBoundingClientRect();
      detailImg.style.visibility = "hidden";
      await movePhoto(detailImg, from, to);
    }

    detail.close();
    document.body.style.overflow = previousOverflow;
    source.style.visibility = "";
    detailImg.style.visibility = "";
    detailImg.removeAttribute("src");
    buttons[activeIndex].focus({ preventScroll: true });
    backButton.disabled = false;
    activeIndex = -1;
    busy = false;
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => open(Number(button.dataset.photoIndex)));
  });
  backButton.addEventListener("click", close);
  detail.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  detail.addEventListener("click", (event) => {
    if (event.target === detail) close();
  });
}

document.addEventListener("astro:page-load", initPhotoDetail);
initPhotoDetail();
