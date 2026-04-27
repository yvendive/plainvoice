# M4.5 — Legal pages (Impressum, AGB, expanded Datenschutz)

Ships three legal documents needed before any paid transaction goes live. Should land **before M7** wires Stripe, but is safe to ship alongside M6 (no paywall active yet).

**IMPORTANT:** all text in this brief is a **draft for legal review**. It's standard boilerplate appropriate for a Dutch BV selling a B2C digital utility into EU markets, but Yves must have a Dutch or German e-commerce lawyer review before enabling real payments (M7). The drafts are safe to publish as informational pages — they're not pretending to be anything other than a first pass.

## Branch

```bash
git checkout main && git pull
git checkout -b m4-5-legal
```

## Company facts (single source of truth)

Use these exact values wherever the docs reference the company:

- **Legal name:** YS Development B.V.
- **Legal form:** Besloten Vennootschap (Dutch private limited company)
- **Address:** Prins Hendrikplein 8, 2264 SL Leidschendam, Netherlands
- **Director (Vertretungsberechtigter / Bestuurder):** Yves Schulz
- **Email:** info@plain-cards.com
- **KvK (Handelsregister):** 93236867 — Kamer van Koophandel, Netherlands
- **VAT ID:** NL866322887B01

Store these in `src/lib/legal/company.ts` as a single exported constant, and reference from all three pages. Nothing hard-coded elsewhere.

```ts
// src/lib/legal/company.ts
export const COMPANY = {
  legalName: 'YS Development B.V.',
  legalForm: 'Besloten Vennootschap',
  streetAddress: 'Prins Hendrikplein 8',
  postalCode: '2264 SL',
  city: 'Leidschendam',
  country: 'Netherlands',
  countryDe: 'Niederlande',
  director: 'Yves Schulz',
  email: 'info@plain-cards.com',
  kvk: '93236867',
  vatId: 'NL866322887B01',
} as const;
```

## 1. Routes & files

Add two new route groups; expand one existing:

| Route | File |
|---|---|
| `/[locale]/impressum` | `src/app/[locale]/impressum/page.tsx` (new) |
| `/[locale]/agb` | `src/app/[locale]/agb/page.tsx` (new) |
| `/[locale]/datenschutz` | existing — replace body |

All three pages follow the existing `datenschutz/page.tsx` layout (header with `LanguageToggle`, centered `max-w-2xl` main, back-link). Same visual language, different content.

## 2. Footer update

`src/app/[locale]/page.tsx` footer currently has one link (`privacyLink` → `/datenschutz`). Expand to three, keeping the existing structure:

```tsx
<nav className="flex gap-4">
  <Link href={`/${locale}/impressum`} className="…">{tf('impressumLink')}</Link>
  <Link href={`/${locale}/agb`} className="…">{tf('termsLink')}</Link>
  <Link href={`/${locale}/datenschutz`} className="…">{tf('privacyLink')}</Link>
</nav>
```

Impressum and Datenschutz pages keep the same footer pattern too, so users can navigate between them.

## 3. Impressum

### 3a. i18n keys — DE

Add to `src/i18n/messages/de.json`:

```json
"Impressum": {
  "title": "Impressum",
  "section1Heading": "Angaben gemäß § 5 TMG",
  "legalName": "YS Development B.V.",
  "legalForm": "Rechtsform: Besloten Vennootschap (niederländische Gesellschaft mit beschränkter Haftung)",
  "address": "Prins Hendrikplein 8, 2264 SL Leidschendam, Niederlande",
  "section2Heading": "Vertreten durch",
  "director": "Yves Schulz (Directeur / Geschäftsführer)",
  "section3Heading": "Kontakt",
  "emailLabel": "E-Mail:",
  "section4Heading": "Registereintrag",
  "register": "Eintragung im niederländischen Handelsregister",
  "registerAuthority": "Registergericht: Kamer van Koophandel, Den Haag",
  "registerNumber": "KvK-Nr.: 93236867",
  "section5Heading": "Umsatzsteuer-ID",
  "vatLabel": "Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG:",
  "section6Heading": "Verbraucherstreitbeilegung / Universalschlichtungsstelle",
  "odrIntro": "Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:",
  "odrLink": "https://ec.europa.eu/consumers/odr",
  "vsbgOptOut": "Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
  "back": "Zurück"
}
```

### 3b. i18n keys — EN

```json
"Impressum": {
  "title": "Legal notice",
  "section1Heading": "Company information",
  "legalName": "YS Development B.V.",
  "legalForm": "Legal form: Besloten Vennootschap (Dutch private limited company)",
  "address": "Prins Hendrikplein 8, 2264 SL Leidschendam, Netherlands",
  "section2Heading": "Represented by",
  "director": "Yves Schulz (Director)",
  "section3Heading": "Contact",
  "emailLabel": "Email:",
  "section4Heading": "Commercial register",
  "register": "Registered in the Dutch commercial register",
  "registerAuthority": "Register court: Kamer van Koophandel, The Hague",
  "registerNumber": "KvK no.: 93236867",
  "section5Heading": "VAT identification number",
  "vatLabel": "VAT ID:",
  "section6Heading": "Online dispute resolution",
  "odrIntro": "The European Commission provides a platform for online dispute resolution (ODR):",
  "odrLink": "https://ec.europa.eu/consumers/odr",
  "vsbgOptOut": "We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.",
  "back": "Back"
}
```

### 3c. Page structure

`src/app/[locale]/impressum/page.tsx` renders sections 1-6 in order, each with its heading + body paragraphs. Link `odrLink` as a real anchor with `target="_blank" rel="noopener"`. Email rendered as `mailto:`.

## 4. AGB / Terms of Service

Covers the commercial relationship once Pro is sold. B2C-compliant (Widerrufsrecht included) but also binds B2B buyers.

### 4a. Key design decisions

- **Contract language:** German and English are both authoritative; in case of dispute, the language of the buyer's purchase flow prevails. Document this in §13.
- **Applicable law:** Dutch law, with a carve-out that mandatory consumer-protection provisions of the buyer's country of residence remain unaffected (Rom I Art. 6).
- **Withdrawal waiver:** because the license is delivered immediately by email after payment, buyers must actively waive their 14-day withdrawal right in a checkbox at checkout, per Art. 16(m) of the Consumer Rights Directive (§ 356 Abs. 5 BGB in DE implementation).
- **Price:** use placeholder `{price}` — render from a config, not hard-coded, so M7 can change it without touching AGB.

### 4b. i18n keys — DE (all keys prefixed `Agb.`)

```json
"Agb": {
  "title": "Allgemeine Geschäftsbedingungen",
  "lastUpdated": "Stand: {date}",
  "s1Heading": "§ 1 Geltungsbereich",
  "s1Body": "Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen YS Development B.V., Prins Hendrikplein 8, 2264 SL Leidschendam, Niederlande (nachfolgend „Anbieter\") und Kundinnen und Kunden (nachfolgend „Kunde\") über die auf plainvoice.de angebotenen kostenpflichtigen Leistungen. Verbraucher im Sinne dieser AGB ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden können. Unternehmer ist jede natürliche oder juristische Person oder rechtsfähige Personengesellschaft, die in Ausübung einer gewerblichen oder selbständigen beruflichen Tätigkeit handelt.",
  "s2Heading": "§ 2 Vertragsgegenstand",
  "s2Body": "Der Anbieter stellt eine browserbasierte Software zur Konvertierung von X-Rechnung-XML-Dateien in CSV-, TXT-, XLSX- und PDF-Formate bereit. Die Basisfunktionen (Einzel-Datei-Konvertierung) sind kostenlos. Gegen Zahlung eines einmaligen Entgelts erwirbt der Kunde eine unbefristete, nicht-exklusive Lizenz zur Nutzung der erweiterten Funktionen („Plainvoice Pro\"), insbesondere der Bulk-Konvertierung mehrerer Dateien. Die Lizenz wird durch einen Lizenzschlüssel repräsentiert und ist nicht übertragbar.",
  "s3Heading": "§ 3 Vertragsschluss",
  "s3Body": "Die Darstellung der Leistungen auf plainvoice.de stellt kein rechtlich bindendes Angebot dar, sondern eine Aufforderung zur Abgabe eines Angebots. Durch Klick auf den Kauf-Button gibt der Kunde ein verbindliches Angebot zum Erwerb einer Lizenz ab. Der Vertrag kommt zustande, wenn der Anbieter das Angebot durch Zusendung des Lizenzschlüssels per E-Mail annimmt.",
  "s4Heading": "§ 4 Preise und Zahlung",
  "s4Body": "Es gilt der zum Zeitpunkt der Bestellung auf plainvoice.de angezeigte Preis. Alle Preise verstehen sich inklusive der gesetzlichen Umsatzsteuer. Die Zahlung erfolgt über den Zahlungsdienstleister Stripe (Stripe Payments Europe, Limited). Es gelten die Zahlungsbedingungen und Datenschutzhinweise von Stripe. Eine Rechnung wird dem Kunden nach Zahlungseingang per E-Mail zugestellt.",
  "s5Heading": "§ 5 Leistungserbringung",
  "s5Body": "Der Lizenzschlüssel wird unmittelbar nach erfolgreicher Zahlung per E-Mail an die vom Kunden angegebene Adresse versandt. Der Kunde ist verpflichtet, für eine gültige E-Mail-Adresse zu sorgen. Der Anbieter bemüht sich um eine hohe Verfügbarkeit der Dienste, schuldet jedoch keine ununterbrochene Verfügbarkeit. Wartungsarbeiten und unvorhergesehene Ausfälle berechtigen nicht zur Minderung des bereits gezahlten Entgelts.",
  "s6Heading": "§ 6 Widerrufsbelehrung für Verbraucher",
  "s6Intro": "Verbrauchern steht ein Widerrufsrecht nach folgender Maßgabe zu:",
  "s6RightHeading": "Widerrufsrecht",
  "s6RightBody": "Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsschlusses. Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (YS Development B.V., Prins Hendrikplein 8, 2264 SL Leidschendam, Niederlande, E-Mail: info@plain-cards.com) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.",
  "s6ConsequencesHeading": "Folgen des Widerrufs",
  "s6ConsequencesBody": "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.",
  "s6ExpiryHeading": "Erlöschen des Widerrufsrechts",
  "s6ExpiryBody": "Das Widerrufsrecht erlischt bei einem Vertrag zur Lieferung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten, wenn der Unternehmer mit der Ausführung des Vertrags begonnen hat, nachdem der Verbraucher ausdrücklich zugestimmt hat, dass der Unternehmer mit der Ausführung des Vertrags vor Ablauf der Widerrufsfrist beginnt, und seine Kenntnis davon bestätigt hat, dass er durch seine Zustimmung mit Beginn der Ausführung des Vertrags sein Widerrufsrecht verliert. Wir weisen darauf hin, dass wir diese Zustimmung und Kenntnisbestätigung beim Kaufvorgang durch Setzen eines Häkchens einholen.",
  "s7Heading": "§ 7 Gewährleistung",
  "s7Body": "Es gelten die gesetzlichen Gewährleistungsrechte. Der Anbieter gewährleistet, dass die Software bei vertragsgemäßer Nutzung im Wesentlichen die in der Leistungsbeschreibung angegebenen Funktionen erfüllt. Mängel sind dem Anbieter unverzüglich per E-Mail mitzuteilen.",
  "s8Heading": "§ 8 Haftung",
  "s8Body": "Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit, nach den Vorschriften des Produkthaftungsgesetzes sowie im Umfang einer vom Anbieter übernommenen Garantie. Bei leicht fahrlässiger Verletzung einer Pflicht, die wesentlich für die Erreichung des Vertragszwecks ist (Kardinalpflicht), ist die Haftung des Anbieters der Höhe nach begrenzt auf den Schaden, der nach der Art des fraglichen Geschäfts vorhersehbar und typisch ist. Im Übrigen ist die Haftung ausgeschlossen.",
  "s9Heading": "§ 9 Datenschutz",
  "s9Body": "Informationen zur Verarbeitung personenbezogener Daten sind in der Datenschutzerklärung enthalten.",
  "s10Heading": "§ 10 Anwendbares Recht und Gerichtsstand",
  "s10Body": "Es gilt niederländisches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern gilt diese Rechtswahl nur insoweit, als nicht der gewährte Schutz durch zwingende Bestimmungen des Rechts des Staates, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat, entzogen wird. Ist der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Vertrag der Sitz des Anbieters.",
  "s11Heading": "§ 11 Änderungen dieser AGB",
  "s11Body": "Der Anbieter behält sich vor, diese AGB zu ändern. Für bereits abgeschlossene Verträge gelten die zum Zeitpunkt des Vertragsschlusses veröffentlichten AGB unverändert fort.",
  "s12Heading": "§ 12 Salvatorische Klausel",
  "s12Body": "Sollte eine Bestimmung dieser AGB unwirksam sein oder werden, so bleibt die Wirksamkeit der übrigen Bestimmungen hiervon unberührt.",
  "s13Heading": "§ 13 Vertragssprache",
  "s13Body": "Die AGB liegen in deutscher und englischer Fassung vor. Beide Fassungen sind gleichermaßen verbindlich. Im Falle von Widersprüchen gilt die Fassung in der Sprache, in der der Kaufvorgang durchgeführt wurde.",
  "back": "Zurück"
}
```

### 4c. i18n keys — EN

Full English translation with same structure and `s1Heading` … `s13Body` keys. Copy of the DE text adapted to English legal style:

- § → Section
- "Verbraucher" → "consumer"
- "Unternehmer" → "business customer"
- "Anbieter" → "Provider"
- Widerrufsbelehrung → "Right of withdrawal (for consumers)"

Implementation note: Code should produce the EN version by translating the DE text in 4b section by section, keeping the same key names. Keep phrasing conservative — this is boilerplate, not marketing copy. Do **not** invent new clauses or reword the withdrawal notice (that language comes from the EU Consumer Rights Directive annex and should be preserved closely).

**Date rendering:** `lastUpdated` value uses current date at build time, format `YYYY-MM-DD`. Pass via props:

```tsx
const lastUpdated = new Date().toISOString().slice(0, 10);
const t = await getTranslations('Agb');
// ...
<p>{t('lastUpdated', { date: lastUpdated })}</p>
```

## 5. Datenschutz (expanded)

Current page has 4 short paragraphs. Replace the `Privacy.*` key set with a comprehensive GDPR-compliant policy.

### 5a. i18n keys — DE

```json
"Privacy": {
  "title": "Datenschutzerklärung",
  "lastUpdated": "Stand: {date}",

  "s1Heading": "1. Verantwortlicher",
  "s1Body": "Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:\n\nYS Development B.V.\nPrins Hendrikplein 8\n2264 SL Leidschendam, Niederlande\nE-Mail: info@plain-cards.com\nKvK-Nr.: 93236867",

  "s2Heading": "2. Grundsatz: Lokale Verarbeitung",
  "s2Body": "Die Kernfunktion von Plainvoice — das Einlesen und Konvertieren Ihrer X-Rechnung — findet ausschließlich in Ihrem Browser statt. Weder die hochgeladene XML-Datei noch die erzeugten CSV-, TXT-, XLSX- oder PDF-Ausgaben werden an Server des Anbieters oder Dritter übertragen.",

  "s3Heading": "3. Hosting der Website",
  "s3Body": "Die Website wird bei easyname GmbH, Canettistraße 5/10, 1100 Wien, Österreich gehostet. Beim Aufruf der Website erfasst der Hosting-Provider technisch notwendige Zugriffsdaten in Logdateien: IP-Adresse (gekürzt oder vollständig, je nach Konfiguration), Zeitpunkt des Zugriffs, abgerufene Ressource, HTTP-Statuscode, User-Agent. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Betrieb und Sicherheit der Website). Die Logdaten werden nach kurzer Zeit gelöscht.",

  "s4Heading": "4. Keine Cookies, kein Tracking",
  "s4Body": "Diese Website setzt keine Cookies, die nicht technisch notwendig sind, und verwendet keine Analyse-Werkzeuge, kein Re-Targeting und keine externen Tracking-Dienste. Schriftarten werden direkt vom eigenen Server ausgeliefert, nicht von einem Drittanbieter-CDN. In Ihrem Browser wird lediglich ein Lokalspeicher-Eintrag gesetzt, wenn Sie die Pro-Funktion freischalten — dieser Eintrag verlässt Ihren Browser nicht.",

  "s5Heading": "5. Kontaktaufnahme",
  "s5Body": "Wenn Sie uns per E-Mail an info@plain-cards.com kontaktieren, verarbeiten wir Ihre E-Mail-Adresse sowie die in der Nachricht enthaltenen Daten ausschließlich zur Bearbeitung Ihrer Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO bei vertragsbezogenen Anfragen, im Übrigen Art. 6 Abs. 1 lit. f DSGVO. Die Daten werden gelöscht, sobald sie für den Zweck ihrer Verarbeitung nicht mehr erforderlich sind, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.",

  "s6Heading": "6. Zahlungsabwicklung (Pro-Funktionen)",
  "s6Body": "Für den Erwerb kostenpflichtiger Pro-Funktionen nutzen wir den Zahlungsdienstleister Stripe (Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irland). Bei einem Kauf werden Sie auf die Zahlungsseite von Stripe weitergeleitet; die dort eingegebenen Zahlungsdaten verarbeitet Stripe als eigenständig Verantwortlicher. Wir erhalten von Stripe lediglich eine Bestätigung über den Zahlungseingang, Ihren Namen und Ihre E-Mail-Adresse zum Zweck der Lizenzerstellung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Weitere Informationen finden Sie in der Datenschutzerklärung von Stripe: https://stripe.com/privacy.",

  "s7Heading": "7. Lizenzschlüssel-Versand",
  "s7Body": "Nach erfolgreicher Zahlung erhalten Sie einen Lizenzschlüssel per E-Mail. Wir speichern hierzu Ihre E-Mail-Adresse, den Kaufzeitpunkt und den ausgestellten Lizenzschlüssel. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Die Daten werden gespeichert, solange es für die Erbringung der Leistung und zur Einhaltung gesetzlicher Aufbewahrungsfristen (insbesondere steuerrechtlicher Pflichten, in der Regel sieben Jahre in den Niederlanden) erforderlich ist.",

  "s8Heading": "8. Empfänger und Auftragsverarbeitung",
  "s8Body": "Wir geben personenbezogene Daten nur an die oben genannten Dienstleister weiter (Hosting: easyname GmbH, Österreich; Zahlung: Stripe, Irland/USA). Mit diesen Dienstleistern bestehen Auftragsverarbeitungsverträge bzw. — im Falle von Stripe — die Datenübermittlung erfolgt auf Basis der EU-Standardvertragsklauseln. Eine Weitergabe an sonstige Dritte erfolgt nicht.",

  "s9Heading": "9. Ihre Rechte",
  "s9Body": "Sie haben nach der DSGVO folgende Rechte: Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie Widerspruch gegen Verarbeitungen auf Basis berechtigter Interessen (Art. 21). Zur Ausübung dieser Rechte genügt eine formlose E-Mail an info@plain-cards.com.",

  "s10Heading": "10. Beschwerderecht",
  "s10Body": "Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Zuständige Aufsichtsbehörde für den Verantwortlichen ist die Autoriteit Persoonsgegevens (Bezuidenhoutseweg 30, 2594 AV Den Haag, Niederlande). Sie können sich wahlweise auch an die Aufsichtsbehörde Ihres gewöhnlichen Aufenthalts wenden (in Deutschland: der jeweilige Landesdatenschutzbeauftragte).",

  "s11Heading": "11. Änderungen dieser Datenschutzerklärung",
  "s11Body": "Wir behalten uns vor, diese Datenschutzerklärung bei Änderungen unserer Dienste oder der Rechtslage anzupassen. Die jeweils aktuelle Fassung ist auf dieser Seite abrufbar.",

  "back": "Zurück"
}
```

### 5b. i18n keys — EN

Same structure, English. Preserve the GDPR article references (they're the same in EN). Preserve company/addresses/authority names as-is (proper nouns).

### 5c. Rendering notes

- `s1Body` and similar contain `\n\n` paragraph separators and `\n` line breaks. Split on `\n\n` into paragraphs; within each paragraph, render `\n` as `<br />`. Implement as a small helper:

```tsx
function renderParagraphs(text: string) {
  return text.split('\n\n').map((p, i) => (
    <p key={i} className="whitespace-pre-line">{p}</p>
  ));
}
```

- External links (e.g. `https://stripe.com/privacy`, ODR platform) render as `<a target="_blank" rel="noopener noreferrer">`. The URLs appear inline in the translation text; keep them as text — don't try to parse them out. Legal-doc convention is that the URL appears literally so it's valid even printed.

## 6. Remove the now-stale Privacy keys

The existing `Privacy.intro`, `Privacy.noUpload`, `Privacy.noTracking`, `Privacy.hosting` keys are **replaced** by the section-based keys above. Delete the old keys from both `de.json` and `en.json`. Update `src/app/[locale]/datenschutz/page.tsx` accordingly.

## 7. Meta / SEO

Add lightweight page metadata to each legal page so they show up correctly in search and OpenGraph:

```ts
// src/app/[locale]/impressum/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Impressum' });
  return {
    title: `${t('title')} — Plainvoice`,
    robots: { index: true, follow: true },
    alternates: { canonical: `/${locale}/impressum` },
  };
}
```

Same pattern for `agb` and `datenschutz`. Add the new pages to `src/app/sitemap.ts`:

```ts
{ url: `${base}/de/impressum`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
{ url: `${base}/en/impressum`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
{ url: `${base}/de/agb`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
{ url: `${base}/en/agb`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
```

Existing datenschutz entries stay. Update the `sitemap.test.ts` expectation from `.toHaveLength(4)` to the new count (8).

## 8. Tests

New tests in `tests/app/`:

1. **`legal-pages.test.ts`** — render each legal page server-side (similar to existing metadata tests), check that `COMPANY.legalName`, `COMPANY.kvk`, `COMPANY.vatId` appear on the Impressum, and that the Stripe section appears on the Datenschutz. Catches accidental stale hard-coding.
2. Extend **`sitemap.test.ts`** — expect 8 entries, expect each new URL present.
3. **`footer-links.test.ts`** — render `/de` and `/en` landing pages, assert all three legal links exist in the footer with correct `href`s.

Run before handoff: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## 9. Acceptance

- [ ] `/de/impressum`, `/en/impressum`, `/de/agb`, `/en/agb` render correctly.
- [ ] Existing `/de/datenschutz`, `/en/datenschutz` show the expanded 11-section policy.
- [ ] Footer on landing pages shows three links: Impressum | AGB | Datenschutz (DE) / Legal notice | Terms | Privacy (EN).
- [ ] Footer on each legal page also shows the other two, so users can cross-navigate.
- [ ] Company details come from `COMPANY` constant — no hard-coded addresses in JSX.
- [ ] Sitemap includes the 4 new URLs; `robots.txt` unchanged.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` all clean; all tests pass.

## 10. Handoff back

```
M4.5 done: branch `m4-5-legal`, commit <sha>, PR #<n>.
Tests: <before>/<before> → <after>/<after>.
Acceptance: all 7 checks pass.
Legal disclaimer restated: these are first-pass drafts. Lawyer review required before M7.
```

## Explicit disclaimer — for Yves

Everything in §3, §4, §5 above is my best attempt at standard EU-compliant boilerplate for a Dutch BV selling a B2C digital utility, but I am not a lawyer and this is not legal advice. Before enabling payments (M7), have a Dutch or German e-commerce lawyer review:

- Whether the Widerrufsbelehrung wording tracks the current EU Consumer Rights Directive annex (it's been updated a few times).
- Whether the Haftungsbeschränkung (liability limit) in § 8 is enforceable under Dutch law — DE BGB § 309 Nr. 7 + § 309 Nr. 8 have specific unenforceability rules that also inform Dutch practice.
- Whether you need a **terms-of-use** document separate from the AGB for the free tier (typically not, but worth asking).
- Whether the Stripe SCC + transfer-impact-assessment language in § 8 of the Privacy policy is sufficient.
- Whether a **cookie banner** is still required given we set only one functional localStorage key (probably not — EU ePrivacy exempts strictly necessary storage — but confirm).
- Adjust § 6 and § 7 of the Privacy policy if you change the license-key email provider (currently unspecified — add the processor once chosen).

Budget: €300-600 via a Dutch/German e-commerce lawyer or Trusted Shops certification gets this to shippable quality.
