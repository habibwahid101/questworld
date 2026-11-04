"use client";

import styles from "./OfferCard.module.css";

export function OfferCard(props: {
  title: string;
  subtitle: string;
  imageSrc: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  const when = formatWindow(props.startsAt, props.endsAt);
  return (
    <section className={styles.card} aria-label="Offer">
      {props.imageSrc ? <img className={styles.image} src={props.imageSrc} alt="" /> : null}
      <div className={styles.copy}>
        <h2 className={styles.title}>{props.title}</h2>
        <p className={styles.subtitle}>{props.subtitle}</p>
        {when ? <p className={styles.when}>{when}</p> : null}
      </div>
    </section>
  );
}

function formatWindow(startsAt?: string | null, endsAt?: string | null): string | null {
  const start = formatDate(startsAt);
  const end = formatDate(endsAt);
  if (start && end) {
    return `${start} – ${end}`;
  }
  return start ?? end ?? null;
}

function formatDate(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
