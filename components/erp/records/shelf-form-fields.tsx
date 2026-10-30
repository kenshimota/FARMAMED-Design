import {
  TextAreaField,
  TextField,
} from "@/components/erp/records/form-controls";
import {
  SECTION_FIELD_IDS,
  SHELF_FIELD_IDS,
} from "@/components/erp/records/shelf-errors";
import type { ShelfRecord, ShelfSectionRecord } from "@/components/erp/records/shelves-api";

export type ShelfFormValues = {
  code: string;
  name: string;
  description: string;
};

export type SectionFormValues = ShelfFormValues;

export const EMPTY_SHELF_VALUES: ShelfFormValues = {
  code: "",
  name: "",
  description: "",
};

export function shelfToFormValues(shelf: ShelfRecord): ShelfFormValues {
  return {
    code: shelf.code,
    name: shelf.name,
    description: shelf.description,
  };
}

export function sectionToFormValues(section: ShelfSectionRecord): SectionFormValues {
  return {
    code: section.code,
    name: section.name,
    description: section.description,
  };
}

export function normalizeCode(value: string) {
  return value.toUpperCase();
}

export function validateShelfValues(values: ShelfFormValues) {
  const errors: Record<string, string> = {};
  if (!values.code.trim()) errors.code = "Ingresa el código del estante.";
  return errors;
}

export function validateSectionValues(values: SectionFormValues) {
  const errors: Record<string, string> = {};
  if (!values.code.trim()) errors.code = "Ingresa el código de la sección.";
  return errors;
}

type ShelfFormFieldsProps = {
  values: ShelfFormValues;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (field: keyof ShelfFormValues, value: string) => void;
};

export function ShelfFormFields({
  values,
  errors,
  disabled = false,
  onChange,
}: ShelfFormFieldsProps) {
  const preview = values.code.trim() || "—";

  return (
    <div className="space-y-5">
      <TextField
        autoComplete="off"
        disabled={disabled}
        error={errors.code}
        help={
          <span>
            Obligatorio. El código es el identificador visible del estante y debe
            ser único dentro de la bodega.
            <span className="mt-1 block">
              Se guardará como{" "}
              <span className="font-mono font-semibold text-ink">{preview}</span>.
            </span>
          </span>
        }
        id={SHELF_FIELD_IDS.code}
        label="Código"
        mono
        onChange={(value) => onChange("code", normalizeCode(value))}
        placeholder="Ej. EST-A1"
        required
        value={values.code}
      />

      <TextField
        autoComplete="off"
        disabled={disabled}
        error={errors.name}
        help="Opcional. Nombre descriptivo del estante."
        id={SHELF_FIELD_IDS.name}
        label="Nombre"
        onChange={(value) => onChange("name", value)}
        placeholder="Ej. Estante de analgésicos"
        value={values.name}
      />

      <TextAreaField
        disabled={disabled}
        error={errors.description}
        help="Opcional. Referencia para ubicar el estante dentro de la bodega."
        id={SHELF_FIELD_IDS.description}
        label="Descripción"
        onChange={(value) => onChange("description", value)}
        placeholder="Ej. Pasillo 2, lado derecho"
        rows={3}
        value={values.description}
      />
    </div>
  );
}

type SectionFormFieldsProps = {
  values: SectionFormValues;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (field: keyof SectionFormValues, value: string) => void;
};

export function SectionFormFields({
  values,
  errors,
  disabled = false,
  onChange,
}: SectionFormFieldsProps) {
  const preview = values.code.trim() || "—";

  return (
    <div className="space-y-5">
      <TextField
        autoComplete="off"
        disabled={disabled}
        error={errors.code}
        help={
          <span>
            Obligatorio. El código es el identificador visible de la sección y debe
            ser único dentro del estante.
            <span className="mt-1 block">
              Se guardará como{" "}
              <span className="font-mono font-semibold text-ink">{preview}</span>.
            </span>
          </span>
        }
        id={SECTION_FIELD_IDS.code}
        label="Código"
        mono
        onChange={(value) => onChange("code", normalizeCode(value))}
        placeholder="Ej. SEC-01"
        required
        value={values.code}
      />

      <TextField
        autoComplete="off"
        disabled={disabled}
        error={errors.name}
        help="Opcional. Nombre descriptivo de la sección."
        id={SECTION_FIELD_IDS.name}
        label="Nombre"
        onChange={(value) => onChange("name", value)}
        placeholder="Ej. Primera fila"
        value={values.name}
      />

      <TextAreaField
        disabled={disabled}
        error={errors.description}
        help="Opcional. Referencia para ubicar la sección dentro del estante."
        id={SECTION_FIELD_IDS.description}
        label="Descripción"
        onChange={(value) => onChange("description", value)}
        placeholder="Ej. Nivel superior"
        rows={3}
        value={values.description}
      />
    </div>
  );
}
