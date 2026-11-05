"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { InvestmentClientError, saveProfileOffer } from "@/lib/investments/client";

export default function AdminSettingsPage() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [requirement, setRequirement] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [image, setImage] = useState<{ contentType: string; dataBase64: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setNotice(null);
    setError(null);
    setSaving(true);
    try {
      await saveProfileOffer({
        title,
        subtitle,
        requirement,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        image: image ?? undefined,
      });
      setNotice("Offer saved. It shows on the profile page between the start and end.");
    } catch (caught) {
      setError(caught instanceof InvestmentClientError ? caught.message : "Could not save that offer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="stack">
        <div>
          <h1>Profile Offer</h1>
          <p className="lead">One profile offer. Members see it above their profile between the start and end.</p>
        </div>
        <form className="stack" onSubmit={(event) => void onSubmit(event)}>
          <Field label="Title" htmlFor="offer-title">
            <Input id="offer-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required />
          </Field>
          <Field label="Subtitle" htmlFor="offer-subtitle">
            <Input id="offer-subtitle" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} maxLength={160} required />
          </Field>
          <Field label="Requirement" htmlFor="offer-requirement">
            <Input
              id="offer-requirement"
              value={requirement}
              onChange={(event) => setRequirement(event.target.value)}
              maxLength={160}
              placeholder="2000 USDT investment"
            />
          </Field>
          <Field label="Starts" htmlFor="offer-starts">
            <Input id="offer-starts" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
          </Field>
          <Field label="Ends" htmlFor="offer-ends">
            <Input id="offer-ends" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
          </Field>
          <Field label="Image" htmlFor="offer-image">
            <input
              id="offer-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  setImage(null);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  const result = typeof reader.result === "string" ? reader.result : "";
                  const dataBase64 = result.includes(",") ? result.split(",")[1] ?? "" : result;
                  setImage({ contentType: file.type, dataBase64 });
                };
                reader.readAsDataURL(file);
              }}
            />
          </Field>
          {error ? <p className="notice notice-error">{error}</p> : null}
          {notice ? <p className="notice notice-success">{notice}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save offer"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
