/**
 * PR-VER-2026-08-07 (PAYMENT_GATEWAY P0-4) — change-only credential
 * semantics for the payment-gateway edit dialog.
 *
 * The API returns stored credentials decrypted, so the edit form must:
 *   1. NEVER pre-populate the secret fields (echoing them back re-exposes
 *      the plaintext secret in the DOM);
 *   2. only include a secret in the update payload when the admin typed a
 *      new value (an empty string would silently wipe the stored secret).
 *
 * Both invariants live in pure functions extracted from
 * PaymentGatewayEditDialog so they're testable under the node env. A
 * source-contract check additionally pins that the component wires the
 * helpers (a future edit pre-populating secrets directly in the useEffect
 * would fail it).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  gatewayFormDefaults,
  buildGatewayUpdateFields,
} from '@/components/admin/screens/payment-gateway/PaymentGatewayEditDialog';
import type { PaymentGateway } from '@/components/admin/screens/payment-gateway/usePaymentGateways';

const gateway: PaymentGateway = {
  id: 'pg-1',
  name: 'Razorpay',
  provider: 'razorpay',
  isActive: true,
  mdrBearer: 'RIDER',
  extraFeePercent: 2.5,
  keyId: 'rzp_test_abc',
  keySecret: 'plaintext-key-secret',
  merchantId: 'M123',
  webhookSecret: 'plaintext-webhook-secret',
  apiEndpoint: 'https://api.razorpay.com',
  environment: 'TEST',
};

describe('gatewayFormDefaults — never pre-populate secrets', () => {
  it('leaves keySecret blank even when the gateway has one stored', () => {
    expect(gatewayFormDefaults(gateway).keySecret).toBe('');
  });

  it('leaves webhookSecret blank even when the gateway has one stored', () => {
    expect(gatewayFormDefaults(gateway).webhookSecret).toBe('');
  });

  it('carries the non-secret fields through', () => {
    const d = gatewayFormDefaults(gateway);
    expect(d.name).toBe('Razorpay');
    expect(d.mdrBearer).toBe('RIDER');
    expect(d.extraFeePercent).toBe(2.5);
    expect(d.keyId).toBe('rzp_test_abc');
    expect(d.merchantId).toBe('M123');
    expect(d.apiEndpoint).toBe('https://api.razorpay.com');
    expect(d.environment).toBe('TEST');
  });

  it('falls back to defaults for a gateway with null optionals', () => {
    const d = gatewayFormDefaults({
      ...gateway,
      keyId: null,
      merchantId: null,
      apiEndpoint: null,
      extraFeePercent: undefined as unknown as number,
    });
    expect(d.keyId).toBe('');
    expect(d.merchantId).toBe('');
    expect(d.apiEndpoint).toBe('');
    expect(d.extraFeePercent).toBe(2.5);
  });
});

describe('buildGatewayUpdateFields — change-only secret semantics', () => {
  const formBase = gatewayFormDefaults(gateway);

  it('omits both secret keys when the admin typed nothing', () => {
    const fields = buildGatewayUpdateFields(formBase);
    expect(fields).not.toHaveProperty('keySecret');
    expect(fields).not.toHaveProperty('webhookSecret');
  });

  it('omits secrets that are whitespace-only', () => {
    const fields = buildGatewayUpdateFields({
      ...formBase,
      keySecret: '   ',
      webhookSecret: '\t\n',
    });
    expect(fields).not.toHaveProperty('keySecret');
    expect(fields).not.toHaveProperty('webhookSecret');
  });

  it('includes a secret only when a new value was typed', () => {
    const fields = buildGatewayUpdateFields({
      ...formBase,
      keySecret: 'new-key-secret',
    });
    expect(fields.keySecret).toBe('new-key-secret');
    expect(fields).not.toHaveProperty('webhookSecret');
  });

  it('includes both secrets when both were typed', () => {
    const fields = buildGatewayUpdateFields({
      ...formBase,
      keySecret: 'new-key-secret',
      webhookSecret: 'new-webhook-secret',
    });
    expect(fields.keySecret).toBe('new-key-secret');
    expect(fields.webhookSecret).toBe('new-webhook-secret');
  });

  it('always includes the non-secret editable fields', () => {
    const fields = buildGatewayUpdateFields({
      ...formBase,
      name: 'Renamed Gateway',
      environment: 'LIVE',
    });
    expect(fields.name).toBe('Renamed Gateway');
    expect(fields.mdrBearer).toBe('RIDER');
    expect(fields.extraFeePercent).toBe(2.5);
    expect(fields.keyId).toBe('rzp_test_abc');
    expect(fields.merchantId).toBe('M123');
    expect(fields.apiEndpoint).toBe('https://api.razorpay.com');
    expect(fields.environment).toBe('LIVE');
  });
});

describe('PaymentGatewayEditDialog — component wiring (source contract)', () => {
  const DIALOG_SRC = resolve(
    __dirname,
    '../../src/components/admin/screens/payment-gateway/PaymentGatewayEditDialog.tsx'
  );

  function src(): string {
    return readFileSync(DIALOG_SRC, 'utf-8');
  }

  it('initializes the secret fields from the helper defaults, never from the gateway prop', () => {
    const s = src();
    // The useEffect must route through gatewayFormDefaults…
    expect(s).toMatch(/setFormKeySecret\(defaults\.keySecret\)/);
    expect(s).toMatch(/setFormWebhookSecret\(defaults\.webhookSecret\)/);
    // …and must never read the stored secrets straight off the gateway.
    expect(s).not.toMatch(/setFormKeySecret\(gateway\.keySecret/);
    expect(s).not.toMatch(/setFormWebhookSecret\(gateway\.webhookSecret/);
  });

  it('clears the credential state when the dialog closes', () => {
    const s = src();
    expect(s).toMatch(/setFormKeySecret\(''\)/);
    expect(s).toMatch(/setFormWebhookSecret\(''\)/);
  });

  it('builds the save payload through the change-only helper', () => {
    const s = src();
    expect(s).toMatch(/const fields = buildGatewayUpdateFields\(/);
  });
});
