"use client";

import styles from "./ProfilePhoto.module.css";

export function ProfilePhoto({
  name,
  src,
  editable = false,
  uploading = false,
  onSelect,
  children,
}: {
  name: string;
  src: string | null;
  editable?: boolean;
  uploading?: boolean;
  onSelect?: (file: File) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.identity}>
      <div className={styles.column}>
        {editable ? (
          <label className={styles.photoButton}>
            {photoNode(name, src)}
            <span className={styles.camera} aria-hidden="true">
              <CameraIcon />
            </span>
            <span className="sr-only">{uploading ? "Uploading…" : "Upload photo"}</span>
            <input
              className={styles.file}
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
        ) : (
          photoNode(name, src)
        )}
      </div>
      {children ? <div className={styles.details}>{children}</div> : null}
    </div>
  );
}

function photoNode(name: string, src: string | null) {
  return src ? (
    // Member photos are private blob or data URLs, so they are not passed through the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.photo} src={src} alt={`${name} profile photo`} />
  ) : (
    <span className={styles.photo} aria-hidden="true" />
  );
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        d="M8 7l1.2-2h5.6L16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3z"
      />
      <circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
