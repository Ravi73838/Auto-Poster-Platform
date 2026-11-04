import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  TAX_DOCUMENT_TYPES,
  SETTING_KEYS,
  type TaxDocumentType,
} from '@ap/shared-constants';
import type { TaxDocument } from '@prisma/client';
import { prisma, type TransactionClient } from '../../shared/db/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { toRupees } from '../../shared/money/index.js';

export function getIndianFinancialYear(date = new Date()): string {
  const month = date.getMonth(); // 0 = Jan, 3 = April
  const year = date.getFullYear();
  if (month >= 3) {
    const nextYear = (year + 1) % 100;
    return `${year % 100}-${nextYear < 10 ? '0' + nextYear : nextYear}`;
  } else {
    const prevYear = (year - 1) % 100;
    return `${prevYear < 10 ? '0' + prevYear : prevYear}-${year % 100}`;
  }
}

export class TaxDocumentService {
  static async getNextDocumentNumber(
    documentType: TaxDocumentType,
    date = new Date(),
    tx?: TransactionClient,
  ): Promise<{ documentNumber: string; financialYear: string; sequenceNumber: number }> {
    const client = tx ?? prisma;
    const fy = getIndianFinancialYear(date);
    const prefix =
      documentType === TAX_DOCUMENT_TYPES.TAX_INVOICE
        ? (await SettingsService.get(SETTING_KEYS.FINANCE_INVOICE_PREFIX, 'INV'))
        : (await SettingsService.get(SETTING_KEYS.FINANCE_CREDIT_NOTE_PREFIX, 'CN'));

    const counter = await client.invoiceCounter.upsert({
      where: {
        financialYear_documentType: {
          financialYear: fy,
          documentType,
        },
      },
      create: {
        financialYear: fy,
        documentType,
        lastNumber: 1,
      },
      update: {
        lastNumber: { increment: 1 },
      },
    });

    const seqStr = counter.lastNumber.toString().padStart(6, '0');
    const documentNumber = `${prefix}/${fy}/${seqStr}`;

    return {
      documentNumber,
      financialYear: fy,
      sequenceNumber: counter.lastNumber,
    };
  }

  static async generateTaxInvoice(
    paymentId: string,
    tx?: TransactionClient,
  ): Promise<TaxDocument> {
    const client = tx ?? prisma;

    const payment = await client.campaignPayment.findUnique({
      where: { id: paymentId },
      include: {
        campaign: true,
        company: {
          include: { companyProfile: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError(`Payment ${paymentId} not found`);
    }

    const { documentNumber, financialYear, sequenceNumber } =
      await this.getNextDocumentNumber(TAX_DOCUMENT_TYPES.TAX_INVOICE, new Date(), client);

    const platformGstin = await SettingsService.get(
      SETTING_KEYS.FINANCE_COMPANY_GSTIN,
      '24AAAAA0000A1Z5',
    );
    const platformStateCode = await SettingsService.get(
      SETTING_KEYS.FINANCE_STATE_CODE,
      '24',
    );

    const taxableAmountPaise = payment.campaign.platformFeePaise;
    const gstBps = BigInt(payment.campaign.gstBps ?? 1800);

    const buyerGstin = payment.company.companyProfile?.gstin;
    const buyerStateCode = buyerGstin ? buyerGstin.slice(0, 2) : '24';

    const isIntraState = buyerStateCode === platformStateCode;

    let cgstPaise = 0n;
    let sgstPaise = 0n;
    let igstPaise = 0n;

    if (isIntraState) {
      // 9% CGST + 9% SGST
      cgstPaise = (taxableAmountPaise * gstBps) / 20000n;
      sgstPaise = (taxableAmountPaise * gstBps) / 20000n;
    } else {
      // 18% IGST
      igstPaise = (taxableAmountPaise * gstBps) / 10000n;
    }

    const totalGstPaise = cgstPaise + sgstPaise + igstPaise;
    const totalAmountPaise = taxableAmountPaise + totalGstPaise;

    const doc = await client.taxDocument.create({
      data: {
        documentType: TAX_DOCUMENT_TYPES.TAX_INVOICE,
        documentNumber,
        financialYear,
        sequenceNumber,
        campaignId: payment.campaignId,
        companyId: payment.companyId,
        paymentId: payment.id,
        taxableAmountPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
        totalAmountPaise,
        metadata: {
          platformGstin,
          buyerGstin,
          buyerName: payment.company.companyProfile?.companyName ?? payment.company.companyProfile?.legalName ?? 'Valued Customer',
          campaignTitle: payment.campaign.title,
        },
      },
    });

    return doc;
  }

  static async generateCreditNote(
    refundId: string,
    tx?: TransactionClient,
  ): Promise<TaxDocument> {
    const client = tx ?? prisma;

    const refund = await client.refund.findUnique({
      where: { id: refundId },
      include: {
        campaign: true,
        company: {
          include: { companyProfile: true },
        },
      },
    });

    if (!refund) {
      throw new NotFoundError(`Refund ${refundId} not found`);
    }

    const { documentNumber, financialYear, sequenceNumber } =
      await this.getNextDocumentNumber(TAX_DOCUMENT_TYPES.CREDIT_NOTE, new Date(), client);

    const taxableAmountPaise = refund.amountPaise;
    const cgstPaise = 0n;
    const sgstPaise = 0n;
    const igstPaise = 0n;
    const totalAmountPaise = refund.amountPaise;

    const doc = await client.taxDocument.create({
      data: {
        documentType: TAX_DOCUMENT_TYPES.CREDIT_NOTE,
        documentNumber,
        financialYear,
        sequenceNumber,
        campaignId: refund.campaignId,
        companyId: refund.companyId,
        paymentId: refund.paymentId,
        taxableAmountPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
        totalAmountPaise,
        metadata: {
          refundReason: refund.reason,
          campaignTitle: refund.campaign.title,
        },
      },
    });

    return doc;
  }

  static async createPdfDocument(doc: TaxDocument): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const meta = (doc.metadata as Record<string, string>) ?? {};

    // Header
    page.drawText('AUTO POSTER ADVERTISING PLATFORM', {
      x: 50,
      y: 790,
      size: 16,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    const isInvoice = doc.documentType === TAX_DOCUMENT_TYPES.TAX_INVOICE;
    page.drawText(isInvoice ? 'TAX INVOICE' : 'CREDIT NOTE', {
      x: 50,
      y: 765,
      size: 12,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.7),
    });

    page.drawText(`Document Number: ${doc.documentNumber}`, {
      x: 50,
      y: 735,
      size: 10,
      font,
    });
    page.drawText(`Date: ${new Date(doc.issuedAt).toISOString().split('T')[0]}`, {
      x: 350,
      y: 735,
      size: 10,
      font,
    });

    // Seller & Buyer Details
    page.drawText('Platform GSTIN: ' + (meta.platformGstin ?? '24AAAAA0000A1Z5'), {
      x: 50,
      y: 705,
      size: 10,
      font,
    });
    page.drawText('Buyer: ' + (meta.buyerName ?? 'Customer'), {
      x: 50,
      y: 685,
      size: 10,
      font,
    });
    if (meta.buyerGstin) {
      page.drawText(`Buyer GSTIN: ${meta.buyerGstin}`, {
        x: 50,
        y: 665,
        size: 10,
        font,
      });
    }

    // Line items header
    let y = 620;
    page.drawText('Description', { x: 50, y, size: 10, font: fontBold });
    page.drawText('Taxable (INR)', { x: 300, y, size: 10, font: fontBold });
    page.drawText('Total (INR)', { x: 450, y, size: 10, font: fontBold });

    y -= 25;
    page.drawText(`Platform Advertising Services - ${meta.campaignTitle ?? 'Campaign'}`, {
      x: 50,
      y,
      size: 9,
      font,
    });
    page.drawText(`Rs. ${toRupees(doc.taxableAmountPaise)}`, { x: 300, y, size: 9, font });
    page.drawText(`Rs. ${toRupees(doc.totalAmountPaise)}`, { x: 450, y, size: 9, font });

    y -= 40;
    if (doc.cgstPaise > 0n) {
      page.drawText(`CGST (9%): Rs. ${toRupees(doc.cgstPaise)}`, { x: 300, y, size: 9, font });
      y -= 15;
    }
    if (doc.sgstPaise > 0n) {
      page.drawText(`SGST (9%): Rs. ${toRupees(doc.sgstPaise)}`, { x: 300, y, size: 9, font });
      y -= 15;
    }
    if (doc.igstPaise > 0n) {
      page.drawText(`IGST (18%): Rs. ${toRupees(doc.igstPaise)}`, { x: 300, y, size: 9, font });
      y -= 15;
    }

    y -= 20;
    page.drawText(`Total Amount: Rs. ${toRupees(doc.totalAmountPaise)}`, {
      x: 300,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.5, 0.1),
    });

    // Footer
    page.drawText('This is a computer-generated tax document and requires no physical signature.', {
      x: 50,
      y: 50,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    return pdfDoc.save();
  }
}
