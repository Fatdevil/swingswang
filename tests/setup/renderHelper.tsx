/**
 * renderHelper.tsx
 * 
 * Minimal component render helper using React's internal createRoot.
 * Renders React elements to a virtual tree and extracts all text content.
 */

import React, { type ReactElement } from 'react';

/**
 * Recursively extract all text from a React element tree,
 * including resolving function components.
 */
function extractText(node: any): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  // If it's a React element
  if (node && typeof node === 'object' && node.$$typeof) {
    const { type, props } = node;

    // Function component — call it to get rendered output
    if (typeof type === 'function') {
      try {
        // Use React's internal rendering to handle hooks
        const rendered = renderFunctionComponent(type, props);
        return extractText(rendered);
      } catch {
        // Fallback: just extract children
        return props?.children ? extractText(props.children) : '';
      }
    }

    // String element (View, Text, etc.) — extract children
    if (props?.children) {
      return extractText(props.children);
    }
    return '';
  }

  return '';
}

/**
 * Simple function component renderer that supports hooks.
 * Uses a minimal hooks emulation for useState and useEffect.
 */
function renderFunctionComponent(Component: Function, props: any): any {
  // Store hooks state for this render
  const hookState: any[] = [];
  let hookIndex = 0;

  // Patch React's internal hooks for this render
  const originalUseState = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher?.current?.useState;
  
  // Simple hook emulation
  const mockDispatcher = {
    useState: (initialValue: any) => {
      const idx = hookIndex++;
      if (hookState[idx] === undefined) {
        hookState[idx] = typeof initialValue === 'function' ? initialValue() : initialValue;
      }
      return [hookState[idx], (v: any) => { hookState[idx] = typeof v === 'function' ? v(hookState[idx]) : v; }];
    },
    useReducer: (reducer: any, initialState: any) => {
      const idx = hookIndex++;
      if (hookState[idx] === undefined) {
        hookState[idx] = initialState;
      }
      return [hookState[idx], (action: any) => { hookState[idx] = reducer(hookState[idx], action); }];
    },
    useEffect: () => {},
    useLayoutEffect: () => {},
    useCallback: (cb: any) => cb,
    useMemo: (fn: any) => fn(),
    useRef: (val: any) => ({ current: val }),
    useContext: () => ({}),
  };

  // Set the mock dispatcher
  const internals = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const prevDispatcher = internals?.ReactCurrentDispatcher?.current;
  
  if (internals?.ReactCurrentDispatcher) {
    internals.ReactCurrentDispatcher.current = mockDispatcher;
  }

  let result;
  try {
    result = Component(props);
  } finally {
    if (internals?.ReactCurrentDispatcher && prevDispatcher) {
      internals.ReactCurrentDispatcher.current = prevDispatcher;
    }
  }

  return result;
}

export function render(element: ReactElement): { textContent: string } {
  return {
    textContent: extractText(element),
  };
}
