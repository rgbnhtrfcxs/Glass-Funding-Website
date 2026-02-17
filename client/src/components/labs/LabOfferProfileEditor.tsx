import { useMemo, useState } from "react";
import type { LabOfferTaxonomyOption } from "@shared/labOffers";
import {
  listToCsv,
  parseCsvList,
  toggleSelection,
  type LabOfferProfileDraft,
} from "@/lib/labOfferProfile";

type Props = {
  draft: LabOfferProfileDraft;
  onChange: (next: LabOfferProfileDraft) => void;
  taxonomy: LabOfferTaxonomyOption[];
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
};

const groupLabel: Record<LabOfferTaxonomyOption["optionGroup"], string> = {
  rentable_lab_level: "Rentable lab type",
  offer_format: "Offer format",
  application_mode: "Application mode",
  pricing_model: "Pricing model",
  technical_service: "Technical services",
  general_service: "General services",
};

const statusLabel: Record<LabOfferProfileDraft["operationalStatus"], string> = {
  open: "Open",
  opening_future: "Opening in future",
  renovation_or_closed: "Under renovation / Closed",
};

const pricingModelLabel: Record<LabOfferProfileDraft["pricingModel"], string> = {
  request_quote: "Request quote",
  price_from: "Price from",
  fixed_price: "Fixed price",
  range: "Price range",
};

export function LabOfferProfileEditor({
  draft,
  onChange,
  taxonomy,
  loading = false,
  error = null,
  disabled = false,
}: Props) {
  const [technicalCustomInput, setTechnicalCustomInput] = useState("");
  const [generalCustomInput, setGeneralCustomInput] = useState("");

  const optionsByGroup = useMemo(() => {
    const grouped: Record<LabOfferTaxonomyOption["optionGroup"], LabOfferTaxonomyOption[]> = {
      rentable_lab_level: [],
      offer_format: [],
      application_mode: [],
      pricing_model: [],
      technical_service: [],
      general_service: [],
    };
    taxonomy.forEach(option => {
      grouped[option.optionGroup].push(option);
    });
    return grouped;
  }, [taxonomy]);

  const set = <K extends keyof LabOfferProfileDraft>(field: K, value: LabOfferProfileDraft[K]) =>
    onChange({ ...draft, [field]: value });

  const renderCheckboxGroup = (
    group: "rentable_lab_level" | "offer_format" | "application_mode",
    field: "rentableLabLevels" | "offerFormats" | "applicationModes",
  ) => (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{groupLabel[group]}</p>
      <div className="flex flex-wrap gap-2">
        {optionsByGroup[group].map(option => {
          const checked = draft[field].includes(option.code);
          return (
            <label
              key={`${group}-${option.code}`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-foreground"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={event => set(field, toggleSelection(draft[field], option.code, event.target.checked) as any)}
              />
              {option.labelEn}
            </label>
          );
        })}
      </div>
    </div>
  );

  const renderServiceGroup = (
    group: "technical_service" | "general_service",
    field: "technicalServices" | "generalServices",
    customInput: string,
    setCustomInput: (value: string) => void,
  ) => (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{groupLabel[group]}</p>
      <div className="flex flex-wrap gap-2">
        {optionsByGroup[group].map(option => {
          const checked = draft[field].includes(option.code);
          return (
            <label
              key={`${group}-${option.code}`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-foreground"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={event => set(field, toggleSelection(draft[field], option.code, event.target.checked) as any)}
              />
              {option.labelEn}
            </label>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          disabled={disabled}
          onChange={event => setCustomInput(event.target.value)}
          placeholder="Add custom entries (comma separated)"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const customValues = parseCsvList(customInput);
            if (!customValues.length) return;
            set(field, Array.from(new Set([...draft[field], ...customValues])) as any);
            setCustomInput("");
          }}
          className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {draft[field].length > 0 && (
        <input
          type="text"
          value={listToCsv(draft[field])}
          disabled={disabled}
          onChange={event => set(field, parseCsvList(event.target.value) as any)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {loading && <p className="text-xs text-muted-foreground">Loading offer options...</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={draft.supportsBenchRental}
            disabled={disabled}
            onChange={event => set("supportsBenchRental", event.target.checked)}
          />
          Supports bench/space rental
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={draft.supportsEquipmentAccess}
            disabled={disabled}
            onChange={event => set("supportsEquipmentAccess", event.target.checked)}
          />
          Supports equipment access
        </label>
      </div>

      {renderCheckboxGroup("rentable_lab_level", "rentableLabLevels")}
      {renderCheckboxGroup("offer_format", "offerFormats")}
      {renderCheckboxGroup("application_mode", "applicationModes")}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm text-foreground">
          <span className="font-medium">Operational status</span>
          <select
            value={draft.operationalStatus}
            disabled={disabled}
            onChange={event => set("operationalStatus", event.target.value as LabOfferProfileDraft["operationalStatus"])}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-foreground">
          <span className="font-medium">Expected opening year</span>
          <input
            type="number"
            min={2024}
            max={2100}
            value={draft.expectedOpeningYear}
            disabled={disabled || draft.operationalStatus !== "opening_future"}
            onChange={event => set("expectedOpeningYear", event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          />
        </label>
      </div>

      {renderServiceGroup("technical_service", "technicalServices", technicalCustomInput, setTechnicalCustomInput)}
      {renderServiceGroup("general_service", "generalServices", generalCustomInput, setGeneralCustomInput)}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm text-foreground">
          <span className="font-medium">Pricing model</span>
          <select
            value={draft.pricingModel}
            disabled={disabled}
            onChange={event => set("pricingModel", event.target.value as LabOfferProfileDraft["pricingModel"])}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {Object.entries(pricingModelLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-foreground">
          <span className="font-medium">Currency</span>
          <input
            type="text"
            maxLength={3}
            value={draft.currency}
            disabled={disabled}
            onChange={event => set("currency", event.target.value.toUpperCase())}
            placeholder="EUR"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm text-foreground">
          <span className="font-medium">Price from</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.priceFrom}
            disabled={disabled}
            onChange={event => set("priceFrom", event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <label className="space-y-1 text-sm text-foreground">
          <span className="font-medium">Price to</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.priceTo}
            disabled={disabled}
            onChange={event => set("priceTo", event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
      </div>

      <label className="space-y-1 text-sm text-foreground">
        <span className="font-medium">Pricing notes</span>
        <textarea
          rows={3}
          value={draft.pricingNotes}
          disabled={disabled}
          onChange={event => set("pricingNotes", event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>

      <label className="space-y-1 text-sm text-foreground">
        <span className="font-medium">Additional information</span>
        <textarea
          rows={4}
          value={draft.additionalInfo}
          disabled={disabled}
          onChange={event => set("additionalInfo", event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm text-foreground">
          <span className="font-medium">Total area (m2)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.totalAreaM2}
            disabled={disabled}
            onChange={event => set("totalAreaM2", event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <label className="space-y-1 text-sm text-foreground">
          <span className="font-medium">Min rentable area (m2)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.minRentAreaM2}
            disabled={disabled}
            onChange={event => set("minRentAreaM2", event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <label className="space-y-1 text-sm text-foreground">
          <span className="font-medium">Max rentable area (m2)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.maxRentAreaM2}
            disabled={disabled}
            onChange={event => set("maxRentAreaM2", event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
      </div>
    </div>
  );
}
