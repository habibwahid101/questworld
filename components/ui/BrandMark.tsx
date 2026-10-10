import Image from "next/image";
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
      <Image className={styles.logo} src="/brand/logo.png" alt={brand.name} width={1000} height={300} unoptimized />
    </span>
  );

  return <Link href={href}>{content}</Link>;
}
