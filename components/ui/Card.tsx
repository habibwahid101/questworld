import { classNames } from "@/utils/format";
import styles from "./Card.module.css";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  quiet?: boolean;
};

export function Card({ children, className, padded = true, quiet = false }: CardProps) {
  return (
    <div className={classNames(styles.card, padded && styles.padded, quiet && styles.quiet, className)}>
      {children}
    </div>
  );
}
