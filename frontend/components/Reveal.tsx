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
      // threshold requires that fraction of the *whole element* to be
      // visible -- fine for a short card, but a tall stack (e.g. Standings'
      // 11 conference tables on a narrow single-column layout) can be many
      // viewports tall, so 15% of it never appears near the top of the
      // page. threshold: 0 fires as soon as a single pixel is visible;
      // rootMargin still delays that until the element is within 60px of
      // the viewport, so this isn't just "reveal everything instantly".
      { threshold: 0, rootMargin: "0px 0px -60px 0px" }
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
