// 作品页分页：每个 [data-pager] 区块独立分页（data-pager 指定每页数量）
// - 无 JS：分页栏保持 hidden，所有内容直接显示（优雅降级）
// - 页码按钮带省略号窗口（1 … 5 6 7 … 38），点页码直接跳
// - 翻页后把区块滚回视野（nearest：已可见就不动）
(function () {
	function initPager() {
		const grids = document.querySelectorAll('[data-pager]');
		grids.forEach(function (grid) {
			var perPage = parseInt(grid.getAttribute('data-pager'), 10) || 4;
			var cards = Array.prototype.slice.call(grid.children);
			var totalPages = Math.ceil(cards.length / perPage);
			var section = grid.closest('section') || grid.parentElement;
			var pager = section && section.querySelector('[data-pager-nav]');
			if (!pager || totalPages <= 1) return;

			var prev = pager.querySelector('[data-pager-prev]');
			var next = pager.querySelector('[data-pager-next]');
			var numbers = pager.querySelector('[data-pager-numbers]');
			var info = pager.querySelector('[data-pager-info]');
			var current = 0;

			function scrollToGrid() {
				var rect = grid.getBoundingClientRect();
				var visible = rect.top < window.innerHeight && rect.bottom > 0;
				if (!visible) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}

			function addNum(p) {
				var b = document.createElement('button');
				b.type = 'button';
				b.className = 'page__pager-num' + (p === current ? ' is-active' : '');
				b.textContent = String(p + 1);
				b.setAttribute('aria-label', '第 ' + (p + 1) + ' 页');
				b.addEventListener('click', function () {
					current = p;
					render();
				});
				numbers.appendChild(b);
			}

			function addDots() {
				var s = document.createElement('span');
				s.className = 'page__pager-dots';
				s.textContent = '…';
				numbers.appendChild(s);
			}

			function renderNumbers() {
				if (!numbers) return;
				numbers.innerHTML = '';
				if (totalPages <= 7) {
					for (var i = 0; i < totalPages; i++) addNum(i);
				} else {
					addNum(0);
					if (current > 2) addDots();
					for (var i = Math.max(1, current - 1); i <= Math.min(totalPages - 2, current + 1); i++) addNum(i);
					if (current < totalPages - 3) addDots();
					addNum(totalPages - 1);
				}
			}

			function render() {
				cards.forEach(function (card, i) {
					card.style.display = Math.floor(i / perPage) === current ? '' : 'none';
				});
				renderNumbers();
				if (info) info.textContent = (current + 1) + ' / ' + totalPages;
				if (prev) prev.disabled = current === 0;
				if (next) next.disabled = current === totalPages - 1;
			}

			if (prev) {
				prev.addEventListener('click', function () {
					if (current > 0) {
						current--;
						render();
						scrollToGrid();
					}
				});
			}
			if (next) {
				next.addEventListener('click', function () {
					if (current < totalPages - 1) {
						current++;
						render();
						scrollToGrid();
					}
				});
			}

			render();
			pager.hidden = false;
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initPager);
	} else {
		initPager();
	}
})();
