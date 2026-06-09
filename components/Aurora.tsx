/**
 * Animated aurora backdrop — five soft, blurred accent-colour blobs that drift
 * slowly. Lives in a fixed-height band at the top of its (relative) parent, so
 * the parent does NOT need `overflow-hidden` and sticky children keep working.
 * Pair with a sibling content wrapper that has `relative z-10`.
 */
export default function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="b1" />
      <span className="b2" />
      <span className="b3" />
      <span className="b4" />
      <span className="b5" />
    </div>
  );
}
