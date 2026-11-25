import { formatLimaTime, humanPreventiveTitle } from "./formatters";

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

export function buildBulletinHtml({ evaluation, weather, simResult }) {
  if (!evaluation) return "";
  const isSim = Boolean(evaluation.is_synthetic);
  const title = humanPreventiveTitle(evaluation.preventive_level, isSim);
  const { local, utc } = formatLimaTime(weather?.fetched_at_utc || new Date().toISOString());
  const nowLima = formatLimaTime(new Date().toISOString()).local;

  const tipoBadge = isSim
    ? "ESCENARIO SIMULADO SINTÉTICO (NO ES ALERTA REAL)"
    : weather?.data_status === "LIVE_API"
    ? "EVALUACIÓN EXPERIMENTAL SOBRE PRONÓSTICO (OPEN-METEO)"
    : "EVALUACIÓN SOBRE CACHÉ LOCAL OFFLINE";

  const rulesHtml = (evaluation.rules_triggered || [])
    .map(
      (r) =>
        `<li><strong>${esc(r.rule_id)}</strong>: ${esc(r.description)} — <em>${esc(
          r.observed_value
        )}</em> (${esc(r.threshold_note)})</li>`
    )
    .join("");

  const guidanceHtml = (evaluation.guidance || []).map((g) => `<li>${esc(g)}</li>`).join("");
  const limitsHtml = (evaluation.uncertainty_and_limits || [])
    .map((u) => `<li>${esc(u)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Boletín Preventivo — YAKU ALERT UNT</title>
  <style>
    body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #101828; max-width: 780px; margin: 24px auto; padding: 0 20px; line-height: 1.5; }
    .banner { background: ${isSim ? "#FEF3C7" : "#EFF6FF"}; border: 1px solid ${
    isSim ? "#F59E0B" : "#BFDBFE"
  }; padding: 12px 16px; border-radius: 8px; font-weight: 700; font-size: 13px; margin-bottom: 18px; }
    h1 { font-size: 22px; margin: 0 0 6px; color: #0B1F33; }
    .meta { font-size: 12px; color: #475467; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .box { border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 14px; background: #F8FAFC; }
    .box h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #2563EB; margin: 0 0 6px; }
    .box p { margin: 0; font-size: 13px; }
    h3 { font-size: 15px; color: #0B1F33; margin: 18px 0 8px; }
    ul { margin: 0; padding-left: 20px; font-size: 13px; }
    li { margin-bottom: 4px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #475467; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="banner">${esc(tipoBadge)}</div>
  <h1>YAKU ALERT — UNT · Boletín Preventivo</h1>
  <div class="meta">Generado el ${esc(nowLima)} · Referencia meteorológica: ${esc(local)} (${esc(
    utc
  )})${simResult && isSim ? ` · ID Simulación: ${esc(simResult.simulation_id)}` : ""}</div>

  <div class="grid">
    <div class="box">
      <h2>Qué ocurre</h2>
      <p><strong>${esc(title)}</strong><br/>${esc(evaluation.hazard_assessment)}</p>
    </div>
    <div class="box">
      <h2>Dónde</h2>
      <p>Ciudad Universitaria — UNT (Trujillo).<br/>${esc(evaluation.exposure_assessment)}</p>
    </div>
    <div class="box">
      <h2>Cuándo y vigencia</h2>
      <p>Actualización: ${esc(local)}. Vigencia informativa sujeta a nueva actualización del pronóstico o cambio de escenario.</p>
    </div>
    <div class="box">
      <h2>Quién informa</h2>
      <p>Prototipo informativo YAKU ALERT — UNT (TRL 3–4). No reemplaza comunicados oficiales de Defensa Civil UNT, SENAMHI, COEN o INDECI.</p>
    </div>
  </div>

  <h3>Qué hacer (Orientaciones preventivas)</h3>
  <ul>${guidanceHtml}</ul>

  <h3>Reglas activadas (Trazabilidad)</h3>
  <ul>${rulesHtml}</ul>

  <h3>Limitaciones e incertidumbre</h3>
  <ul>${limitsHtml}</ul>

  <div class="footer">
    <strong>Aviso normativo:</strong> ${esc(evaluation.legal_disclaimer)}<br/>
    Este boletín descargable funciona sin conexión como material informativo de apoyo y no constituye un sistema de alerta masiva operativo.
  </div>
</body>
</html>`;
}

export function downloadBulletin(params) {
  const html = buildBulletinHtml(params);
  if (!html) return;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const tag = params.evaluation?.is_synthetic ? "simulado" : "pronostico";
  a.download = `yaku-alert-boletin-${tag}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printBulletin(params) {
  const html = buildBulletinHtml(params);
  if (!html) return;
  const win = window.open("", "_blank", "width=840,height=720");
  if (!win) {
    downloadBulletin(params);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
