import { describe, it, expect, vi } from 'vitest';
import Transition from '../src/Transition';

describe('Transition', () => {
	it('stores wrapper in constructor', () => {
		const wrapper = document.createElement('div');
		const transition = new Transition({ wrapper });
		expect(transition.wrapper).toBe(wrapper);
	});

	it('resolves default onLeave immediately', async () => {
		const wrapper = document.createElement('div');
		const from = document.createElement('div');
		const transition = new Transition({ wrapper });

		const leavePromise = transition.leave({ from, trigger: false });
		await expect(leavePromise).resolves.toBeUndefined();
	});

	it('resolves default onEnter immediately', async () => {
		const wrapper = document.createElement('div');
		const to = document.createElement('div');
		const transition = new Transition({ wrapper });

		const enterPromise = transition.enter({ to, trigger: false });
		await expect(enterPromise).resolves.toBeUndefined();
	});

	it('allows custom subclasses to perform async transitions', async () => {
		const wrapper = document.createElement('div');
		const from = document.createElement('div');
		const to = document.createElement('div');

		const leaveSpy = vi.fn();
		const enterSpy = vi.fn();

		class CustomTransition extends Transition {
			onLeave({ from, trigger, done }) {
				setTimeout(() => {
					leaveSpy();
					done();
				}, 10);
			}

			onEnter({ to, trigger, done }) {
				setTimeout(() => {
					enterSpy();
					done();
				}, 10);
			}
		}

		const custom = new CustomTransition({ wrapper });

		await custom.leave({ from, trigger: 'click' });
		expect(leaveSpy).toHaveBeenCalledTimes(1);

		await custom.enter({ to, trigger: 'click' });
		expect(enterSpy).toHaveBeenCalledTimes(1);
	});
});
