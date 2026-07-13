export type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  className?: string;
};

/** Shimmering placeholder for content that is still loading. */
export function Skeleton({
  width = "100%",
  height = "1rem",
  rounded = false,
  className,
}: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={["nelna-skeleton", className].filter(Boolean).join(" ")}
      style={{
        display: "block",
        width,
        height,
        borderRadius: rounded ? "999px" : undefined,
      }}
    />
  );
}
