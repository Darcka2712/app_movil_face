export type DeviceType = 'KIOSK' | 'WORKFORCE' | 'INVENTORY';

export type DeviceStatus = 'ACTIVE' | 'BLOCKED';

export interface DeviceIdentity {
  deviceId: string;
  deviceType: DeviceType;
  appVersion: string;
  platform: 'ANDROID';
  registeredAt?: string;
  status: DeviceStatus;
}
