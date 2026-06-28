// fontkit ships no usable type declarations for our import path. We only use
// fontkit.openSync(path).familyName / .fonts[].familyName, accessed via a cast.
declare module 'fontkit';
