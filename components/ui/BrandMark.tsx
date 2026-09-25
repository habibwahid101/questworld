import Link from "next/link";
import { brand } from "@/constants/site";
import { classNames } from "@/utils/format";
import styles from "./BrandMark.module.css";

type BrandMarkProps = {
  href?: string;
  inverse?: boolean;
};

export function BrandMark({ href = "/", inverse = false }: BrandMarkProps) {
  const content = (
    <span className={classNames(styles.mark, inverse && styles.inverse)}>
      <span className={styles.wordmark}>{brand.name}</span>
    </span>
  );

  return <Link href={href}>{content}</Link>;
}
