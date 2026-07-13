import { Button } from "./Button";
import type { ButtonProps } from "./Button";

export type NelnaButtonProps = ButtonProps;

/**
 * @deprecated Prefer importing `Button` directly. Kept as a thin alias so
 * existing call sites (e.g. record forms built in Phase 1) keep working.
 */
export function NelnaButton(props: NelnaButtonProps) {
  return <Button {...props} />;
}
