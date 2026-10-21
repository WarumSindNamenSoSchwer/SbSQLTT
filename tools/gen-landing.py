import re, os, sys
D = os.environ['JCODE_SCRATCH_DIR'] + '/design/'
R = '/Users/muri/Repos/SbSQLTT/'
src = open(D + 'Website v11.dc.html', encoding='utf-8').read().split('\n')
css = '\n'.join(src[12:178])  # inside <style> (lines 12..179 exclusive)
assert css.lstrip().startswith('@font-face'), css[:40]
html = '\n'.join(src[182:246])
js = open(D + 'website-v11.js', encoding='utf-8').read()

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
html = re.sub(r'href="[^"#/:]+\.dc\.html"', 'href="/learn"', html)
assert '.dc.html' not in html, re.findall(r'.{40}\.dc\.html', html)[:3]
open(R + 'src/lib/landing/v11.html', 'w', encoding='utf-8').write(html)
open(R + 'src/lib/landing/v11.css', 'w', encoding='utf-8').write(css)
open(R + 'src/lib/landing/v11-site.js', 'w', encoding='utf-8').write('// @ts-nocheck\n// Startseite v11, Verhalten 1:1 aus der Designer-Lieferung (website-v11.js).\n' + js)
print(len(html), len(css), len(js))
open(R + 'src/lib/landing/v11-site.js','a').write('\nexport {};\n')
