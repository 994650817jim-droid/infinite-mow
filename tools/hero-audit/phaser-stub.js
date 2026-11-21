// 纯 node 读数据用：Phaser 只在类型 / 函数体里用，给个什么都能点的空壳
const h = { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'prototype' ? {} : P, apply: () => P, construct: () => P };
const P = new Proxy(function () {}, h);
export default P;
