// 相册「lookbook reveal」动画：照片卡片滚动进入视口时，
// 从下往上 + clip-path 从底部展开 + 轻微缩放，带 stagger 延迟逐张浮现。
function initPhotoReveal() {
	const els = document.querySelectorAll("[data-photo-reveal]");
	if (!els.length) return;

	if (!("IntersectionObserver" in window)) {
		els.forEach((el) => el.classList.add("is-revealed"));
		return;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add("is-revealed");
					observer.unobserve(entry.target); // 只播一次，不反复
				}
			});
		},
		{ threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
	);

	els.forEach((el) => observer.observe(el));
}

document.addEventListener("astro:page-load", initPhotoReveal);
initPhotoReveal();
