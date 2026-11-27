'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface MarqueeTextProps {
  children: React.ReactNode;
  measureKey: string;
  className?: string;
  gapPx?: number;
  speedPxPerSec?: number;
}

type MarqueeStyle = React.CSSProperties & {
  '--marquee-distance'?: string;
  '--marquee-duration'?: string;
};

export default function MarqueeText({
  children,
  measureKey,
  className = '',
  gapPx = 40,
  speedPxPerSec = 34,
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const [isOverflowing, setIsOverflowing] = useState(false);
  const [distancePx, setDistancePx] = useState(0);
  const [durationSec, setDurationSec] = useState(10);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const availableWidth = Math.max(0, container.clientWidth - 4);
    const textWidth = Math.ceil(textEl.getBoundingClientRect().width);
    const overflows = textWidth > availableWidth + 2;

    setIsOverflowing(overflows);
    if (overflows) {
      const dist = textWidth + gapPx;
      setDistancePx(dist);
      setDurationSec(Math.max(7, Number((dist / speedPxPerSec).toFixed(2))));
    }
  }, [gapPx, speedPxPerSec]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(measure);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(containerRef.current);
      if (textRef.current) {
        ro.observe(textRef.current);
      }
    }

    let cancelled = false;
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready
        .then(() => {
          if (!cancelled) measure();
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [measure, measureKey]);

  const maskStyle: React.CSSProperties | undefined = isOverflowing
    ? {
        maskImage:
          'linear-gradient(to right, transparent 0px, black 4px, black calc(100% - 18px), transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0px, black 4px, black calc(100% - 18px), transparent 100%)',
      }
    : undefined;

  const trackStyle: MarqueeStyle | undefined = isOverflowing
    ? {
        '--marquee-distance': `${distancePx}px`,
        '--marquee-duration': `${durationSec}s`,
      }
    : undefined;

  return (
    <div
      ref={containerRef}
      style={maskStyle}
      className={`relative -ml-1 min-w-0 max-w-full overflow-hidden pl-1 ${className}`}
    >
      <div
        key={isOverflowing ? `mq-${measureKey}` : 'static'}
        style={trackStyle}
        className={`inline-flex items-center whitespace-nowrap ${
          isOverflowing ? 'orihour-marquee-track' : ''
        }`}
      >
        <span ref={textRef} className="inline-block shrink-0 whitespace-nowrap">
          {children}
        </span>
        {isOverflowing && (
          <span
            aria-hidden="true"
            className="inline-block shrink-0 whitespace-nowrap"
            style={{ marginLeft: `${gapPx}px` }}
          >
            {children}
          </span>
        )}
      </div>
    </div>
  );
}