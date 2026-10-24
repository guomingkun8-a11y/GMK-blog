// 滚动渐入渐出：元素进入视口时淡入上滑，离开视口时淡出还原
function initReveal() {
	const els = document.querySelectorAll('[data-reveal]');
	if (!els.length) return;
	document.documentElement.classList.add('reveal-ready');

	if (!('IntersectionObserver' in window)) {
		els.forEach((el) => el.classList.add('is-visible'));
		return;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				// 进入视口 → 渐入一次并固定可见。
				// 不再往复切换：位移动画会改变元素位置，导致在阈值边缘反复触发（闪跳）。
				if (entry.isIntersecting) {
					entry.target.classList.add('is-visible');
					observer.unobserve(entry.target);
				}
			});
		},
		{ threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
	);

	els.forEach((el) => observer.observe(el));
}

document.addEventListener('astro:page-load', initReveal);
initReveal();

// 暴露给实时数据脚本：动态插入内容后重新观察新增的 [data-reveal] 元素
window.__GMK_REVEAL__ = function (node) {
	if (node && node.classList) {
		node.classList.add('is-visible');
	}
};
