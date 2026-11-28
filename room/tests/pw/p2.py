import sys, time, http.server, threading, functools
from playwright.sync_api import sync_playwright
root = sys.argv[1]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8768), functools.partial(Q, directory=root)); threading.Thread(target=srv.serve_forever, daemon=True).start()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg = b.new_page(viewport={'width': 1400, 'height': 1100})
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' ' + (e.stack or '')[:400]))
    pg.goto('http://127.0.0.1:8768/index.html'); pg.wait_for_timeout(1500)
    print('thr:', pg.inner_text('#blindthr'))
    pg.evaluate('''() => { document.querySelectorAll('#ori input').forEach((x, i) => { x.checked = (i === 4); }); document.querySelector('#ori').dispatchEvent(new Event('change', {bubbles:true}));
       document.querySelectorAll('#types input').forEach((x) => { x.checked = x.value === 'cellular'; }); document.querySelector('#types').dispatchEvent(new Event('change', {bubbles:true})); }''')
    pg.click('#run'); t0 = time.time(); last = ''
    while time.time() - t0 < 560:
        pg.wait_for_timeout(5000); s = pg.inner_text('#status')
        if s != last: last = s
        if 'running' not in s.lower() and 'search' not in s.lower() and time.time() - t0 > 20 and not pg.is_disabled('#savres'): break  # 0.12.0: the facade panel sits in its own tab
    pg.wait_for_timeout(45000); pg.click('#rtabs button:nth-child(2)'); pg.wait_for_timeout(3000); print('time', round(time.time() - t0), 's | status:', pg.inner_text('#status')[:200])
    b_=pg.inner_text('body'); print('VERDICT:', pg.inner_text('#v5verd')[:2500]); bl=b_.lower(); print('PKG:', b_[bl.find('other packages at this facade'):][:1900]); print('DEC:', b_[bl.find('keep at every facade'):][:1800]); pg.screenshot(path='p3.png', full_page=True); pg.screenshot(path='p2.png', full_page=False); print('coolsum:', pg.inner_text('#coolsum')[:700])
    print('ERRORS', errs); b.close()
srv.shutdown()
