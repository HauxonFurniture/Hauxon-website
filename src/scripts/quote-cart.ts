import { productCategories } from '../data/products';

const storageKey = 'hauxon_quote_cart';
const cartChangeEvent = 'hauxon:quote-cart-change';

type QuoteProduct = {
	model: string;
	category: string;
	image?: string;
};

const products = new Map<string, QuoteProduct>();
productCategories.forEach((category) => {
	category.subcategories.forEach((subcategory) => {
		subcategory.products.forEach((product) => {
			products.set(product.model, {
				model: product.model,
				category: subcategory.name,
				image: product.image,
			});
		});
	});
});

function initializeQuoteCart() {
	const dialog = document.querySelector<HTMLDialogElement>('#quote-cart-dialog');
	const list = document.querySelector<HTMLUListElement>('[data-quote-list]');
	const emptyState = document.querySelector<HTMLElement>('[data-quote-empty]');
	const footer = document.querySelector<HTMLElement>('[data-quote-footer]');
	const total = document.querySelector<HTMLElement>('[data-quote-total]');
	const status = document.querySelector<HTMLElement>('[data-quote-status]');
	if (!dialog || !list || !emptyState || !footer || !total || !status || dialog.dataset.ready === 'true') return;

	dialog.dataset.ready = 'true';
	let selectedModels: string[] = [];
	let lastTrigger: HTMLElement | null = null;
	let closeTimer: number | undefined;
	let bodyOverflowBeforeOpen = '';

	function readStoredModels(value: string | null): string[] {
		if (!value) return [];
		try {
			const parsed: unknown = JSON.parse(value);
			if (!Array.isArray(parsed)) {
				throw new TypeError('Quote cart storage must contain an array of product model identifiers.');
			}
			const validModels = parsed.filter((model): model is string => typeof model === 'string' && products.has(model));
			if (validModels.length !== parsed.length) {
				console.warn('Some invalid or unknown product identifiers were ignored in the saved quote cart.');
			}
			return [...new Set(validModels)];
		} catch (error) {
			console.error('Unable to read the saved quote cart.', error);
			status.textContent = 'Saved quote selections could not be read. You can start a new selection.';
			return [];
		}
	}

	function setStoredModels() {
		try {
			window.localStorage.setItem(storageKey, JSON.stringify(selectedModels));
			status.textContent = '';
		} catch (error) {
			console.error('Unable to save the quote cart in this browser.', error);
			status.textContent = 'Quote selections are only available until you leave this page because browser storage is unavailable.';
		}
		window.dispatchEvent(new CustomEvent<string[]>(cartChangeEvent, { detail: [...selectedModels] }));
	}

	function render() {
		const count = selectedModels.length;
		document.querySelectorAll<HTMLElement>('[data-quote-count]').forEach((counter) => {
			counter.textContent = `Quote (${count})`;
		});
		document.querySelectorAll<HTMLButtonElement>('[data-quote-open]').forEach((trigger) => {
			trigger.setAttribute('aria-label', `Open quote cart, ${count} ${count === 1 ? 'product' : 'products'}`);
		});
		document.querySelectorAll<HTMLButtonElement>('[data-quote-add]').forEach((button) => {
			const model = button.dataset.quoteAdd ?? '';
			const added = selectedModels.includes(model);
			button.classList.toggle('is-added', added);
			button.setAttribute('aria-pressed', String(added));
			const label = button.querySelector<HTMLElement>('[data-quote-add-label]');
			if (label) label.textContent = added ? 'Added' : 'Add to Quote';
		});

		list.replaceChildren();
		selectedModels.forEach((model) => {
			const product = products.get(model);
			if (!product) return;

			const item = document.createElement('li');
			item.className = 'quote-cart-item';

			const imageFrame = document.createElement('div');
			imageFrame.className = 'quote-cart-image';
			if (product.image) {
				const image = document.createElement('img');
				image.src = product.image;
				image.alt = '';
				image.loading = 'lazy';
				imageFrame.append(image);
			}

			const copy = document.createElement('div');
			copy.className = 'quote-cart-item-copy';
			const heading = document.createElement('h3');
			heading.textContent = product.model;
			const category = document.createElement('p');
			category.textContent = product.category;
			copy.append(heading, category);

			const remove = document.createElement('button');
			remove.className = 'quote-cart-remove';
			remove.type = 'button';
			remove.dataset.quoteRemove = product.model;
			remove.setAttribute('aria-label', `Remove ${product.model} from quote cart`);
			remove.textContent = 'Remove';

			item.append(imageFrame, copy, remove);
			list.append(item);
		});

		emptyState.hidden = count > 0;
		footer.hidden = count === 0;
		total.textContent = `${count} ${count === 1 ? 'Product' : 'Products'} Selected`;
	}

	function openCart(trigger: HTMLElement) {
		if (closeTimer !== undefined) window.clearTimeout(closeTimer);
		lastTrigger = trigger;
		if (!dialog.open) {
			bodyOverflowBeforeOpen = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			dialog.showModal();
		}
		window.requestAnimationFrame(() => dialog.classList.add('is-open'));
		dialog.querySelector<HTMLButtonElement>('[data-quote-close]')?.focus();
	}

	function closeCart() {
		if (!dialog.open) return;
		dialog.classList.remove('is-open');
		if (closeTimer !== undefined) window.clearTimeout(closeTimer);
		closeTimer = window.setTimeout(() => {
			if (!dialog.open) return;
			const triggerToRestore = lastTrigger;
			dialog.close();
			document.body.style.overflow = bodyOverflowBeforeOpen;
			bodyOverflowBeforeOpen = '';
			lastTrigger = null;
			window.setTimeout(() => {
				if (!dialog.open && triggerToRestore?.isConnected) triggerToRestore.focus({ preventScroll: true });
			}, 0);
		}, 220);
	}

	dialog.addEventListener('cancel', (event) => {
		event.preventDefault();
		closeCart();
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && dialog.open) {
			event.preventDefault();
			closeCart();
		}
	});

	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) closeCart();
		const target = event.target;
		if (!(target instanceof Element)) return;
		const removeButton = target.closest<HTMLButtonElement>('[data-quote-remove]');
		if (removeButton?.dataset.quoteRemove) {
			selectedModels = selectedModels.filter((model) => model !== removeButton.dataset.quoteRemove);
			setStoredModels();
			render();
			return;
		}
		if (target.closest('[data-quote-close]')) closeCart();
	});

	document.addEventListener('click', (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;

		const trigger = target.closest<HTMLElement>('[data-quote-open]');
		if (trigger) {
			openCart(trigger);
			return;
		}

		const addButton = target.closest<HTMLButtonElement>('[data-quote-add]');
		const model = addButton?.dataset.quoteAdd;
		if (!addButton || !model || !products.has(model) || selectedModels.includes(model)) return;

		selectedModels = [...selectedModels, model];
		setStoredModels();
		render();
		addButton.classList.add('just-added');
		window.setTimeout(() => addButton.classList.remove('just-added'), 500);
	});

	window.addEventListener('storage', (event) => {
		if (event.key !== storageKey && event.key !== null) return;
		selectedModels = readStoredModels(event.newValue);
		render();
	});

	window.addEventListener(cartChangeEvent, (event) => {
		const models = (event as CustomEvent<unknown>).detail;
		if (!Array.isArray(models)) return;
		selectedModels = [...new Set(models.filter((model): model is string => typeof model === 'string' && products.has(model)))];
		render();
	});

	try {
		selectedModels = readStoredModels(window.localStorage.getItem(storageKey));
	} catch (error) {
		console.error('Unable to access the saved quote cart in this browser.', error);
		status.textContent = 'Quote selections are only available until you leave this page because browser storage is unavailable.';
	}
	render();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeQuoteCart, { once: true });
} else {
	initializeQuoteCart();
}
