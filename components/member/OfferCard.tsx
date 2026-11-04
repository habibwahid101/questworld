"use client";

import styles from "./OfferCard.module.css";

export function OfferCard(props: {
  title: string;
  subtitle: string;
  imageSrc: string | null;
}) {
  return (
    <section className={styles.card} aria-label="Offer">
      {props.imageSrc ? <img className={styles.image} src={props.imageSrc} alt="" /> : null}
      <div className={styles.copy}>
        <h2 className={styles.title}>{props.title}</h2>
        <p className={styles.subtitle}>{props.subtitle}</p>
      </div>
    </section>
  );
}
