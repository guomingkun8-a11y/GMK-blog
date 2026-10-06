// 「观察」区块：滑动到该区域后图片固定，继续滚动驱动图片横向左移
// - 无 JS / 减少动画：降级为原生横向滑动
// - 有 JS：区块高度 = 视口 + 横向溢出，sticky 固定后按滚动进度平移
(function () {
	const section = document.querySelector('.obs');
	if (!section) return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const sticky = section.querySelector('.obs__sticky');
	const track = section.querySelector('.obs__track');
	const intro = section.querySelector('.obs__intro');
	const head = section.querySelector('.obs__head');
	const lead = section.querySelector('.obs__lead');
	if (!sticky || !track) return;

	let maxShift = 0;
	let introH = 0;
	let ticking = false;

	function setup() {
		section.classList.add('obs--pin');
		// 先清掉内联高度再测量，避免 resize 时把收起中的高度当成自然高度
		if (intro) {
			intro.style.height = '';
			introH = intro.offsetHeight;
		}
		const gutter = parseFloat(getComputedStyle(track).paddingRight) || 0;
		maxShift = Math.max(0, track.scrollWidth - sticky.clientWidth + gutter);
		section.style.height = window.innerHeight + maxShift + 'px';
		update();
	}

	function update() {
		const rect = section.getBoundingClientRect();
		const vh = window.innerHeight || 1;
		const total = section.offsetHeight - vh || 1;
		const progress = Math.min(1, Math.max(0, -rect.top / total));

		// 图片横移
		track.style.transform = 'translate3d(' + -progress * maxShift + 'px, 0, 0)';

		// 标题/引导语：进入视口时渐入升起，pin 后前 30% 渐进飘走消失
		const enter = 1 - Math.min(1, Math.max(0, rect.top / (vh * 0.5)));
		const exit = Math.min(1, progress / 0.3);
		const opacity = Math.max(0, Math.min(enter, 1 - exit));
		const headRise = (1 - enter) * 2 + exit * 4;
		const leadRise = (1 - enter) * 1.5 + exit * 2.5;
		if (head) {
			head.style.opacity = String(opacity);
			head.style.transform = 'translateY(' + -headRise + 'rem)';
		}
		if (lead) {
			lead.style.opacity = String(opacity);
			lead.style.transform = 'translateY(' + -leadRise + 'rem)';
		}
		// intro 占位同步收起：文字淡出的同时，图片上升补位到画面中央
		if (intro && exit > 0) {
			intro.style.height = Math.round(introH * (1 - exit)) + 'px';
		} else if (intro) {
			intro.style.height = '';
		}

		ticking = false;
	}

	function onScroll() {
		if (!ticking) {
			ticking = true;
			requestAnimationFrame(update);
		}
	}

	let resizeTimer;
	window.addEventListener('resize', function () {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(setup, 150);
	});
	window.addEventListener('scroll', onScroll, { passive: true });

	// 图片加载完成后重新测量（避免图片未加载时宽度算错）
	track.querySelectorAll('img').forEach(function (img) {
		if (!img.complete) img.addEventListener('load', setup, { once: true });
	});

	setup();
})();
