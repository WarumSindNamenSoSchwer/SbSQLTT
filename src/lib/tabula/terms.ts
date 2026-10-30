// Inhalt der Nutzungsbedingungen. Jede Aussage hat Quellen-IDs (src), wie bei privacy.ts.
// [R…] Rechtsquelle, [T…] eigene technische Prüfung am Quellcode, [P…] privacy.ts/Datenschutzerklärung,
// [A…] Anbieter- oder Behördendokument. Protokoll und Begründung: docs/NUTZUNGSBEDINGUNGEN-QUELLEN.md
// Die Quellen werden auf der Website NICHT angezeigt.
//
// ENTWURF zur anwaltlichen Prüfung (docs/ANWALT-FRAGEN.md Frage 10). Offline nehmen: LIVE = false.
// Dann liefert /nutzungsbedingungen eine 404-Seite, alle Links und der Hinweis bei der Registrierung
// verschwinden automatisch (sie lesen dieselbe Konstante).

export const LIVE = true;
export const STAND = '30. Oktober 2026';

export type Block = { p?: string; list?: string[]; src: string[] };
export type Section = { id: string; title: string; blocks: Block[] };

export const SECTIONS: Section[] = [
	{
		id: 'geltung',
		title: 'Worum es geht',
		blocks: [
			{
				p: 'Diese Nutzungsbedingungen regeln die Nutzung von Tabula unter www.tabulasql.de und app.tabulasql.de. Anbieter ist Murat-Can Meric (Kontaktdaten im Impressum). Tabula ist ein kostenloses, nicht kommerzielles Lernangebot für SQL im Informatikunterricht.',
				src: ['R1', 'T1', 'P1']
			},
			{
				p: 'Die Bedingungen gelten für Lehrkräfte, die ein Konto anlegen, und für Schüler, die einer Klasse beitreten. Wer Tabula ohne Anmeldung ausprobiert, schließt keinen Vertrag mit uns. Für diese Nutzung gelten nur die Hinweise auf dieser Seite zu Inhalten und Haftung.',
				src: ['R1', 'R2', 'T2']
			},
			{
				p: 'Wie wir mit Daten umgehen, steht in der Datenschutzerklärung. Sie ist kein Teil dieser Bedingungen und gilt unabhängig davon.',
				src: ['P1', 'R3']
			}
		]
	},
	{
		id: 'leistung',
		title: 'Was Tabula bietet',
		blocks: [
			{
				p: 'Tabula ist kostenlos. Es gibt keine Bezahlstufen, keine Werbung und keine kostenpflichtigen Zusatzfunktionen. Wir verlangen dafür keine Gegenleistung, auch nicht in Form von Daten für andere Zwecke.',
				src: ['T1', 'P2', 'R4']
			},
			{
				list: [
					'Lektionen und Übungsdatenbanken für SQL, die vollständig im Browser laufen.',
					'Für Lehrkräfte: Klassen anlegen, Lernstand der Klasse sehen, Lektionen freischalten, Live-Quiz am Beamer.',
					'Für Schüler: einer Klasse mit Klassencode beitreten und den Lernfortschritt sichern.',
					'Datensätze zum Herunterladen für eigene Projekte.'
				],
				src: ['T3']
			},
			{
				p: 'Weil Tabula kostenlos ist und von einer Einzelperson betrieben wird, können wir keine bestimmte Verfügbarkeit zusagen. Wir bemühen uns um einen störungsfreien Betrieb, kündigen geplante Wartungen nach Möglichkeit an und dürfen Funktionen weiterentwickeln, ändern oder einstellen. Wichtige Einschränkungen, etwa das Einstellen des Dienstes, kündigen wir angemeldeten Lehrkräften mindestens vier Wochen vorher per E-Mail an, damit sie ihre Daten sichern können.',
				src: ['R4', 'R5', 'R6']
			}
		]
	},
	{
		id: 'konto',
		title: 'Konten und Anmeldung',
		blocks: [
			{
				p: 'Lehrkräfte legen ein Konto mit Name, E-Mail-Adresse und Passwort an. Der Vertrag über die Nutzung kommt zustande, wenn Sie bei der Registrierung diese Nutzungsbedingungen bestätigen und das Konto angelegt ist.',
				src: ['R2', 'T4']
			},
			{
				p: 'Schüler haben kein Konto mit E-Mail-Adresse. Sie treten mit dem Klassencode ihrer Lehrkraft einer Klasse bei und wählen selbst Name und Passwort. Mit dem Beitritt gelten diese Bedingungen auch für sie.',
				src: ['T5', 'P3']
			},
			{
				p: 'Halten Sie Ihr Passwort und den Wiederherstellungscode geheim. Wer Zugangsdaten weitergibt, ist für die Nutzung damit verantwortlich. Bemerken Sie, dass jemand anderes Ihr Konto nutzt, schreiben Sie uns bitte sofort.',
				src: ['R7', 'T4']
			},
			{
				p: 'Vergisst eine Lehrkraft ihr Passwort und hat den Wiederherstellungscode nicht mehr, können wir die verschlüsselten Schülernamen nicht wiederherstellen. Die Namen erscheinen wieder, sobald sich die Schüler das nächste Mal anmelden.',
				src: ['T6', 'P3']
			}
		]
	},
	{
		id: 'lehrkraefte',
		title: 'Pflichten der Lehrkräfte',
		blocks: [
			{
				list: [
					'Nutzen Sie Tabula nur für Ihren eigenen Unterricht und laden Sie nur Schüler ein, die Sie unterrichten.',
					'Geben Sie den Klassencode nur an Ihre Klasse und den Einmal-Code für ein vergessenes Passwort nur an den betroffenen Schüler weiter.',
					'Klären Sie vor dem Einsatz im Unterricht, ob Ihre Schule oder Schulaufsicht dem Einsatz zugestimmt hat. Nach Auffassung der Datenschutzaufsichtsbehörden entscheidet die Schule über den Einsatz von Online-Lernplattformen und ist dann für die Daten verantwortlich.',
					'Fragensätze für das Quiz dürfen keine Inhalte enthalten, die Rechte anderer verletzen oder gegen Gesetze verstoßen, und keine personenbezogenen Daten von Schülern.'
				],
				src: ['A1', 'R8', 'R9', 'T7']
			},
			{
				p: 'Setzt Ihre Schule Tabula verbindlich ein, schließen wir mit der Schule auf Anfrage einen Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO. Schreiben Sie uns dazu über die Kontaktseite.',
				src: ['A1', 'R9', 'P4']
			}
		]
	},
	{
		id: 'regeln',
		title: 'Was nicht erlaubt ist',
		blocks: [
			{
				list: [
					'Tabula für etwas anderes als Lernen und Unterricht zu nutzen, etwa für Werbung oder zum Sammeln von Daten.',
					'Den Dienst zu stören, zu überlasten oder Schutzmaßnahmen zu umgehen, zum Beispiel durch automatisierte Massenanfragen oder das Durchprobieren von Klassencodes und Passwörtern.',
					'Sich als jemand anderes auszugeben oder ohne Berechtigung auf fremde Klassen zuzugreifen.',
					'In Namen oder selbst erstellten Fragen beleidigende, diskriminierende oder rechtswidrige Inhalte zu verwenden.'
				],
				src: ['R7', 'R10', 'T8']
			},
			{
				p: 'Sicherheitslücken melden Sie bitte an kontakt@tabulasql.de, statt sie auszunutzen. Wer eine Lücke verantwortungsvoll meldet, hat von uns nichts zu befürchten.',
				src: ['T9']
			}
		]
	},
	{
		id: 'inhalte',
		title: 'Eigene Inhalte und Meldungen',
		blocks: [
			{
				p: 'Eigene Inhalte sind bei Tabula nur Fragensätze für das Quiz und die Namen von Klassen. Sie sehen nur die Lehrkraft und die eigene Klasse. Sie behalten alle Rechte daran. Sie erlauben uns, die Inhalte zu speichern und Ihnen und Ihrer Klasse anzuzeigen, solange Sie sie in Tabula nutzen.',
				src: ['T7', 'R11']
			},
			{
				p: 'Wir prüfen eigene Inhalte nicht vorab und setzen keine automatischen Filter ein. Halten Sie einen Inhalt in Tabula für rechtswidrig, melden Sie ihn bitte per E-Mail an kontakt@tabulasql.de oder über die Kontaktseite. Nennen Sie dabei, wo der Inhalt steht, warum er rechtswidrig ist, und Ihren Namen und Ihre E-Mail-Adresse. Wir prüfen jede Meldung durch einen Menschen, entfernen rechtswidrige Inhalte zügig und teilen Ihnen das Ergebnis mit. Betroffene Lehrkräfte informieren wir mit Begründung und können dazu Stellung nehmen.',
				src: ['R12', 'R13', 'R14', 'T7']
			},
			{
				p: 'Zentrale Kontaktstelle für Nutzer und Behörden ist kontakt@tabulasql.de. Wir antworten auf Deutsch und Englisch.',
				src: ['R15', 'P1']
			}
		]
	},
	{
		id: 'rechte',
		title: 'Rechte an Tabula',
		blocks: [
			{
				p: 'Der Quellcode von Tabula ist Open Source unter der GNU Affero General Public License 3.0 (AGPL-3.0) und auf GitHub veröffentlicht. Für den Code gilt allein diese Lizenz, auch für Kopien und Weiterentwicklungen.',
				src: ['T10', 'A2']
			},
			{
				p: 'Lektionstexte, Übungen und Datensätze sind Teil des Quellcodes und stehen damit ebenfalls unter der AGPL-3.0. Die Datensätze sind reine Übungsdaten. Personen, Kunden und Messwerte sind erfunden, Ähnlichkeiten mit echten Personen sind nicht beabsichtigt. Einige Buchtitel und Autoren stammen aus der echten Fachliteratur, Preise, Seitenzahlen und Bestände dienen nur der Übung. Name und Logo von Tabula sowie die Figur Edgar dürfen Sie für den Unterricht und Berichte über Tabula verwenden, aber nicht so, dass der Eindruck entsteht, ein anderes Angebot stamme von uns.',
				src: ['T10', 'T11', 'A2']
			}
		]
	},
	{
		id: 'haftung',
		title: 'Haftung',
		blocks: [
			{
				p: 'Tabula ist ein Lernangebot. Lösungen und Hinweise sollen beim Lernen helfen. Für Prüfungen und Noten ist allein die Lehrkraft verantwortlich, Tabula vergibt keine Noten.',
				src: ['T3', 'T12']
			},
			{
				p: 'Weil wir Tabula unentgeltlich bereitstellen, haften wir nur für Vorsatz und grobe Fahrlässigkeit. Das entspricht der gesetzlichen Haftung bei unentgeltlichen Leistungen.',
				src: ['R4', 'R5', 'R16']
			},
			{
				p: 'Unberührt bleibt die Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, nach dem Produkthaftungsgesetz und soweit wir einen Mangel arglistig verschwiegen haben.',
				src: ['R16', 'R17', 'R18']
			},
			{
				p: 'Bitte sichern Sie wichtige eigene Inhalte, etwa Fragensätze, zusätzlich selbst. Wir sichern die Daten regelmäßig, können aber nicht ausschließen, dass Daten verloren gehen.',
				src: ['T13']
			}
		]
	},
	{
		id: 'ende',
		title: 'Laufzeit, Kündigung, Löschung',
		blocks: [
			{
				p: 'Die Nutzung ist unbefristet. Lehrkräfte können ihr Konto jederzeit im Profil löschen. Dabei werden auch ihre Klassen, die Fortschritte der Schüler und ihre Fragensätze gelöscht. Schüler können ihre Klasse jederzeit im Profil verlassen, dabei werden ihre Daten gelöscht.',
				src: ['T14', 'P3']
			},
			{
				p: 'Konten, die zwölf Monate nicht genutzt wurden, löschen wir automatisch. Lehrkräfte erinnern wir 30 Tage vorher per E-Mail. Mit dem Konto einer Lehrkraft werden auch ihre Klassen und die Daten ihrer Schüler gelöscht.',
				src: ['T15', 'P5']
			},
			{
				p: 'Wir können die Nutzung mit einer Frist von vier Wochen beenden, etwa wenn wir Tabula einstellen. Verstößt jemand schwerwiegend gegen diese Bedingungen, können wir ein Konto auch ohne Frist sperren oder löschen. Vorher geben wir nach Möglichkeit Gelegenheit, den Verstoß zu beenden.',
				src: ['R19', 'R6']
			}
		]
	},
	{
		id: 'aenderungen',
		title: 'Änderungen dieser Bedingungen',
		blocks: [
			{
				p: 'Wenn wir diese Bedingungen ändern, informieren wir angemeldete Lehrkräfte vorher per E-Mail und bei der nächsten Anmeldung. Wesentliche Änderungen gelten erst, wenn Sie ihnen ausdrücklich zustimmen. Stimmen Sie nicht zu, können Sie Ihr Konto löschen. Schweigen gilt nicht als Zustimmung.',
				src: ['R20', 'R13']
			}
		]
	},
	{
		id: 'schluss',
		title: 'Schlussbestimmungen',
		blocks: [
			{
				p: 'Es gilt deutsches Recht. Für Verbraucher gilt dies nur, soweit dadurch nicht der Schutz zwingender Vorschriften des Staates entzogen wird, in dem sie ihren gewöhnlichen Aufenthalt haben.',
				src: ['R21']
			},
			{
				p: 'Sollte eine Bestimmung unwirksam sein, bleiben die übrigen wirksam. An die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung.',
				src: ['R22']
			},
			{
				p: 'Wir nehmen nicht an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teil und sind dazu auch nicht verpflichtet.',
				src: ['R23']
			}
		]
	}
];

export type Source = { id: string; label: string; url?: string };

export const SOURCES: Source[] = [
	// Rechtsquellen
	{ id: 'R1', label: '§ 305 Abs. 1 BGB (Begriff Allgemeine Geschäftsbedingungen)', url: 'https://www.gesetze-im-internet.de/bgb/__305.html' },
	{ id: 'R2', label: '§ 305 Abs. 2 BGB (Einbeziehung: Hinweis, zumutbare Kenntnisnahme, Einverständnis bei Vertragsschluss)', url: 'https://www.gesetze-im-internet.de/bgb/__305.html' },
	{ id: 'R3', label: 'Art. 13 DSGVO (Informationspflicht, unabhängig von Vertragsbedingungen)', url: 'https://dsgvo-gesetz.de/art-13-dsgvo/' },
	{ id: 'R4', label: '§ 516 ff. BGB (Schenkung) und § 598 BGB (Leihe): unentgeltliche Gebrauchsüberlassung; Einordnung kostenloser Onlinedienste offen, siehe Protokoll', url: 'https://www.gesetze-im-internet.de/bgb/__598.html' },
	{ id: 'R5', label: '§ 521 BGB (Schenker hat nur Vorsatz und grobe Fahrlässigkeit zu vertreten), § 599 BGB (gleich für Verleiher)', url: 'https://www.gesetze-im-internet.de/bgb/__521.html' },
	{ id: 'R6', label: '§ 307 Abs. 1 und 2 BGB (Inhaltskontrolle, Transparenzgebot; einseitiger Änderungs- und Einstellungsvorbehalt nur mit Grund und Vorlauf)', url: 'https://www.gesetze-im-internet.de/bgb/__307.html' },
	{ id: 'R7', label: '§ 241 Abs. 2 BGB (Rücksichtnahmepflichten aus dem Schuldverhältnis)', url: 'https://www.gesetze-im-internet.de/bgb/__241.html' },
	{ id: 'R8', label: 'Art. 4 Nr. 7 DSGVO (Verantwortlicher)', url: 'https://dsgvo-gesetz.de/art-4-dsgvo/' },
	{ id: 'R9', label: 'Art. 28 DSGVO (Auftragsverarbeiter, Vertrag)', url: 'https://dsgvo-gesetz.de/art-28-dsgvo/' },
	{ id: 'R10', label: '§ 202a StGB (Ausspähen von Daten), § 303b StGB (Computersabotage)', url: 'https://www.gesetze-im-internet.de/stgb/__202a.html' },
	{ id: 'R11', label: '§ 31 UrhG (Einräumung von Nutzungsrechten, Zweckübertragung)', url: 'https://www.gesetze-im-internet.de/urhg/__31.html' },
	{ id: 'R12', label: 'Art. 3 lit. g Ziff. iii DSA (Hostingdienst) und Art. 6 DSA (Haftung Hostingdienst)', url: 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32022R2065' },
	{ id: 'R13', label: 'Art. 14 Abs. 1 und 2 DSA (Angaben zu Beschränkungen und Moderation in den AGB, Information über wesentliche Änderungen)', url: 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32022R2065' },
	{ id: 'R14', label: 'Art. 16 und 17 DSA (Melde- und Abhilfeverfahren, Begründung gegenüber Betroffenen)', url: 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32022R2065' },
	{ id: 'R15', label: 'Art. 11 und 12 DSA (zentrale Kontaktstellen für Behörden und Nutzer)', url: 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32022R2065' },
	{ id: 'R16', label: '§ 309 Nr. 7 lit. a und b BGB (kein Haftungsausschluss für Leben, Körper, Gesundheit und grobes Verschulden)', url: 'https://www.gesetze-im-internet.de/bgb/__309.html' },
	{ id: 'R17', label: '§ 14 ProdHaftG (Haftung nach dem Produkthaftungsgesetz nicht abdingbar)', url: 'https://www.gesetze-im-internet.de/prodhaftg/__14.html' },
	{ id: 'R18', label: '§ 523 und § 524 BGB (Schenker haftet für arglistig verschwiegene Mängel)', url: 'https://www.gesetze-im-internet.de/bgb/__524.html' },
	{ id: 'R19', label: '§ 314 BGB (Kündigung von Dauerschuldverhältnissen aus wichtigem Grund, Abmahnung)', url: 'https://www.gesetze-im-internet.de/bgb/__314.html' },
	{ id: 'R20', label: 'BGH, Urteil vom 27.04.2021, XI ZR 26/20 (Zustimmungsfiktion bei AGB-Änderungen unwirksam)', url: 'https://juris.bundesgerichtshof.de/cgi-bin/rechtsprechung/document.py?Gericht=bgh&Art=en&nr=118565' },
	{ id: 'R21', label: 'Art. 6 Abs. 2 Rom-I-Verordnung (Rechtswahl bei Verbraucherverträgen)', url: 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32008R0593' },
	{ id: 'R22', label: '§ 306 Abs. 1 und 2 BGB (Rechtsfolgen bei Unwirksamkeit einzelner AGB)', url: 'https://www.gesetze-im-internet.de/bgb/__306.html' },
	{ id: 'R23', label: '§ 36 Abs. 1 Nr. 1 VSBG (Hinweis auf Teilnahme an Streitbeilegung; Pflicht erst ab mehr als 10 Beschäftigten, § 36 Abs. 3)', url: 'https://www.gesetze-im-internet.de/vsbg/__36.html' },
	// Behörden- und Anbieterdokumente
	{ id: 'A1', label: 'DSK, Orientierungshilfe für Online-Lernplattformen im Schulunterricht (Schule bzw. Schulaufsicht entscheidet über den Einsatz und ist verantwortlich; Auftragsverarbeitung)', url: 'https://www.datenschutzkonferenz-online.de/media/oh/20180426_oh_online_lernplattformen.pdf' },
	{ id: 'A2', label: 'GNU Affero General Public License v3.0', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
	// Datenschutzerklärung (privacy.ts)
	{ id: 'P1', label: 'privacy.ts: Verantwortlicher, Kontakt kontakt@tabulasql.de' },
	{ id: 'P2', label: 'privacy.ts: kein Tracking, keine Werbung, Daten nicht verkauft' },
	{ id: 'P3', label: 'privacy.ts / K1: Schüler ohne Konto, Klassen-Login, Name nur im Browser der Lehrkraft lesbar' },
	{ id: 'P4', label: 'privacy.ts / K12: Schule als Verantwortliche bei verbindlichem Einsatz, dann Vertrag nach Art. 28 DSGVO' },
	{ id: 'P5', label: 'privacy.ts / K8: Löschung nach 12 Monaten Inaktivität, Erinnerung 30 Tage vorher' },
	// Technische Prüfung am Quellcode
	{ id: 'T1', label: 'README.md, Startseite: kostenlos, Open Source, keine Bezahlstufen; kein Zahlungscode im Repo' },
	{ id: 'T2', label: 'src/lib/tabula/flags.ts, Lektionen ohne Anmeldung nutzbar, Fortschritt nur im Browser (lessons.ts)' },
	{ id: 'T3', label: 'src/routes: learn, teach, quiz, datasets; course/*.ts' },
	{ id: 'T4', label: 'server/src/routes/auth.ts: Registrierung mit Name, E-Mail, Passwort, terms_accepted (z.literal(true)), Wiederherstellungscode' },
	{ id: 'T5', label: 'server/src/routes/class-login.ts: Beitritt mit Klassencode, kein E-Mail-Feld' },
	{ id: 'T6', label: 'session.svelte.ts / keystore.ts: Schlüssel nur mit Passwort oder Wiederherstellungscode; needs_key_recovery' },
	{ id: 'T7', label: 'server/src/routes/quiz.ts: Fragensätze nur für die Lehrkraft (teacher_id), Quiz nur für die eigene Klasse' },
	{ id: 'T8', label: 'server/src/plugins/ratelimit.ts, class-login.ts: Begrenzung von Fehlversuchen und Beitritten' },
	{ id: 'T9', label: 'Kontakt kontakt@tabulasql.de (Impressum)' },
	{ id: 'T10', label: 'LICENSE: GNU AGPL v3; Repo github.com/WarumSindNamenSoSchwer/SbSQLTT' },
	{ id: 'T11', label: 'src/lib/tabula/course/data.ts, traffic-data.ts: Übungsdaten. Personen, Kunden und Messwerte erfunden, einige echte Fachbuchtitel (z. B. Refactoring, Clean Code) mit Übungswerten' },
	{ id: 'T12', label: 'Startseite und Quiz: Punkte nur im Quiz, keine Noten' },
	{ id: 'T13', label: 'deploy/tabula-backup.service/.timer, deploy/backup.sh: tägliche Sicherung' },
	{ id: 'T14', label: 'server/src/routes/auth.ts DELETE /me (löscht Klassen und Schüler), class-login.ts POST /student/leave' },
	{ id: 'T15', label: 'server/src/jobs.ts: INACTIVITY_LIMIT 365 Tage, Erinnerung 30 Tage vorher nur an Lehrkräfte' }
];
