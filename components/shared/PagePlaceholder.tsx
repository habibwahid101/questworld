import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type PagePlaceholderProps = {
  title: string;
  description: string;
  note?: string;
};

export function PagePlaceholder({ title, description, note }: PagePlaceholderProps) {
  return (
    <Card>
      <div className="stack">
        <Badge tone="info">Foundation placeholder</Badge>
        <div>
          <h1>{title}</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            {description}
          </p>
        </div>
        <p>
          {note ??
            "This screen is structurally ready. Authentication, ledger processing, and AWS services are intentionally not connected in Step 01."}
        </p>
      </div>
    </Card>
  );
}
