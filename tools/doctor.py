"""Doktor modeli Tornado.io bez okna (Playwright + SwiftShader): otwiera tools/doctor.html, czeka na wszystkie modele
i wypisuje wyniki (logika doktora — kopia z GameLaboratory: tools/doctor/modeldoctor.js).
  python3 tools/doctor.py             # wszystkie modele
  python3 tools/doctor.py streets/    # tylko modele, których id zaczyna się od podanego
Kod wyjścia 1, gdy jest błąd (severity error), model się nie zbudował albo strona zgłosiła błąd."""
import os, sys, time, subprocess
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8781

def main():
    only = next((a for a in sys.argv[1:] if not a.startswith('-')), '')
    errs = []
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            pg = b.new_page(bypass_csp=True)
            pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
            pg.on('console', lambda m: errs.append(m.type + ' ' + m.text) if m.type == 'error' else None)
            pg.goto(f'http://localhost:{PORT}/tools/doctor.html' + (f'?only={only}' if only else ''))
            pg.wait_for_function('window.doctorReport && window.doctorReport.done', timeout=1800000)
            rep = pg.evaluate('window.doctorReport')
            b.close()
    finally:
        srv.kill()
    bad = 0
    for mid, r in rep['models'].items():
        if r.get('error'): print(f'\n{mid}: BUILD FAILED\n  {r["error"][:400]}'); bad += 1; continue
        fp = r['fingerprint']
        print(f'\n{mid}  ({r["label"]})  {r["stats"]["meshes"]} części, {fp["triangles"]:,} trójkątów, {fp["drawCalls"]} wywołań, {r["ms"]} ms')
        for f in r['findings']:
            print(f'  {f["severity"][0].upper()} {f["check"]:<10} {f["detail"][:160]}')
            print(f'               {" ; ".join(f["parts"])[:160]}')
            if f['severity'] == 'error': bad += 1
        if not r['findings']: print('  czysto')
    for e in errs: print('STRONA:', e[:300])
    print(f'\n{len(rep["models"])} modeli, błędów: {bad}')
    sys.exit(1 if bad or errs else 0)

main()
