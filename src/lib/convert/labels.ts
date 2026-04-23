import type { Locale } from './types';

export interface LabelBundle {
  docTitleInvoice: string;
  docTitleCreditNote: string;
  columns: {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    sellerName: string;
    sellerVatId: string;
    buyerName: string;
    buyerReference: string;
    lineId: string;
    itemName: string;
    itemDescription: string;
    quantity: string;
    unitCode: string;
    unitPrice: string;
    lineNetAmount: string;
    taxCategory: string;
    taxRate: string;
    currency: string;
    grandTotal: string;
    amountDue: string;
    lineCount: string;
    lineNetTotal: string;
    taxTotal: string;
    iban: string;
    bic: string;
    paymentTermsNote: string;
    taxBasis: string;
    taxAmount: string;
  };
  sections: {
    overview: string;
    lineItems: string;
    taxBreakdown: string;
    totals: string;
    payment: string;
    notes: string;
    seller: string;
    buyer: string;
    format: string;
    exemptionReason: string;
  };
  fields: {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    format: string;
    currency: string;
    buyerReference: string;
    net: string;
    tax: string;
    gross: string;
    amountDue: string;
    iban: string;
    bic: string;
    paymentTerms: string;
  };
  sheets: {
    overview: string;
    lines: string;
    tax: string;
    field: string;
    value: string;
  };
  pdf: {
    billTo: string;
    payee: string;
    paymentInfo: string;
    accountHolder: string;
    netSubtotal: string;
    vatLabel: string;
    totalInclVat: string;
    amountDue: string;
    paid: string;
    rounding: string;
    pageOf: (n: number, total: number) => string;
    footerBrand: string;
    reverseChargeNote: string;
    emDash: string;
    units: {
      hour: string;
      piece: string;
      unit: string;
    };
  };
}

const de: LabelBundle = {
  docTitleInvoice: 'Rechnung',
  docTitleCreditNote: 'Gutschrift',
  columns: {
    invoiceNumber: 'Rechnungsnummer',
    issueDate: 'Rechnungsdatum',
    dueDate: 'Fälligkeitsdatum',
    sellerName: 'Verkäufer',
    sellerVatId: 'USt-IdNr. Verkäufer',
    buyerName: 'Käufer',
    buyerReference: 'Leitweg-ID / Buyer-Ref',
    lineId: 'Pos.',
    itemName: 'Artikel',
    itemDescription: 'Beschreibung',
    quantity: 'Menge',
    unitCode: 'Einheit',
    unitPrice: 'Einzelpreis',
    lineNetAmount: 'Netto',
    taxCategory: 'USt-Kategorie',
    taxRate: 'USt-Satz %',
    currency: 'Währung',
    grandTotal: 'Gesamtsumme',
    amountDue: 'Zahlbetrag',
    lineCount: 'Anzahl Positionen',
    lineNetTotal: 'Summe Netto',
    taxTotal: 'Umsatzsteuer',
    iban: 'IBAN',
    bic: 'BIC',
    paymentTermsNote: 'Zahlungsbedingungen',
    taxBasis: 'Basis',
    taxAmount: 'Steuer',
  },
  sections: {
    overview: 'Übersicht',
    lineItems: 'Positionen',
    taxBreakdown: 'Steuer',
    totals: 'Summen',
    payment: 'Zahlung',
    notes: 'Notizen',
    seller: 'Verkäufer',
    buyer: 'Käufer',
    format: 'Format',
    exemptionReason: 'Befreiungsgrund',
  },
  fields: {
    invoiceNumber: 'Rechnungsnummer',
    issueDate: 'Rechnungsdatum',
    dueDate: 'Fälligkeit',
    format: 'Format',
    currency: 'Währung',
    buyerReference: 'Leitweg-ID',
    net: 'Netto',
    tax: 'Umsatzsteuer',
    gross: 'Brutto',
    amountDue: 'Zahlbetrag',
    iban: 'IBAN',
    bic: 'BIC',
    paymentTerms: 'Zahlungsbedingungen',
  },
  sheets: {
    overview: 'Übersicht',
    lines: 'Positionen',
    tax: 'Steuer',
    field: 'Feld',
    value: 'Wert',
  },
  pdf: {
    billTo: 'Empfänger',
    payee: 'Zahlungsempfänger',
    paymentInfo: 'Zahlungsinformationen',
    accountHolder: 'Kontoinhaber',
    netSubtotal: 'Zwischensumme netto',
    vatLabel: 'Umsatzsteuer',
    totalInclVat: 'Gesamtsumme',
    amountDue: 'Zahlbetrag',
    paid: 'Bereits gezahlt',
    rounding: 'Rundung',
    pageOf: (n, total) => `Seite ${n} von ${total}`,
    footerBrand: 'Erstellt mit Plainvoice · plainvoice.de',
    reverseChargeNote: 'Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG).',
    emDash: '—',
    units: {
      hour: 'Std.',
      piece: 'Stk.',
      unit: 'Einh.',
    },
  },
};

const en: LabelBundle = {
  docTitleInvoice: 'Invoice',
  docTitleCreditNote: 'Credit note',
  columns: {
    invoiceNumber: 'Invoice number',
    issueDate: 'Issue date',
    dueDate: 'Due date',
    sellerName: 'Seller',
    sellerVatId: 'Seller VAT ID',
    buyerName: 'Buyer',
    buyerReference: 'Buyer reference',
    lineId: 'Line',
    itemName: 'Item',
    itemDescription: 'Description',
    quantity: 'Quantity',
    unitCode: 'Unit',
    unitPrice: 'Unit price',
    lineNetAmount: 'Net amount',
    taxCategory: 'VAT category',
    taxRate: 'VAT rate %',
    currency: 'Currency',
    grandTotal: 'Grand total',
    amountDue: 'Amount due',
    lineCount: 'Line count',
    lineNetTotal: 'Net subtotal',
    taxTotal: 'VAT total',
    iban: 'IBAN',
    bic: 'BIC',
    paymentTermsNote: 'Payment terms',
    taxBasis: 'Basis',
    taxAmount: 'Tax',
  },
  sections: {
    overview: 'Overview',
    lineItems: 'Line items',
    taxBreakdown: 'Tax breakdown',
    totals: 'Totals',
    payment: 'Payment',
    notes: 'Notes',
    seller: 'Seller',
    buyer: 'Buyer',
    format: 'Format',
    exemptionReason: 'Exemption reason',
  },
  fields: {
    invoiceNumber: 'Invoice number',
    issueDate: 'Issue date',
    dueDate: 'Due date',
    format: 'Format',
    currency: 'Currency',
    buyerReference: 'Buyer reference',
    net: 'Net',
    tax: 'VAT',
    gross: 'Gross',
    amountDue: 'Amount due',
    iban: 'IBAN',
    bic: 'BIC',
    paymentTerms: 'Payment terms',
  },
  sheets: {
    overview: 'Overview',
    lines: 'Line items',
    tax: 'Tax breakdown',
    field: 'Field',
    value: 'Value',
  },
  pdf: {
    billTo: 'Bill to',
    payee: 'Payee',
    paymentInfo: 'Payment information',
    accountHolder: 'Account holder',
    netSubtotal: 'Net subtotal',
    vatLabel: 'VAT',
    totalInclVat: 'Total incl. VAT',
    amountDue: 'Amount due',
    paid: 'Paid',
    rounding: 'Rounding',
    pageOf: (n, total) => `Page ${n} of ${total}`,
    footerBrand: 'Generated with Plainvoice · plainvoice.de',
    reverseChargeNote: 'Reverse charge — customer liable for VAT.',
    emDash: '—',
    units: {
      hour: 'h',
      piece: 'pcs',
      unit: 'units',
    },
  },
};

export function labelsFor(locale: Locale): LabelBundle {
  return locale === 'de' ? de : en;
}
