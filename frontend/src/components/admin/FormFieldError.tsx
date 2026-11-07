import styles from "./FormFieldError.module.css";

type FormFieldErrorProps = {
  id: string;
  message?: string;
};

export default function FormFieldError({
  id,
  message,
}: FormFieldErrorProps) {
  if (!message) return null;

  return (
    <small
      id={id}
      role="alert"
      className={styles.error}
    >
      {message}
    </small>
  );
}
