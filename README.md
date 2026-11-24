# YAKU ALERT — UNT
**Hackathon Innova Norte 3G 2026 — Desafío 3: Gestión de riesgos y desastres ante el Fenómeno El Niño**

Plataforma web inteligente de monitoreo meteorológico, análisis espacial geográfico (Shapely) y motor de decisiones preventivas explicables para la Ciudad Universitaria de la Universidad Nacional de Trujillo (UNT).

---

## Estructura del Proyecto

- `backend/` — API REST en **FastAPI** + **Shapely 2.x** + cliente **Open-Meteo** (IPv4 + respaldo local offline) + suite `pytest`.
- `frontend/` — Interfaz en **React + Vite + Tailwind CSS + Leaflet** con 3 vistas (*Monitoreo*, *Mapa y Escenarios*, *Prevención y Respuesta*).
- `docs/` — Matriz de cumplimiento, Entregables Stage-Gate 1 (Ficha del Problema, Ficha Técnica, Plan de Validación) y Defensa de Jurado.
- `pitch/` — Generador y presentación PowerPoint oficial (`YAKU_ALERT_UNT_PITCH.pptx`, 7 diapositivas).
- `PLAN_DESARROLLO.md` — Plan maestro, arquitectura y backlog P0/P1/P2.

---

## Requisitos Previos

- **Python 3.11+**
- **Node.js 20+** y **npm**

---

## Ejecución Rápida con Docker (Recomendado)

```powershell
docker compose up --build -d
```
- **Frontend (Nginx + React + Leaflet):** `http://localhost:8080`
- **Backend (FastAPI + Shapely):** `http://localhost:8000/docs`

Para detener los contenedores:
```powershell
docker compose down
```

---

## Instalación y Ejecución Local (Sin Docker)

### 1. Backend (FastAPI)
```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API disponible en: `http://127.0.0.1:8000/docs`

### 2. Frontend (React + Vite + Leaflet)
En otra terminal:
```powershell
cd frontend
npm install
npm run dev
```
Aplicación web disponible en: `http://localhost:5173`

---

## Ejecución de Pruebas Automatizadas

```powershell
cd backend
python -m pytest -v
```

---

## Cumplimiento Normativo y Científico
- **Ley N.° 29664 (SINAGERD) y D.S. N.° 048-2011-PCM:** Herramienta preventiva e informativa; no reemplaza alertas oficiales de SENAMHI, COEN, INDECI ni Defensa Civil UNT.
- **Ley N.° 29733 (Protección de Datos Personales):** No recopila datos personales ni geolocalización GPS del usuario.
- **Transparencia:** Distinción permanente en interfaz y API entre **datos reales de pronóstico** y **escenarios experimentales** (A: relieve DEM de 30 m; B: zonas reportadas por testimonio/prensa; C: combinación). La lluvia no modifica los polígonos.
