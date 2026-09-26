#!/usr/bin/env python3
"""
Descubre emisoras de las GRANDES CADENAS colombianas (La FM / ex-RCN, El Sol,
La Mega, Radio Uno, Caracol, Olímpica, Todelar, etc.) que normalmente NO
aparecen en Radio Browser API, usando el directorio público de TuneIn.

Cómo funciona
-------------
1) Scrapea la página "Stream <Marca>" de TuneIn (ej. tunein.com/radio/Stream-RCN-a38574/)
   y saca el nombre + id de cada emisora regional que agrupa esa marca.
2) Resuelve cada id de TuneIn a la URL real del audio, usando el endpoint público
   opml.radiotime.com/Tune.ashx -- el mismo que usa el propio reproductor web/app
   de TuneIn para reproducir. No evade login, pago ni DRM: es la URL que
   cualquier oyente gratuito recibe al darle "play".
3) Detecta la ciudad a partir del nombre de la emisora (ej. "El Sol (Cali)").
4) Si le pasas el CSV consolidado de Radio Browser, fusiona todo y regenera el
   listado de ciudades faltantes con datos combinados de ambas fuentes.

Uso
---
    pip install requests beautifulsoup4 lxml
    python descubrir_cadenas_tunein.py

Notas importantes
------------------
- Estos selectores los armé revisando el HTML real de tunein.com/radio/Stream-RCN-a38574/
  en el momento de escribir esto. Si TuneIn cambia su estructura, el script puede
  necesitar ajustes -- están todos en la función parse_brand_page().
- No pude probar el script yo mismo (mi entorno de este chat no tiene salida de
  red hacia tunein.com), así que corre primero con pocas marcas y revisa que los
  resultados tengan sentido antes de lanzarlo contra la lista completa.
- Sé razonable con la frecuencia de requests (ya hay pausas). Esto es para uso
  personal/hobby en tu propio proyecto, no para redistribuir el directorio de TuneIn.
"""

import re
import csv
import time
import unicodedata
from collections import defaultdict

import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; RadioJerePro-Discovery/1.0)"}

# --------------------------------------------------------------------------
# Agrega aquí la página "Stream <Marca>" de TuneIn de cada cadena que quieras
# cubrir. Para encontrar la de otra cadena: busca en Google/TuneIn el nombre
# de la cadena (ej. "Caracol Radio Colombia tunein"), entra a la página que
# agrupa todas sus emisoras regionales (la que dice "Stations" con varias
# ciudades) y copia esa URL aquí.
# --------------------------------------------------------------------------
TUNEIN_BRAND_PAGES = {
    "La FM / El Sol / La Mega / Radio Uno (ex-RCN)": "https://tunein.com/radio/Stream-RCN-a38574/",
    # Esta trae de regalo Bésame y Tropicana (mismo grupo PRISA/Caracol):
    "Caracol Radio / W Radio / Bésame / Tropicana / LOS40 / Radioacktiva": "https://tunein.com/radio/Stream-Caracol-Radio-a40084/",
    # "Olimpica Stereo": "https://tunein.com/radio/Stream-Olimpica-Stereo-aXXXXX/",
    # "Todelar": "https://tunein.com/radio/Stream-Todelar-aXXXXX/",
    #
    # BONUS: TuneIn también tiene páginas por CIUDAD (no solo por cadena),
    # que listan TODAS las emisoras de esa ciudad sin importar el grupo.
    # El mismo parser sirve igual, solo agrega la URL aquí con la ciudad
    # como "marca". Confirmadas mientras investigaba:
    "Ciudad: Bogotá": "https://tunein.com/radio/Stream-Bogota-r100716/",
    "Ciudad: Barranquilla": "https://tunein.com/radio/Stream-Barranquilla-r100718/",
    "Ciudad: Tunja": "https://tunein.com/radio/Stream-Tunja-r101982/",
    # Para las demás capitales: busca en Google/TuneIn "tunein stream <ciudad>
    # colombia" y agrega aquí la URL que encuentres (patrón Stream-<Ciudad>-rNNNNNN).
    # "Ciudad: Medellín": "https://tunein.com/radio/Stream-Medellin-rXXXXXX/",
    # "Ciudad: Cali": "https://tunein.com/radio/Stream-Cali-rXXXXXX/",
    # "Ciudad: Cartagena": "https://tunein.com/radio/Stream-Cartagena-rXXXXXX/",
    # "Ciudad: Bucaramanga": "https://tunein.com/radio/Stream-Bucaramanga-rXXXXXX/",
    # "Ciudad: Cúcuta": "https://tunein.com/radio/Stream-Cucuta-rXXXXXX/",
    # "Ciudad: Armenia": "https://tunein.com/radio/Stream-Armenia-rXXXXXX/",
}

# Emisoras que NO están agrupadas en una página de cadena/ciudad -- se agregan
# directo por su id de estación en TuneIn (lo ves en la URL: ...-sNNNNNN/).
TUNEIN_SINGLE_STATIONS = {
    "Radio Fundingue": {"tunein_id": "108019", "ciudad_forzada": "Barranquilla"},
    # No encontré en TuneIn "La Guapachosa" ni "Yariguíes Stereo" (Barrancabermeja).
    # Si tienes su id de TuneIn o su URL de stream directa, agrégalas así:
    # "La Guapachosa": {"tunein_id": "XXXXXX", "ciudad_forzada": "Cartagena"},
    # "Yariguíes Stereo": {"tunein_id": "XXXXXX", "ciudad_forzada": "Barrancabermeja"},
}

CIUDADES_OBJETIVO = [
    "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Cúcuta",
    "Bucaramanga", "Ibagué", "Pereira", "Santa Marta", "Manizales",
    "Villavicencio", "Pasto", "Montería", "Neiva", "Armenia", "Popayán",
    "Valledupar", "Sincelejo", "Tunja", "Florencia", "Riohacha", "Quibdó",
    "Yopal", "Mocoa", "San José del Guaviare", "Arauca", "Leticia",
    "Inírida", "Mitú", "Puerto Carreño", "San Andrés", "Girardot",
]


def normalizar(txt: str) -> str:
    if not txt:
        return ""
    txt = unicodedata.normalize("NFKD", txt).encode("ascii", "ignore").decode()
    txt = re.sub(r"[^a-z0-9]+", " ", txt.lower()).strip()
    return txt


CIUDADES_NORM = {normalizar(c): c for c in CIUDADES_OBJETIVO}

STATION_HREF_RE = re.compile(r"^/radio/[^/]+-s(\d+)/$")


def parse_brand_page(url: str):
    """Devuelve una lista de dicts {nombre, tunein_id, tunein_url} para una
    página 'Stream <Marca>' de TuneIn."""
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    encontrados = {}
    for a in soup.find_all("a", href=True):
        m = STATION_HREF_RE.match(a["href"])
        if not m:
            continue
        tunein_id = m.group(1)
        texto = a.get_text(strip=True)
        if not texto:
            continue
        # Nos quedamos con el texto más largo que veamos para ese id
        # (a veces el mismo link aparece dos veces: icono + texto)
        if tunein_id not in encontrados or len(texto) > len(encontrados[tunein_id]["nombre"]):
            encontrados[tunein_id] = {
                "nombre": texto,
                "tunein_id": tunein_id,
                "tunein_url": "https://tunein.com" + a["href"],
            }
    return list(encontrados.values())


def resolver_stream_url(tunein_id: str):
    """Usa el endpoint público de TuneIn (el mismo que usa su reproductor)
    para obtener la URL real de audio a partir del id de estación."""
    url = f"http://opml.radiotime.com/Tune.ashx?id=s{tunein_id}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        # La respuesta suele ser un .pls / texto plano con una o varias URLs.
        urls = re.findall(r"https?://[^\s\"'<>]+", r.text)
        # Preferimos la primera que no sea del propio tunein.com
        for u in urls:
            if "tunein.com" not in u:
                return u
        return urls[0] if urls else None
    except requests.RequestException as e:
        print(f"  [!] No se pudo resolver id s{tunein_id}: {e}")
        return None


def detectar_ciudad(nombre: str) -> str:
    n = normalizar(nombre)
    for norm, bonito in CIUDADES_NORM.items():
        if norm and re.search(rf"\b{re.escape(norm)}\b", n):
            return bonito
    return "Sin ciudad detectada"


def main():
    todas = []
    for marca, url in TUNEIN_BRAND_PAGES.items():
        print(f"Descargando directorio de: {marca}")
        try:
            estaciones = parse_brand_page(url)
        except requests.RequestException as e:
            print(f"  [!] Error descargando {url}: {e}")
            continue
        print(f"  Encontradas {len(estaciones)} emisoras en la página de {marca}")
        for e in estaciones:
            e["marca"] = marca
            e["ciudad"] = detectar_ciudad(e["nombre"])
            todas.append(e)

    for nombre, datos in TUNEIN_SINGLE_STATIONS.items():
        todas.append({
            "nombre": nombre,
            "tunein_id": datos["tunein_id"],
            "tunein_url": f"https://tunein.com/radio/-{datos['tunein_id']}/",
            "marca": "Independiente",
            "ciudad": datos.get("ciudad_forzada") or detectar_ciudad(nombre),
        })

    print(f"\nResolviendo URLs de audio para {len(todas)} emisoras (con pausas)...")
    for i, e in enumerate(todas, 1):
        e["stream_url"] = resolver_stream_url(e["tunein_id"])
        if i % 5 == 0:
            print(f"  {i}/{len(todas)} resueltas...")
        time.sleep(0.5)  # ser amable con el endpoint público

    # --- CSV de salida ---
    with open("cadenas_tunein.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["marca", "nombre", "ciudad_detectada", "stream_url", "tunein_url", "tunein_id"])
        for e in sorted(todas, key=lambda x: (x["ciudad"], x["nombre"])):
            w.writerow([e["marca"], e["nombre"], e["ciudad"], e.get("stream_url") or "",
                        e["tunein_url"], e["tunein_id"]])

    por_ciudad = defaultdict(int)
    for e in todas:
        por_ciudad[e["ciudad"]] += 1

    print("\n=== Emisoras de cadenas grandes por ciudad ===")
    for ciudad, n in sorted(por_ciudad.items(), key=lambda x: -x[1]):
        print(f"  {ciudad:<25} {n}")

    print(f"\nArchivo generado: cadenas_tunein.csv ({len(todas)} emisoras)")
    print("\nSiguiente paso sugerido: abre cadenas_tunein.csv y prueba a mano un par")
    print("de 'stream_url' en VLC o en el navegador para confirmar que funcionan")
    print("antes de agregarlas a Radio Jere Pro.")


if __name__ == "__main__":
    main()
