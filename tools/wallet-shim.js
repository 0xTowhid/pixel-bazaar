import { Buffer } from 'buffer';
export { Buffer };
export const process = { env: {}, browser: true, version: '', nextTick: (f, ...a) => Promise.resolve().then(() => f(...a)) };
