// 滚动渐入渐出：元素进入视口时淡入上滑，离开视口时淡出还原
function initReveal() {
	const els = document.querySelectorAll('[data-reveal]');
	if (!els.length) return;

	if (!('IntersectionObserver' in window)) {
		els.forEach((el) => el.classList.add('is-visible'));
		return;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				// 进入视口 → 渐入；离开视口 → 渐出（来回往复，不注销监听）
				entry.target.classList.toggle('is-visible', entry.isIntersecting);
			});
		},
		{ threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
	);

	els.forEach((el) => observer.observe(el));
}

document.addEventListener('astro:page-load', initReveal);
initReveal();
