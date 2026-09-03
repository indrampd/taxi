import { describe, it, expect, vi, beforeEach } from 'vitest';
import Renderer from '../src/Renderer';
import Transition from '../src/Transition';

describe('Renderer', () => {
	let wrapper;
	let content;
	let page;

	beforeEach(() => {
		wrapper = document.createElement('div');
		wrapper.setAttribute('data-taxi', '');
		content = document.createElement('main');
		content.setAttribute('data-taxi-view', '');
		content.innerHTML = '<h1>Old Page</h1>';
		wrapper.appendChild(content);
		document.body.innerHTML = '';
		document.body.appendChild(wrapper);

		page = document.implementation.createHTMLDocument('New Page Title');
	});

	it('initializes and selects existing content', () => {
		const renderer = new Renderer({
			content,
			page,
			title: 'Initial Title',
			wrapper,
		});

		expect(renderer.title).toBe('Initial Title');
		expect(renderer.wrapper).toBe(wrapper);
		expect(renderer.content).toBe(content);
	});

	it('triggers lifecycle on initialLoad', () => {
		const enterSpy = vi.fn();
		const enterCompletedSpy = vi.fn();

		class TestRenderer extends Renderer {
			onEnter() {
				enterSpy();
			}
			onEnterCompleted() {
				enterCompletedSpy();
			}
		}

		const renderer = new TestRenderer({
			content,
			page,
			title: 'Page Title',
			wrapper,
		});

		renderer.initialLoad();
		expect(enterSpy).toHaveBeenCalledTimes(1);
		expect(enterCompletedSpy).toHaveBeenCalledTimes(1);
	});

	it('creates DOM and updates content and document.title on update()', () => {
		const newContent = document.createElement('main');
		newContent.setAttribute('data-taxi-view', '');
		newContent.innerHTML = '<h1>New Content</h1>';

		const renderer = new Renderer({
			content: newContent,
			page,
			title: 'Updated Page Title',
			wrapper,
		});

		renderer.createDom();
		renderer.update();

		expect(document.title).toBe('Updated Page Title');
		expect(renderer.content.querySelector('h1')?.textContent).toBe('New Content');
	});

	it('removes content when remove() is called', () => {
		const renderer = new Renderer({
			content,
			page,
			title: 'Page Title',
			wrapper,
		});

		expect(wrapper.contains(content)).toBe(true);
		renderer.remove();
		expect(wrapper.contains(content)).toBe(false);
	});

	it('calls leave and optionally removes old content', async () => {
		const transition = new Transition({ wrapper });
		const onLeaveSpy = vi.fn();
		const onLeaveCompletedSpy = vi.fn();

		class TestRenderer extends Renderer {
			onLeave() {
				onLeaveSpy();
			}
			onLeaveCompleted() {
				onLeaveCompletedSpy();
			}
		}

		const renderer = new TestRenderer({
			content,
			page,
			title: 'Page Title',
			wrapper,
		});

		await renderer.leave(transition, false, true);

		expect(onLeaveSpy).toHaveBeenCalledTimes(1);
		expect(onLeaveCompletedSpy).toHaveBeenCalledTimes(1);
		expect(wrapper.contains(content)).toBe(false);
	});
});
