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

**TBD.** Blocked on:
1. Analytics tool decision — Cowork PM recommends Cloudflare Web Analytics (free, cookieless, no consent banner needed) over Plausible (~€9/mo, EU-hosted, better custom events). Yves to decide.
2. Analytics implementation — small Code task once decision is made; ~30 min.
3. Yves running the IT-Recht Datenschutzerklärung wizard with analytics in scope.
4. Yves uploading the generated `Online-Shop_dig.Inhalte-Datenschutzerklaerung.txt` (or equivalent).

When (3) and (4) land, Cowork PM extends this brief with Part 2.

Folds-in: pentest issue [#19](https://github.com/yvendive/plainvoice/issues/19) (privacy text accuracy on `/api/verify` round-trip).

---

# Part 3 — Widerrufsbelehrung diff

**TBD.** Blocked on Yves running the IT-Recht Widerrufsbelehrung wizard and uploading the generated text. When that lands, Cowork PM extends this brief with Part 3.

Cross-reference: P3c plan says `/de/widerruf` page hosts the full Widerrufsbelehrung + Muster-Widerrufsformular. The text move (Change 5 above) populates it from existing §6 content; the IT-Recht template diff in Part 3 will refine that text.

---

# When all three parts are complete

This brief becomes the canonical implementation spec for the `m7-p3-template-driven-revisions` PR. Cowork PM writes a separate short Code-prompt at that point that points at this file, lists each Change as one commit, and follows the standard handoff-brief flow per AGENTS.md "Handoff briefs" rule #5 (Code self-commits the brief if uncommitted).

Until Parts 2 and 3 are filled in, do NOT hand this to Code — the AGB-only changes shouldn't ship without their Datenschutz + Widerrufsbelehrung counterparts.
