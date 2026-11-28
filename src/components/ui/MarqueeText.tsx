'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface MarqueeMember {
  textWidth: number;
  distance: number; // 0 jika tidak overflow
  speedPxPerSec: number;
  applyFrame: (offsetPx: number, fadeLeft: boolean) => void;
}

interface MarqueeSyncContextValue {
  register: (id: string, member: MarqueeMember) => void;
  unregister: (id: string) => void;
  notifyMeasure: () => void;
}

const MarqueeSyncContext = createContext<MarqueeSyncContextValue | null>(null);

const MASK_RIGHT_ONLY =
  'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)';
const MASK_BOTH_EDGES =
  'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 7%, rgba(0,0,0,1) 90%, rgba(0,0,0,0) 100%)';

function applyEdgeMask(el: HTMLElement | null, overflows: boolean, fadeLeft: boolean) {
  if (!el) return;
  if (!overflows) {
    el.style.removeProperty('mask-image');
    el.style.removeProperty('-webkit-mask-image');
    return;
  }
  const mask = fadeLeft ? MASK_BOTH_EDGES : MASK_RIGHT_ONLY;
  el.style.setProperty('mask-image', mask);
  el.style.setProperty('-webkit-mask-image', mask);
}

interface MarqueeSyncGroupProps {
  /** Ganti key (mis. saat lagu berubah) untuk mereset jeda & gerak serempak dari awal */
  resetKey?: string | number;
  /** Lama jeda diam di posisi awal sebelum mulai bergeser bareng (ms) */
  pauseMs?: number;
  children: React.ReactNode;
}

type MarqueeMemberMap = Map<string, MarqueeMember>;

export function MarqueeSyncGroup({
  resetKey,
  pauseMs = 2400,
  children,
}: MarqueeSyncGroupProps) {
  const membersRef = useRef<MarqueeMemberMap>(new Map());
  const cycleStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const pauseMsRef = useRef(pauseMs);
  pauseMsRef.current = pauseMs;

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const resetAllToOrigin = useCallback(() => {
    membersRef.current.forEach((m) => {
      m.applyFrame(0, false);
    });
  }, []);

  const startOrSyncLoop = useCallback(
    (resetCycle: boolean) => {
      if (typeof window === 'undefined') return;

      const reducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

      let maxScrollMs = 0;
      membersRef.current.forEach((m) => {
        if (m.distance > 0 && m.speedPxPerSec > 0) {
          const dur = (m.distance / m.speedPxPerSec) * 1000;
          if (dur > maxScrollMs) maxScrollMs = dur;
        }
      });

      if (reducedMotion || maxScrollMs <= 0) {
        stopLoop();
        resetAllToOrigin();
        return;
      }

      if (resetCycle || cycleStartRef.current === 0) {
        cycleStartRef.current = performance.now();
        resetAllToOrigin();
      }

      if (rafRef.current !== null) return;

      const tick = (now: number) => {
        if (document.hidden) {
          cycleStartRef.current = now;
          resetAllToOrigin();
          rafRef.current = window.requestAnimationFrame(tick);
          return;
        }

        let currentMaxScrollMs = 0;
        membersRef.current.forEach((m) => {
          if (m.distance > 0 && m.speedPxPerSec > 0) {
            const dur = (m.distance / m.speedPxPerSec) * 1000;
            if (dur > currentMaxScrollMs) currentMaxScrollMs = dur;
          }
        });

        if (currentMaxScrollMs <= 0) {
          rafRef.current = null;
          resetAllToOrigin();
          return;
        }

        const currentPauseMs = Math.max(400, pauseMsRef.current);
        const totalCycleMs = currentPauseMs + currentMaxScrollMs;
        const elapsed = Math.max(0, now - cycleStartRef.current);
        const cyclePos = elapsed % totalCycleMs;

        if (cyclePos < currentPauseMs) {
          // Fase jeda diam bersama di titik awal
          membersRef.current.forEach((m) => {
            m.applyFrame(0, false);
          });
        } else {
          // Fase meluncur serempak; baris pendek parkir dulu di 0 sambil menunggu baris panjang
          const scrollSec = (cyclePos - currentPauseMs) / 1000;
          membersRef.current.forEach((m) => {
            if (m.distance <= 0) {
              m.applyFrame(0, false);
              return;
            }
            const rawOffset = scrollSec * m.speedPxPerSec;
            if (rawOffset >= m.distance) {
              m.applyFrame(0, false);
            } else {
              const fadeLeft = rawOffset > 2 && rawOffset < m.textWidth;
              m.applyFrame(rawOffset, fadeLeft);
            }
          });
        }

        rafRef.current = window.requestAnimationFrame(tick);
      };

      rafRef.current = window.requestAnimationFrame(tick);
    },
    [resetAllToOrigin, stopLoop]
  );

  const register = useCallback(
    (id: string, member: MarqueeMember) => {
      membersRef.current.set(id, member);
    },
    []
  );

  const unregister = useCallback(
    (id: string) => {
      membersRef.current.delete(id);
      if (membersRef.current.size === 0) {
        stopLoop();
      }
    },
    [stopLoop]
  );

  const notifyMeasure = useCallback(() => {
    startOrSyncLoop(true);
  }, [startOrSyncLoop]);

  useEffect(() => {
    startOrSyncLoop(true);
  }, [resetKey, pauseMs, startOrSyncLoop]);

  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  const ctxValue = useMemo<MarqueeSyncContextValue>(
    () => ({ register, unregister, notifyMeasure }),
    [register, unregister, notifyMeasure]
  );

  return (
    <MarqueeSyncContext.Provider value={ctxValue}>
      {children}
    </MarqueeSyncContext.Provider>
  );
}

interface MarqueeTextProps {
  children: React.ReactNode;
  className?: string;
  measureKey?: string | number;
  speedPxPerSec?: number;
  gapPx?: number;
  pauseMs?: number;
}

export default function MarqueeText({
  children,
  className = '',
  measureKey,
  speedPxPerSec = 28,
  gapPx = 44,
  pauseMs = 2400,
}: MarqueeTextProps) {
  const syncGroup = useContext(MarqueeSyncContext);
  const memberId = useId();

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const [overflows, setOverflows] = useState(false);
  const overflowsRef = useRef(false);
  const lastFadeLeftRef = useRef<boolean | null>(null);
  const metricsRef = useRef({ textWidth: 0, distance: 0 });
  const standaloneRafRef = useRef<number | null>(null);

  const applyFrame = useCallback((offsetPx: number, fadeLeft: boolean) => {
    const track = trackRef.current;
    if (track) {
      track.style.transform =
        offsetPx > 0 ? `translate3d(${-offsetPx}px, 0, 0)` : 'translate3d(0, 0, 0)';
    }

    if (lastFadeLeftRef.current !== fadeLeft) {
      lastFadeLeftRef.current = fadeLeft;
      applyEdgeMask(containerRef.current, overflowsRef.current, fadeLeft);
    }
  }, []);

  const stopStandalone = useCallback(() => {
    if (standaloneRafRef.current !== null) {
      window.cancelAnimationFrame(standaloneRafRef.current);
      standaloneRafRef.current = null;
    }
  }, []);

  const startStandalone = useCallback(
    (textWidth: number, distance: number) => {
      stopStandalone();
      if (typeof window === 'undefined' || distance <= 0) {
        applyFrame(0, false);
        return;
      }

      const reducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      if (reducedMotion) {
        applyFrame(0, false);
        return;
      }

      const startAt = performance.now();
      const scrollMs = (distance / speedPxPerSec) * 1000;
      const totalCycleMs = Math.max(400, pauseMs) + scrollMs;

      const tick = (now: number) => {
        if (document.hidden) {
          applyFrame(0, false);
          standaloneRafRef.current = window.requestAnimationFrame(tick);
          return;
        }

        const cyclePos = Math.max(0, now - startAt) % totalCycleMs;
        if (cyclePos < pauseMs) {
          applyFrame(0, false);
        } else {
          const offset = ((cyclePos - pauseMs) / 1000) * speedPxPerSec;
          if (offset >= distance) {
            applyFrame(0, false);
          } else {
            applyFrame(offset, offset > 2 && offset < textWidth);
          }
        }
        standaloneRafRef.current = window.requestAnimationFrame(tick);
      };

      standaloneRafRef.current = window.requestAnimationFrame(tick);
    },
    [applyFrame, pauseMs, speedPxPerSec, stopStandalone]
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const containerWidth = container.clientWidth;
    const textWidth = Math.ceil(textEl.getBoundingClientRect().width);
    const nextOverflows = containerWidth > 0 && textWidth > containerWidth + 2;
    const nextDistance = nextOverflows ? textWidth + gapPx : 0;

    overflowsRef.current = nextOverflows;
    metricsRef.current = { textWidth, distance: nextDistance };
    setOverflows(nextOverflows);

    lastFadeLeftRef.current = null;
    applyEdgeMask(container, nextOverflows, false);
    applyFrame(0, false);

    if (syncGroup) {
      syncGroup.register(memberId, {
        textWidth,
        distance: nextDistance,
        speedPxPerSec,
        applyFrame,
      });
      syncGroup.notifyMeasure();
    } else {
      startStandalone(textWidth, nextDistance);
    }
  }, [applyFrame, gapPx, memberId, speedPxPerSec, startStandalone, syncGroup]);

  useLayoutEffect(() => {
    measure();
  }, [measure, measureKey, children]);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(container);
    ro.observe(textEl);

    let active = true;
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        if (active) measure();
      });
    }

    return () => {
      active = false;
      ro.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    return () => {
      stopStandalone();
      if (syncGroup) {
        syncGroup.unregister(memberId);
      }
    };
  }, [memberId, stopStandalone, syncGroup]);

  return (
    <div
      ref={containerRef}
      className={`relative block w-full overflow-hidden whitespace-nowrap ${className}`}
    >
      <div
        ref={trackRef}
        className="inline-flex items-center whitespace-nowrap will-change-transform"
      >
        <span ref={textRef} className="inline-block whitespace-nowrap">
          {children}
        </span>
        {overflows && (
          <span
            aria-hidden="true"
            className="inline-block whitespace-nowrap"
            style={{ paddingLeft: `${gapPx}px` }}
          >
            {children}
          </span>
        )}
      </div>
    </div>
  );
}