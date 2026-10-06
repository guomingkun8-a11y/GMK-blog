// GMK 博客聊天挂件
// - 点击「说声 hi」/「与我聊聊」打开聊天窗
// - 直接用 OpenRouter 调大模型（key 由构建时注入 window.__GMK_AI__）
// - 主模型失败自动降级到兜底免费模型
(function () {
	const win = document.getElementById('gmk-chat');
	if (!win) return;

	const cfg = window.__GMK_AI__ || {};
	const API_KEY = cfg.apiKey || '';
	const BASE_URL = cfg.baseUrl || 'https://openrouter.ai/api/v1';
	const MODEL = cfg.model || 'qwen/qwen3.8-27b:free';
	const FALLBACK_MODEL = cfg.fallbackModel || 'openrouter/free';
	const SITE_NAME = cfg.siteName || '';
	// HTTP 头只允许 ISO-8859-1 字符，中文站名会导致 fetch 直接抛错，这里强制只留 ASCII
	const ASCII_SITE_NAME = /^[ -~]*$/.test(SITE_NAME) ? SITE_NAME : '';
	const SYSTEM_PROMPT = cfg.systemPrompt || '你是郭明坤个人博客的 AI 小助手，用简洁友好的中文回答。';

	const openBtns = document.querySelectorAll('[data-chat-open]');
	const closeBtn = win.querySelector('[data-chat-close]');
	const form = win.querySelector('.chat__input');
	const field = win.querySelector('.chat__field');
	const sendBtn = win.querySelector('.chat__send');
	const list = win.querySelector('.chat__messages');

	const history = [{ role: 'assistant', content: win.querySelector('.chat__msg--bot')?.textContent || '' }];
	let busy = false;

	function sleep(ms) {
		return new Promise((r) => setTimeout(r, ms));
	}

	function open() {
		win.hidden = false;
		if (field) field.focus();
	}

	function close() {
		win.hidden = true;
	}

	function add(role, text) {
		const div = document.createElement('div');
		div.className = 'chat__msg chat__msg--' + role;
		div.textContent = text;
		list.appendChild(div);
		list.scrollTop = list.scrollHeight;
		return div;
	}

	function typing(show) {
		let t = list.querySelector('.chat__typing');
		if (show && !t) {
			t = document.createElement('div');
			t.className = 'chat__msg chat__msg--bot chat__typing';
			t.innerHTML = '<span></span><span></span><span></span>';
			list.appendChild(t);
			list.scrollTop = list.scrollHeight;
		} else if (!show && t) {
			t.remove();
		}
	}

	function setBusy(v) {
		busy = v;
		if (sendBtn) sendBtn.disabled = v;
	}

	async function callModel(userText) {
		if (!API_KEY) {
			await sleep(600);
			return '（没配置 API key，我现在只会说这句。）';
		}

		const payload = {
			model: MODEL,
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				...history.filter((m) => m.role !== 'system'),
				{ role: 'user', content: userText },
			],
			max_tokens: 500,
		};

		const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API_KEY };
		if (ASCII_SITE_NAME) {
			headers['HTTP-Referer'] = 'https://' + ASCII_SITE_NAME;
			headers['X-Title'] = ASCII_SITE_NAME;
		}

		let res = await fetch(BASE_URL + '/chat/completions', {
			method: 'POST',
			headers,
			body: JSON.stringify(payload),
		});

		if (!res.ok && MODEL !== FALLBACK_MODEL) {
			res = await fetch(BASE_URL + '/chat/completions', {
				method: 'POST',
				headers,
				body: JSON.stringify({ ...payload, model: FALLBACK_MODEL }),
			});
		}

		if (!res.ok) {
			const errText = await res.text();
			throw new Error('HTTP ' + res.status + ' ' + errText.slice(0, 80));
		}

		const data = await res.json();
		return data?.choices?.[0]?.message?.content?.trim() || '（模型返回了空内容）';
	}

	async function send(text) {
		const content = (text || '').trim();
		if (!content || busy) return;
		setBusy(true);
		add('user', content);
		field.value = '';

		typing(true);
		let reply;
		try {
			reply = await callModel(content);
		} catch (e) {
			reply = '抱歉，我这边出了点问题，没能连上模型（' + (e && e.message ? e.message : e) + '）。稍后再试试，或直接发邮件给本尊：guomingkun8@gmail.com';
		}
		typing(false);
		add('bot', reply);
		history.push({ role: 'user', content }, { role: 'assistant', content: reply });
		setBusy(false);
		if (field) field.focus();
	}

	openBtns.forEach((btn) => {
		btn.addEventListener('click', () => {
			win.hidden ? open() : close();
		});
	});

	if (closeBtn) closeBtn.addEventListener('click', close);

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !win.hidden) close();
	});

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		send(field.value);
	});
})();
