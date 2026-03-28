// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// react-router v7 requires TextEncoder/TextDecoder which Jest 27's jsdom does not expose.
// Polyfill from Node's built-in `util` module.
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// @rc-component/form (used by antd Form.useWatch) calls `new MessageChannel()` in its
// useNotifyWatch hook. jsdom does not provide MessageChannel; polyfill from worker_threads.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MessageChannel: NodeMessageChannel } = require('worker_threads');
if (typeof (global as any).MessageChannel === 'undefined') {
  (global as any).MessageChannel = NodeMessageChannel;
}

// antd Table uses @rc-component/resize-observer which calls ResizeObserver.
// jsdom does not implement it; stub with a no-op class.
if (typeof (global as any).ResizeObserver === 'undefined') {
  (global as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Polyfill matchMedia — jsdom does not implement it.
// Required by MyRequests.tsx which calls window.matchMedia on initialisation.
// Use a plain function (not jest.fn) so it is never cleared between tests.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
