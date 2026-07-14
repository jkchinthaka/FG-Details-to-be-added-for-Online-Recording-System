"use client";

import { useState } from "react";
import { Input } from "./Input";

export type QuickChoiceFieldProps = {
  label: string;
  value: string;
  /** Preset pills in display order; a trailing "Other" reveals a free-text field. */
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

/**
 * Quick-select pill row for categorized failure detail (issue reason,
 * immediate correction) with an "Other" fallback that reveals a free-text
 * field. Fully controlled — `value` is either an exact preset label or a
 * custom typed string; the only local state is which UI mode ("Other" free
 * text vs. pills) is currently showing.
 */
export function QuickChoiceField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  error,
}: QuickChoiceFieldProps) {
  const presetOptions = options.filter((option) => option !== "Other");
  const hasOtherOption = options.length !== presetOptions.length;
  const isKnownPreset = presetOptions.includes(value);
  const [customMode, setCustomMode] = useState(value.length > 0 && !isKnownPreset);

  function selectPreset(option: string) {
    setCustomMode(false);
    onChange(option);
  }

  function selectOther() {
    setCustomMode(true);
    if (isKnownPreset) onChange("");
  }

  return (
    <div className="nelna-field">
      <span className="nelna-field-label">{label}</span>
      <div
        role="group"
        aria-label={label}
        style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}
      >
        {presetOptions.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={!customMode && value === option}
            onClick={() => selectPreset(option)}
            className={[
              "nelna-segmented-option",
              "nelna-focusable",
              !customMode && value === option
                ? "nelna-tone-success"
                : "nelna-tone-neutral",
            ].join(" ")}
            style={{
              minHeight: "2.25rem",
              padding: "0.4rem 0.75rem",
              fontSize: "0.85rem",
            }}
          >
            {option}
          </button>
        ))}
        {hasOtherOption ? (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={customMode}
            onClick={selectOther}
            className={[
              "nelna-segmented-option",
              "nelna-focusable",
              customMode ? "nelna-tone-success" : "nelna-tone-neutral",
            ].join(" ")}
            style={{
              minHeight: "2.25rem",
              padding: "0.4rem 0.75rem",
              fontSize: "0.85rem",
            }}
          >
            Other
          </button>
        ) : null}
      </div>

      {customMode ? (
        <Input
          label={`${label} — other`}
          hideLabel
          value={isKnownPreset ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe…"
          disabled={disabled}
          maxLength={200}
        />
      ) : null}

      {error ? (
        <p role="alert" className="nelna-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
