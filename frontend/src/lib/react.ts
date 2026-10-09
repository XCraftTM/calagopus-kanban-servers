import { Children, isValidElement, ReactNode } from 'react';

// Whether `type` is rendered anywhere in a (not yet rendered) element tree. Themes such as qunix move
// parts of the stock page around before our interceptor sees it, so the board checks what is left.
export function containsElementOfType(node: ReactNode, type: unknown): boolean {
  let found = false;

  Children.forEach(node, (child) => {
    if (found || !isValidElement(child)) return;

    const childType = child.type as unknown;
    if (
      childType === type ||
      (typeof childType === 'object' && childType !== null && 'type' in childType && childType.type === type)
    ) {
      found = true;
      return;
    }

    const children = (child.props as { children?: unknown }).children;
    if (children && typeof children !== 'function') found = containsElementOfType(children as ReactNode, type);
  });

  return found;
}
