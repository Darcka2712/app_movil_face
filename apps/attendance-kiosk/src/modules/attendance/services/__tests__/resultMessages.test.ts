import { resultMessage, successMessage } from '../resultMessages';

describe('resultMessage', () => {
  it('maps each failure code to Spanish kiosk copy', () => {
    expect(resultMessage('UNKNOWN_EMPLOYEE')).toBe('Codigo no encontrado');
    expect(resultMessage('DAY_CLOSED')).toBe('Jornada cerrada hoy');
    expect(resultMessage('ENQUEUE_FAILED')).toBe(
      'No se pudo guardar — intente de nuevo',
    );
    expect(resultMessage('NO_DEVICE_KEY')).toBe('Dispositivo no provisionado');
  });
});

describe('successMessage', () => {
  it('labels ENTRY as Entrada and EXIT as Salida', () => {
    expect(successMessage('ENTRY')).toBe('Guardado en dispositivo — Entrada');
    expect(successMessage('EXIT')).toBe('Guardado en dispositivo — Salida');
  });
});
