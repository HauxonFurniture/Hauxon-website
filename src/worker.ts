import { productCategories } from './data/products';

interface RateLimitBinding {
	limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

interface AssetBinding {
	fetch: (request: Request) => Promise<Response>;
}

interface WorkerEnvironment {
	ASSETS: AssetBinding;
	INQUIRY_LIMITER: RateLimitBinding;
	RESEND_API_KEY?: string;
	INQUIRY_TO_EMAIL?: string;
	INQUIRY_FROM_EMAIL?: string;
}

type InquiryData = {
	name: string;
	company: string;
	email: string;
	country: string;
	phone: string;
	message: string;
	productModels: string[];
	website: string;
	source: 'quote' | 'contact';
};

const maximumRequestBytes = 16_384;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const productCatalog = new Map(
	productCategories.flatMap((category) =>
		category.subcategories.flatMap((subcategory) =>
			subcategory.products.map((product) => [product.model, subcategory.name] as const),
		),
	),
);

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
	return Response.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store' },
	});
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		};
		return entities[character];
	});
}

async function readJsonBody(request: Request): Promise<unknown> {
	const contentLength = Number(request.headers.get('Content-Length') ?? 0);
	if (contentLength > maximumRequestBytes) throw new RangeError('Request body is too large.');
	if (!request.body) throw new TypeError('Request body is missing.');

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		totalBytes += value.byteLength;
		if (totalBytes > maximumRequestBytes) {
			await reader.cancel();
			throw new RangeError('Request body is too large.');
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(totalBytes);
	let offset = 0;
	chunks.forEach((chunk) => {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	});
	return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function getString(
	value: Record<string, unknown>,
	field: string,
	maximumLength: number,
	required = false,
): string | null {
	const raw = value[field];
	if (raw === undefined || raw === null) return required ? null : '';
	if (typeof raw !== 'string') return null;
	const normalized = raw.trim();
	if (normalized.length > maximumLength || (required && normalized.length === 0)) return null;
	return normalized;
}

function parseInquiry(value: unknown): InquiryData | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const input = value as Record<string, unknown>;
	const name = getString(input, 'name', 100, true);
	const source = input.source;
	if (source !== 'quote' && source !== 'contact') return null;
	const company = getString(input, 'company', 150, source === 'quote');
	const email = getString(input, 'email', 254, true);
	const country = getString(input, 'country', 100, true);
	const phoneInput = input.phone ?? input.whatsapp;
	const phone = getString({ phone: phoneInput }, 'phone', 30);
	const message = getString(input, 'message', 2000, source === 'contact');
	const website = getString(input, 'website', 500);
	if (name === null || company === null || email === null || country === null || phone === null || message === null || website === null) return null;
	if (!emailPattern.test(email)) return null;

	const rawModels = input.productModels ?? [];
	if (!Array.isArray(rawModels) || rawModels.length > productCatalog.size) return null;
	if (rawModels.some((model) => typeof model !== 'string' || !productCatalog.has(model))) return null;

	return {
		name,
		company,
		email,
		country,
		phone,
		message,
		productModels: [...new Set(rawModels as string[])],
		website,
		source,
	};
}

function renderInquiryEmail(inquiry: InquiryData): { html: string; text: string; subject: string } {
	const details = [
		['Name', inquiry.name],
		['Company', inquiry.company],
		['Email', inquiry.email],
		['Country / Region', inquiry.country],
		['Phone / WhatsApp', inquiry.phone],
	].filter(([, value]) => value);
	const selectedProducts = inquiry.productModels.map((model) => `${model} — ${productCatalog.get(model)}`);
	const subjectLabel = (inquiry.company || inquiry.name).replace(/[\r\n\t]+/g, ' ');
	const subject = `New Website Inquiry | ${subjectLabel}`;
	const html = [
		'<h2>Website Inquiry</h2>',
		'<h3>Customer Information</h3>',
		'<dl>',
		...details.map(([label, value]) => `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value)}</dd>`),
		'</dl>',
		'<h3>Selected Products</h3>',
		selectedProducts.length
			? `<ul>${selectedProducts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
			: '<p>General Inquiry</p>',
		'<h3>Customer Message</h3>',
		`<p>${escapeHtml(inquiry.message || 'No message provided.').replace(/\n/g, '<br>')}</p>`,
	].join('');
	const text = [
		'Website Inquiry',
		'',
		'Customer Information:',
		...details.map(([label, value]) => `${label}: ${value}`),
		'',
		'Selected Products:',
		...(selectedProducts.length ? selectedProducts.map((item) => `- ${item}`) : ['General Inquiry']),
		'',
		'Customer Message:',
		inquiry.message || 'No message provided.',
	].join('\n');
	return { html, text, subject };
}

function renderFooterEmail(email: string): { html: string; text: string } {
	const timestamp = new Date().toISOString();
	const html = [
		'<h2>Website Contact — Keep in Touch</h2>',
		`<p><strong>Submitted email address:</strong> ${escapeHtml(email)}</p>`,
		'<p><strong>Source:</strong> Footer — Keep in Touch</p>',
		`<p><strong>Submission timestamp:</strong> ${escapeHtml(timestamp)}</p>`,
	].join('');
	const text = [
		'Website Contact — Keep in Touch',
		`Submitted email address: ${email}`,
		'Source: Footer — Keep in Touch',
		`Submission timestamp: ${timestamp}`,
	].join('\n');
	return { html, text };
}

async function sendEmail(
	env: WorkerEnvironment,
	message: { subject: string; html: string; text: string; replyTo?: string },
): Promise<boolean> {
	if (!env.RESEND_API_KEY || !env.INQUIRY_TO_EMAIL || !env.INQUIRY_FROM_EMAIL) {
		console.error('Inquiry email configuration is incomplete.');
		return false;
	}

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: env.INQUIRY_FROM_EMAIL,
				to: [env.INQUIRY_TO_EMAIL],
				subject: message.subject,
				html: message.html,
				text: message.text,
				...(message.replyTo ? { reply_to: message.replyTo } : {}),
			}),
		});
		if (!response.ok) {
			console.error('Resend rejected an email request with status', response.status);
			return false;
		}
		return true;
	} catch (error) {
		console.error('Resend email request failed.', error);
		return false;
	}
}

async function handleInquiry(request: Request, env: WorkerEnvironment): Promise<Response> {
	if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
	if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
		return jsonResponse({ success: false, error: 'Invalid request.' }, 415);
	}
	const origin = request.headers.get('Origin');
	if (origin && origin !== new URL(request.url).origin) return jsonResponse({ success: false, error: 'Invalid request.' }, 403);

	const address = request.headers.get('CF-Connecting-IP') ?? 'unknown';
	try {
		const rateLimit = await env.INQUIRY_LIMITER.limit({ key: address });
		if (!rateLimit.success) return jsonResponse({ success: false, error: 'Too many requests. Please try again shortly.' }, 429);
	} catch (error) {
		console.error('Inquiry rate limiter failed.', error);
		return jsonResponse({ success: false, error: 'The service is temporarily unavailable.' }, 503);
	}

	let body: unknown;
	try {
		body = await readJsonBody(request);
	} catch (error) {
		const tooLarge = error instanceof RangeError;
		return jsonResponse({ success: false, error: tooLarge ? 'Request is too large.' : 'Invalid request.' }, tooLarge ? 413 : 400);
	}
	const inquiry = parseInquiry(body);
	if (!inquiry || inquiry.website) return jsonResponse({ success: false, error: 'Please check your information and try again.' }, 400);

	const email = renderInquiryEmail(inquiry);
	const sent = await sendEmail(env, { ...email, replyTo: inquiry.email });
	if (!sent) return jsonResponse({ success: false, error: 'Unable to send your inquiry right now.' }, 502);
	return jsonResponse({ success: true });
}

async function handleFooterContact(request: Request, env: WorkerEnvironment): Promise<Response> {
	if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
	if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
		return jsonResponse({ success: false, error: 'Invalid request.' }, 415);
	}
	const origin = request.headers.get('Origin');
	if (origin && origin !== new URL(request.url).origin) return jsonResponse({ success: false, error: 'Invalid request.' }, 403);

	const address = request.headers.get('CF-Connecting-IP') ?? 'unknown';
	try {
		const rateLimit = await env.INQUIRY_LIMITER.limit({ key: address });
		if (!rateLimit.success) return jsonResponse({ success: false, error: 'Too many requests. Please try again shortly.' }, 429);
	} catch (error) {
		console.error('Footer contact rate limiter failed.', error);
		return jsonResponse({ success: false, error: 'The service is temporarily unavailable.' }, 503);
	}

	let body: unknown;
	try {
		body = await readJsonBody(request);
	} catch (error) {
		const tooLarge = error instanceof RangeError;
		return jsonResponse({ success: false, error: tooLarge ? 'Request is too large.' : 'Invalid request.' }, tooLarge ? 413 : 400);
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ success: false, error: 'Invalid request.' }, 400);
	const input = body as Record<string, unknown>;
	const email = getString(input, 'email', 254, true);
	const website = getString(input, 'website', 500);
	if (!email || !emailPattern.test(email) || website === null || website) {
		return jsonResponse({ success: false, error: 'Please enter a valid email address.' }, 400);
	}

	const message = renderFooterEmail(email);
	const sent = await sendEmail(env, {
		subject: 'New Website Contact – Keep in Touch',
		...message,
		replyTo: email,
	});
	if (!sent) return jsonResponse({ success: false, error: 'Unable to send your email right now.' }, 502);
	return jsonResponse({ success: true });
}

export default {
	async fetch(request: Request, env: WorkerEnvironment): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname === '/api/inquiry') return handleInquiry(request, env);
		if (pathname === '/api/footer-contact') return handleFooterContact(request, env);
		return env.ASSETS.fetch(request);
	},
};
