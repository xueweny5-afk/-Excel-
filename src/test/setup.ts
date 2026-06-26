import '@testing-library/jest-dom/vitest';

// jsdom 不实现 matchMedia 与 URL.createObjectURL，部分组件可能依赖
if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (!('createObjectURL' in URL)) {
  // @ts-expect-error 测试环境下 polyfill
  URL.createObjectURL = () => 'blob:mock';
  // @ts-expect-error 测试环境下 polyfill
  URL.revokeObjectURL = () => undefined;
}
