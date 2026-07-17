import { describe, it, expect } from 'vitest';
import { isBlockedTarget } from '../../api/orthanc-proxy';

/**
 * Guarda anti-SSRF do proxy de Orthanc na nuvem: só HTTPS, nunca IP privado/
 * loopback/metadados, e host restrito à allowlist de sufixos (padrão *.ts.net,
 * o que também fecha DNS-rebinding — domínio de atacante resolvendo para IP
 * privado nunca termina em .ts.net).
 */
describe('isBlockedTarget (anti-SSRF do orthanc-proxy)', () => {
  const check = (url: string) => isBlockedTarget(new URL(url));

  it('aceita host do Tailscale Funnel via HTTPS', () => {
    expect(check('https://orthanc-server.tail861dda.ts.net/system')).toBeNull();
  });

  it('recusa HTTP puro (só HTTPS na nuvem)', () => {
    expect(check('http://orthanc-server.tail861dda.ts.net/system')).toMatch(/HTTPS/);
  });

  it('recusa localhost e domínios internos', () => {
    expect(check('https://localhost:8042/system')).toBeTruthy();
    expect(check('https://foo.localhost/system')).toBeTruthy();
    expect(check('https://metadata.google.internal/x')).toBeTruthy();
    expect(check('https://algo.internal/x')).toBeTruthy();
  });

  it('recusa IPs privados/reservados literais', () => {
    for (const ip of ['10.0.0.5', '127.0.0.1', '192.168.8.50', '172.16.0.1', '169.254.169.254', '0.0.0.0']) {
      expect(check(`https://${ip}/system`)).toBeTruthy();
    }
  });

  it('recusa host público fora da allowlist de sufixos (anti DNS-rebinding)', () => {
    expect(check('https://atacante.example.com/system')).toMatch(/ts\.net/);
    expect(check('https://8.8.8.8/system')).toMatch(/ts\.net/);
  });

  it('não aceita sufixo forjado no meio do nome (endsWith real)', () => {
    expect(check('https://fake.ts.net.example.com/system')).toMatch(/ts\.net/);
  });
});
