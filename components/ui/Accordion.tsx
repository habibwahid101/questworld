"use client";

import { useId, useState } from "react";
import type { FaqItem } from "@/types";
import styles from "./Accordion.module.css";

export function Accordion({ items }: { items: readonly FaqItem[] }) {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(items[0]?.question ?? null);

  return (
    <div className="stack">
      {items.map((item, index) => {
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;
        const open = openId === item.question;

        return (
          <div className={styles.item} key={item.question}>
            <h3>
              <button
                id={buttonId}
                className={styles.trigger}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : item.question)}
              >
                <span>{item.question}</span>
                <span className={styles.icon} aria-hidden="true">
                  {open ? "–" : "+"}
                </span>
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open}>
              {open ? <p className={styles.panel}>{item.answer}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
