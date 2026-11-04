import type { Request, Response, NextFunction } from 'express';
import { CampaignPaymentService } from './campaign-payment.service.js';
import { TaxDocumentService } from '../tax-documents/tax-document.service.js';
import {
  createPaymentOrderSchema,
  verifyPaymentSignatureSchema,
} from '@ap/shared-validation';
import { prisma } from '../../shared/db/index.js';
import { NotFoundError } from '../../shared/errors/index.js';

export class CampaignPaymentController {
  static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createPaymentOrderSchema.parse(req.body);
      const result = await CampaignPaymentService.createPaymentOrder(
        req.params.id!,
        req.auth!.userId,
        input.idempotencyKey,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = verifyPaymentSignatureSchema.parse(req.body);
      const result = await CampaignPaymentService.verifyPayment(
        input,
        req.auth!.userId,
      );
      res.status(200).json({
        success: true,
        data: {
          payment: {
            id: result.payment.id,
            status: result.payment.status,
            amountPaise: result.payment.amountPaise.toString(),
            method: result.payment.method,
            capturedAt: result.payment.capturedAt,
          },
          taxDocument: {
            id: result.taxDocument.id,
            documentNumber: result.taxDocument.documentNumber,
            totalAmountPaise: result.taxDocument.totalAmountPaise.toString(),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async listAllCompanyPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payments = await prisma.campaignPayment.findMany({
        where: {
          companyId: req.auth!.userId,
        },
        include: {
          campaign: { select: { id: true, title: true } },
          taxDocuments: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        data: {
          items: payments.map((p) => ({
            id: p.id,
            campaignId: p.campaignId,
            campaign: p.campaign,
            amountPaise: p.amountPaise.toString(),
            gatewayFeePaise: p.gatewayFeePaise.toString(),
            currency: p.currency,
            gateway: p.gateway,
            gatewayOrderId: p.gatewayOrderId,
            gatewayPaymentId: p.gatewayPaymentId,
            status: p.status,
            method: p.method,
            capturedAt: p.capturedAt,
            createdAt: p.createdAt,
            taxDocuments: p.taxDocuments.map((td) => ({
              id: td.id,
              documentNumber: td.documentNumber,
              documentType: td.documentType,
              totalAmountPaise: td.totalAmountPaise.toString(),
            })),
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payments = await prisma.campaignPayment.findMany({
        where: {
          campaignId: req.params.id,
          companyId: req.auth!.userId,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        data: payments.map((p) => ({
          id: p.id,
          campaignId: p.campaignId,
          amountPaise: p.amountPaise.toString(),
          gatewayFeePaise: p.gatewayFeePaise.toString(),
          currency: p.currency,
          gateway: p.gateway,
          gatewayOrderId: p.gatewayOrderId,
          gatewayPaymentId: p.gatewayPaymentId,
          status: p.status,
          method: p.method,
          capturedAt: p.capturedAt,
          createdAt: p.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docs = await prisma.taxDocument.findMany({
        where: {
          campaignId: req.params.id,
          companyId: req.auth!.userId,
        },
        orderBy: { issuedAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        data: docs.map((d) => ({
          id: d.id,
          documentType: d.documentType,
          documentNumber: d.documentNumber,
          financialYear: d.financialYear,
          taxableAmountPaise: d.taxableAmountPaise.toString(),
          cgstPaise: d.cgstPaise.toString(),
          sgstPaise: d.sgstPaise.toString(),
          igstPaise: d.igstPaise.toString(),
          totalAmountPaise: d.totalAmountPaise.toString(),
          issuedAt: d.issuedAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async downloadPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await prisma.taxDocument.findUnique({
        where: { id: req.params.id },
      });

      if (!doc) {
        throw new NotFoundError('Tax document not found');
      }

      // If user is company, ensure ownership
      if (req.auth?.role === 'COMPANY' && doc.companyId !== req.auth.userId) {
        throw new NotFoundError('Tax document not found');
      }

      const pdfBytes = await TaxDocumentService.createPdfDocument(doc);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${doc.documentNumber.replace(/\//g, '_')}.pdf"`,
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = (req.headers['x-razorpay-signature'] as string) ?? '';
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const result = await CampaignPaymentService.processWebhook(rawBody, signature);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
