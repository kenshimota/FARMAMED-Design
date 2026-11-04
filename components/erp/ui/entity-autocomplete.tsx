"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AutocompleteField,
  type AutocompleteOption,
} from "@/components/erp/ui/autocomplete-field";

type EntityAutocompleteFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string, option?: AutocompleteOption) => void;
  loadOptions: (query: string) => Promise<AutocompleteOption[]>;
  initialLabel?: string;
  placeholder?: string;
  help?: ReactNode;
  error?: string | null;
  emptyLabel?: string;
  loadingLabel?: string;
  errorLabel?: string;
  createHref?: string;
  createLabel?: string;
  disabled?: boolean;
  required?: boolean;
  minChars?: number;
};

export function EntityAutocompleteField({
  id,
  label,
  value,
  onChange,
  loadOptions,
  initialLabel,
  placeholder,
  help,
  error,
  emptyLabel = "No hay coincidencias.",
  loadingLabel = "Buscando…",
  errorLabel = "No pudimos cargar las opciones.",
  createHref,
  createLabel,
  disabled = false,
  required = false,
  minChars = 0,
}: EntityAutocompleteFieldProps) {
  const initial = initialLabel?.trim() ?? "";
  const [draft, setDraft] = useState(initial);
  const [selected, setSelected] = useState(Boolean(value && initial));
  const selectedLabel = useRef(initial);
  const previousValue = useRef(value);
  const pendingLabel = useRef<string | null>(null);
  const ignoreNextReset = useRef(false);

  useEffect(() => {
    const nextLabel = initialLabel?.trim() ?? "";

    if (value === previousValue.current) {
      if (value && nextLabel && !selectedLabel.current) {
        selectedLabel.current = nextLabel;
        setDraft(nextLabel);
        setSelected(true);
      }
      return;
    }

    previousValue.current = value;

    if (!value) {
      if (ignoreNextReset.current) {
        ignoreNextReset.current = false;
        return;
      }
      selectedLabel.current = "";
      pendingLabel.current = null;
      setDraft("");
      setSelected(false);
      return;
    }

    ignoreNextReset.current = false;

    if (pendingLabel.current) {
      const label = pendingLabel.current;
      pendingLabel.current = null;
      selectedLabel.current = label;
      setDraft(label);
      setSelected(true);
      return;
    }

    if (nextLabel) {
      selectedLabel.current = nextLabel;
      setDraft(nextLabel);
      setSelected(true);
      return;
    }

    selectedLabel.current = "";
    setDraft("");
    setSelected(false);
  }, [initialLabel, value]);

  function handleInputChange(nextValue: string) {
    if (!value || nextValue === selectedLabel.current) return;
    selectedLabel.current = "";
    setSelected(false);
    ignoreNextReset.current = true;
    onChange("");
  }

  function handleSelect(option: AutocompleteOption) {
    pendingLabel.current = option.label;
    selectedLabel.current = option.label;
    setDraft(option.label);
    setSelected(true);
    onChange(option.value, option);
  }

  function handleClear() {
    selectedLabel.current = "";
    pendingLabel.current = null;
    setSelected(false);
    onChange("");
  }

  return (
    <AutocompleteField
      clearAriaLabel="Limpiar selección"
      createHref={createHref}
      createLabel={createLabel}
      disabled={disabled}
      emptyLabel={emptyLabel}
      error={error}
      errorLabel={errorLabel}
      help={help}
      id={id}
      label={label}
      loadingLabel={loadingLabel}
      loadOptions={loadOptions}
      minChars={minChars}
      onClear={handleClear}
      onInputChange={handleInputChange}
      onSelect={handleSelect}
      onValueChange={setDraft}
      placeholder={placeholder}
      required={required}
      searchOnFocus={!selected}
      value={draft}
    />
  );
}
