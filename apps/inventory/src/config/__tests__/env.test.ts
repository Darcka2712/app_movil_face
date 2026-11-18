import { readEnv, getEnv } from '../env';

describe('readEnv', () => {
  it('defaults to development with localhost allowed', () => {
    expect(
      readEnv({
        EXPO_PUBLIC_ENVIRONMENT: 'development',
        EXPO_PUBLIC_API_BASE_URL: 'http://localhost:3002/api/v1',
      }),
    ).toEqual({
      environment: 'development',
      apiBaseUrl: 'http://localhost:3002/api/v1',
    });
  });

  it('rejects http outside development', () => {
    expect(() =>
      readEnv({
        EXPO_PUBLIC_ENVIRONMENT: 'production',
        EXPO_PUBLIC_API_BASE_URL: 'http://insecure.example/api/v1',
      }),
    ).toThrow(/HTTPS/);
  });

  it('rejects unknown environment', () => {
    expect(() =>
      readEnv({
        EXPO_PUBLIC_ENVIRONMENT: 'qa',
        EXPO_PUBLIC_API_BASE_URL: 'https://ok.example/api/v1',
      }),
    ).toThrow(/Invalid EXPO_PUBLIC_ENVIRONMENT/);
  });

  it('requires apiBaseUrl', () => {
    expect(() =>
      readEnv({
        EXPO_PUBLIC_ENVIRONMENT: 'development',
      }),
    ).toThrow(/required/);
  });
});

describe('getEnv', () => {
  it('delegates to process.env without throwing when vars are set', () => {
    const prevEnv = process.env.EXPO_PUBLIC_ENVIRONMENT;
    const prevUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_ENVIRONMENT = 'development';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3002/api/v1';
    try {
      expect(getEnv()).toEqual({
        environment: 'development',
        apiBaseUrl: 'http://localhost:3002/api/v1',
      });
    } finally {
      if (prevEnv === undefined) delete process.env.EXPO_PUBLIC_ENVIRONMENT;
      else process.env.EXPO_PUBLIC_ENVIRONMENT = prevEnv;
      if (prevUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
      else process.env.EXPO_PUBLIC_API_BASE_URL = prevUrl;
    }
  });
});
