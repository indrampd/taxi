import Transition from "./Transition";

/**
 * Transition subclass leveraging the native browser View Transitions API (document.startViewTransition).
 */
export default class ViewTransition extends Transition {
	/**
	 * Identifier flag for Core to recognize native View Transition delegation.
	 * @type {boolean}
	 */
	isViewTransition = true;

	/**
	 * Optional transition types (supported in Chrome 125+ for @view-transition rules).
	 * @type {string[]}
	 */
	types = [];

	/**
	 * Hook called before the view transition begins.
	 *
	 * @param {{ from: HTMLElement|Element, trigger: string|HTMLElement|false }} props
	 */
	beforeTransition(props) {}

	/**
	 * Hook called after the native view transition animation has completed.
	 *
	 * @param {{ to: HTMLElement|Element, trigger: string|HTMLElement|false, transition?: any }} props
	 */
	afterTransition(props) {}

	/**
	 * Fallback leave handler when startViewTransition is not supported.
	 *
	 * @param {{ from: HTMLElement|Element, trigger: string|HTMLElement|false, done: function }} props
	 */
	onLeave({ from, trigger, done }) {
		done();
	}

	/**
	 * Fallback enter handler when startViewTransition is not supported.
	 *
	 * @param {{ to: HTMLElement|Element, trigger: string|HTMLElement|false, done: function }} props
	 */
	onEnter({ to, trigger, done }) {
		done();
	}
}
