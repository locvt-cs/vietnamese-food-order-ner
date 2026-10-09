import test from 'node:test';
import assert from 'node:assert/strict';
import { startupDiagnostic } from '../src/startup-diagnostic.js';

test('distinguishes credentials, permissions and malformed URI without exposing driver text', () => {
  const secret = 'mongodb+srv://user:secret-password@private-host/';
  for (const [error, expected] of [
    [{ code: 18, message: secret }, 'MONGO_AUTH'],
    [{ code: 8000, message: `bad auth: authentication failed ${secret}` }, 'MONGO_AUTH'],
    [{ code: 13, message: secret }, 'MONGO_PERMISSION'],
    [{ name: 'MongoParseError', message: secret }, 'MONGO_URI'],
    [{ message: secret }, 'STARTUP_UNKNOWN'],
  ]) {
    const diagnostic = startupDiagnostic(error);
    assert.ok(diagnostic.startsWith(`[${expected}]`));
    assert.ok(!diagnostic.includes(secret));
    assert.ok(!diagnostic.includes('secret-password'));
  }
});
test('unwraps network selection causes and distinguishes DNS from generic network failure', () => {
  const error = { name: 'MongoServerSelectionError', reason: { servers: new Map([
    ['host', { error: { cause: { code: 'ECONNREFUSED', syscall: 'querySrv' } } }],
  ]) } };
  assert.match(startupDiagnostic(error), /^\[MONGO_DNS\]/);
  assert.match(startupDiagnostic({ name: 'MongoServerSelectionError' }), /^\[MONGO_NETWORK\]/);
  assert.match(startupDiagnostic({ cause: { code: 'CERT_HAS_EXPIRED' } }), /^\[MONGO_TLS\]/);
});
test('handles cyclic causes and reports initialization failure separately', () => {
  const error = {}; error.cause = error;
  assert.match(startupDiagnostic(error, 'initialize'), /^\[MONGO_INITIALIZE\]/);
});
