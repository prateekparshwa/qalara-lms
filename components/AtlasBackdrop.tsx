/**
 * Shared Atlas backdrop for the lobby and the segment chooser: the warm
 * map-grid (.atlas-bg) plus a slow radar sweep and pulsing accent pins.
 * Purely decorative; hidden on small screens and respects reduced motion
 * (the pin/sweep animations are disabled via CSS).
 */

// Decorative map pins (right side); colors cycle the 5-accent system, delays
// stagger the pulse.
const PINS = [
  { top: "14%", left: "80%", color: "#4F46E5", d: "0s" },
  { top: "30%", left: "92%", color: "#0D9488", d: "0.6s" },
  { top: "52%", left: "74%", color: "#F59E0B", d: "1.1s" },
  { top: "64%", left: "88%", color: "#E11D48", d: "1.6s" },
  { top: "40%", left: "63%", color: "#7C3AED", d: "0.9s" },
];

export default function AtlasBackdrop() {
  return (
    <>
      <div className="atlas-bg" aria-hidden="true" />
      <div
        className="absolute inset-0 z-[1] pointer-events-none hidden sm:block"
        aria-hidden="true"
      >
        <div
          className="atlas-sweep"
          style={{ top: "-70px", right: "-90px", width: "300px", height: "300px" }}
        />
        {PINS.map((p, i) => (
          <span
            key={i}
            className="atlas-pin"
            style={{
              top: p.top,
              left: p.left,
              background: p.color,
              ["--d" as string]: p.d,
            }}
          />
        ))}
      </div>
    </>
  );
}
