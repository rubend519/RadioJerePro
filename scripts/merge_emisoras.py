#!/usr/bin/env python3
"""
Fusiona emisoras nuevas descubiertas (TuneIn, u otros CSV) dentro de
stations.json SIN afectar nunca las que ya están gestionadas.

Reglas de oro
-------------
1) NUNCA se sobreescribe ni se borra una entrada existente en stations.json.
   Este script solo AGREGA filas nuevas al final.
2) Las emisoras en PROTEGIDAS_PARA_SIEMPRE jamás se tocan ni se comparan
   para reemplazo (coinciden con HEALTH_CHECK_EXCLUDE de app.js).
3) La clave de "es duplicado" es (nombre_normalizado, ciudad_normalizada),
   NUNCA solo el nombre -- porque "El Sol", "La Mega", "Olímpica", etc.
   se repiten en muchas ciudades y son emisoras distintas.
4) Antes de aceptar un candidato de TuneIn, también se revisa contra
   Radio Browser EN VIVO (la misma API gratuita que ya consume app.js),
   para no duplicar algo que los usuarios ya pueden encontrar ahí.

Uso
---
    pip install requests
    python merge_emisoras.py \
        --master ../stations.json \
        --candidatos ../cadenas_tunein.csv \
        --salida ../stations.json \
        --reporte reporte_merge.csv

Si --salida es igual a --master, el archivo se actualiza en el mismo
lugar (agregando filas nuevas al final del array, sin tocar las viejas).
"""

import argparse
import csv
import json
import re
import sys
import unicodedata
from datetime import date
from difflib import SequenceMatcher

import requests

# IDs que jamás se tocan, se re-chequean ni se consideran "reemplazables"
# (mismos que HEALTH_CHECK_EXCLUDE en app.js).
PROTEGIDAS_PARA_SIEMPRE = {"co-022", "co-036"}

RADIO_BROWSER_SERVERS = [
    "https://de1.api.radio-browser.info/json",
    "https://nl1.api.radio-browser.info/json",
    "https://at1.api.radio-browser.info/json",
    "https://fi1.api.radio-browser.info/json",
]

HEADERS = {"User-Agent": "RadioJerePro-Merge/1.0"}

# Ruido a quitar del nombre antes de comparar (frecuencias, "fm/am/stereo", etc.)
RUIDO_NOMBRE_RE = re.compile(
    r"\b(\d{2,4}([.,]\d)?\s*(fm|am|khz|mhz)?|fm|am|stereo|radio|emisora|hd)\b",
    re.IGNORECASE,
)

UMBRAL_SIMILITUD = 0.82  # 0-1, qué tan parecidos deben ser dos nombres para contar como duplicado


def normalizar(txt):
    if not txt:
        return ""
    txt = unicodedata.normalize("NFKD", txt).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9 ]+", " ", txt.lower()).strip()


def normalizar_nombre(nombre):
    n = normalizar(nombre)
    n = RUIDO_NOMBRE_RE.sub(" ", n)
    return re.sub(r"\s+", " ", n).strip()


def normalizar_ciudad(ciudad):
    return normalizar(ciudad)


def son_duplicados(nombre_a, ciudad_a, nombre_b, ciudad_b):
    """Duplicado = misma ciudad Y nombres muy parecidos. Nunca solo el nombre."""
    if ciudad_a != ciudad_b:
        return False
    if not ciudad_a:  # sin ciudad detectada en ninguno de los dos: no arriesgarse
        return False
    ratio = SequenceMatcher(None, nombre_a, nombre_b).ratio()
    if ratio >= UMBRAL_SIMILITUD:
        return True
    # además, si uno contiene completo al otro (ej. "el sol" dentro de "el sol la salsa")
    if nombre_a and nombre_b and (nombre_a in nombre_b or nombre_b in nombre_a):
        return True
    return False


def cargar_master(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"[!] No existe {path}, se asume lista vacía.")
        return [], None
    if isinstance(data, dict) and "stations" in data:
        return data["stations"], data  # (lista, envoltorio original con _meta)
    return data, None


def index_master(master):
    """Devuelve lista de (nombre_norm, ciudad_norm, entrada_original)."""
    idx = []
    for e in master:
        idx.append((normalizar_nombre(e.get("name", "")), normalizar_ciudad(e.get("state", "")), e))
    return idx


def consultar_radio_browser_colombia():
    """Trae, de la misma API gratuita que ya usa app.js, todas las emisoras
    que Radio Browser ya reporta para Colombia. Se usa solo para evitar
    duplicar -- no se guarda en ningún archivo."""
    params = {"country": "Colombia", "hidebroken": "true", "limit": 4000}
    for base in RADIO_BROWSER_SERVERS:
        try:
            r = requests.get(f"{base}/stations/search", params=params, headers=HEADERS, timeout=20)
            r.raise_for_status()
            datos = r.json()
            print(f"[i] Radio Browser en vivo ({base}): {len(datos)} emisoras de Colombia.")
            return [(normalizar_nombre(d.get("name", "")), normalizar_ciudad(d.get("state", ""))) for d in datos]
        except requests.RequestException as e:
            print(f"  [!] Falló {base}: {e}, probando siguiente espejo...")
    print("[!] No se pudo consultar Radio Browser en vivo; se continúa solo con stations.json.")
    return []


def cargar_candidatos_csv(path):
    """Lee el CSV que genera descubrir_cadenas_tunein.py (u otro CSV con
    columnas equivalentes) y lo normaliza a un formato común."""
    candidatos = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        campos = {c.lower(): c for c in reader.fieldnames or []}

        def col(*alias):
            for a in alias:
                if a in campos:
                    return campos[a]
            return None

        c_nombre = col("nombre", "name")
        c_ciudad = col("ciudad_detectada", "ciudad", "state")
        c_url = col("stream_url", "url_resolved", "url")
        c_marca = col("marca", "tags")
        c_id = col("tunein_id", "stationuuid")

        for row in reader:
            nombre = row.get(c_nombre, "").strip() if c_nombre else ""
            url = row.get(c_url, "").strip() if c_url else ""
            if not nombre or not url:
                continue  # sin nombre o sin URL resuelta, no sirve
            candidatos.append({
                "name": nombre,
                "state": row.get(c_ciudad, "").strip() if c_ciudad else "",
                "url": url,
                "country": "Colombia",
                "tags": row.get(c_marca, "").strip() if c_marca else "",
                "favicon": "",
                "_origen_id": row.get(c_id, "").strip() if c_id else "",
            })
    return candidatos


def siguiente_uuid(master):
    """Genera ids co-XXX consecutivos siguiendo el patrón que ya usas."""
    max_n = 0
    for e in master:
        m = re.match(r"co-(\d+)$", str(e.get("stationuuid", "")))
        if m:
            max_n = max(max_n, int(m.group(1)))
    n = max_n
    while True:
        n += 1
        yield f"co-{n:03d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--master", required=True, help="stations.json actual")
    ap.add_argument("--candidatos", required=True, help="CSV de descubrir_cadenas_tunein.py")
    ap.add_argument("--salida", required=True, help="Dónde escribir el stations.json actualizado")
    ap.add_argument("--reporte", default="reporte_merge.csv", help="CSV con el detalle de qué se agregó/descartó")
    ap.add_argument("--sin-radio-browser", action="store_true", help="Omitir la consulta en vivo a Radio Browser")
    args = ap.parse_args()

    master, envoltorio = cargar_master(args.master)
    idx_master = index_master(master)
    idx_master_protegidas = {
        (n, c) for n, c, e in idx_master if e.get("stationuuid") in PROTEGIDAS_PARA_SIEMPRE
    }

    idx_live = [] if args.sin_radio_browser else consultar_radio_browser_colombia()
    candidatos = cargar_candidatos_csv(args.candidatos)

    gen_ids = siguiente_uuid(master)
    agregados, descartados = [], []

    for cand in candidatos:
        n_cand = normalizar_nombre(cand["name"])
        c_cand = normalizar_ciudad(cand["state"])

        dup_en_master = next(
            (e for n, c, e in idx_master if son_duplicados(n_cand, c_cand, n, c)), None
        )
        dup_en_vivo = any(son_duplicados(n_cand, c_cand, n, c) for n, c in idx_live)

        if dup_en_master:
            descartados.append({**cand, "motivo": f"ya está en stations.json como '{dup_en_master.get('name')}'"})
            continue
        if dup_en_vivo:
            descartados.append({**cand, "motivo": "ya la trae Radio Browser en vivo"})
            continue

        nueva = {
            "stationuuid": next(gen_ids),
            "name": cand["name"],
            "url": cand["url"],
            "country": "Colombia",
            "state": cand["state"] or "Sin ciudad detectada",
            "tags": cand["tags"],
            "favicon": cand["favicon"],
        }
        master.append(nueva)
        idx_master.append((n_cand, c_cand, nueva))
        agregados.append(nueva)

    if envoltorio is not None:
        envoltorio["stations"] = master
        if isinstance(envoltorio.get("_meta"), dict):
            envoltorio["_meta"]["total"] = len(master)
            envoltorio["_meta"]["last_updated"] = date.today().isoformat()
        salida_final = envoltorio
    else:
        salida_final = master

    with open(args.salida, "w", encoding="utf-8") as f:
        json.dump(salida_final, f, ensure_ascii=False, indent=2)

    with open(args.reporte, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["resultado", "nombre", "ciudad", "url", "motivo"])
        for a in agregados:
            w.writerow(["AGREGADA", a["name"], a["state"], a["url"], ""])
        for d in descartados:
            w.writerow(["DESCARTADA", d["name"], d["state"], d["url"], d["motivo"]])

    print(f"\n{len(agregados)} emisoras nuevas agregadas, {len(descartados)} descartadas por duplicado.")
    print(f"stations.json actualizado en: {args.salida}")
    print(f"Reporte detallado en: {args.reporte}")

    if not agregados:
        sys.exit(78)  # código especial: "no hubo cambios", útil para el workflow


if __name__ == "__main__":
    main()
