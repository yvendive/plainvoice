import { z } from 'zod';

export const AddressSchema = z.object({
  street: z.string().optional(),
  additionalStreet: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  countryCode: z.string().length(2),
});
export type Address = z.infer<typeof AddressSchema>;

export const ContactSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const ElectronicAddressSchema = z.object({
  scheme: z.string(),
  value: z.string(),
});
export type ElectronicAddress = z.infer<typeof ElectronicAddressSchema>;

export const PartySchema = z.object({
  name: z.string(),
  vatId: z.string().optional(),
  taxId: z.string().optional(),
  address: AddressSchema,
  contact: ContactSchema.optional(),
  electronicAddress: ElectronicAddressSchema.optional(),
});
export type Party = z.infer<typeof PartySchema>;

export const TaxCategorySchema = z.object({
  code: z.string(),
  rate: z.number(),
  exemptionReason: z.string().optional(),
});
export type TaxCategory = z.infer<typeof TaxCategorySchema>;

export const LineItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  sellerItemId: z.string().optional(),
  buyerItemId: z.string().optional(),
  standardItemId: z.string().optional(),
  quantity: z.number(),
  unitCode: z.string(),
  unitPrice: z.number(),
  netAmount: z.number(),
  taxCategory: TaxCategorySchema,
  note: z.string().optional(),
});
export type LineItem = z.infer<typeof LineItemSchema>;

export const AllowanceChargeSchema = z.object({
  isCharge: z.boolean(),
  amount: z.number(),
  baseAmount: z.number().optional(),
  percentage: z.number().optional(),
  reason: z.string().optional(),
  reasonCode: z.string().optional(),
  taxCategory: TaxCategorySchema.optional(),
});
export type AllowanceCharge = z.infer<typeof AllowanceChargeSchema>;

export const TaxBreakdownRowSchema = z.object({
  category: TaxCategorySchema,
  taxableAmount: z.number(),
  taxAmount: z.number(),
});
export type TaxBreakdownRow = z.infer<typeof TaxBreakdownRowSchema>;

export const PaymentMeansSchema = z.object({
  typeCode: z.string(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  accountHolder: z.string().optional(),
  mandateReference: z.string().optional(),
});
export type PaymentMeans = z.infer<typeof PaymentMeansSchema>;

export const TotalsSchema = z.object({
  lineNetTotal: z.number(),
  allowanceTotal: z.number(),
  chargeTotal: z.number(),
  taxExclusive: z.number(),
  taxTotal: z.number(),
  taxInclusive: z.number(),
  paidAmount: z.number().default(0),
  roundingAmount: z.number().default(0),
  amountDue: z.number(),
});
export type Totals = z.infer<typeof TotalsSchema>;

export const InvoiceSchema = z.object({
  // Document
  number: z.string(),
  typeCode: z.string(),
  issueDate: z.string(),
  dueDate: z.string().optional(),
  taxPointDate: z.string().optional(),
  currency: z.string().length(3),
  taxCurrency: z.string().length(3).optional(),
  buyerReference: z.string().optional(),
  purchaseOrderReference: z.string().optional(),
  contractReference: z.string().optional(),
  projectReference: z.string().optional(),
  notes: z.array(z.string()).default([]),

  // Parties
  seller: PartySchema,
  buyer: PartySchema,
  payee: PartySchema.optional(),

  // Lines
  lines: z.array(LineItemSchema),

  // Document-level allowances/charges
  allowancesCharges: z.array(AllowanceChargeSchema).default([]),

  // Tax
  taxBreakdown: z.array(TaxBreakdownRowSchema),

  // Totals
  totals: TotalsSchema,

  // Payment
  paymentMeans: z.array(PaymentMeansSchema).default([]),
  paymentTermsNote: z.string().optional(),

  // Provenance
  sourceSyntax: z.enum(['UBL', 'CII']),
  customizationId: z.string().optional(),
  profileId: z.string().optional(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;
