import {isIP} from 'node:net';
// Only the local tunnel process may supply Cloudflare client-address headers.
// A direct LAN client cannot set its own rate-limit identity or HTTPS status.
export function requestTransport(request){
  const remote=request.socket.remoteAddress??'unknown';
  const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote);
  const client=request.headers['cf-connecting-ip'];
  const tunnel=loopback&&typeof client==='string'&&isIP(client)&&typeof request.headers['cf-ray']==='string';
  return {ip:tunnel?client:remote,secure:Boolean(tunnel&&request.headers['x-forwarded-proto']==='https')};
}
