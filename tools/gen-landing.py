import re, os, sys
D = os.environ['JCODE_SCRATCH_DIR'] + '/design/'
R = '/Users/muri/Repos/SbSQLTT/'
src = open(D + 'Website v11.dc.html', encoding='utf-8').read().split('\n')
css = '\n'.join(src[12:178])  # inside <style> (lines 12..179 exclusive)
assert css.lstrip().startswith('@font-face'), css[:40]
html = '\n'.join(src[182:246])
js = open(D + 'website-v11.js', encoding='utf-8').read()
# Studio-Demo laeuft mit der echten Engine (SQLite + Pruefung der Lektion), wenn die Seite sie bereitstellt
_old = "button.addEventListener('click',execute);query.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();execute();}});"
assert _old in js
js = js.replace(_old, "button.addEventListener('click',()=>window.SbExecute?window.SbExecute():execute());query.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();window.SbExecute?window.SbExecute():execute();}});")
assert 'SbExecute' in js, 'hook not applied'

# --- HTML: Links/Assets an echte Routen anpassen
rep = {
 'href="Lektionsuebersicht A2.dc.html"': 'href="/learn"',
 'href="Datensaetze A3 B3 B4.dc.html"': 'href="/datasets"',
 'src="assets/owl-svg/': 'src="/edgar/',
 'mailto:kontakt@sbsqltt.de': 'mailto:kontakt@tabulasql.de',
 '>kontakt@sbsqltt.de<': '>kontakt@tabulasql.de<',
 'href="Konto C.dc.html"': 'href="/login"',
 'href="#impressum"': 'href="/impressum"',
 'href="#datenschutzerklaerung"': 'href="/datenschutz"',
}
for a, b in rep.items(): html = html.replace(a, b)
# Wortwahl: "Schueler" statt "Lernende" (Dativ Plural: "den Schuelern")
html = html.replace('den Lernenden', 'den Schülern').replace('Lernende', 'Schüler')
assert 'Lernend' not in html
# Echter QR-Code (SVG, zeigt auf die Website) statt Schachbrett-Platzhalter
qr = open(R + 'static/qr-tabula.svg', encoding='utf-8').read()
qr = qr[qr.index('<svg'):].replace('<svg ', '<svg class="t-qr-svg" role="img" aria-label="QR-Code zu www.tabulasql.de" ', 1)
html = html.replace('<span class="t-qr" aria-hidden="true"></span>', '<span class="t-qr t-qr-real">' + qr + '</span>')
assert 't-qr-real' in html

# ---- Mockups mit echten Inhalten (aus tools/landing-data.json, erzeugt aus Datensatz + Lektionen + Pruefung)
import json, html as H
D_ = json.load(open(R + 'tools/landing-data.json', encoding='utf-8'))
def sub(old, new, count=1):
    global html
    assert old in html, old[:80]
    html = html.replace(old, new, count)
def between(a, b, new):
    global html
    i = html.index(a) + len(a); j = html.index(b, i)
    html = html[:i] + new + html[j:]
e = H.escape
# Hero: echte books-Tabelle (6 Zeilen), herausgefilterte Zeilen markiert
# Python 3.9: keine Backslashes in f-string-Ausdruecken -> Hilfsfunktionen
def _data_row(t, y):
    old_attr = '' if y > D_['keepYear'] else ' data-old=""'
    return '<div class="motion-data-row"' + old_attr + '><span>' + e(t) + '</span><b>' + str(y) + '</b></div>'
rows = ''.join(_data_row(t, y) for t, y in D_['books'])
between('<div class="motion-table-label"><span>TITLE</span><span>YEAR</span></div>', '</div>\n<div class="motion-query">', rows)
sub('<strong>books</strong><span>5 Zeilen</span>', '<strong>books</strong><span>' + str(len(D_['books'])) + ' Zeilen</span>')
res = ''.join('<div class="motion-result-row"><span>' + e(t) + '</span><b>' + str(y) + '</b></div>' for t, y in D_['result'])
between('<strong>Ergebnis</strong><span>3 Treffer</span></div>', '<div class="motion-output-footer">', res)
sub('<strong>Ergebnis</strong><span>3 Treffer</span>', '<strong>Ergebnis</strong><span>' + str(len(D_['result'])) + ' Treffer</span>')
# Studio: echte Aufgabe, Schritt, Schema und Lektionsliste
st = D_['studio']
sub('<h3>Welche Bücher sind nach 2010 erschienen?</h3><p>Zeige Titel und Jahr. Sortiere die ältesten zuerst.</p></div><span>Schritt 2 / 5</span>',
    '<h3>' + e(st['task']) + '</h3><p>' + e(st['taskSub']) + '</p></div><span>Schritt ' + str(st['stepNo']) + ' / ' + str(st['stepOf']) + '</span>')
def _schema_col(c):
    sel = ' selected' if c['name'] in ('title', 'year') else ''
    key = c.get('key') or c['type']
    return '<div class="schema-column' + sel + '"><span>' + e(c['name']) + '</span><small>' + e(key) + '</small></div>'
cols = ''.join(_schema_col(c) for c in D_['schemaBooks'])
between('<div class="schema-title"><i aria-hidden="true"></i>books</div>', '</aside>', cols)
def _sidebar_item(l):
    active = ' active' if l['no'] == st['lessonNo'] else ''
    num = '\u2713' if l['no'] < st['lessonNo'] else '{:02d}'.format(l['no'])
    return '<div class="sidebar-item' + active + '"><span>' + num + '</span>' + e(l['title']) + '</div>'
items = ''.join(_sidebar_item(l) for l in D_['lessons'])
between('<span class="section-label" style="padding-left:10px">SQL-Grundlagen</span>', '<div class="sidebar-caption">', items)
sub('<h4>Ein Tipp von Edgar</h4><p>Mit <code>WHERE year &gt; 2010</code> bleiben die neueren Bücher übrig. <code>ORDER BY year</code> bringt sie in aufsteigende Reihenfolge.</p>',
    '<h4>Ein Tipp von Edgar</h4><p>' + e(st['tip']) + '</p>')
# Hinweis-Panel: echte Rueckmeldung der Pruefung auf diese Abfrage
sub('<span class="blue" style="font-size:10px">Lektion 2</span>', '<span class="blue" style="font-size:10px">Lektion ' + str(D_['hint']['lesson']) + '</span>')
sub('<div class="explanation"><strong>Die richtigen Bücher hast du schon.</strong><br>Die Aufgabe fragt auch nach dem Jahr. Ergänze <code>year</code> in der SELECT-Zeile, getrennt durch ein Komma.</div>',
    '<div class="explanation"><strong>Noch nicht ganz.</strong><br>' + e(D_['hint']['sub']) + '</div>')
# JOIN-Ergebnis aus echter Abfrage
jr = ''.join('<div class="join-combined-row"><span>' + e(t) + '</span><strong>' + e(n) + '</strong></div>' for t, n in D_['joinResult'])
between('<span>Gemeinsames Ergebnis</span><span>✓ 3 Zeilen</span></div>', '</div></div><div class="join-visual-footer">', jr)
sub('<span>Gemeinsames Ergebnis</span><span>✓ 3 Zeilen</span>', '<span>Gemeinsames Ergebnis</span><span>✓ ' + str(len(D_['joinResult'])) + ' Zeilen</span>')
sub('<span>O\u2019Reilly Media</span>', '<span>' + e(D_['publishers'][1][1]) + '</span>')
# Lehrkraft-Detail: echte Aufgabe + echte Rueckmeldung
th = D_['teacherHelp']
sub('<p class="t-task">Zeige zu jedem Buch den Namen des Verlags.</p>', '<p class="t-task">' + e(th['task']) + '</p>')
sub('<div class="t-error">Nach JOIN fehlt die Bedingung mit ON.</div>', '<div class="t-error">' + e(th['msg']) + '</div>')
# Letzte Abfrage: echter typischer Fehler genau dieser Uebung (Schluesselwoerter fett wie im Design)
_q = '<br>'.join(re.sub(r'\b(SELECT|FROM|JOIN|WHERE|ON|GROUP BY|ORDER BY)\b', r'<b>\1</b>', e(line)) for line in th['query'].split('\n'))
sub('<div class="t-codeblock"><b>SELECT</b> b.title, p.name<br><b>FROM</b> books b<br><b>JOIN</b> publishers p;</div>', '<div class="t-codeblock">' + _q + '</div>')
html = re.sub(r'href="[^"#/:]+\.dc\.html"', 'href="/learn"', html)
assert '.dc.html' not in html, re.findall(r'.{40}\.dc\.html', html)[:3]
# Inline-Farbe aus der Designer-Lieferung entfernen, damit das Kontrast-Blau aus dem CSS gilt
html = html.replace('class="button primary" style="background-color: #3B82F6"', 'class="button primary"')
open(R + 'src/lib/landing/v11.html', 'w', encoding='utf-8').write(html)
open(R + 'src/lib/landing/v11.css', 'w', encoding='utf-8').write(css + '\n/* Echter QR-Code: immer dunkle Module auf hellem Grund, auch im Dark Mode (scannbar) */\n.t-qr.t-qr-real{background:#fff;opacity:1;padding:8px;box-sizing:border-box;display:block}.t-qr-svg{width:100%;height:100%;display:block}\n'
  # Kontrast (29.10.2026, gleiches Blau wie --accent in theme.css): Weiß auf #2563eb 5,17:1, Blau auf Weiß ebenso;
  # Hover #1d4ed8 6,70:1. Vorher #3B82F6 mit 3,67:1 (unter WCAG AA 4,5:1).
  '\n:root,[data-theme="dark"],[data-theme="light"]{--primary:#2563EB}\n[data-theme="light"]{--blue:#2563EB}\n'
  '.button.primary{background:#2563EB;border-color:#2563EB}\n.button.primary:hover{background:#1D4ED8;border-color:#1D4ED8;box-shadow:0 5px 15px -5px #2563EB88}\n'
  # Ergebnis-Karte (.motion-output, absolut positioniert) ragt bis ~110px unter den Hero hinaus und wurde vom Studio
  # verdeckt. Platz unter der Animation reservieren, damit das Studio darunter beginnt (24px Abstand).
  '\n.motion-hero{padding-bottom:132px}\n@media(max-width:1100px){.motion-hero{padding-bottom:124px}}\n@media(max-width:760px){.motion-hero{padding-bottom:116px}}\n')
open(R + 'src/lib/landing/v11-site.js', 'w', encoding='utf-8').write('// @ts-nocheck\n// Startseite v11, Verhalten 1:1 aus der Designer-Lieferung (website-v11.js).\n' + js)
print(len(html), len(css), len(js))
open(R + 'src/lib/landing/v11-site.js','a').write('\nexport {};\n')
