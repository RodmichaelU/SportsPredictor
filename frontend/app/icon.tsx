import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Same mark as components/Logo.tsx (kept separate: this runs through
// satori/ImageResponse at build time, not React in the browser, so the two
// can't share one component -- keep any shape changes in sync by hand).
export default function Icon() {
  return new ImageResponse(
    (
      <svg width={32} height={32} viewBox="0 0 48 48">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <path
          d="M8 8 L40 8 L40 26 C40 36 33 44 24 46 C15 44 8 36 8 26 Z"
          fill="url(#g)"
        />
        <polyline
          points="13,31 20,24 26,28 35,15"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="35" cy="15" r="3.4" fill="white" />
      </svg>
    ),
    { ...size }
  );
}
