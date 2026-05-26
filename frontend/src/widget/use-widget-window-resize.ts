import type { PointerEvent as ReactPointerEvent } from 'react';

export type WidgetResizeEdge = 'corner' | 'right' | 'bottom';

export function useWidgetWindowResize(edge: WidgetResizeEdge) {
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const widgetApi = globalThis.window.desktop?.widget;
    if (!widgetApi?.resizeStart) return;

    void widgetApi.resizeStart(edge);

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      void widgetApi.resizeMove();
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      void widgetApi.resizeEnd();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return { onPointerDown };
}
