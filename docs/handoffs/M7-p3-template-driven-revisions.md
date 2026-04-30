# M7 P3 — Template-driven legal revisions (Cowork PM diff → Code implementation brief)

**Status:** AGB diff complete. Datenschutzerklärung and Widerrufsbelehrung diffs pending — blocked on Yves running the IT-Recht wizard for those (Datenschutz blocked further on analytics tool decision).

**Source artifacts:**
- IT-Recht Schutzpaket templates Yves uploaded (`Online-Shop_dig.Inhalte-AGB.txt` for AGB; others incoming).
- Existing legal pages in `src/i18n/messages/de.json` namespaces `Agb`, `Datenschutz`, `Widerruf` (plus `src/app/[locale]/{agb,datenschutz,impressum}/page.tsx`).
- Locked decisions in `docs/handoffs/07-stripe-paywall.md` (DE-only legal scope, IT-Recht as vendor, §6 waiver kept, Verbraucherschlichtung opt-out).
- Pentest issue [#19](https://github.com/yvendive/plainvoice/issues/19) — privacy text accuracy — folds into the Datenschutz portion of this PR when ready.

This brief becomes the implementation spec for the `m7-p3-template-driven-revisions` PR once all three template diffs are in. Code reads this file end-to-end and applies the changes; Yves reviews against the brief.

---

# Part 1 — AGB diff

## Structural alignment

| IT-Recht template § | Topic | Our existing § | Verdict |
| --- | --- | --- | --- |
| 1 | Geltungsbereich | § 1 Geltungsbereich | Keep ours, **augment with template's "Einbeziehung von eigenen Bedingungen widersprochen"** clause. |
| — | (no equivalent) | § 2 Vertragsgegenstand | **Keep ours**. Plainvoice-specific product description; template assumes this lives elsewhere in the shop description. |
| 2 | Vertragsschluss | § 3 Vertragsschluss | Keep ours, **expand with template's 5-day acceptance window, contract-text storage clause, input-error-correction language, spam-filter advisory**. See §3 detail below. |
| 3 | Widerrufsrecht | § 6 Widerrufsbelehrung | **Restructure**: slim our §6 to a single-sentence reference (matching template's brevity); move the full Widerrufsbelehrung text to the `/de/widerruf` page (per P3c routing decision). The full notice content stays the same. |
| 4 | Preise und Zahlungsbedingungen | § 4 Preise und Zahlung | Keep ours, **augment with template's explicit Stripe identification + Bonitätsprüfung disclosure** (DSGVO Art. 22 transparency). |
| 5 | Bereitstellung der Inhalte | § 5 Leistungserbringung | Keep ours, **add the "per Direktzugriff über die Website" + "per E-Mail" formulation** that matches the IT-Recht wizard answers. |
| 6 | Einräumung von Nutzungsrechten | (no equivalent) | **Add new §** using template's 6.1–6.3, plus a Plainvoice-specific self-hosting carve-out clause. See "New §" detail below. |
| 7 | Mängelhaftung | § 7 Gewährleistung | **Keep ours**. Our wording is more specific to software and equally compliant. |
| — | (template has no Haftung section) | § 8 Haftung | **Keep ours, do NOT remove**. Template's omission of Haftungsbeschränkung is unusual; ours follows the BGH-blessed Kardinalpflicht structure that's standard for software providers. Flag for IT-Recht support: ask why their digital-content template lacks this. |
| — | (no equivalent — but Datenschutz is its own document) | § 9 Datenschutz | **Keep ours**. Cross-reference to the Datenschutzerklärung is correct; template assumes the same structure. |
| 8 | Anwendbares Recht | § 10 Anwendbares Recht und Gerichtsstand | Keep ours, **enhance the B2B jurisdiction language** with template's more thorough phrasing. **Critical: keep our Dutch-law choice** — template doesn't specify a law (it's German-shop-default-implicit), but for a Dutch BV we need explicit Dutch law with the Rome I Art. 6 consumer-protection carve-out. |
| 9 | Alternative Streitbeilegung | (no equivalent) | **Add new §** with template's exact §36 VSBG opt-out wording. **Mandatory disclosure under §36 VSBG; we currently lack it — this is technically a compliance gap that needs to close before launch.** |
| — | (no equivalent) | § 11 Änderungen dieser AGB | **Keep ours**. |
| — | (no equivalent) | § 12 Salvatorische Klausel | **Keep ours**. |
| — | (no equivalent) | § 13 Vertragssprache | **Revise to DE-only.** Per the locked-decision DE-only-legal scope, the "both versions equally binding" wording is now stale. New text: "Vertragssprache und maßgebliche AGB-Sprache ist Deutsch." |

## Detailed changes (apply in this order — one commit each)

### Change 1 — § 1 augmentation: customer-T&Cs rejection clause

Append to existing `Agb.s1Body` after the Verbraucher/Unternehmer definitions:

> Hiermit wird der Einbeziehung von eigenen Bedingungen des Kunden widersprochen, es sei denn, es ist etwas anderes vereinbart.

**Why:** Defensive boilerplate that prevents B2B customers from claiming THEIR T&Cs apply (battle-of-the-forms). Template includes it; ours doesn't; cheap to add.

### Change 2 — § 3 Vertragsschluss expansion

Replace `Agb.s3Body` content. Keep our framing (Buy button, license-key delivery as acceptance) but add four template-derived sub-clauses:

- **5-day acceptance window:** "Der Anbieter kann das Angebot des Kunden innerhalb von fünf Tagen annehmen, indem er dem Kunden den Lizenzschlüssel per E-Mail zusendet oder die bestellten Inhalte bereitstellt." (Defensive — our flow is instant, but if delivery fails for technical reasons we have a window before contract lapses.)
- **Contract text storage:** "Bei der Abgabe eines Angebots wird der Vertragstext nach dem Vertragsschluss vom Anbieter gespeichert und dem Kunden nach Absendung der Bestellung in Textform per E-Mail übermittelt. Eine darüber hinausgehende Zugänglichmachung des Vertragstextes erfolgt nicht."
- **Input error correction:** "Vor verbindlicher Abgabe der Bestellung kann der Kunde mögliche Eingabefehler durch aufmerksames Lesen der auf dem Bildschirm dargestellten Informationen erkennen. Seine Eingaben kann der Kunde im Rahmen des elektronischen Bestellprozesses so lange korrigieren, bis er den Kauf-Button anklickt."
- **Spam filter advisory:** "Die Bestellabwicklung und Kontaktaufnahme finden in der Regel per E-Mail und automatisierter Bestellabwicklung statt. Der Kunde hat sicherzustellen, dass die von ihm zur Bestellabwicklung angegebene E-Mail-Adresse zutreffend ist und dass eingehende E-Mails nicht durch SPAM-Filter ausgefiltert werden."

**Why:** All four are defensive boilerplate. Spam filter advisory is genuinely useful — license-key emails do hit spam folders.

### Change 3 — § 4 Preise: Stripe identification + Bonitätsprüfung

Append to `Agb.s4Body`:

> Bei Auswahl der Zahlungsart Kreditkarte erfolgt die Zahlungsabwicklung über den Zahlungsdienstleister Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irland. Der Rechnungsbetrag ist mit Vertragsschluss sofort fällig. Stripe behält sich vor, eine Bonitätsprüfung durchzuführen und diese Zahlungsart bei negativer Bonitätsprüfung abzulehnen.

**Why:** Explicit processor identification is required under DSGVO transparency. Bonitätsprüfung disclosure is required under Art. 22 (automated decision-making) since Stripe DOES perform credit checks.

### Change 4 — § 5 Leistungserbringung: provision channel formulation

Insert after the first sentence of `Agb.s5Body`:

> Digitale Inhalte werden dem Kunden per Direktzugriff über die Website des Anbieters (plainvoice.de) sowie per E-Mail (Übermittlung des Lizenzschlüssels) bereitgestellt.

**Why:** Matches the wizard answers and §327 BGB digital-content disclosure expectations.

### Change 5 — § 6 Widerrufsbelehrung: restructure to reference + move to /de/widerruf

This is a structural change, not just text.

**a. Slim down `Agb.s6*` content.** Replace the entire §6 block (s6Heading, s6Intro, s6RightHeading/Body, s6ConsequencesHeading/Body, s6ExpiryHeading/Body) with a single short clause:

```json
"s6Heading": "§ 6 Widerrufsrecht",
"s6Body": "Verbrauchern steht grundsätzlich ein Widerrufsrecht zu. Nähere Informationen zum Widerrufsrecht sowie das Muster-Widerrufsformular ergeben sich aus der separaten Widerrufsbelehrung des Anbieters."
```

(Update `agb/page.tsx` to drop the s6Intro/s6Right*/s6Consequences*/s6Expiry* refs and just render s6Body like every other section.)

**b. Move full Widerrufsbelehrung text to `/de/widerruf`.** The page already exists per P3c plan — populate it with the existing §6 content (Widerrufsrecht clause + Folgen des Widerrufs + Erlöschen des Widerrufsrechts), plus the Muster-Widerrufsformular template.

**c. Update the BuyForm consent-checkbox link** (`src/components/BuyForm.tsx`) — currently links to `/de/agb#s6`; should link to `/de/widerruf` instead.

**Why:** Matches IT-Recht's structure (Belehrung as separate document), gives the Belehrung its own canonical URL for direct linking from the license email (per P3c), and reduces AGB length. The legal effect is identical.

### Change 6 — NEW § Einräumung von Nutzungsrechten

Insert as new section, between current §6 (Widerrufsrecht reference) and §7 (Gewährleistung). Three sub-clauses from template + a Plainvoice-specific carve-out:

```json
"s6aHeading": "§ 6a Einräumung von Nutzungsrechten",
"s6aBody": "Sofern sich aus der Inhaltsbeschreibung im Online-Shop des Anbieters nichts anderes ergibt, räumt der Anbieter dem Kunden an den bereitgestellten Inhalten das nicht ausschließliche, zeitlich unbefristete Recht ein, die Inhalte zu privaten sowie zu kommerziellen Zwecken zu nutzen. Eine Weitergabe der Inhalte oder des Lizenzschlüssels an Dritte oder die Erstellung von Kopien für Dritte außerhalb des Rahmens dieser AGB ist nicht gestattet, soweit nicht der Anbieter einer Übertragung der vertragsgegenständlichen Lizenz an den Dritten zugestimmt hat. Die Rechtseinräumung wird erst wirksam, wenn der Kunde die vertraglich geschuldete Vergütung vollständig geleistet hat. Die Lizenz berechtigt den Kunden zur Nutzung der gehosteten Software unter plainvoice.de. Sie umfasst nicht das Recht, eine selbst gehostete Instanz der unter freier Lizenz veröffentlichten Software für eigene oder fremde Zwecke zu betreiben und dabei den vom Anbieter vergebenen Lizenzschlüssel oder die Marke „Plainvoice" zu verwenden."
```

(Renumber subsequent sections — §7 stays §7, but if the wizard or sectioning prefers strict numbering, that's a Code call when applying.)

**Why:** Closes the "AGB §2 self-hosting carve-out" parked TODO from M7 brief. The MIT-licensed code is freely reusable but the *Pro license + Plainvoice brand + hosted service* are not. Without this clause, a reader could interpret the Pro license as covering self-hosted forks of the public repo.

### Change 7 — § 10 Anwendbares Recht: enhance B2B jurisdiction language

Replace the second half of `Agb.s10Body` (the jurisdiction sentence) with template's more thorough version, but keep our Dutch-law-with-Rome-I-Art-6 carve-out:

> Es gilt niederländisches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern gilt diese Rechtswahl nur insoweit, als nicht der gewährte Schutz durch zwingende Bestimmungen des Rechts des Staates, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat, entzogen wird. Handelt der Kunde als Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen mit Sitz im Hoheitsgebiet der Bundesrepublik Deutschland, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Vertrag der Geschäftssitz des Anbieters. Hat der Kunde seinen Sitz außerhalb des Hoheitsgebiets der Bundesrepublik Deutschland, so ist der Geschäftssitz des Anbieters ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Vertrag, wenn der Vertrag oder Ansprüche aus dem Vertrag der beruflichen oder gewerblichen Tätigkeit des Kunden zugerechnet werden können. Der Anbieter ist in den vorstehenden Fällen jedoch in jedem Fall berechtigt, das Gericht am Sitz des Kunden anzurufen.

**Why:** Template's jurisdiction clause is more thorough and standard. Our Dutch-law choice + consumer carve-out is correct for our setup; we just bolt the better B2B language onto the existing law-choice.

### Change 8 — § 13 Vertragssprache: DE-only revision

Replace `Agb.s13Body` entirely:

> Vertragssprache und maßgebliche Sprache dieser AGB ist Deutsch.

**Why:** The "deutsche und englische Fassung sind gleichermaßen verbindlich" clause is incompatible with the locked-decision DE-only-legal-pages scope. Cleanest fix is to state German is the sole binding language.

### Change 9 — NEW § Verbraucherschlichtung (§36 VSBG)

Insert as new section AFTER §13 (becomes the final § 14):

```json
"s14Heading": "§ 14 Alternative Streitbeilegung",
"s14Body": "Der Anbieter ist zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle weder verpflichtet noch bereit."
```

**Why:** Mandatory disclosure under §36 VSBG. We currently lack it — **this is a real compliance gap** that needs to close before launch. Verbatim wording from the IT-Recht template (matches Yves's wizard answer "Option 1 = Nein" recorded as a locked decision in `07-stripe-paywall.md`).

## Summary of AGB changes

- **8 augmentations** to existing sections (§1, §3, §4, §5, §6, §10, §13).
- **2 new sections** (§ 6a Nutzungsrechte, § 14 Verbraucherschlichtung).
- **1 structural move** (full Widerrufsbelehrung from inline §6 to dedicated `/de/widerruf` page).
- **0 deletions** — every existing § stays in some form.
- **Compliance impact:** Closes one real §36 VSBG gap; closes the parked self-hosting carve-out TODO; aligns wording with IT-Recht's regularly-updated template (so future updates flow through cleanly).

---

# Part 2 — Datenschutzerklärung diff

Source: Yves uploaded `Online-Shop-Datenschutz.txt` (IT-Recht generated) on 2026-04-29 after running the wizard with the recommendations from earlier in this session (Cloudflare Web Analytics under "andere Webanalyse"; Stripe under Zahlungsdienste; "Spezielle Dienste für Bestellverwaltung" enabled but the Resend / Cloudflare Workers presets weren't available so neither got auto-text — manual paragraphs needed).

Folds in pentest issue [#19](https://github.com/yvendive/plainvoice/issues/19) (privacy text accuracy on `/api/verify` round-trip).

## Structural alignment

| IT-Recht template § | Topic | Our existing § | Verdict |
| --- | --- | --- | --- |
| 1 | Einleitung + Verantwortlicher | § 1 Verantwortlicher | **Use template's wording**. Adds the boilerplate "Wir freuen uns..." opener and the standard Verantwortlicher definition. Add KvK-Nr. line back in (template doesn't include it; ours does). |
| — | (no equivalent) | § 2 Grundsatz: Lokale Verarbeitung | **Keep ours, position as new § 2**. This is a Plainvoice USP and a positive trust signal — the XML never leaves the browser. The template assumes server-side processing; our reality is client-side. **Critical to keep.** |
| 2 | Datenerfassung beim Besuch der Website (Server-Logfiles + SSL) | (partial in our § 3) | **Use template's wording**. More thorough Server-Logfiles enumeration than ours, plus the SSL/TLS paragraph. Replaces our partial coverage. |
| 3.1 | Hosting (generic EU-Anbieter) | § 3 Hosting (easyname Vienna explicit) | **Keep ours**. Specific easyname Vienna disclosure beats template's generic phrasing. |
| 3.2 | Cloudflare (described as CDN for website) | (no equivalent) | **DO NOT USE template's 3.2 as-is.** It frames Cloudflare as a website CDN, but plainvoice.de is NOT proxied through Cloudflare — Cloudflare's role is hosting the **Worker API** (`plainvoice-pay.yvendive.workers.dev`). Substantial rewrite required. See "Cloudflare Workers" replacement text below. |
| 4 | Kontaktaufnahme | § 5 Kontaktaufnahme | **Use template's wording** as base; ours says nearly the same thing but slightly less precise on Art. 6 grounds. |
| 5.1 | Bestellabwicklung intro | (partial, scattered) | **Use template's wording**. Standard intro paragraph. |
| 5.2 | Stripe / Paymentdienst | § 6 Zahlungsabwicklung | **Hybrid**. Template's 5.2 includes a long Bonitätsprüfung paragraph that's only relevant if we offer Rechnungs-/Ratenkauf (we don't — Stripe Checkout = card only). **Keep the first half** (Stripe identification, payment-data transmission Art. 6(1)(b)) and **drop the Bonitätsprüfung paragraph** describing alternative Zahlungsmittel/Geburtsdatum etc. Stripe still does internal Risk checks but doesn't take Geburtsdatum from us. |
| — | (no equivalent — wizard didn't have a Resend preset) | (no equivalent) | **ADD new § 5.3 — Resend** with the manual disclosure text below. |
| — | (no equivalent — wizard didn't have a CF Workers preset) | (no equivalent — replaces the misleading 3.2 above) | **ADD new § 5.4 — Cloudflare Workers (API)** with the manual disclosure text below. |
| 6 | Webanalysedienste / Cloudflare Web Analytics | § 4 Keine Cookies, kein Tracking | **REWRITE template's 6 entirely.** The template's auto-generated text describes Cloudflare Web Analytics as if it uses cookies, heatmaps, and a Cookie-Consent-Tool — **all factually wrong**. CF Web Analytics is cookieless, aggregate-only, no individual-session tracking, no consent needed under TDDDG §25 (no terminal-equipment storage access). The template's wording would also implicitly oblige us to ship a Cookie-Consent-Tool we don't have. Replace with accurate description. See "Cloudflare Web Analytics" replacement text below. **Also drop our existing § 4** "Keine Cookies, kein Tracking" — that wording is now stale (we DO have cookieless analytics). |
| — | (no equivalent — TDDDG §25 localStorage) | (mentioned briefly in our § 4) | **ADD new § 7 — Lokalspeicher (localStorage)**. We use `localStorage.plainvoice.pro` for the Pro entitlement flag and `localStorage.plainvoice.pro.key` for the license key. TDDDG §25(2)(2) "essentiell zur Bereitstellung des vom Nutzer ausdrücklich gewünschten Dienstes" carve-out applies — no consent needed but disclosure required. |
| 7 | Rechte des Betroffenen + WIDERSPRUCHSRECHT | § 9 Ihre Rechte | **Use template's wording**. More thorough enumeration of all Art. 15-22 rights plus the prominent WIDERSPRUCHSRECHT block (UPPERCASE, as required by case law). Better than ours. |
| — | (template lacks explicit DPA reference) | § 10 Beschwerderecht | **Keep ours, append to template's § 7 / new § 8**. The Autoriteit Persoonsgegevens reference (Den Haag) is correct for a Dutch BV; the template's generic "Aufsichtsbehörde" is too vague. |
| 8 | Dauer der Speicherung | (mentioned briefly per-section in ours) | **Use template's wording**. Better-organized retention-period disclosure. |
| — | (no equivalent) | § 11 Änderungen | **Keep ours**. Standard. |

## New manual paragraphs to add

### § 5.3 — Resend (transactional email)

```
Zur Zustellung des Lizenzschlüssels nach erfolgreicher Zahlung nutzen wir
den E-Mail-Versanddienstleister Resend (Resend, Inc., 2261 Market Street
#5039, San Francisco, CA 94114, USA). An Resend werden Ihre E-Mail-Adresse
sowie der für Sie ausgestellte Lizenzschlüssel im Klartext übermittelt,
damit die transaktionale E-Mail mit dem Schlüssel an Sie zugestellt
werden kann.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des
Kaufvertrags) sowie unser berechtigtes Interesse gem. Art. 6 Abs. 1
lit. f DSGVO an einer zuverlässigen E-Mail-Zustellung. Wir haben mit
Resend einen Auftragsverarbeitungsvertrag geschlossen, der den Schutz
Ihrer Daten sicherstellt und eine unberechtigte Weitergabe an Dritte
untersagt.

Für Datenübermittlungen in die USA hat sich Resend dem
EU-US-Datenschutzrahmen (EU-US Data Privacy Framework) angeschlossen,
das auf Basis eines Angemessenheitsbeschlusses der Europäischen
Kommission die Einhaltung des europäischen Datenschutzniveaus
sicherstellt.
```

### § 5.4 — Cloudflare Workers (API für Lizenzvergabe und -prüfung)

```
Die Bestellabwicklung — Erzeugung des Lizenzschlüssels nach Zahlungs-
eingang sowie die Echtheitsprüfung eingegebener Lizenzschlüssel über die
Eingabemaske unter „Pro aktivieren" — wird durch eine bei Cloudflare
betriebene API-Komponente verarbeitet (Cloudflare, Inc., 101 Townsend
St., San Francisco, CA 94107, USA). Diese verarbeitet folgende Daten:

- Ihre E-Mail-Adresse (zur Erstellung und späteren Zuordnung der Lizenz)
- Den Stripe Payment-Intent-Identifikator (zur Idempotenz-Sicherung
  gegen mehrfache Ausstellung)
- Den Lizenzschlüssel (zur Speicherung und späteren Validierung bei
  Aktivierung)
- Den Zeitpunkt Ihrer Zustimmung zum sofortigen Vertragsbeginn
- Die von Ihnen gewählte Sprache (Deutsch oder Englisch)
- Bei einer Lizenzschlüssel-Validierung ausschließlich der von Ihnen
  eingegebene Lizenzschlüssel; die Antwort der API enthält lediglich
  die Information „gültig" oder „ungültig" — keine personenbezogenen
  Daten werden zurückgespielt

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung). Wir
haben mit Cloudflare einen Auftragsverarbeitungsvertrag geschlossen.
Für Datenübermittlungen in die USA hat sich Cloudflare dem
EU-US-Datenschutzrahmen (EU-US Data Privacy Framework) angeschlossen.

Die Speicherdauer der Lizenzdaten richtet sich nach den unter "Dauer
der Speicherung" dargestellten gesetzlichen Aufbewahrungsfristen
(insbesondere steuerrechtliche Pflichten).
```

### § 6 — Webanalysedienste / Cloudflare Web Analytics (REPLACEMENT)

This **fully replaces** the IT-Recht template's auto-generated § 6 wording. The template's wording about cookies/heatmaps/consent is wrong for our case.

```
Wir nutzen den Webanalysedienst Cloudflare Web Analytics (Cloudflare,
Inc., 101 Townsend St., San Francisco, CA 94107, USA), um aggregierte
Statistiken über die Nutzung unserer Website zu erhalten (z.B. Anzahl
Seitenaufrufe, Herkunftsländer, Verweisquellen, verwendete Geräte-
typen).

Der Dienst arbeitet ohne Cookies und ohne lokale Speicherung von
Informationen auf Ihrem Endgerät. Es findet keine individuelle
Nutzerverfolgung, kein Fingerprinting und keine Erstellung von
Bewegungsprofilen oder Heatmaps statt. Die erhobenen Daten werden
unmittelbar serverseitig anonymisiert aggregiert; eine Identifikation
einzelner Personen ist auf Basis dieser Daten nicht möglich.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse
an der Verbesserung unserer Website). Da der Dienst keine Informationen
auf Ihrem Endgerät speichert oder ausliest, ist eine Einwilligung nach
§ 25 Abs. 1 TDDDG nicht erforderlich; es greift die Ausnahme nach § 25
Abs. 2 Nr. 2 TDDDG nicht, da die Verarbeitung schon nicht in den
Anwendungsbereich von § 25 Abs. 1 fällt.

Wir haben mit Cloudflare einen Auftragsverarbeitungsvertrag
geschlossen. Für Datenübermittlungen in die USA hat sich der Anbieter
dem EU-US-Datenschutzrahmen (EU-US Data Privacy Framework)
angeschlossen.
```

### § 7 — Lokalspeicher (localStorage)

Replaces our existing § 4 "Keine Cookies, kein Tracking" (which is stale post-analytics).

```
Diese Website setzt keine Cookies. Zur Speicherung Ihres Pro-Zugangs
nutzen wir den Lokalspeicher (localStorage) Ihres Browsers wie folgt:

- `plainvoice.pro` — Schlüssel mit dem Wert „1", wenn Sie Ihren
  Lizenzschlüssel erfolgreich aktiviert haben. Ohne diesen Eintrag
  bleibt die Pro-Funktion gesperrt.
- `plainvoice.pro.key` — Ihr eingegebener Lizenzschlüssel, lokal
  gespeichert, damit die Aktivierung nach einem Browserneustart
  bestehen bleibt.

Diese Einträge verlassen Ihren Browser nicht und werden nicht an uns
oder Dritte übermittelt — mit Ausnahme der einmaligen Übermittlung des
Lizenzschlüssels an unsere API zum Zweck der Echtheitsprüfung (siehe
oben § 5.4).

Eine Einwilligung gemäß § 25 Abs. 1 TDDDG ist hierfür nicht
erforderlich, da die Speicherung gemäß § 25 Abs. 2 Nr. 2 TDDDG
„unbedingt erforderlich" ist, damit der von Ihnen ausdrücklich
gewünschte Dienst — die Pro-Funktion — bereitgestellt werden kann. Sie
können die Einträge jederzeit über die Einstellungen Ihres Browsers
löschen; die Pro-Funktion wird dadurch wieder gesperrt.
```

## Net Datenschutzerklärung structure (after revisions)

Final section list for `Privacy.s*` keys in `de.json`:

1. § 1 Verantwortlicher (template wording + our KvK line)
2. § 2 Grundsatz: Lokale Verarbeitung (KEEP ours — Plainvoice USP)
3. § 3 Datenerfassung beim Besuch der Website (template wording: Server-Logfiles + SSL)
4. § 4 Hosting (KEEP ours — easyname Vienna explicit)
5. § 5 Datenverarbeitung zur Bestellabwicklung
   - § 5.1 Allgemeines (template wording)
   - § 5.2 Stripe (template wording, drop Bonitätsprüfung-alternative-Zahlungsmittel paragraph)
   - § 5.3 Resend (NEW manual text above)
   - § 5.4 Cloudflare Workers (NEW manual text above; replaces template's 3.2)
6. § 6 Webanalyse / Cloudflare Web Analytics (REPLACEMENT text above)
7. § 7 Lokalspeicher (NEW manual text above; replaces our stale § 4)
8. § 8 Kontaktaufnahme (template wording; our § 5 was nearly identical)
9. § 9 Rechte des Betroffenen (template wording, including UPPERCASE Widerspruchsrecht block)
10. § 10 Beschwerderecht bei einer Aufsichtsbehörde (KEEP ours — Autoriteit Persoonsgegevens reference)
11. § 11 Dauer der Speicherung (template wording)
12. § 12 Änderungen dieser Datenschutzerklärung (KEEP ours)

## Changes for Code (Datenschutz portion)

When this brief is handed off as the `m7-p3-template-driven-revisions` PR, Code's Datenschutz commit must:

1. Rewrite all `Privacy.s*` keys in `src/i18n/messages/de.json` to match the section structure above. (EN keys are dropped per the DE-only-legal decision.)
2. Update `src/app/[locale]/datenschutz/page.tsx` if the section count or shape changes (currently 11 sections; new is 12 sections plus sub-sections § 5.1–5.4 — Code may need to extend the renderer for sub-sections, or flatten the numbering, depending on what reads cleanest).
3. Verify the i18n parity test still passes (since EN keys are being removed entirely, parity check needs to handle "DE-only namespace" — Code triages whether to allowlist `Privacy.*` keys in the parity test or remove the EN counterpart entries).
4. The `lastUpdated` constant in `src/lib/legal/company.ts` (`LEGAL_LAST_UPDATED`) bumps to today's date when this PR merges.

---

# Part 3 — Widerrufsbelehrung diff

Source: Yves uploaded `Widerrufsbelehrung_dig.Inhalte.txt` (IT-Recht generated) on 2026-04-30 with both toggles OFF (no extended frist, no electronic submission form).

The IT-Recht text is structured as **A. Widerrufsbelehrung** + **B. Widerrufsformular**. We adopt this structure verbatim on the new `/de/widerruf` page (per Part 1, Change 5 — the AGB §6 slim-down moves the full Belehrung to this dedicated page).

## Section-by-section comparison

| IT-Recht template section | Our existing AGB § 6 sub-section | Verdict |
| --- | --- | --- |
| Einleitung (Verbraucher definition) | s6Intro (no Verbraucher definition) | **Use template's wording**. Includes the explicit Verbraucher-Definition (BGB §13) which makes the addressee of the Belehrung crystal clear. |
| Widerrufsrecht | s6RightBody | **Use template's wording**. Two important gains over ours: (a) includes the phone number `+31616179209` in the contact block, (b) includes the Muster-Widerrufsformular reference ("Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist."). Both are required for full Anlage-1-BGB compliance. |
| Folgen des Widerrufs | s6ConsequencesBody | **Use template's wording verbatim**, even though our cleaner version skipped the Lieferkosten boilerplate. Rationale: the **Gesetzlichkeitsfiktion** under Art. 246a §1 Abs. 2 EGBGB only applies if the Muster-Widerrufsbelehrung from Anlage 1 is reproduced exactly. Deviation — even a "cleaner" deviation — breaks the legal-compliance presumption. The Lieferkosten clause is harmless for digital downloads (no shipping → no shipping costs to refund); leaving it in costs nothing and gains the Gesetzlichkeitsfiktion. |
| Erlöschen des Widerrufsrechts | s6ExpiryBody | **Hybrid**: use template's wording AND append our Häkchen-clarification sentence. Template adds `"auf einem dauerhaften Datenträger zur Verfügung gestellt"` which is the exact §356(5) BGB requirement and is **missing from ours** — a real compliance gap. Our addition `"Wir weisen darauf hin, dass wir diese Zustimmung und Kenntnisbestätigung beim Kaufvorgang durch Setzen eines Häkchens einholen."` is a useful clarification that explains the consent-collection mechanism. Combine: template's compliant base text + our explanatory sentence as the final line. |
| Muster-Widerrufsformular (B) | (not present in AGB) | **Use template's wording verbatim**. Required by BGB Anlage 2 — exact text mandated. |

## Final text for the new `/de/widerruf` page

Code creates `src/app/[locale]/widerruf/page.tsx` (DE-only, the EN locale routes to DE per the locked-decision DE-only-legal scope) with the following content as i18n message keys under namespace `Widerruf`:

```json
"Widerruf": {
  "title": "Widerrufsbelehrung & Widerrufsformular",
  "lastUpdated": "Stand: {date}",
  "sectionAHeading": "A. Widerrufsbelehrung",
  "introHeading": "Einleitung",
  "introBody": "Verbrauchern steht ein Widerrufsrecht nach folgender Maßgabe zu, wobei Verbraucher jede natürliche Person ist, die ein Rechtsgeschäft zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden können:",
  "rightHeading": "Widerrufsrecht",
  "rightBody": "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.\n\nDie Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.\n\nUm Ihr Widerrufsrecht auszuüben, müssen Sie uns (YS Development B.V., Prins Hendrikplein 8, 2264 SL Leidschendam, Niederlande, Tel.: +31 6 16 17 92 09, E-Mail: info@plain-cards.com) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.\n\nZur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.",
  "consequencesHeading": "Folgen des Widerrufs",
  "consequencesBody": "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.",
  "expiryHeading": "Erlöschen des Widerrufsrechts",
  "expiryBody": "Das Widerrufsrecht erlischt vorzeitig, wenn wir mit der Vertragserfüllung begonnen haben, nachdem Sie ausdrücklich zugestimmt haben, dass wir mit der Vertragserfüllung vor Ablauf der Widerrufsfrist beginnen, Sie uns Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der Vertragserfüllung Ihr Widerrufsrecht verlieren, und wir Ihnen eine Bestätigung des Vertrags, in der der Vertragsinhalt einschließlich der vorgenannten Voraussetzungen zum vorzeitigen Erlöschen des Widerrufsrechts wiedergegeben ist, auf einem dauerhaften Datenträger zur Verfügung gestellt haben.\n\nWir weisen darauf hin, dass wir diese Zustimmung und Kenntnisbestätigung beim Kaufvorgang durch Setzen eines Häkchens einholen.",
  "sectionBHeading": "B. Muster-Widerrufsformular",
  "formIntro": "Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden es zurück.",
  "formAddressee": "An:\nYS Development B.V.\nPrins Hendrikplein 8\n2264 SL Leidschendam\nNiederlande\nE-Mail: info@plain-cards.com",
  "formBody": "Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*):\n\n_______________________________________________________\n_______________________________________________________\n\nBestellt am (*) ____________ / erhalten am (*) ____________\n\n________________________________________________________\nName des/der Verbraucher(s)\n\n________________________________________________________\nAnschrift des/der Verbraucher(s)\n\n________________________________________________________\nUnterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)\n\n_________________________\nDatum",
  "formFootnote": "(*) Unzutreffendes streichen",
  "mailtoButton": "Widerruf per E-Mail senden",
  "mailtoSubject": "Widerruf Plainvoice Pro",
  "back": "Zurück"
}
```

The page renders the four Belehrung sections in order, then a horizontal rule, then the Muster-Widerrufsformular block, then a `mailto:info@plain-cards.com?subject=Widerruf%20Plainvoice%20Pro` button. No interactive form (per the wizard answer — we said NO to electronic submission, so consumers download/copy and send via email or post).

## AGB § 6 reference text (the slim-down from Part 1, Change 5)

The new condensed `Agb.s6Body` (replacing the four old s6* keys) becomes:

```
Verbrauchern steht grundsätzlich ein Widerrufsrecht zu. Nähere Informationen zum Widerrufsrecht sowie das Muster-Widerrufsformular ergeben sich aus der separaten Widerrufsbelehrung des Anbieters.
```

…with the heading link from `agb/page.tsx` going to `/de/widerruf`.

## Email template addendum

The license email (sent via Resend after successful payment) currently links to:
- the unlock page (so customer can paste the key)
- the AGB

The license email body (DE) should now ALSO include a Widerrufsformular link near the bottom, even though the §6 BGB waiver applies (the Häkchen-checked customer waived their Widerrufsrecht). Reason: belt-and-braces — even with the waiver, customers should always have a clear path to exercise withdrawal if they discover an error. Per the AGENTS.md tripwire policy, we honor 30-day refunds operationally regardless.

Suggested copy at the bottom of the email body:

> Möchten Sie den Vertrag widerrufen? Auch wenn das Widerrufsrecht durch Ihre Zustimmung zur sofortigen Vertragserfüllung erloschen ist, finden Sie das Muster-Widerrufsformular sowie unsere Kontaktdaten unter https://plainvoice.de/de/widerruf — wir bearbeiten Anfragen wohlwollend.

The "wir bearbeiten Anfragen wohlwollend" (we handle requests favorably) is intentionally informal — it signals goodwill without contractually committing to refund-on-demand.

## Sitemap update

`src/app/sitemap.ts` adds an entry for `/de/widerruf` (DE only, no `/en/widerruf` per DE-only-legal-pages decision). Priority 0.5, same as `/buy` and `/unlock`.

---

# All three parts complete — ready to hand to Code

This brief is now the canonical implementation spec for the `m7-p3-template-driven-revisions` PR. Six commits suggested:

1. **Commit 1:** AGB augmentations from Part 1 (changes 1-4 — § 1 customer T&Cs rejection, § 3 expansion, § 4 Stripe disclosure, § 5 Direktzugriff formulation). All within `de.json` `Agb.*` keys.
2. **Commit 2:** AGB §6 slim-down + new `/de/widerruf` page from Part 1 Change 5 + Part 3. New i18n namespace `Widerruf`, new page file, AGB §6 references the new page, BuyForm consent link points to `/de/widerruf`.
3. **Commit 3:** AGB Changes 6-9 from Part 1 (§ 6a Nutzungsrechte, § 10 jurisdiction enhancement, § 13 DE-only revision, § 14 Verbraucherschlichtung). All in `de.json` `Agb.*` keys + page.tsx renderer if section count changes.
4. **Commit 4:** Datenschutzerklärung overhaul from Part 2. Rewrite `Privacy.s*` keys. Update `datenschutz/page.tsx` if section structure changes.
5. **Commit 5:** Email template Widerruf addendum (Worker repo `plainvoice-pay`, in `src/lib/resend.ts` or wherever the email body lives). One commit, one repo. Yes, this means PR-3 spans BOTH repos — the brief makes that explicit; Code opens two PRs (one per repo) cross-linked. **Edit 2026-04-30:** alternatively, fold this into a separate, smaller PR after the frontend PR merges — Code's call based on what reads cleanest.
6. **Commit 6:** Sitemap entry + LEGAL_LAST_UPDATED bump.

Code prompt to use when handing this off (after frontend repo working tree is clean):

```
Model: Claude Opus 4.6 (legal-text correctness is high-stakes). Run `/model opus` if not already.

cd ~/Documents/Codex/x-rechnung-conversion.

First action: read AGENTS.md. Then commit and push the brief at
docs/handoffs/M7-p3-template-driven-revisions.md to main per AGENTS.md
"Handoff briefs" rule #5. Stop and ask if `git status --short` shows
unrelated pending changes.

Once the brief is on origin/main, read it end-to-end (it's three Parts —
all three need to be applied; do not skip Part 3). Then read AGENTS.md
once more, then read these dependent files in the repo:
- src/i18n/messages/de.json (current legal text)
- src/app/[locale]/agb/page.tsx (renders AGB sections)
- src/app/[locale]/datenschutz/page.tsx (renders Datenschutz sections)
- src/components/BuyForm.tsx (consent checkbox + AGB §6 link)
- src/app/sitemap.ts (URL list)

Execute the brief. Six commits suggested in the brief's "All three parts
complete" section. Stop and ask if any "Stop and ask if" condition fires
(none defined yet — but if the i18n parity test fails after EN-key drops,
or if the Widerrufsformular text differs from BGB Anlage 2 exact wording,
ask).

Begin by acking readiness in one line, then commit the brief, then start
with Commit 1.
```


---

# Part 3 — Widerrufsbelehrung diff

**TBD.** Blocked on Yves running the IT-Recht Widerrufsbelehrung wizard and uploading the generated text. When that lands, Cowork PM extends this brief with Part 3.

Cross-reference: P3c plan says `/de/widerruf` page hosts the full Widerrufsbelehrung + Muster-Widerrufsformular. The text move (Change 5 above) populates it from existing §6 content; the IT-Recht template diff in Part 3 will refine that text.

---

# When all three parts are complete

This brief becomes the canonical implementation spec for the `m7-p3-template-driven-revisions` PR. Cowork PM writes a separate short Code-prompt at that point that points at this file, lists each Change as one commit, and follows the standard handoff-brief flow per AGENTS.md "Handoff briefs" rule #5 (Code self-commits the brief if uncommitted).

Until Parts 2 and 3 are filled in, do NOT hand this to Code — the AGB-only changes shouldn't ship without their Datenschutz + Widerrufsbelehrung counterparts.
