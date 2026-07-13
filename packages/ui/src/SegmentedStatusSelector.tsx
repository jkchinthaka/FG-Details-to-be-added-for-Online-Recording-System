export type SegmentedStatusTone = "neutral" | "success" | "warning" | "danger";

export type SegmentedStatusOption<T extends string> = {
  value: T;
  label: string;
  tone?: SegmentedStatusTone;
};

export type SegmentedStatusSelectorProps<T extends string> = {
  label: string;
  value: T | null;
  options: Array<SegmentedStatusOption<T>>;
  onChange: (value: T) => void;
  name?: string;
  disabled?: boolean;
  error?: string;
};

/**
 * Large-target segmented control for exception-first record statuses
 * (e.g. Acceptable / Fail). Prefer this over checkboxes or a native select
 * for the primary result of a checklist item.
 */
export function SegmentedStatusSelector<T extends string>({
  label,
  value,
  options,
  onChange,
  name,
  disabled = false,
  error,
}: SegmentedStatusSelectorProps<T>) {
  return (
    <div className="nelna-field">
      <span className="nelna-field-label">{label}</span>
      <div role="group" aria-label={label} className="nelna-segmented">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            name={name}
            disabled={disabled}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={[
              "nelna-segmented-option",
              "nelna-focusable",
              `nelna-tone-${option.tone ?? "neutral"}`,
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="nelna-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
