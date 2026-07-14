export function RecordHeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ margin: 0, color: "var(--nelna-text-muted)", fontSize: "0.75rem" }}>
        {label}
      </dt>
      <dd style={{ margin: "0.15rem 0 0", fontWeight: 600, color: "var(--nelna-text)" }}>
        {value}
      </dd>
    </div>
  );
}
