import type { DeviceIdentity, ApiResponse, SyncStatus } from '../index';

describe('@face/shared-types', () => {
  it('DeviceIdentity accepts kiosk shape', () => {
    const d: DeviceIdentity = {
      deviceId: 'device_1',
      deviceType: 'KIOSK',
      appVersion: '0.1.0',
      platform: 'ANDROID',
      status: 'ACTIVE',
    };
    expect(d.deviceType).toBe('KIOSK');
  });

  it('ApiResponse discriminates success', () => {
    const ok: ApiResponse<number> = { success: true, data: 1 };
    const bad: ApiResponse<number> = { success: false, error: 'X', message: 'm' };
    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
  });

  it('SyncStatus union is closed', () => {
    const s: SyncStatus = 'PENDING';
    expect(['PENDING', 'SYNCING', 'SYNCED', 'REJECTED']).toContain(s);
  });
});
