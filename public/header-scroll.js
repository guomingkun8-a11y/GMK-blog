// 智能导航栏：向下滚动隐藏，向上滚动出现；页面顶部常显
function initHeaderScroll() {
	const header = document.querySelector('.site-header');
	if (!header) return;

	let lastY = window.scrollY;
	let ticking = false;

	function update() {
		const y = window.scrollY;
		if (y <= 80) {
			// 接近顶部时始终显示
			header.classList.remove('is-hidden');
		} else if (y > lastY + 4) {
			// 向下滚（留 4px 死区防抖动）
			header.classList.add('is-hidden');
		} else if (y < lastY - 4) {
			// 向上滚
			header.classList.remove('is-hidden');
		}
		lastY = y;
		ticking = false;
	}

	window.addEventListener(
		'scroll',
		function () {
			if (!ticking) {
				ticking = true;
				requestAnimationFrame(update);
			}
		},
		{ passive: true }
	);

	update();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initHeaderScroll);
} else {
	initHeaderScroll();
}
