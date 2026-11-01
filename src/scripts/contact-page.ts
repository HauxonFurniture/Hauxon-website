function initializeContactPage() {
	const form = document.querySelector<HTMLFormElement>('[data-contact-page-form]');
	const status = document.querySelector<HTMLElement>('[data-contact-page-status]');
	const button = form?.querySelector<HTMLButtonElement>('.contact-submit');
	const buttonLabel = form?.querySelector<HTMLElement>('[data-contact-submit-label]');
	const factoryVisit = document.querySelector<HTMLAnchorElement>('[data-factory-visit]');
	const messageField = form?.querySelector<HTMLTextAreaElement>('#contact-form-message');
	if (!form || !status || !button || !buttonLabel || form.dataset.ready === 'true') return;

	form.dataset.ready = 'true';
	let submitting = false;

	factoryVisit?.addEventListener('click', () => {
		if (!messageField) return;
		if (messageField.value.trim() && !window.confirm('Replace your current message with the factory visit request?')) return;

		messageField.value = 'I would like to arrange a factory visit.';
		window.requestAnimationFrame(() => {
			messageField.focus({ preventScroll: true });
			messageField.scrollIntoView({
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
				block: 'center',
			});
		});
	});

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (submitting || !form.reportValidity()) return;

		submitting = true;
		button.disabled = true;
		button.setAttribute('aria-busy', 'true');
		buttonLabel.textContent = 'Sending…';
		status.classList.remove('is-success');
		status.textContent = 'Sending your message…';

		try {
			const formData = new FormData(form);
			const response = await fetch('/api/inquiry', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({
					name: String(formData.get('name') ?? '').trim(),
					company: String(formData.get('company') ?? '').trim(),
					email: String(formData.get('email') ?? '').trim(),
					country: String(formData.get('country') ?? '').trim(),
					message: String(formData.get('message') ?? '').trim(),
					website: String(formData.get('website') ?? '').trim(),
					source: 'general-contact',
				}),
			});

			let result: { success?: boolean; error?: string };
			try {
				result = await response.json() as { success?: boolean; error?: string };
			} catch {
				throw new Error('The inquiry endpoint returned an invalid response.');
			}
			if (!response.ok || result.success !== true) {
				throw new Error(result.error || `Contact request failed with status ${response.status}.`);
			}

			form.reset();
			status.textContent = 'Thank you. Your message has been sent to our team.';
			status.classList.add('is-success');
		} catch (error) {
			console.error('Unable to submit the general contact inquiry.', error);
			status.textContent = 'We couldn’t send your message. Please try again.';
		} finally {
			submitting = false;
			button.disabled = false;
			button.removeAttribute('aria-busy');
			buttonLabel.textContent = 'Send Message';
		}
	});

	form.addEventListener('input', () => {
		if (status.textContent) {
			status.textContent = '';
			status.classList.remove('is-success');
		}
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeContactPage, { once: true });
} else {
	initializeContactPage();
}
