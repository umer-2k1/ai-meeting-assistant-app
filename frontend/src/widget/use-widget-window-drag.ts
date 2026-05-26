import type { PointerEvent as ReactPointerEvent } from 'react';

export function useWidgetWindowDrag() {
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.widget-no-drag')) return;

    const widgetApi = globalThis.window.desktop?.widget;
    if (!widgetApi?.dragStart) return;

    event.preventDefault();

    void widgetApi.dragStart();

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      void widgetApi.dragMove();
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      void widgetApi.dragEnd();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return { onPointerDown };
}
