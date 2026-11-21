// 离线算数值用的 Phaser 占位：任何属性 / 调用 / new 都返回自己
const h = { get: (t, k) => k === '__esModule' ? false : k === 'default' ? P : k === Symbol.toPrimitive ? () => 0 : P, apply: () => P, construct: () => P };
const P = new Proxy(function () {}, h); module.exports = P;
