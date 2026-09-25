import type { StatusTone } from "@/types";
import { classNames } from "@/utils/format";
import styles from "./Badge.module.css";

type BadgeProps = {
  children: React.ReactNode;
  tone?: StatusTone;
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={classNames(styles.badge, styles[tone])}>{children}</span>;
}
