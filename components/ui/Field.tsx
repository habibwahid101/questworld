import styles from "./Field.module.css";

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
};

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="form-error" role="alert" id={`${htmlFor}-error`}>
          {error}
        </p>
      ) : null}
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={[styles.control, className].filter(Boolean).join(" ")} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={[styles.control, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </select>
  );
}
