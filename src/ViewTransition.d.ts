import Transition from "./Transition";

export default class ViewTransition extends Transition {
    isViewTransition: boolean;
    types: string[];
    beforeTransition(props: {
        from?: HTMLElement | Element;
        trigger?: string | HTMLElement | false;
    }): void;
    afterTransition(props: {
        to?: HTMLElement | Element;
        trigger?: string | HTMLElement | false;
        transition?: any;
    }): void;
    onLeave(props: {
        from?: HTMLElement | Element;
        trigger?: string | HTMLElement | false;
        done: () => void;
    }): void;
    onEnter(props: {
        to?: HTMLElement | Element;
        trigger?: string | HTMLElement | false;
        done: () => void;
    }): void;
}
