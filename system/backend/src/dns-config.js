import { setServers } from 'node:dns/promises';
import { isIP } from 'node:net';

// Opt-in, process-local DNS for MongoDB SRV/TXT queries. No Windows settings change.
export function configureMongoDns(value, apply = setServers) {
  if (!value?.trim()) return false;
  const servers = value.split(',').map((server) => server.trim());
  if (!servers.every((server) => isIP(server))) {
    const error = new Error('MONGODB_DNS_SERVERS must contain comma-separated IP addresses.');
    error.code = 'DNS_CONFIG';
    throw error;
  }
  apply(servers);
  return true;
}
