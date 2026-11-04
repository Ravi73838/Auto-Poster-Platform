export interface VirusScanResult {
  isClean: boolean;
  threatName?: string;
  scannedAt: Date;
}

export interface FileVirusScanner {
  scan(data: Buffer, filename: string): Promise<VirusScanResult>;
}

/**
 * No-operation virus scanner stub.
 * In production, this will interface with a ClamAV daemon, VirusTotal API,
 * or cloud provider container malware scanner.
 */
export class NoopFileVirusScanner implements FileVirusScanner {
  public async scan(_data: Buffer, _filename: string): Promise<VirusScanResult> {
    return {
      isClean: true,
      scannedAt: new Date(),
    };
  }
}

export const fileVirusScanner = new NoopFileVirusScanner();

