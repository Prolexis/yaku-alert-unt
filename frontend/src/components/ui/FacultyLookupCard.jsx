import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  MapPin,
  ArrowRight,
  ChevronDown,
  X,
  Sliders,
  Info,
  Compass,
} from "lucide-react";
import { normalizeText } from "../../utils/formatters";
import { buildCampusCatalog, CAMPUS_CATEGORIES } from "../../utils/campusCatalog";

const STATUS_BADGE = {
  Verificado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  Referencial: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "Sin identificar": "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export default function FacultyLookupCard({
  campusLayers,
  simResult,
  onLocateInMap,
  onNavigate,
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const catalog = useMemo(
    () => buildCampusCatalog(campusLayers, simResult),
    [campusLayers, simResult]
  );

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    return catalog
      .filter((item) => (categoryFilter === "all" ? true : item.typeId === categoryFilter))
      .filter((item) => (!q ? true : item.searchText.includes(q)))
      .slice(0, 40);
  }, [catalog, categoryFilter, query]);

  const selected = useMemo(
    () => catalog.find((item) => item.id === selectedId) || null,
    [catalog, selectedId]
  );

  return (
    <section
      ref={containerRef}
      aria-label="Explora tu campus"
      className="rounded-xl border border-[#E2E8F0] bg-white p-4 dark:border-slate-800 dark:bg-[#0B1F33] sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="shrink-0">
          <h3 className="text-sm font-bold text-[#101828] dark:text-white">Explora tu campus</h3>
          <p className="text-xs text-[#475467] dark:text-slate-400">
            Busca facultades, pabellones, puertas, bibliotecas, comedor o canchas
          </p>
        </div>

        {/* Filtro por categoría + Combobox buscable */}
        <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:max-w-2xl">
          <select
            aria-label="Filtrar por tipo de instalación"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setOpen(true);
            }}
            className="h-10 rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-3 text-xs font-medium text-[#101828] dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:w-48"
          >
            {CAMPUS_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475467]" />
            <input
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              aria-label="Buscar instalación de la Ciudad Universitaria UNT"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                if (!e.target.value.trim()) setSelectedId("");
              }}
              placeholder="Ej. Ingeniería, Biblioteca, Comedor, Puerta, Cancha..."
              className="h-10 w-full rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] pl-9 pr-14 text-sm text-[#101828] transition focus:border-[#2563EB] focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />

            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSelectedId("");
                    setOpen(true);
                  }}
                  aria-label="Limpiar búsqueda"
                  className="rounded p-1 text-[#475467] hover:bg-slate-200/70 dark:hover:bg-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label="Desplegar instalaciones"
                className="rounded p-1 text-[#475467] hover:bg-slate-200/70 dark:hover:bg-slate-800"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
            </div>

            {open && (
              <div
                role="listbox"
                className="absolute left-0 right-0 top-11 z-40 max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-[#0B1F33]"
              >
                {filtered.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-[#475467] dark:text-slate-400">
                    No se encontró ninguna instalación con esos criterios.
                  </div>
                ) : (
                  filtered.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={selectedId === item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setQuery(item.displayLabel);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                        selectedId === item.id
                          ? "bg-[#2563EB]/10 font-semibold text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-300"
                          : "text-[#101828] hover:bg-[#F7F9FC] dark:text-slate-200 dark:hover:bg-slate-800/80"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.displayLabel}</div>
                        <div className="text-[11px] text-[#475467] dark:text-slate-400">
                          {item.typeLabel} · {item.verificationStatus}
                        </div>
                      </div>
                      {item.exposure && (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            item.exposure.inside_hazard_zone
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-slate-100 text-[#475467] dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {item.exposure.inside_hazard_zone ? "En escenario" : "Fuera"}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ficha de la instalación seleccionada */}
      {selected && (
        <div className="mt-4 space-y-3 border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-bold text-[#101828] dark:text-white">
                {selected.displayLabel}
              </h4>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[#475467] dark:bg-slate-800 dark:text-slate-300">
                {selected.typeLabel}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                  STATUS_BADGE[selected.verificationStatus] || STATUS_BADGE.Referencial
                }`}
              >
                {selected.verificationStatus}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-[#F7F9FC] p-3 text-xs dark:bg-slate-900/60">
              <div className="flex items-center gap-1.5 font-semibold text-[#101828] dark:text-white">
                <Compass className="h-3.5 w-3.5 text-[#2563EB]" />
                Ubicación y fuente geográfica
              </div>
              <p className="mt-1 text-[#475467] dark:text-slate-300">
                {selected.center
                  ? `Coordenadas aprox.: ${selected.center.lat.toFixed(5)}, ${selected.center.lon.toFixed(5)}`
                  : "Ubicación: Información no disponible"}
              </p>
              <p className="mt-0.5 text-[11px] text-[#475467] dark:text-slate-400">
                Fuente: {selected.source}
                {selected.osmId ? ` · ${selected.osmId}` : ""}
              </p>
            </div>

            <div className="rounded-lg bg-[#F7F9FC] p-3 text-xs dark:bg-slate-900/60">
              <div className="flex items-center gap-1.5 font-semibold text-[#101828] dark:text-white">
                <Info className="h-3.5 w-3.5 text-amber-600" />
                Exposición en último escenario simulado
              </div>
              <p className="mt-1 text-[#475467] dark:text-slate-300">
                {selected.exposure ? (
                  selected.exposure.inside_hazard_zone ? (
                    <>
                      Intersecta la zona experimental ({selected.exposure.overlap_pct}%).{" "}
                      {selected.exposure.status_in_scenario}
                    </>
                  ) : (
                    <>
                      No intersecta el polígono del escenario actual. Esto no declara la instalación
                      como segura ante un evento real.
                    </>
                  )
                ) : (
                  "Información no disponible para este tipo de instalación en el motor espacial actual."
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onLocateInMap(selected.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
            >
              <MapPin className="h-3.5 w-3.5" />
              Ver en mapa
            </button>
            <button
              type="button"
              onClick={() => onNavigate("simulator")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3.5 text-xs font-semibold text-[#101828] hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
            >
              <Sliders className="h-3.5 w-3.5 text-[#2563EB]" />
              Consultar escenario
            </button>
            <button
              type="button"
              onClick={() => onNavigate("continuity")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3.5 text-xs font-semibold text-[#101828] hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
            >
              Ver orientaciones <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
