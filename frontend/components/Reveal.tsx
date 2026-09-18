"use client";

import { useEffect, useRef, useState } from "react";

// Fades + slides a section in the first time it scrolls into view, via
// IntersectionObserver rather than the newer CSS scroll-driven-animation
// APIs (animation-timeline: view()) -- those aren't supported in Safari yet,
// and this app's whole design has leaned on broad compatibility over
// bleeding-edge CSS. motion-reduce:transition-none skips the animation
// (snapping straight to visible) for anyone who's asked their OS for
// reduced motion.
export default function Reveal({
  children,
  className = "",
  delayMs = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      // Tag is a dynamic "div" | "section", so TS can't narrow which
      // intrinsic element's ref type applies -- both are plain HTMLElements
      // here (only .current is used, for IntersectionObserver), so this
      // assertion is safe.
      ref={ref as React.Ref<HTMLDivElement>}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
