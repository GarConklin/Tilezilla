'use strict';

/**
 * Minimal dependency-free Redis (RESP2) client used by the solver farm worker and the
 * Windows admin CLI. Supports pipelining (call() many times without awaiting), binary
 * bulk strings (Buffers in and out) and AUTH. Bulk replies come back as Buffers;
 * use toStr() to convert replies to strings.
 */

const net = require('net');
const tls = require('tls');

const CRLF = Buffer.from('\r\n');

function encodeCommand(args) {
  const parts = [Buffer.from(`*${args.length}\r\n`)];
  for (const a of args) {
    const b = Buffer.isBuffer(a) ? a : Buffer.from(String(a), 'utf8');
    parts.push(Buffer.from(`$${b.length}\r\n`), b, CRLF);
  }
  return Buffer.concat(parts);
}

/** Parse one reply at offset. Returns { value, offset } or { need } when incomplete. */
function parseReply(buf, offset) {
  if (offset >= buf.length) return { need: offset + 1 };
  const type = buf[offset];
  const eol = buf.indexOf(CRLF, offset);
  if (eol < 0) return { need: buf.length + 1 };
  const line = buf.toString('utf8', offset + 1, eol);
  const next = eol + 2;
  switch (type) {
    case 0x2b: // +
      return { value: line, offset: next };
    case 0x2d: // -
      return { value: new RedisError(line), offset: next };
    case 0x3a: // :
      return { value: Number(line), offset: next };
    case 0x24: { // $
      const len = parseInt(line, 10);
      if (len < 0) return { value: null, offset: next };
      const end = next + len;
      if (buf.length < end + 2) return { need: end + 2 };
      return { value: buf.subarray(next, end), offset: end + 2 };
    }
    case 0x2a: { // *
      const n = parseInt(line, 10);
      if (n < 0) return { value: null, offset: next };
      const arr = new Array(n);
      let off = next;
      for (let i = 0; i < n; i++) {
        const r = parseReply(buf, off);
        if (r.need !== undefined) return r;
        arr[i] = r.value;
        off = r.offset;
      }
      return { value: arr, offset: off };
    }
    default:
      throw new Error(`RESP protocol error: unexpected byte 0x${type.toString(16)}`);
  }
}

class RedisError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'RedisError';
  }
}

function toStr(v) {
  if (Buffer.isBuffer(v)) return v.toString('utf8');
  if (Array.isArray(v)) return v.map(toStr);
  return v;
}

class RedisClient {
  /**
   * tls: false | true | { servername, ca (PEM string/Buffer), rejectUnauthorized (default true) }
   * username: optional Redis 6+ ACL user (AUTH username password).
   */
  constructor({ host = '127.0.0.1', port = 6379, password = null, username = null, tls: tlsOpt = false, connectTimeoutMs = 10000 } = {}) {
    this.host = host;
    this.port = Number(port);
    this.password = password || null;
    this.username = username || null;
    this.tls = tlsOpt;
    this.connectTimeoutMs = connectTimeoutMs;
    this.socket = null;
    this.pending = [];
    this.chunks = [];
    this.chunkBytes = 0;
    this.need = 0;
    this.closed = true;
  }

  connect() {
    return new Promise((resolve, reject) => {
      let sock;
      let connectEvent = 'connect';
      if (this.tls) {
        const o = typeof this.tls === 'object' ? this.tls : {};
        sock = tls.connect({
          host: this.host,
          port: this.port,
          servername: o.servername || (net.isIP(this.host) ? undefined : this.host),
          ca: o.ca || undefined,
          rejectUnauthorized: o.rejectUnauthorized !== false,
        });
        connectEvent = 'secureConnect';
      } else {
        sock = net.createConnection({ host: this.host, port: this.port });
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        sock.destroy();
        reject(new Error(`Timed out connecting to Redis at ${this.host}:${this.port}`));
      }, this.connectTimeoutMs);
      sock.setNoDelay(true);
      sock.setKeepAlive(true, 15000);
      sock.on(connectEvent, async () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.socket = sock;
        this.closed = false;
        try {
          if (this.password && this.username) await this.call('AUTH', this.username, this.password);
          else if (this.password) await this.call('AUTH', this.password);
          await this.call('PING');
          resolve(this);
        } catch (e) {
          this.close();
          reject(e);
        }
      });
      sock.on('data', (chunk) => this._onData(chunk));
      sock.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
        this._failAll(err);
      });
      sock.on('close', () => {
        this.closed = true;
        this._failAll(new Error('Redis connection closed'));
      });
    });
  }

  _failAll(err) {
    const p = this.pending;
    this.pending = [];
    for (const { reject } of p) reject(err);
  }

  _onData(chunk) {
    this.chunks.push(chunk);
    this.chunkBytes += chunk.length;
    if (this.chunkBytes < this.need) return;
    let buf = this.chunks.length === 1 ? this.chunks[0] : Buffer.concat(this.chunks, this.chunkBytes);
    this.chunks = [];
    this.chunkBytes = 0;
    this.need = 0;
    let off = 0;
    while (off < buf.length) {
      let r;
      try {
        r = parseReply(buf, off);
      } catch (e) {
        this._failAll(e);
        this.close();
        return;
      }
      if (r.need !== undefined) {
        const rest = buf.subarray(off);
        this.chunks = [rest];
        this.chunkBytes = rest.length;
        this.need = r.need - off;
        return;
      }
      off = r.offset;
      const waiter = this.pending.shift();
      if (!waiter) continue;
      if (r.value instanceof RedisError) waiter.reject(r.value);
      else waiter.resolve(r.value);
    }
  }

  /** Send one command. Returns a promise of the raw reply (Buffers for bulk strings). */
  call(...args) {
    if (this.closed || !this.socket) return Promise.reject(new Error('Redis connection is not open'));
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.socket.write(encodeCommand(args));
    });
  }

  /** Same as call() but converts bulk replies to strings. */
  async str(...args) {
    return toStr(await this.call(...args));
  }

  close() {
    this.closed = true;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}

/**
 * Build RedisClient options from plain settings (env vars or a JSON config):
 * { host, port, password, passwordFile, username, tls, tlsServername, tlsCaFile, tlsInsecure }.
 * Values may be strings ("1"/"true" for booleans).
 */
function clientOptions(s) {
  const fs = require('fs');
  const on = (v) => v === true || v === 1 || /^(1|true|yes)$/i.test(String(v || ''));
  let password = s.password || null;
  if (!password && s.passwordFile && fs.existsSync(s.passwordFile)) {
    password = fs.readFileSync(s.passwordFile, 'utf8').trim();
  }
  let tlsOpt = false;
  if (on(s.tls)) {
    tlsOpt = {
      servername: s.tlsServername || undefined,
      ca: s.tlsCaFile ? fs.readFileSync(s.tlsCaFile) : undefined,
      rejectUnauthorized: !on(s.tlsInsecure),
    };
  }
  return {
    host: s.host || '127.0.0.1',
    port: Number(s.port || 6379),
    password,
    username: s.username || null,
    tls: tlsOpt,
  };
}

module.exports = { RedisClient, RedisError, toStr, clientOptions };
