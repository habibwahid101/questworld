"use client";

import styles from "./ProfilePhoto.module.css";

export function ProfilePhoto({
  name,
  src,
  editable = false,
  uploading = false,
  onSelect,
}: {
  name: string;
  src: string | null;
  editable?: boolean;
  uploading?: boolean;
  onSelect?: (file: File) => void;
}) {
  return (
    <div className={styles.row}>
      {src ? (
        // Member photos are private blob or data URLs, so they are not passed through the image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.photo} src={src} alt={`${name} profile photo`} />
      ) : (
        <span className={styles.photo} aria-hidden="true" />
      )}
      {editable ? (
        <label className={styles.upload}>
          {uploading ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file && onSelect) {
                onSelect(file);
              }
            }}
          />
        </label>
      ) : null}
    </div>
  );
}
