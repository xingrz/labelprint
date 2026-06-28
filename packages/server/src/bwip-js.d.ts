// bwip-js v4 does not ship type declarations for its root import path.
// We use it dynamically and defensively (see render/assets.ts), so an ambient
// `any` module is sufficient.
declare module 'bwip-js';
