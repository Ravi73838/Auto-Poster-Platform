export interface GstVerificationResult {
  isValid: boolean;
  legalName?: string;
  tradeName?: string;
  status?: string;
  verifiedAt: Date;
}

export interface GstVerifier {
  verify(gstin: string): Promise<GstVerificationResult>;
}

/**
 * Manual GST verifier stub.
 * In a future phase or production deployment, this can be integrated with
 * the official GSTN portal API or a third-party GST compliance provider.
 */
export class ManualGstVerifier implements GstVerifier {
  async verify(_gstin: string): Promise<GstVerificationResult> {
    return {
      isValid: true,
      verifiedAt: new Date(),
    };
  }
}

export const gstVerifier = new ManualGstVerifier();

