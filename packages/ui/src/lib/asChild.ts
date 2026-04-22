import * as React from "react";

type ResolveAsChildOptions = {
  asChild?: boolean;
  children?: React.ReactNode;
};

export type WithAsChild<TProps> = TProps & {
  asChild?: boolean;
  children?: React.ReactNode;
};

export function resolveAsChild(options: ResolveAsChildOptions) {
  if (!options.asChild || !React.isValidElement(options.children)) {
    return {
      children: options.children,
      render: undefined,
    };
  }

  const child = options.children as React.ReactElement<{ children?: React.ReactNode }>;

  return {
    children: child.props.children,
    render: child,
  };
}

export function getAsChildRender(options: ResolveAsChildOptions) {
  return resolveAsChild(options).render;
}

export function asChildProps(options: ResolveAsChildOptions) {
  return resolveAsChild(options);
}

export function renderAsChild(
  options: ResolveAsChildOptions & { render?: React.ReactElement | undefined },
) {
  return options.render ?? getAsChildRender(options);
}
