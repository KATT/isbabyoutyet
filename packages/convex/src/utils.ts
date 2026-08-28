export function lazyGetter<T extends object>(fn: () => T): T;
export function lazyGetter(fn: () => object) {
  let value: object | undefined;
  return new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        if (!value) {
          value = fn();
        }
        return Reflect.get(value, prop);
      },
    },
  );
}
