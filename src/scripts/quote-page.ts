import { productCategories } from '../data/products';

const storageKey = 'hauxon_quote_cart';
const cartChangeEvent = 'hauxon:quote-cart-change';
const productDetails = new Map(
	productCategories.flatMap((category) =>
		category.subcategories.flatMap((subcategory) =>
			subcategory.products.map((product) => [
				product.model,
				{ model: product.model, category: subcategory.name, image: product.image },
			] as const),
		),
	),
);

function initializeQuotePage() {
	const list = document.querySelector<HTMLElement>('[data-quote-page-list]');
	const emptyState = document.querySelector<HTMLElement>('[data-quote-page-empty]');
	const count = document.querySelector<HTMLElement>('[data-quote-page-count]');
	const form = document.querySelector<HTMLFormElement>('[data-inquiry-form]');
	if (!list || !emptyState || !count || !form || list.dataset.ready === 'true') return;

	list.dataset.ready = 'true';
	const submitButton = form.querySelector<HTMLButtonElement>('.submit-inquiry');
	const submissionNote = form.querySelector<HTMLElement>('[data-submission-note]');
	let selectedModels: string[] = [];
	let submitting = false;

	if (!submitButton || !submissionNote) return;

	function validModelIds(value: unknown): string[] {
		if (!Array.isArray(value)) return [];
		return [...new Set(value.filter((model): model is string => typeof model === 'string' && productDetails.has(model)))];
	}

	function render() {
		list.replaceChildren();
		selectedModels.forEach((model) => {
			const product = productDetails.get(model);
			if (!product) return;

			const item = document.createElement('article');
			item.className = 'selected-product';

			const imageFrame = document.createElement('div');
			imageFrame.className = 'selected-product-image';
			if (product.image) {
				const image = document.createElement('img');
				image.src = product.image;
				image.alt = '';
				image.loading = 'lazy';
				imageFrame.append(image);
			}

			const information = document.createElement('div');
			information.className = 'selected-product-info';
			const heading = document.createElement('h3');
			heading.textContent = product.model;
			const category = document.createElement('p');
			category.textContent = product.category;
			information.append(heading, category);

			const remove = document.createElement('button');
			remove.className = 'remove-selected-product';
			remove.type = 'button';
			remove.dataset.quotePageRemove = product.model;
			remove.setAttribute('aria-label', `Remove ${product.model} from selected products`);
			remove.textContent = 'Remove';

			item.append(imageFrame, information, remove);
			list.append(item);
		});

		const total = selectedModels.length;
		count.textContent = `${total} ${total === 1 ? 'product' : 'products'} selected`;
		emptyState.hidden = total > 0;
	}

	function saveModels() {
		try {
			window.localStorage.setItem(storageKey, JSON.stringify(selectedModels));
		} catch (error) {
			console.error('Unable to save the quote selections in this browser.', error);
		}
		window.dispatchEvent(new CustomEvent<string[]>(cartChangeEvent, { detail: [...selectedModels] }));
	}

	function setSubmitAvailability() {
		submitButton.disabled = submitting;
	}

	function readModels(value: string | null) {
		if (!value) {
			selectedModels = [];
			render();
			return;
		}
		try {
			selectedModels = validModelIds(JSON.parse(value));
		} catch (error) {
			console.error('Unable to read the saved quote selections.', error);
			submissionNote.textContent = 'Saved product selections could not be read. You can still send a general inquiry.';
			selectedModels = [];
		}
		render();
	}

	function clearFieldError(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
		field.removeAttribute('aria-invalid');
		const error = form.querySelector<HTMLElement>(`[data-field-error="${field.name}"]`);
		if (error) error.textContent = '';
	}

	form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((field) => {
		field.addEventListener('input', () => clearFieldError(field));
		field.addEventListener('change', () => clearFieldError(field));
	});

	list.addEventListener('click', (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const remove = target.closest<HTMLButtonElement>('[data-quote-page-remove]');
		const model = remove?.dataset.quotePageRemove;
		if (!model) return;
		selectedModels = selectedModels.filter((selected) => selected !== model);
		saveModels();
		render();
	});

	window.addEventListener('storage', (event) => {
		if (event.key !== storageKey && event.key !== null) return;
		readModels(event.newValue);
	});

	window.addEventListener(cartChangeEvent, (event) => {
		selectedModels = validModelIds((event as CustomEvent<unknown>).detail);
		render();
	});

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (submitting) return;

		const fields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:not([type="hidden"]), select, textarea'));
		let firstInvalid: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined;

		fields.forEach((field) => {
			clearFieldError(field);
			const value = field.value.trim();
			let message = '';

			if (field.name === 'website' && value) {
				message = '';
			} else if (field.required && !value) {
				message = 'This field is required.';
			} else if (field.type === 'email' && value && !field.validity.valid) {
				message = 'Enter a valid email address.';
			} else if (field.hasAttribute('maxlength') && value.length > Number(field.getAttribute('maxlength'))) {
				message = `Use no more than ${field.getAttribute('maxlength')} characters.`;
			}

			if (message) {
				field.setAttribute('aria-invalid', 'true');
				const error = form.querySelector<HTMLElement>(`[data-field-error="${field.name}"]`);
				if (error) error.textContent = message;
				firstInvalid ??= field;
			}
		});

		if (firstInvalid) {
			firstInvalid.focus();
			return;
		}

		const formData = new FormData(form);
		const payload = {
			name: String(formData.get('name') ?? '').trim(),
			company: String(formData.get('company') ?? '').trim(),
			email: String(formData.get('email') ?? '').trim(),
			country: String(formData.get('country') ?? '').trim(),
			whatsapp: String(formData.get('whatsapp') ?? '').trim(),
			message: String(formData.get('message') ?? '').trim(),
			productModels: selectedModels,
			website: String(formData.get('website') ?? '').trim(),
			source: 'quote',
		};

		submitting = true;
		setSubmitAvailability();
		submitButton.setAttribute('aria-busy', 'true');
		const originalLabel = submitButton.textContent ?? 'Submit Inquiry';
		submitButton.textContent = 'Sending…';
		submissionNote.textContent = 'Sending your inquiry…';

		try {
			const response = await fetch('/api/inquiry', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify(payload),
			});
			let result: { success?: boolean; error?: string } = {};
			try {
				result = await response.json() as { success?: boolean; error?: string };
			} catch {
				throw new Error('The inquiry endpoint returned an invalid response.');
			}
			if (!response.ok || result.success !== true) {
				throw new Error(result.error || `Inquiry request failed with status ${response.status}.`);
			}

			selectedModels = [];
			try {
				window.localStorage.removeItem(storageKey);
			} catch (error) {
				console.error('Inquiry sent, but the saved product selection could not be cleared.', error);
			}
			window.dispatchEvent(new CustomEvent<string[]>(cartChangeEvent, { detail: [] }));
			render();
			form.reset();
			submissionNote.textContent = 'Thank you for your inquiry. Our team will get back to you as soon as possible.';
		} catch (error) {
			console.error('Unable to submit the inquiry.', error);
			submissionNote.textContent = 'We couldn’t send your inquiry. Please try again.';
		} finally {
			submitting = false;
			submitButton.removeAttribute('aria-busy');
			submitButton.textContent = originalLabel;
			setSubmitAvailability();
		}
	});

	try {
		readModels(window.localStorage.getItem(storageKey));
	} catch (error) {
		console.error('Unable to access the saved quote selections.', error);
		submissionNote.textContent = 'Saved product selections are unavailable in this browser. You can still send a general inquiry.';
		readModels(null);
	}
	setSubmitAvailability();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeQuotePage, { once: true });
} else {
	initializeQuotePage();
}
