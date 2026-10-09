import test from 'node:test';
import assert from 'node:assert/strict';
import { startupDiagnostic } from '../src/startup-diagnostic.js';
import { configureMongoDns } from '../src/dns-config.js';

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

test('DNS override is opt-in and rejects invalid configuration without exposing its contents', () => {
  let applied;
  const apply = (servers) => { applied = servers; };
  assert.equal(configureMongoDns('', apply), false);
  assert.equal(applied, undefined);
  assert.equal(configureMongoDns(' 1.1.1.1, 8.8.8.8 ', apply), true);
  assert.deepEqual(applied, ['1.1.1.1', '8.8.8.8']);
  assert.throws(() => configureMongoDns('mongodb+srv://user:secret@host/', apply), (error) => {
    assert.match(startupDiagnostic(error), /^\[MONGO_DNS_CONFIG\]/);
    assert.ok(!startupDiagnostic(error).includes('secret'));
    return true;
  });
  assert.match(startupDiagnostic({ code: 'ESERVFAIL', syscall: 'querySrv' }), /^\[MONGO_DNS\] ESERVFAIL:/);
});

test('TLS alert 80 is distinguished from certificate expiry without exposing error text', () => {
  const secret = 'mongodb+srv://user:secret-password@host/';
  const diagnostic = startupDiagnostic({ name: 'MongoServerSelectionError', cause: {
    code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', message: secret,
  } });
  assert.match(diagnostic, /TLS alert 80/);
  assert.match(diagnostic, /Network Access/);
  assert.ok(!diagnostic.includes(secret));
  assert.match(startupDiagnostic({ code: 'CERT_HAS_EXPIRED', message: secret }), /CERT_HAS_EXPIRED/);
  assert.ok(!startupDiagnostic({ code: 'CERT_HAS_EXPIRED', message: secret }).includes(secret));
});
