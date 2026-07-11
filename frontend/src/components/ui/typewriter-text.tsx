import { useEffect, useRef, useState } from 'react';

/**
 * Reveals `text` character-by-character whenever it changes to a new value —
 * used so an AI-generated meeting title "types out" in real time when processing
 * finishes, instead of snapping in. The very first value can render instantly
 * (`animateInitial={false}`) so already-titled meetings don't animate on load.
 */
export function TypewriterText({
  text,
  className,
  speedMs = 28,
  animateInitial = false,
}: {
  text: string;
  className?: string;
  speedMs?: number;
  animateInitial?: boolean;
}) {
  const [displayed, setDisplayed] = useState(animateInitial ? '' : text);
  const prevText = useRef(animateInitial ? '' : text);

  useEffect(() => {
    if (text === prevText.current) return;
    prevText.current = text;

    let i = 0;
    setDisplayed('');
    const id = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speedMs);

    return () => clearInterval(id);
  }, [text, speedMs]);

  return <span className={className}>{displayed}</span>;
}
