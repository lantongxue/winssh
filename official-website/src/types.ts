export interface DownloadPlatform {
  id: string;
  name: string;
  os: 'mac' | 'windows' | 'linux';
  architecture: string;
  version: string;
  fileSize: string;
  fileFormat: string;
}
