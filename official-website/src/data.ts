import { DownloadPlatform } from './types';
import pkg from '../package.json';

export const DOWNLOADS: DownloadPlatform[] = [
  {
    id: 'mac-silicon',
    name: 'macOS (Apple Silicon)',
    os: 'mac',
    architecture: 'Apple M1/M2/M3/M4 系列芯片',
    version: `v${pkg.version}`,
    fileSize: '34.2 MB',
    fileFormat: '.dmg (ARM64)'
  },
  {
    id: 'mac-intel',
    name: 'macOS (Intel Core)',
    os: 'mac',
    architecture: 'Intel 酷睿系列芯片',
    version: `v${pkg.version}`,
    fileSize: '36.8 MB',
    fileFormat: '.dmg (x86_64)'
  },
  {
    id: 'win-x64',
    name: 'Windows 11 / 10 (x64)',
    os: 'windows',
    architecture: '主流 Intel / AMD 64位 处理器',
    version: `v${pkg.version}`,
    fileSize: '42.1 MB',
    fileFormat: '.exe / .msi'
  },
  {
    id: 'linux-deb',
    name: 'Linux Debian / Ubuntu',
    os: 'linux',
    architecture: 'x86_64 / ARM64',
    version: `v${pkg.version}`,
    fileSize: '29.9 MB',
    fileFormat: '.deb'
  },
  {
    id: 'linux-appimage',
    name: 'Linux Universal AppImage',
    os: 'linux',
    architecture: 'x86_64 通用架构',
    version: `v${pkg.version}`,
    fileSize: '35.4 MB',
    fileFormat: '.AppImage'
  }
];
