import dictionaries from '../i18n/translations.json';

export type Locale = 'en' | 'pt-BR' | 'es';

const localeCodes: Record<Locale, string> = { en: 'EN', 'pt-BR': 'PT', es: 'ES' };
const localePaths: Record<Locale, string> = { en: '', 'pt-BR': '/pt-br', es: '/es' };
const routePaths = new Set(['/', '/products', '/our-factory', '/about-us', '/contact', '/faq', '/quote']);
const languageStorageKey = 'hauxon_language';

export function getLocale(): Locale {
	const lang = document.documentElement.lang;
	return lang === 'pt-BR' || lang === 'es' ? lang : 'en';
}

export function translateText(value: string, locale: Locale = getLocale()): string {
	if (locale === 'en') return value;
	const dictionary = dictionaries[locale] as Record<string, string>;
	const exact = dictionary[value];
	if (exact) return exact;

	let match = value.match(/^STEP (\d{2}) \/ (\d{2})$/);
	if (match) return `${locale === 'pt-BR' ? 'ETAPA' : 'PASO'} ${match[1]} / ${match[2]}`;

	match = value.match(/^(.+) subcategories$/);
	if (match) {
		const category = translateText(match[1], locale);
		return `${locale === 'pt-BR' ? 'Subcategorias' : 'Subcategorías'}: ${category}`;
	}

	match = value.match(/^View (.+) products$/);
	if (match) {
		return `${locale === 'pt-BR' ? 'Ver produtos' : 'Ver productos'}: ${translateText(match[1], locale)}`;
	}

	match = value.match(/^([A-Z0-9-]+) (.+)$/);
	if (match && dictionary[match[2]]) return `${match[1]} ${dictionary[match[2]]}`;

	match = value.match(/^Quote \((\d+)\)$/);
	if (match) return `${locale === 'pt-BR' ? 'Cotação' : 'Cotización'} (${match[1]})`;

	match = value.match(/^(\d+) Products? Selected$/i);
	if (match) {
		const count = Number(match[1]);
		return `${count} ${locale === 'pt-BR' ? count === 1 ? 'produto selecionado' : 'produtos selecionados' : count === 1 ? 'producto seleccionado' : 'productos seleccionados'}`;
	}

	match = value.match(/^(\d+) products? selected$/i);
	if (match) {
		const count = Number(match[1]);
		return `${count} ${locale === 'pt-BR' ? count === 1 ? 'produto selecionado' : 'produtos selecionados' : count === 1 ? 'producto seleccionado' : 'productos seleccionados'}`;
	}

	match = value.match(/^(\d+) product models? selected$/i);
	if (match) {
		const count = Number(match[1]);
		return `${count} ${locale === 'pt-BR' ? count === 1 ? 'modelo de produto selecionado' : 'modelos de produtos selecionados' : count === 1 ? 'modelo de producto seleccionado' : 'modelos de productos seleccionados'}`;
	}

	match = value.match(/^Open quote cart, (\d+) selected (product models?)$/);
	if (match) {
		const count = Number(match[1]);
		const noun = locale === 'pt-BR'
			? count === 1 ? 'modelo selecionado' : 'modelos selecionados'
			: count === 1 ? 'modelo seleccionado' : 'modelos seleccionados';
		return `${locale === 'pt-BR' ? 'Abrir lista de cotação' : 'Abrir lista de cotización'}, ${count} ${noun}`;
	}

	match = value.match(/^Remove (.+) from (?:selected products|quote cart)$/);
	if (match) {
		return locale === 'pt-BR'
			? `Remover ${match[1]} ${value.endsWith('selected products') ? 'dos produtos selecionados' : 'da lista de cotação'}`
			: `Quitar ${match[1]} ${value.endsWith('selected products') ? 'de los productos seleccionados' : 'de la lista de cotización'}`;
	}

	match = value.match(/^Use no more than (\d+) characters\.$/);
	if (match) {
		return locale === 'pt-BR'
			? `Use no máximo ${match[1]} caracteres.`
			: `Use un máximo de ${match[1]} caracteres.`;
	}

	return value;
}

function isPreservedText(node: Node): boolean {
	return Boolean(node.parentElement?.closest('[data-i18n-preserve]'));
}

function localizeNode(node: Node, locale: Locale) {
	if (node.nodeType === Node.TEXT_NODE) {
		const text = node.nodeValue;
		if (!text || isPreservedText(node)) return;
		const leading = text.match(/^\s*/)?.[0] ?? '';
		const trailing = text.match(/\s*$/)?.[0] ?? '';
		const content = text.slice(leading.length, text.length - trailing.length);
		const translated = translateText(content, locale);
		if (translated !== content) node.nodeValue = `${leading}${translated}${trailing}`;
		return;
	}

	if (!(node instanceof Element) || node.matches('script,style,noscript,[data-i18n-preserve]')) return;
	for (const attr of ['aria-label', 'aria-description', 'aria-roledescription', 'alt', 'placeholder', 'title', 'content', 'label', 'data-process-title', 'data-process-description', 'data-process-alt', 'data-process-feature-title-0', 'data-process-feature-title-1', 'data-process-feature-title-2', 'data-process-feature-description-0', 'data-process-feature-description-1', 'data-process-feature-description-2', 'data-custom-title', 'data-custom-description', 'data-custom-alt', 'data-custom-feature-title-0', 'data-custom-feature-title-1', 'data-custom-feature-title-2', 'data-custom-feature-description-0', 'data-custom-feature-description-1', 'data-custom-feature-description-2']) {
		const value = node.getAttribute(attr);
		if (!value) continue;
		const translated = translateText(value, locale);
		if (translated !== value) node.setAttribute(attr, translated);
	}
}

function basePath(pathname: string): string {
	const withoutLocale = pathname.replace(/^\/(?:pt-br|es)(?=\/|$)/, '') || '/';
	return withoutLocale.replace(/\/$/, '') || '/';
}

function pathForLocale(pathname: string, locale: Locale): string {
	const normalized = basePath(pathname);
	if (!routePaths.has(normalized)) return pathname;
	const prefix = localePaths[locale];
	const path = normalized === '/' ? `${prefix}/` || '/' : `${prefix}${normalized}/`;
	return path;
}

function getStoredLocale(): Locale | undefined {
	try {
		const stored = window.localStorage.getItem(languageStorageKey);
		return stored === 'pt-BR' || stored === 'es' || stored === 'en' ? stored : undefined;
	} catch {
		return undefined;
	}
}

function setLanguageChoiceLinks(locale: Locale) {
	document.querySelectorAll<HTMLAnchorElement>('[data-language-choice]').forEach((link) => {
		const choice = link.dataset.languageChoice as Locale | undefined;
		if (!choice || !(choice in localeCodes)) return;
		const path = pathForLocale(window.location.pathname, choice);
		link.href = `${path}${window.location.search}${window.location.hash}`;
		link.classList.toggle('is-selected', choice === locale);
		if (choice === locale) link.setAttribute('aria-current', 'page');
		else link.removeAttribute('aria-current');
		const status = link.querySelector<HTMLElement>('.language-status');
		if (status) status.textContent = choice === locale ? translateText('Selected', locale) : '';
	});
	const code = localeCodes[locale];
	document.querySelectorAll<HTMLElement>('[data-current-language]').forEach((element) => {
		element.textContent = code;
	});
	document.querySelectorAll<HTMLElement>('.language-selector summary').forEach((summary) => {
		const languageLabel = locale === 'pt-BR'
			? 'Idioma: Português (Brasil)'
			: locale === 'es' ? 'Idioma: Español' : 'Language: English';
		summary.setAttribute('aria-label', languageLabel);
	});
}

function prefixInternalLink(link: HTMLAnchorElement, locale: Locale) {
	if (link.dataset.languageChoice) return;
	const href = link.getAttribute('href');
	if (!href || !href.startsWith('/') || href.startsWith('//')) return;
	const url = new URL(href, window.location.origin);
	const path = pathForLocale(url.pathname, locale);
	const localizedHref = `${path}${url.search}${url.hash}`;
	if (href !== localizedHref) link.setAttribute('href', localizedHref);
}

function initializeI18n() {
	const locale = getLocale();
	const preferredLocale = getStoredLocale();
	if (preferredLocale && preferredLocale !== locale) {
		const preferredPath = pathForLocale(window.location.pathname, preferredLocale);
		if (preferredPath !== window.location.pathname) {
			window.location.replace(`${preferredPath}${window.location.search}${window.location.hash}`);
			return;
		}
	}
	try {
		if (!preferredLocale) window.localStorage.setItem(languageStorageKey, locale);
	} catch {
		// Storage may be disabled; the current URL remains the source of truth.
	}

	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
	let current: Node | null;
	while ((current = walker.nextNode())) localizeNode(current, locale);
	document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => prefixInternalLink(link, locale));
	setLanguageChoiceLinks(locale);

	document.addEventListener('click', (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const choice = target.closest<HTMLAnchorElement>('[data-language-choice]');
		const nextLocale = choice?.dataset.languageChoice as Locale | undefined;
		if (!nextLocale || !(nextLocale in localeCodes)) return;
		try {
			window.localStorage.setItem(languageStorageKey, nextLocale);
		} catch {
			// Navigation still works when storage is disabled.
		}
	});

	const observer = new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === 'characterData') localizeNode(record.target, locale);
			if (record.type === 'attributes') {
				if (record.target instanceof HTMLAnchorElement) prefixInternalLink(record.target, locale);
				localizeNode(record.target, locale);
			}
			record.addedNodes.forEach((node) => {
				localizeNode(node, locale);
				if (node instanceof Element) {
					const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
					let child: Node | null;
					while ((child = walker.nextNode())) localizeNode(child, locale);
					node.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => prefixInternalLink(link, locale));
				}
			});
		}
	});
	observer.observe(document.body, {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['href', 'aria-label', 'aria-description', 'aria-roledescription', 'alt', 'placeholder', 'title', 'content', 'label', 'data-process-title', 'data-process-description', 'data-process-alt', 'data-process-feature-title-0', 'data-process-feature-title-1', 'data-process-feature-title-2', 'data-process-feature-description-0', 'data-process-feature-description-1', 'data-process-feature-description-2', 'data-custom-title', 'data-custom-description', 'data-custom-alt', 'data-custom-feature-title-0', 'data-custom-feature-title-1', 'data-custom-feature-title-2', 'data-custom-feature-description-0', 'data-custom-feature-description-1', 'data-custom-feature-description-2'],
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeI18n, { once: true });
} else {
	initializeI18n();
}
