import { cx } from "./cx";

export function Hairline({ className }: { className?: string }) {
  return <hr className={cx("border-line", className)} />;
}
