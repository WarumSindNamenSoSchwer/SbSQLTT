// Inhalt der Datenschutzerklärung. Jede Aussage hat eine Quellen-ID (siehe SOURCES unten
// und docs/DATENSCHUTZ-QUELLEN.md). [T…] = eigene technische Prüfung, [R…] = Rechtsquelle,
// [A…] = Anbieter-Dokumentation. Platzhalter in {{…}} müssen vor Veröffentlichung gefüllt werden.

export const STAND = '21. Oktober 2026';

/** Verantwortlicher. Bis Name und Anschrift feststehen, bleibt die Seite als Entwurf markiert. */
export const CONTROLLER = {
	name: 'Murat-Can Meric',
	address: ['Lübecker Str. 45', '10559 Berlin', 'Deutschland'],
	email: 'kontakt@tabulasql.de',
	/** Erst auf true setzen, wenn der AV-Vertrag im Hetzner-Kundenkonto abgeschlossen ist (accounts.hetzner.com/account/dpa). */
	avv: true
};

export type Block = { p?: string; list?: string[]; src: string[]; needsAvv?: boolean };
export type Section = { id: string; title: string; blocks: Block[] };

export const SECTIONS: Section[] = [
	{
		id: 'ueberblick',
		title: 'Das Wichtigste in Kürze',
		blocks: [
			{
				list: [
					'Tabula setzt keine Cookies und bindet keine Inhalte, Schriften oder Skripte von fremden Servern ein. Dein Browser spricht beim Besuch nur mit www.tabulasql.de.',
					'Es gibt kein Tracking, keine Reichweitenmessung und keine Werbung.',
					'SQL-Abfragen und Übungsdatenbanken laufen vollständig in deinem Browser. Was du in den Editor schreibst, wird nicht an uns übertragen.',
					'Lernen geht ohne Konto. Wer ein Konto anlegt, braucht als Schüler nur Benutzername, Anzeigename und Passwort. Ein echter Name oder eine E-Mail-Adresse ist nicht nötig.',
					'Fortschritt sehen nur du und die Lehrkraft deiner Klasse. Daten werden nicht verkauft, nicht weitergegeben und nicht für Werbung genutzt.',
					'Der Server führt kein Zugriffsprotokoll über einzelne Seitenaufrufe. Technische Protokolle werden nach höchstens 14 Tagen gelöscht.'
				],
				src: ['T1', 'T2', 'T3', 'T5', 'T6', 'K1', 'K4', 'K9']
			}
		]
	},
	{
		id: 'verantwortlich',
		title: 'Verantwortlicher',
		blocks: [
			{
				p: 'Verantwortlich im Sinne von Art. 4 Nr. 7 DSGVO für die Datenverarbeitung auf dieser Website ist:',
				src: ['R1', 'R2']
			},
			{ p: '{{CONTROLLER}}', src: ['R2'] },
			{
				p: 'Ein Datenschutzbeauftragter ist nicht benannt, weil keiner der Fälle vorliegt, in denen das Gesetz eine Benennung verlangt (Art. 37 Abs. 1 DSGVO, § 38 Abs. 1 BDSG).',
				src: ['R9', 'R10']
			}
		]
	},
	{
		id: 'aufruf',
		title: 'Aufruf der Website',
		blocks: [
			{
				p: 'Wenn du eine Seite aufrufst, sendet dein Browser technisch bedingt Daten an unseren Server, unter anderem deine IP-Adresse, die angefragte Adresse, Datum und Uhrzeit sowie Angaben zu Browser und Betriebssystem (User-Agent). Ohne diese Daten kann der Server die Seite nicht ausliefern. Eine IP-Adresse kann ein personenbezogenes Datum sein.',
				src: ['T6', 'R1', 'R12']
			},
			{
				p: 'Diese Daten werden nur für die Auslieferung der Seite im Arbeitsspeicher verarbeitet. Ein Zugriffsprotokoll, also eine Liste aller Seitenaufrufe, führen wir nicht.',
				src: ['T6', 'A6']
			},
			{
				p: 'Der Webserver schreibt nur Betriebs- und Fehlermeldungen in eine Protokolldatei. Enthält eine Meldung eine IP-Adresse, wird sie vor dem Speichern gekürzt: Bei IPv4 bleiben die ersten 24 Bit erhalten, bei IPv6 die ersten 48 Bit. Die Datei wird täglich gewechselt und nach höchstens 14 Tagen gelöscht.',
				src: ['T7', 'A6']
			},
			{
				p: 'Zweck ist ein sicherer und stabiler Betrieb, zum Beispiel das Erkennen von Fehlern und Angriffen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt in der Sicherheit und Verfügbarkeit der Website. Die Netz- und Informationssicherheit ist als solches Interesse ausdrücklich anerkannt.',
				src: ['R3', 'R4', 'R13']
			}
		]
	},
	{
		id: 'hosting',
		title: 'Hosting und Verschlüsselung',
		blocks: [
			{
				p: 'Die Website läuft auf einem Cloud-Server der Hetzner Online GmbH, Industriestraße 25, 91710 Gunzenhausen, im Rechenzentrum Nürnberg (Standort nbg1, Netzwerkzone eu-central). Hetzner ist Auftragsverarbeiter im Sinne von Art. 28 DSGVO.',
				src: ['T8', 'A1', 'A2', 'R6']
			},
			{
				p: 'Mit Hetzner besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.',
				src: ['A1', 'R6', 'T9'],
				needsAvv: true
			},
			{
				p: 'Bei Cloud-Servern hat nur der Kunde Zugriff auf den Server. Hetzner hat keinen Einblick in die dort laufenden Funktionen. Bei Cloud-Produkten richtet sich der Speicherort nach dem gewählten Standort, hier Deutschland. Supportzugriffe erfolgen durch Teams innerhalb der EU.',
				src: ['A1', 'A3', 'T8']
			},
			{
				p: 'Alle Verbindungen sind per HTTPS (TLS) verschlüsselt. Das Zertifikat stammt von Let’s Encrypt. Aufrufe ohne „www“ werden auf https://www.tabulasql.de umgeleitet.',
				src: ['T10', 'R11']
			}
		]
	},
	{
		id: 'speicher',
		title: 'Speicherung in deinem Browser',
		blocks: [
			{
				p: 'Ohne Anmeldung setzt Tabula keine Cookies. Damit die Website funktioniert, wie du es erwartest, legt sie aber in bestimmten Fällen kleine Einträge im Speicher deines Browsers ab (Web Storage). Diese Einträge werden nicht an uns übertragen, mit einer Ausnahme: Beim ersten Anmelden übernehmen wir einmalig deinen Lernfortschritt in dein Konto.',
				src: ['T1', 'T11', 'K4']
			},
			{
				list: [
					'tabula-progress (localStorage): welche Lektionen und Schritte du erledigt hast. Wird erst angelegt, wenn du in einer Lektion auf „Weiter“ klickst.',
					'tabula-theme (localStorage): ob du die helle oder dunkle Darstellung gewählt hast. Wird erst angelegt, wenn du den Schalter benutzt.',
					'tabula-guest-hint (localStorage): dass du den Hinweis zur Anmeldung geschlossen hast. Wird erst angelegt, wenn du ihn schließt.',
					'sveltekit:scroll und sveltekit:snapshot (sessionStorage): Scrollposition beim Zurückblättern. Wird beim Wechsel zwischen Seiten angelegt und beim Schließen des Tabs gelöscht.'
				],
				src: ['T11', 'T12', 'A4', 'A5']
			},
			{
				p: 'Der localStorage bleibt erhalten, bis du ihn löschst, zum Beispiel über die Browser-Einstellungen „Website-Daten löschen“. Im privaten Modus löscht der Browser ihn beim Schließen des letzten privaten Fensters.',
				src: ['A4', 'A5']
			},
			{
				p: 'Rechtsgrundlage für das Speichern und Auslesen ist § 25 Abs. 2 Nr. 2 TDDDG. Eine Einwilligung ist nicht nötig, weil jeder Eintrag erst durch deine eigene Handlung entsteht und unbedingt erforderlich ist, um die von dir gewünschte Funktion bereitzustellen (Fortschritt merken, Darstellung merken). Die Datenschutzaufsichtsbehörden stellen ausdrücklich auf solche bewusst genutzten Funktionen ab und verlangen, dass die Speicherung erst nach der Nutzerhandlung erfolgt. Ohne Konto bleiben diese Daten nur auf deinem Gerät.',
				src: ['R5', 'R14']
			}
		]
	},
	{
		id: 'browser',
		title: 'Was nur in deinem Browser passiert',
		blocks: [
			{
				p: 'Die Übungsdatenbanken entstehen beim Öffnen einer Lektion direkt in deinem Browser (SQLite, über WebAssembly). Deine Abfragen, Ergebnisse und Fehlermeldungen werden dort berechnet und nicht an uns gesendet.',
				src: ['T3', 'T13']
			},
			{
				p: 'Downloads von Datenbanken (.db) und Tabellen (.csv) werden ebenfalls im Browser erzeugt und direkt auf deinem Gerät gespeichert. Beim Klick auf „Kopieren“ wird der Code in deine Zwischenablage gelegt. Auch das geschieht nur lokal.',
				src: ['T14']
			},
			{
				p: 'Alle Schriftarten werden von unserem eigenen Server geladen. Es werden keine Schriften von Google oder anderen Anbietern nachgeladen.',
				src: ['T2', 'T15']
			}
		]
	},
	{
		id: 'konten',
		title: 'Konten für Schüler und Lehrkräfte',
		blocks: [
			{
				p: 'Ein Konto ist freiwillig. Alle Lektionen funktionieren auch ohne Anmeldung. Ein Konto brauchst du, wenn dein Fortschritt auf mehreren Geräten gleich sein soll, wenn du einer Klasse beitrittst oder am Live-Quiz teilnimmst.',
				src: ['K1', 'K4', 'K5']
			},
			{
				p: 'Für ein Schülerkonto speichern wir:',
				src: ['K1']
			},
			{
				list: [
					'Benutzername (zum Anmelden) und Anzeigename (sieht deine Lehrkraft). Beides darf ein ausgedachter Name sein.',
					'Passwort, nur als nicht umkehrbarer Hash (Argon2id mit zufälligem Salt, zusätzlich an Benutzername und Erstellungstag gebunden). Dein Passwort selbst kennen wir nicht.',
					'Freiwillig: E-Mail-Adresse, nur um ein vergessenes Passwort zurückzusetzen.',
					'Zeitpunkt der Registrierung und der letzten Anmeldung.'
				],
				src: ['K1', 'K3', 'K8', 'R21']
			},
			{
				p: 'Für ein Lehrkraftkonto speichern wir Name, E-Mail-Adresse, Passwort-Hash, freiwillig die Schule sowie die Zeitpunkte von Registrierung und letzter Anmeldung.',
				src: ['K2', 'K3']
			},
			{
				p: 'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO: Die Daten sind nötig, um das Konto bereitzustellen, das du angelegt hast. Ohne Benutzername und Passwort (bei Lehrkräften zusätzlich E-Mail-Adresse) kann kein Konto angelegt werden. Alles andere ist freiwillig.',
				src: ['R3', 'R7', 'K1', 'K2']
			}
		]
	},
	{
		id: 'klassen',
		title: 'Klassen und Lernfortschritt',
		blocks: [
			{
				p: 'Du trittst einer Klasse nur selbst bei, mit dem Klassencode oder QR-Code deiner Lehrkraft. Danach speichern wir je Lektion und Schritt, ob du ihn erledigt hast, wie viele Versuche du gebraucht hast und wann. Hängst du an einer Übung fest, speichern wir nur deine letzte Abfrage und die letzte Fehlermeldung, damit die Lehrkraft dir helfen kann. Beim nächsten Versuch wird sie überschrieben.',
				src: ['K4']
			},
			{
				p: 'Diese Daten sieht nur die Lehrkraft deiner Klasse, keine anderen Schüler und keine anderen Lehrkräfte. Tabula vergibt keine Noten und erstellt keine Profile.',
				src: ['K4', 'K9', 'R22']
			},
			{
				p: 'Bist du in keiner Klasse, speichern wir deinen Fortschritt nur, damit er auf all deinen Geräten gleich ist. Beim ersten Anmelden übernehmen wir einmalig den Fortschritt, den dein Browser bis dahin lokal gespeichert hat.',
				src: ['K4']
			},
			{
				p: 'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung der Klassen- und Fortschrittsfunktion, die du durch den Beitritt nutzt). Setzt eine Schule Tabula verbindlich im Unterricht ein, ist nach Auffassung der Datenschutzaufsichtsbehörden die Schule die verantwortliche Stelle. Dann verarbeiten wir die Daten in ihrem Auftrag auf Grundlage eines Vertrags nach Art. 28 DSGVO, und die Datenschutzhinweise der Schule gelten ergänzend.',
				src: ['R3', 'K12', 'R6', 'R23']
			}
		]
	},
	{
		id: 'quiz',
		title: 'Live-Quiz',
		blocks: [
			{
				p: 'Startet deine Lehrkraft ein Quiz und trittst du bei, speichern wir deine Teilnahme, deine Antwort auf jede Frage, die Antwortzeit und deine Punkte. Im Raum wird eine Rangliste mit Anzeigenamen gezeigt. Die Verbindung läuft über WebSocket direkt zu unserem Server.',
				src: ['K5', 'K11']
			},
			{
				p: '24 Stunden nach Ende des Quiz löschen wir einzelne Antworten und Punkte. Übrig bleibt nur eine Auswertung je Frage ohne Namen (zum Beispiel: 60 % richtig), damit die Lehrkraft sieht, was noch geübt werden muss.',
				src: ['K5', 'R8']
			},
			{
				p: 'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Quiz, an dem du teilnimmst).',
				src: ['R3', 'K5']
			}
		]
	},
	{
		id: 'cookie',
		title: 'Anmelde-Cookie',
		blocks: [
			{
				p: 'Nur wenn du dich anmeldest, setzen wir genau ein Cookie: tabula_session. Es enthält eine zufällige Sitzungskennung, damit du angemeldet bleibst. Es ist für Skripte nicht lesbar (HttpOnly), wird nur verschlüsselt übertragen (Secure), gilt nur für www.tabulasql.de, wird beim Abmelden gelöscht und läuft spätestens nach 30 Tagen ab. Weitere Cookies gibt es nicht.',
				src: ['K6']
			},
			{
				p: 'Rechtsgrundlage für das Speichern ist § 25 Abs. 2 Nr. 2 TDDDG, weil das Cookie für die von dir gewünschte Anmeldung unbedingt erforderlich ist. Die Aufsichtsbehörden nennen Log-in-Bereiche ausdrücklich als Funktion, die erst mit der bewussten Nutzung gewünscht ist. Das Cookie wird deshalb erst beim Anmelden gesetzt. Die Verarbeitung der Sitzungsdaten stützt sich auf Art. 6 Abs. 1 lit. b DSGVO.',
				src: ['R5', 'R14', 'R3', 'K6']
			}
		]
	},
	{
		id: 'systemmails',
		title: 'E-Mails von Tabula',
		blocks: [
			{
				p: 'Wir senden nur E-Mails, die für dein Konto nötig sind: einen Link zum Zurücksetzen des Passworts (1 Stunde gültig, nur einmal nutzbar) und bei Lehrkräften die Bestätigung der E-Mail-Adresse. Absender ist kontakt@tabulasql.de, der Versand läuft über den Mailserver der Hetzner Online GmbH. Newsletter oder Werbung senden wir nicht.',
				src: ['K7', 'T16', 'A1']
			},
			{
				p: 'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.',
				src: ['R3', 'K7']
			}
		]
	},
	{
		id: 'loeschen',
		title: 'Wie lange wir Daten speichern',
		blocks: [
			{
				list: [
					'Konto: bis du es löschst. Das geht jederzeit selbst in den Einstellungen und entfernt sofort alle Fortschritts- und Quizdaten.',
					'Konten ohne Anmeldung seit 12 Monaten löschen wir automatisch. Ist eine E-Mail-Adresse hinterlegt, erinnern wir 30 Tage vorher.',
					'Entfernt dich die Lehrkraft aus einer Klasse oder löscht sie die Klasse, werden Zugehörigkeit und klassenbezogener Fortschritt gelöscht.',
					'Einzelne Quiz-Antworten: 24 Stunden nach Quiz-Ende.',
					'Sicherungskopien der Datenbank: verschlüsselt, auf unserem Server in Deutschland, höchstens 7 Tage. Gelöschte Daten verschwinden spätestens dann auch aus den Sicherungen.',
					'Server-Protokolle: höchstens 14 Tage (siehe Abschnitt „Aufruf der Website“).'
				],
				src: ['K8', 'K5', 'T7', 'R8', 'R16']
			}
		]
	},
	{
		id: 'minderjaehrige',
		title: 'Hinweis für Schüler und Eltern',
		blocks: [
			{
				p: 'Tabula richtet sich an Schüler ab Klasse 10. Kinder und Jugendliche verdienen bei ihren Daten besonderen Schutz. Deshalb fragen wir bei Schülern keinen echten Namen, kein Alter und keine E-Mail-Adresse ab, zeigen keine Werbung und erstellen keine Profile. Eltern können alle Rechte aus Abschnitt „Deine Rechte“ für ihr Kind über kontakt@tabulasql.de geltend machen.',
				src: ['R22', 'K1', 'K9']
			}
		]
	},
	{
		id: 'email',
		title: 'Kontakt per E-Mail',
		blocks: [
			{
				p: 'Wenn du uns an kontakt@tabulasql.de schreibst, verarbeiten wir deine E-Mail-Adresse, den Inhalt und die Zeitangaben deiner Nachricht, um dir zu antworten. Das Postfach liegt auf einem Mailserver der Hetzner Online GmbH.',
				src: ['T16', 'A1']
			},
			{
				p: 'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, wenn deine Anfrage auf einen Vertrag oder vorvertragliche Maßnahmen zielt, sonst Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Beantwortung von Anfragen). Wir löschen die Nachricht, sobald sie für die Bearbeitung nicht mehr nötig ist und keine gesetzliche Pflicht zur Aufbewahrung besteht.',
				src: ['R3', 'R8', 'R16']
			}
		]
	},
	{
		id: 'links',
		title: 'Links zu anderen Websites',
		blocks: [
			{
				p: 'Einige Seiten enthalten Links zu anderen Websites, zum Beispiel zum Quellcode bei GitHub (github.com). Erst wenn du einen solchen Link anklickst, verlässt du Tabula. Für die Verarbeitung auf der anderen Website ist deren Betreiber verantwortlich. Vorher werden keine Daten an diese Websites übertragen.',
				src: ['T17', 'T2']
			}
		]
	},
	{
		id: 'empfaenger',
		title: 'Empfänger und Drittländer',
		blocks: [
			{
				p: 'Innerhalb von Tabula sieht nur die Lehrkraft deiner Klasse deinen Fortschritt, beim Quiz sehen die Teilnehmenden im Raum die Rangliste mit Anzeigenamen. Außerhalb von Tabula ist Empfänger nur die Hetzner Online GmbH als Auftragsverarbeiter. Wir übermitteln keine Daten in Länder außerhalb der EU und geben sie nicht an Dritte weiter. Es findet keine automatisierte Entscheidungsfindung und kein Profiling statt.',
				src: ['K4', 'K5', 'A1', 'A3', 'K11', 'K9', 'R7', 'T2', 'T5']
			}
		]
	},
	{
		id: 'rechte',
		title: 'Deine Rechte',
		blocks: [
			{
				p: 'Du hast gegenüber dem Verantwortlichen folgende Rechte hinsichtlich der dich betreffenden personenbezogenen Daten:',
				src: ['R7']
			},
			{
				list: [
					'Auskunft (Art. 15 DSGVO)',
					'Berichtigung (Art. 16 DSGVO)',
					'Löschung (Art. 17 DSGVO)',
					'Einschränkung der Verarbeitung (Art. 18 DSGVO)',
					'Datenübertragbarkeit (Art. 20 DSGVO)'
				],
				src: ['R7', 'R16']
			},
			{
				p: 'Widerspruchsrecht: Soweit wir Daten auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO verarbeiten, kannst du aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit widersprechen (Art. 21 Abs. 1 DSGVO).',
				src: ['R17']
			},
			{
				p: 'Dein Konto kannst du jederzeit selbst löschen. Für alles andere genügt eine formlose E-Mail an kontakt@tabulasql.de. Wir antworten unverzüglich, spätestens innerhalb eines Monats, und kostenlos.',
				src: ['R18', 'K8']
			},
			{
				p: 'Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere in dem Mitgliedstaat deines Aufenthaltsorts, deines Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes (Art. 77 DSGVO). Zuständig für nichtöffentliche Stellen ist die Aufsichtsbehörde des Bundeslands, in dem der Verantwortliche sitzt (§ 40 BDSG). {{AUFSICHT}}',
				src: ['R19', 'R20', 'A7']
			},
			{
				p: 'Du bist weder gesetzlich noch vertraglich verpflichtet, uns Daten bereitzustellen. Ohne die technisch nötigen Verbindungsdaten kann die Website allerdings nicht angezeigt werden.',
				src: ['R7', 'T6']
			}
		]
	},
	{
		id: 'sicherheit',
		title: 'Sicherheit',
		blocks: [
			{
				p: 'Wir schützen den Server mit technischen und organisatorischen Maßnahmen nach Art. 32 DSGVO: Anmeldung am Server nur mit Schlüssel (keine Passwörter, kein Root-Login), automatische Sicherheitsupdates und eine Sperre von Adressen nach wiederholten Fehlversuchen beim Login (fail2ban: 5 Fehlversuche in 10 Minuten führen zu 10 Minuten Sperre, die Sperrliste wird nach einem Tag bereinigt). Passwörter speichern wir nur als Argon2id-Hash. Fehlversuche beim Anmelden in Tabula begrenzen wir nur im Arbeitsspeicher, ohne IP-Adressen dauerhaft zu speichern.',
				src: ['R11', 'T18', 'K3', 'K10', 'R21']
			}
		]
	},
	{
		id: 'aenderungen',
		title: 'Änderungen',
		blocks: [
			{
				p: 'Wir passen diese Erklärung an, sobald sich die Verarbeitung ändert. Ändert sich der Zweck einer Verarbeitung, informieren wir angemeldete Nutzer vorher. Es gilt jeweils die hier veröffentlichte Fassung mit dem oben genannten Stand.',
				src: ['R7', 'R15']
			}
		]
	}
];

export type Source = { id: string; label: string; url?: string };

export const SOURCES: Source[] = [
	// Rechtsquellen
	{ id: 'R1', label: 'Art. 4 DSGVO (Begriffe: personenbezogene Daten, Verantwortlicher)', url: 'https://dsgvo-gesetz.de/art-4-dsgvo/' },
	{ id: 'R2', label: 'Art. 13 Abs. 1 lit. a DSGVO (Name und Kontaktdaten des Verantwortlichen)', url: 'https://dsgvo-gesetz.de/art-13-dsgvo/' },
	{ id: 'R3', label: 'Art. 6 Abs. 1 DSGVO (Rechtmäßigkeit der Verarbeitung)', url: 'https://dsgvo-gesetz.de/art-6-dsgvo/' },
	{ id: 'R4', label: 'Erwägungsgrund 49 DSGVO (Netz- und Informationssicherheit als berechtigtes Interesse)', url: 'https://dsgvo-gesetz.de/erwaegungsgruende/nr-49/' },
	{ id: 'R5', label: '§ 25 TDDDG (Schutz der Privatsphäre bei Endeinrichtungen)', url: 'https://www.gesetze-im-internet.de/ttdsg/__25.html' },
	{ id: 'R6', label: 'Art. 28 DSGVO (Auftragsverarbeiter)', url: 'https://dsgvo-gesetz.de/art-28-dsgvo/' },
	{ id: 'R7', label: 'Art. 13 Abs. 1 und 2 DSGVO (Empfänger, Drittland, Rechte, Pflicht zur Bereitstellung, automatisierte Entscheidung)', url: 'https://dsgvo-gesetz.de/art-13-dsgvo/' },
	{ id: 'R8', label: 'Art. 5 Abs. 1 lit. e DSGVO (Speicherbegrenzung)', url: 'https://dsgvo-gesetz.de/art-5-dsgvo/' },
	{ id: 'R9', label: 'Art. 37 Abs. 1 DSGVO (Benennung eines Datenschutzbeauftragten)', url: 'https://dsgvo-gesetz.de/art-37-dsgvo/' },
	{ id: 'R10', label: '§ 38 Abs. 1 BDSG (Datenschutzbeauftragte nichtöffentlicher Stellen)', url: 'https://www.gesetze-im-internet.de/bdsg_2018/__38.html' },
	{ id: 'R11', label: 'Art. 32 DSGVO (Sicherheit der Verarbeitung)', url: 'https://dsgvo-gesetz.de/art-32-dsgvo/' },
	{ id: 'R12', label: 'Erwägungsgrund 30 DSGVO (IP-Adressen als Online-Kennungen)', url: 'https://dsgvo-gesetz.de/erwaegungsgruende/nr-30/' },
	{ id: 'R13', label: 'Art. 13 Abs. 1 lit. d DSGVO (Angabe der berechtigten Interessen)', url: 'https://dsgvo-gesetz.de/art-13-dsgvo/' },
	{ id: 'R14', label: 'DSK, Orientierungshilfe für Anbieter:innen von digitalen Diensten, Version 1.2, Stand November 2024, Rn. 18, 66 bis 80 (Web Storage, Ausnahme § 25 Abs. 2 Nr. 2 TDDDG, Zeitpunkt der Speicherung)', url: 'https://www.datenschutzkonferenz-online.de/media/oh/OH_Digitale_Dienste.pdf' },
	{ id: 'R15', label: 'Art. 13 Abs. 3 DSGVO (Information vor Weiterverarbeitung zu anderem Zweck)', url: 'https://dsgvo-gesetz.de/art-13-dsgvo/' },
	{ id: 'R16', label: 'Art. 17 Abs. 1 lit. a DSGVO (Löschung, wenn Daten nicht mehr notwendig)', url: 'https://dsgvo-gesetz.de/art-17-dsgvo/' },
	{ id: 'R17', label: 'Art. 21 Abs. 1 DSGVO (Widerspruchsrecht)', url: 'https://dsgvo-gesetz.de/art-21-dsgvo/' },
	{ id: 'R18', label: 'Art. 12 Abs. 3 und 5 DSGVO (Frist ein Monat, unentgeltlich)', url: 'https://dsgvo-gesetz.de/art-12-dsgvo/' },
	{ id: 'R19', label: 'Art. 77 Abs. 1 DSGVO (Beschwerderecht)', url: 'https://dsgvo-gesetz.de/art-77-dsgvo/' },
	{ id: 'R20', label: '§ 40 Abs. 1 BDSG (Aufsichtsbehörden der Länder)', url: 'https://www.gesetze-im-internet.de/bdsg_2018/__40.html' },
	{ id: 'R21', label: 'OWASP Password Storage Cheat Sheet (Argon2id, Salt)', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html' },
	{ id: 'R22', label: 'Erwägungsgrund 38 DSGVO (besonderer Schutz der Daten von Kindern, keine Profile, keine Werbung)', url: 'https://dsgvo-gesetz.de/erwaegungsgruende/nr-38/' },
	{ id: 'R23', label: 'DSK, Orientierungshilfe für Online-Lernplattformen im Schulunterricht (Schule als verantwortliche Stelle)', url: 'https://www.datenschutz-berlin.de/fileadmin/user_upload/pdf/publikationen/DSK/2016/OH_Lernplattform_neu.pdf' },
	// Anbieter-Dokumentation
	{ id: 'A1', label: 'Hetzner Docs: Datenschutz bei Hetzner (AV-Vertrag, Drittlandsübermittlung)', url: 'https://docs.hetzner.com/de/general/general-terms-and-conditions/data-privacy-faq/' },
	{ id: 'A2', label: 'Hetzner Docs: Locations (nbg1 = Nürnberg, Netzwerkzone eu-central)', url: 'https://docs.hetzner.com/cloud/general/locations/' },
	{ id: 'A3', label: 'Hetzner Docs: Technische und organisatorische Maßnahmen (Serverzugriff nur durch Auftraggeber)', url: 'https://docs.hetzner.com/de/general/security-and-identify/technical-and-organizational-measures/' },
	{ id: 'A4', label: 'MDN: Window.localStorage', url: 'https://developer.mozilla.org/de/docs/Web/API/Window/localStorage' },
	{ id: 'A5', label: 'MDN: Window.sessionStorage', url: 'https://developer.mozilla.org/de/docs/Web/API/Window/sessionStorage' },
	{ id: 'A6', label: 'Caddy-Dokumentation: log-Direktive (Zugriffsprotokoll nur mit log, Filter ip_mask, roll_keep_for)', url: 'https://caddyserver.com/docs/caddyfile/directives/log' },
	{ id: 'R24', label: '§ 18 Abs. 1 MStV (Name und Anschrift bei nicht rein privaten Angeboten)', url: 'https://gesetze.co/SL/MStV/18' },
	{ id: 'R25', label: '§ 5 Abs. 1 DDG (allgemeine Informationspflichten)', url: 'https://www.gesetze-im-internet.de/ddg/__5.html' },
	{ id: 'R26', label: 'Verordnung (EU) 2024/3228: OS-Plattform seit 20.07.2025 eingestellt, Hinweispflicht entfallen', url: 'https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=CELEX:32024R3228' },
	{ id: 'A7', label: 'Berliner Beauftragte für Datenschutz und Informationsfreiheit, Impressum (Anschrift)', url: 'https://www.datenschutz-berlin.de/impressum' },
	// Verbindliche Vorgaben für Konten, Klassen und Quiz (docs/BACKEND-DATENSCHUTZ.md); Freigabe-Checkliste dort
	{ id: 'K1', label: 'docs/BACKEND-DATENSCHUTZ.md K1: Schülerkonto: Pflichtfelder Benutzername, Anzeigename, Passwort; E-Mail und Klassencode optional', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K2', label: 'docs/BACKEND-DATENSCHUTZ.md K2: Lehrkraftkonto: Name, E-Mail, Passwort, Nutzungsbedingungen; Schule optional', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K3', label: 'docs/BACKEND-DATENSCHUTZ.md K3: Passwörter nur als Argon2id-Hash mit Salt, gebunden an Benutzername und Erstellungstag, nie im Klartext', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K4', label: 'docs/BACKEND-DATENSCHUTZ.md K4: Klassen und Fortschritt: Beitritt per Code/QR, gespeicherte Felder, nur letzte Abfrage, Sichtbarkeit nur Lehrkraft, einmalige Übernahme des Browser-Fortschritts', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K5', label: 'docs/BACKEND-DATENSCHUTZ.md K5: Live-Quiz: gespeicherte Daten, Rangliste, Löschung 24 h nach Ende, WebSocket zum eigenen Server', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K6', label: 'docs/BACKEND-DATENSCHUTZ.md K6: Ein Cookie tabula_session (HttpOnly, Secure, SameSite=Lax, 30 Tage), erst beim Anmelden', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K7', label: 'docs/BACKEND-DATENSCHUTZ.md K7: Nur Systemmails (Passwort-Reset 1 h, E-Mail-Bestätigung), Versand über Hetzner', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K8', label: 'docs/BACKEND-DATENSCHUTZ.md K8: Löschung: Selbstlöschung, Klassen, Inaktivität 12 Monate, Backups 7 Tage', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K9', label: 'docs/BACKEND-DATENSCHUTZ.md K9: Kein Tracking, keine Weitergabe, keine Profile, keine Benotung', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K10', label: 'docs/BACKEND-DATENSCHUTZ.md K10: Anmeldeschutz nur im Arbeitsspeicher, keine IP in der Datenbank', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K11', label: 'docs/BACKEND-DATENSCHUTZ.md K11: Alle Daten auf dem Hetzner-Server in Nürnberg, keine Drittländer', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	{ id: 'K12', label: 'docs/BACKEND-DATENSCHUTZ.md K12: Schulen: Rolle als Verantwortliche bei verbindlichem Einsatz, dann Vertrag nach Art. 28 DSGVO', url: 'https://github.com/WarumSindNamenSoSchwer/SbSQLTT/blob/main/docs/BACKEND-DATENSCHUTZ.md' },
	// Eigene technische Prüfung (Protokoll: docs/DATENSCHUTZ-QUELLEN.md)
	{ id: 'T1', label: 'Prüfung 21.10.2026: Aufruf aller Seiten in frischem Chrome-Profil, Cookies: keine' },
	{ id: 'T2', label: 'Prüfung 21.10.2026: Netzwerkmitschnitt aller Seiten, kontaktierter Host: nur www.tabulasql.de' },
	{ id: 'T3', label: 'Quellcode src/lib/tabula/sql.ts: SQLite (sql.js) läuft im Browser, WebAssembly von /sql/sql-wasm.wasm' },
	{ id: 'T5', label: 'Prüfung 21.10.2026: kein Analyse-, Werbe- oder Tracking-Skript im Build und im Netzwerkmitschnitt' },
	{ id: 'T6', label: 'Server-Konfiguration deploy/Caddyfile: keine log-Direktive in den Site-Blöcken; Test: Seitenaufrufe erzeugen keine Protokollzeile' },
	{ id: 'T7', label: 'Server-Konfiguration deploy/Caddyfile: Standardprotokoll mit ip_mask 24/48, Rotation 00:00, roll_keep_for 312h; Test: Protokolldatei enthält keine vollständigen Besucher-IPs' },
	{ id: 'T8', label: 'Hetzner-Metadaten des Servers: region eu-central, availability-zone nbg1-dc3' },
	{ id: 'T9', label: 'AV-Vertrag im Hetzner-Kundenkonto (accounts.hetzner.com/account/dpa) abgeschlossen, bestätigt durch den Verantwortlichen am 21.10.2026' },
	{ id: 'T10', label: 'TLS-Zertifikat von www.tabulasql.de, Aussteller: Let’s Encrypt; Weiterleitung tabulasql.de auf www (HTTP 301)' },
	{ id: 'T11', label: 'Quellcode: einzige localStorage-Schlüssel tabula-progress, tabula-theme, tabula-guest-hint; Prüfung: frisches Profil hat nach Aufruf aller Seiten leeren localStorage' },
	{ id: 'T12', label: 'SvelteKit-Quellcode runtime/client/constants.js: sessionStorage-Schlüssel sveltekit:snapshot und sveltekit:scroll' },
	{ id: 'T13', label: 'Quellcode src/lib/tabula/course/*.ts: Übungsdatenbanken als SQL im Programmcode, Aufbau im Browser' },
	{ id: 'T14', label: 'Quellcode src/lib/tabula/sql.ts (exportDb) und src/routes/datasets: Blob und Download im Browser; Kopieren über navigator.clipboard' },
	{ id: 'T15', label: 'Build: Schriften (IBM Plex, Inter, JetBrains Mono) über @fontsource als eigene Dateien unter /_app/immutable/assets' },
	{ id: 'T16', label: 'DNS: MX von tabulasql.de ist www750.your-server.de (Hetzner-Webhosting)' },
	{ id: 'T17', label: 'Quellcode: externe Links sind einfache Hyperlinks (a href), u. a. github.com/WarumSindNamenSoSchwer/SbSQLTT; keine eingebetteten Inhalte' },
	{ id: 'T18', label: 'Server: sshd -T (passwordauthentication no, permitrootlogin no), unattended-upgrades enabled, fail2ban sshd maxretry 5, findtime 600, bantime 600, dbpurgeage 1d' }
];
