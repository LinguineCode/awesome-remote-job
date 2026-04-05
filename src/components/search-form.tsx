"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchProfile } from "@/types";
import { api } from "@/lib/api";

const COMMON_MAKES = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "BMW", "Buick", "Cadillac",
  "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford", "Genesis",
  "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
  "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus", "Maserati",
  "Mazda", "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan",
  "Polestar", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru",
  "Tesla", "Toyota", "Volkswagen", "Volvo",
];

const TRANSMISSIONS = [
  { value: "", label: "Any" },
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
];

const DRIVETRAINS = [
  { value: "", label: "Any" },
  { value: "fwd", label: "FWD" },
  { value: "rwd", label: "RWD" },
  { value: "awd", label: "AWD" },
  { value: "4wd", label: "4WD" },
];

interface SearchFormProps {
  initialData?: SearchProfile;
  mode: "create" | "edit";
}

export function SearchForm({ initialData, mode }: SearchFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: initialData?.name || "",
    makes: initialData?.makes?.join(", ") || "",
    models: initialData?.models?.join(", ") || "",
    yearMin: initialData?.yearMin?.toString() || "",
    yearMax: initialData?.yearMax?.toString() || "",
    priceMin: initialData?.priceMin?.toString() || "",
    priceMax: initialData?.priceMax?.toString() || "",
    mileageMax: initialData?.mileageMax?.toString() || "",
    transmission: initialData?.transmission || "",
    drivetrain: initialData?.drivetrain || "",
    colors: initialData?.colors?.join(", ") || "",
    zipCode: initialData?.zipCode || "",
    searchRadiusMiles: initialData?.searchRadiusMiles?.toString() || "100",
    states: initialData?.states?.join(", ") || "",
    excludeDealers: initialData?.excludeDealers ?? false,
    excludeSalvage: initialData?.excludeSalvage ?? true,
    aiNotes: initialData?.aiNotes || "",
  });

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      ...(mode === "edit" && initialData ? { id: initialData.id } : {}),
      name: form.name,
      makes: form.makes
        ? form.makes.split(",").map((s) => s.trim()).filter(Boolean)
        : null,
      models: form.models
        ? form.models.split(",").map((s) => s.trim()).filter(Boolean)
        : null,
      yearMin: form.yearMin ? parseInt(form.yearMin) : null,
      yearMax: form.yearMax ? parseInt(form.yearMax) : null,
      priceMin: form.priceMin ? parseInt(form.priceMin) : null,
      priceMax: form.priceMax ? parseInt(form.priceMax) : null,
      mileageMax: form.mileageMax ? parseInt(form.mileageMax) : null,
      transmission: form.transmission || null,
      drivetrain: form.drivetrain || null,
      colors: form.colors
        ? form.colors.split(",").map((s) => s.trim()).filter(Boolean)
        : null,
      zipCode: form.zipCode || null,
      searchRadiusMiles: parseInt(form.searchRadiusMiles) || 100,
      states: form.states
        ? form.states.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : null,
      excludeDealers: form.excludeDealers,
      excludeSalvage: form.excludeSalvage,
      aiNotes: form.aiNotes || null,
    };

    try {
      if (mode === "edit") {
        await api.updateSearch(payload);
      } else {
        await api.createSearch(payload);
      }

      router.push("/searches");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Search Name */}
      <div>
        <label className={labelClass}>Search Name *</label>
        <input
          type="text"
          required
          placeholder='e.g., "Porsche 997 Manual" or "Budget Miata"'
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">
          Give this search a memorable name
        </p>
      </div>

      {/* Make & Model */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Make(s)</label>
          <input
            type="text"
            placeholder="e.g., Porsche, BMW"
            value={form.makes}
            onChange={(e) => updateField("makes", e.target.value)}
            className={inputClass}
            list="makes-list"
          />
          <datalist id="makes-list">
            {COMMON_MAKES.map((make) => (
              <option key={make} value={make} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-gray-500">Comma-separated</p>
        </div>
        <div>
          <label className={labelClass}>Model(s)</label>
          <input
            type="text"
            placeholder="e.g., 911, M3"
            value={form.models}
            onChange={(e) => updateField("models", e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500">Comma-separated</p>
        </div>
      </div>

      {/* Year Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Year Min</label>
          <input
            type="number"
            placeholder="e.g., 2005"
            value={form.yearMin}
            onChange={(e) => updateField("yearMin", e.target.value)}
            className={inputClass}
            min="1900"
            max="2027"
          />
        </div>
        <div>
          <label className={labelClass}>Year Max</label>
          <input
            type="number"
            placeholder="e.g., 2012"
            value={form.yearMax}
            onChange={(e) => updateField("yearMax", e.target.value)}
            className={inputClass}
            min="1900"
            max="2027"
          />
        </div>
      </div>

      {/* Price Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Min Price ($)</label>
          <input
            type="number"
            placeholder="e.g., 20000"
            value={form.priceMin}
            onChange={(e) => updateField("priceMin", e.target.value)}
            className={inputClass}
            min="0"
          />
        </div>
        <div>
          <label className={labelClass}>Max Price ($)</label>
          <input
            type="number"
            placeholder="e.g., 60000"
            value={form.priceMax}
            onChange={(e) => updateField("priceMax", e.target.value)}
            className={inputClass}
            min="0"
          />
        </div>
      </div>

      {/* Mileage */}
      <div className="w-full sm:w-1/2">
        <label className={labelClass}>Max Mileage</label>
        <input
          type="number"
          placeholder="e.g., 75000"
          value={form.mileageMax}
          onChange={(e) => updateField("mileageMax", e.target.value)}
          className={inputClass}
          min="0"
        />
      </div>

      {/* Transmission & Drivetrain */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Transmission</label>
          <select
            value={form.transmission}
            onChange={(e) => updateField("transmission", e.target.value)}
            className={inputClass}
          >
            {TRANSMISSIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Drivetrain</label>
          <select
            value={form.drivetrain}
            onChange={(e) => updateField("drivetrain", e.target.value)}
            className={inputClass}
          >
            {DRIVETRAINS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Colors */}
      <div>
        <label className={labelClass}>Preferred Colors</label>
        <input
          type="text"
          placeholder="e.g., Black, White, Silver"
          value={form.colors}
          onChange={(e) => updateField("colors", e.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">
          Comma-separated (optional)
        </p>
      </div>

      {/* Location */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>ZIP Code</label>
          <input
            type="text"
            placeholder="e.g., 90210"
            value={form.zipCode}
            onChange={(e) => updateField("zipCode", e.target.value)}
            className={inputClass}
            maxLength={5}
          />
        </div>
        <div>
          <label className={labelClass}>Search Radius (mi)</label>
          <input
            type="number"
            value={form.searchRadiusMiles}
            onChange={(e) =>
              updateField("searchRadiusMiles", e.target.value)
            }
            className={inputClass}
            min="10"
            max="500"
          />
        </div>
        <div>
          <label className={labelClass}>States</label>
          <input
            type="text"
            placeholder="e.g., CA, OR, WA"
            value={form.states}
            onChange={(e) => updateField("states", e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500">Comma-separated</p>
        </div>
      </div>

      {/* Quality Filters */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Quality Filters
        </h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.excludeDealers}
              onChange={(e) => updateField("excludeDealers", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Exclude dealer listings (private sellers only)
            </span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.excludeSalvage}
              onChange={(e) => updateField("excludeSalvage", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Exclude salvage/rebuilt titles
            </span>
          </label>
        </div>
      </div>

      {/* AI Notes — the killer feature */}
      <div>
        <label className={labelClass}>
          AI Search Notes{" "}
          <span className="text-blue-600 font-normal">(the magic)</span>
        </label>
        <textarea
          value={form.aiNotes}
          onChange={(e) => updateField("aiNotes", e.target.value)}
          className={`${inputClass} min-h-[120px]`}
          placeholder={`Describe exactly what you want in plain English. Our AI will evaluate every listing against these notes.

Examples:
• "Must be a 997.1 (2005-2008), not interested in Carrera 4/4S. Prefer Seal Grey or Arctic Silver. Must have sport chrono package."
• "Looking for a clean, unmolested example. No aftermarket body kits. Prefer low miles from an older owner."
• "I want an E46 M3 with the competition package. Manual only. No convertibles."`}
        />
        <p className="mt-1 text-xs text-gray-500">
          This is where CarFinder shines. Write anything you want — our AI reads
          every listing description and evaluates it against your notes. Be as
          specific as you like.
        </p>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving || !form.name}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving
            ? "Saving..."
            : mode === "edit"
              ? "Update Search"
              : "Create Search"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
