import { BrandMark } from "@/components/ui/BrandMark";
import { Card } from "@/components/ui/Card";
import styles from "./AuthFrame.module.css";

export function AuthFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.intro}>
          <BrandMark />
        </div>
        <Card>
          <div className="stack">
            <div>
              <h1>{title}</h1>
              <p style={{ marginTop: 8 }}>{description}</p>
            </div>
            {children}
          </div>
        </Card>
      </div>
    </div>
  );
}
