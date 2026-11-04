import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import translations from '../src/i18n/translations.json' with { type: 'json' };
import seo from '../src/i18n/seo.json' with { type: 'json' };

const dist = path.resolve('dist');
const locales = ['pt-BR', 'es'];
const localePaths = { 'pt-BR': 'pt-br', es: 'es' };
const pages = [
	{ route: '/', file: 'index.html' },
	{ route: '/products/', file: 'products/index.html' },
	{ route: '/our-factory/', file: 'our-factory/index.html' },
	{ route: '/about-us/', file: 'about-us/index.html' },
	{ route: '/contact/', file: 'contact/index.html' },
	{ route: '/faq/', file: 'faq/index.html' },
	{ route: '/quote/', file: 'quote/index.html' },
];
const routeNames = new Set(pages.map(({ route }) => route.replace(/\/$/, '') || '/'));

function decodeHtml(value) {
	return value
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, '\u00a0');
}

function encodeHtml(value, attribute = false) {
	const encoded = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return attribute ? encoded.replace(/"/g, '&quot;') : encoded;
}

function translateMarkup(html, dictionary) {
	let insideScriptOrStyle = false;
	let preservedTag = '';
	return html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/gi, (token) => {
		if (/^<(script|style)\b[\s\S]*<\/\1>$/i.test(token)) return token;
		if (/^<(script|style)\b/i.test(token)) {
			insideScriptOrStyle = true;
			return token;
		}
		if (/^<\/(script|style)\b/i.test(token)) {
			insideScriptOrStyle = false;
			return token;
		}
		if (insideScriptOrStyle || token.startsWith('<!--')) return token;
		if (token.startsWith('<')) {
			const closingTag = token.match(/^<\/([a-z0-9-]+)/i)?.[1]?.toLowerCase();
			if (preservedTag) {
				if (closingTag === preservedTag) preservedTag = '';
				return token;
			}
			const openingPreservedTag = token.match(/^<([a-z0-9-]+)\b[^>]*\bdata-i18n-preserve(?:\s|=|>)/i)?.[1]?.toLowerCase();
			if (openingPreservedTag) {
				preservedTag = openingPreservedTag;
				return token;
			}
			return token.replace(/\b(aria-label|aria-description|aria-roledescription|alt|placeholder|title|content|label|data-[\w-]+)="([^"]*)"/g, (match, name, raw) => {
				const value = decodeHtml(raw);
				const translated = dictionary[value];
				return translated ? `${name}="${encodeHtml(translated, true)}"` : match;
			});
		}

		const leading = token.match(/^\s*/)?.[0] ?? '';
		const trailing = token.match(/\s*$/)?.[0] ?? '';
		const text = token.slice(leading.length, token.length - trailing.length);
		const translated = dictionary[decodeHtml(text)];
		return translated ? `${leading}${encodeHtml(translated)}${trailing}` : token;
	});
}

function localizedRoute(route, localePath) {
	const url = new URL(route, 'https://hauxon.cn');
	const normalized = url.pathname.replace(/\/$/, '') || '/';
	if (!routeNames.has(normalized)) return route;
	const localizedPath = normalized === '/' ? `/${localePath}/` : `/${localePath}${normalized}/`;
	return `${localizedPath}${url.search}${url.hash}`;
}

function addSeoLinks(html, route) {
	const canonical = `https://hauxon.cn${route}`;
	const links = [
		`<link rel="canonical" href="${canonical}">`,
		`<link rel="alternate" hreflang="en" href="${canonical}">`,
		`<link rel="alternate" hreflang="pt-BR" href="https://hauxon.cn/pt-br${route === '/' ? '/' : route}">`,
		`<link rel="alternate" hreflang="es" href="https://hauxon.cn/es${route === '/' ? '/' : route}">`,
		`<link rel="alternate" hreflang="x-default" href="${canonical}">`,
	].join('');
	const withoutSeoLinks = html.replace(/<link rel="(?:canonical|alternate)"[^>]*>/g, '');
	return withoutSeoLinks.replace('</head>', `${links}</head>`);
}

for (const page of pages) {
	const sourcePath = path.join(dist, page.file);
	const englishHtml = addSeoLinks(await readFile(sourcePath, 'utf8'), page.route);
	await writeFile(sourcePath, englishHtml);

	for (const locale of locales) {
		const localePath = localePaths[locale];
		const targetPath = path.join(dist, localePath, page.file);
		await mkdir(path.dirname(targetPath), { recursive: true });
		let localizedHtml = translateMarkup(englishHtml, translations[locale]);
		localizedHtml = localizedHtml.replace(/(<html\b[^>]*\blang=")en(")/, `$1${locale}$2`);
		localizedHtml = localizedHtml.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="https://hauxon.cn${localizedRoute(page.route, localePath)}">`);
		localizedHtml = localizedHtml.replace(`<link rel="alternate" hreflang="${locale}" href="https://hauxon.cn${page.route}">`, `<link rel="alternate" hreflang="${locale}" href="https://hauxon.cn${localizedRoute(page.route, localePath)}">`);
		localizedHtml = localizedHtml.replace(/href="(\/[^"]*)"/g, (match, href) => `href="${localizedRoute(href, localePath)}"`);
		const { title, description } = seo[locale][page.route];
		localizedHtml = localizedHtml.replace(/<title>[\s\S]*?<\/title>/, `<title>${encodeHtml(title)}</title>`);
		localizedHtml = localizedHtml.replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${encodeHtml(description, true)}" />`);
		await writeFile(targetPath, localizedHtml);
	}
}

const sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
for (const { route } of pages) {
	const alternates = [
		['en', route],
		['pt-BR', localizedRoute(route, 'pt-br')],
		['es', localizedRoute(route, 'es')],
	];
	for (const [, urlPath] of alternates) {
		sitemap.push('<url>', `<loc>https://hauxon.cn${urlPath}</loc>`);
		for (const [locale, alternatePath] of alternates) {
			sitemap.push(`<xhtml:link rel="alternate" hreflang="${locale}" href="https://hauxon.cn${alternatePath}"/>`);
		}
		sitemap.push(`<xhtml:link rel="alternate" hreflang="x-default" href="https://hauxon.cn${route}"/>`, '</url>');
	}
}
sitemap.push('</urlset>');
await writeFile(path.join(dist, 'sitemap.xml'), sitemap.join(''));

const generatedLocales = await readdir(dist);
if (!generatedLocales.includes('pt-br') || !generatedLocales.includes('es')) {
	throw new Error('Localized routes were not generated.');
}
