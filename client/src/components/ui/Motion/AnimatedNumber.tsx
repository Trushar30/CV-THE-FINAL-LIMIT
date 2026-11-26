import { useEffect, useState, useRef, type ReactElement } from 'react';
import { animate, useReducedMotion } from 'motion/react';

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 0.4,
  formatter = (v) => v.toLocaleString(),
  className = '',
}: AnimatedNumberProps): ReactElement {
  const shouldReduce = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    if (shouldReduce) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const start = prevValueRef.current;
    const end = value;

    if (start === end) return;

    const controls = animate(start, end, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setDisplayValue(Math.round(latest));
      },
    });

    prevValueRef.current = value;

    return () => controls.stop();
  }, [value, duration, shouldReduce]);

  return (
    <span
      className={`tabular-nums ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formatter(displayValue)}
    </span>
  );
}

export default AnimatedNumber;
