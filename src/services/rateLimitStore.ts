import net from 'node:net';
import tls from 'node:tls';
import { env } from '../config/env';
import { logger } from '../utils/logger';

type RateLimitResult = {
  count: number;
  retryAfterMs: number;
};

interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitResult>;
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RedisResponseValue = string | number | null | RedisResponseValue[] | RedisErrorReply;

type RedisConnectionOptions = {
  host: string;
  port: number;
  useTls: boolean;
  username?: string;
  password?: string;
  database?: number;
  timeoutMs: number;
};

class RedisErrorReply extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisErrorReply';
  }
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitEntry>();

  private sweepExpiredEntries(now: number) {
    if (this.buckets.size < 5000) {
      return;
    }

    for (const [key, entry] of this.buckets.entries()) {
      if (entry.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweepExpiredEntries(now);

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });

      return {
        count: 1,
        retryAfterMs: windowMs
      };
    }

    existing.count += 1;
    this.buckets.set(key, existing);

    return {
      count: existing.count,
      retryAfterMs: Math.max(0, existing.resetAt - now)
    };
  }
}

class RespParser {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): RedisResponseValue[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const values: RedisResponseValue[] = [];

    while (true) {
      const parsed = this.parseValue(0);
      if (!parsed) {
        break;
      }

      values.push(parsed.value);
      this.buffer = this.buffer.subarray(parsed.nextOffset);
    }

    return values;
  }

  private parseValue(offset: number): { value: RedisResponseValue; nextOffset: number } | null {
    if (this.buffer.length <= offset) {
      return null;
    }

    const prefix = String.fromCharCode(this.buffer[offset]);
    switch (prefix) {
      case '+':
        return this.parseSimpleString(offset + 1);
      case '-':
        return this.parseError(offset + 1);
      case ':':
        return this.parseInteger(offset + 1);
      case '$':
        return this.parseBulkString(offset + 1);
      case '*':
        return this.parseArray(offset + 1);
      default:
        throw new Error(`Unsupported Redis response prefix: ${prefix}`);
    }
  }

  private parseSimpleString(offset: number) {
    const line = this.readLine(offset);
    if (!line) {
      return null;
    }

    return {
      value: line.value,
      nextOffset: line.nextOffset
    };
  }

  private parseError(offset: number) {
    const line = this.readLine(offset);
    if (!line) {
      return null;
    }

    return {
      value: new RedisErrorReply(line.value),
      nextOffset: line.nextOffset
    };
  }

  private parseInteger(offset: number) {
    const line = this.readLine(offset);
    if (!line) {
      return null;
    }

    return {
      value: Number(line.value),
      nextOffset: line.nextOffset
    };
  }

  private parseBulkString(offset: number) {
    const line = this.readLine(offset);
    if (!line) {
      return null;
    }

    const length = Number(line.value);
    if (length === -1) {
      return {
        value: null,
        nextOffset: line.nextOffset
      };
    }

    const endOffset = line.nextOffset + length;
    if (this.buffer.length < endOffset + 2) {
      return null;
    }

    const value = this.buffer.subarray(line.nextOffset, endOffset).toString('utf8');
    return {
      value,
      nextOffset: endOffset + 2
    };
  }

  private parseArray(offset: number) {
    const line = this.readLine(offset);
    if (!line) {
      return null;
    }

    const length = Number(line.value);
    if (length === -1) {
      return {
        value: null,
        nextOffset: line.nextOffset
      };
    }

    const items: RedisResponseValue[] = [];
    let currentOffset = line.nextOffset;

    for (let index = 0; index < length; index += 1) {
      const item = this.parseValue(currentOffset);
      if (!item) {
        return null;
      }

      items.push(item.value);
      currentOffset = item.nextOffset;
    }

    return {
      value: items,
      nextOffset: currentOffset
    };
  }

  private readLine(offset: number) {
    const endIndex = this.buffer.indexOf('\r\n', offset, 'utf8');
    if (endIndex === -1) {
      return null;
    }

    return {
      value: this.buffer.subarray(offset, endIndex).toString('utf8'),
      nextOffset: endIndex + 2
    };
  }
}

const serializeCommand = (parts: string[]) => {
  const serializedParts = parts
    .map((part) => {
      const value = String(part);
      return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    })
    .join('');

  return `*${parts.length}\r\n${serializedParts}`;
};

const parseRedisUrl = (value: string): RedisConnectionOptions => {
  const parsed = new URL(value);
  const database = parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : 0;

  if (!Number.isInteger(database) || database < 0) {
    throw new Error('RATE_LIMIT_REDIS_URL must use a numeric database path');
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : parsed.protocol === 'rediss:' ? 6380 : 6379,
    useTls: parsed.protocol === 'rediss:',
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database,
    timeoutMs: env.RATE_LIMIT_REDIS_TIMEOUT_MS
  };
};

class RedisRateLimitStore implements RateLimitStore {
  private readonly connection: RedisConnectionOptions;

  constructor(redisUrl: string) {
    this.connection = parseRedisUrl(redisUrl);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const namespacedKey = `${env.RATE_LIMIT_REDIS_KEY_PREFIX}:${key}`;
    const responses = await this.executePipeline([
      ...this.getSetupCommands(),
      [
        'EVAL',
        [
          'local current = redis.call("INCR", KEYS[1])',
          'if current == 1 then',
          '  redis.call("PEXPIRE", KEYS[1], ARGV[1])',
          'end',
          'local ttl = redis.call("PTTL", KEYS[1])',
          'return {current, ttl}'
        ].join(' '),
        '1',
        namespacedKey,
        String(windowMs)
      ]
    ]);

    const result = responses[responses.length - 1];
    if (!Array.isArray(result) || typeof result[0] !== 'number' || typeof result[1] !== 'number') {
      throw new Error('Unexpected Redis rate limit response');
    }

    return {
      count: result[0],
      retryAfterMs: Math.max(0, result[1])
    };
  }

  private getSetupCommands() {
    const commands: string[][] = [];

    if (this.connection.password) {
      commands.push(
        this.connection.username
          ? ['AUTH', this.connection.username, this.connection.password]
          : ['AUTH', this.connection.password]
      );
    }

    if (this.connection.database && this.connection.database > 0) {
      commands.push(['SELECT', String(this.connection.database)]);
    }

    return commands;
  }

  private async executePipeline(commands: string[][]): Promise<RedisResponseValue[]> {
    const payload = commands.map((command) => serializeCommand(command)).join('');

    return new Promise((resolve, reject) => {
      const parser = new RespParser();
      const responses: RedisResponseValue[] = [];
      const socket = this.connection.useTls
        ? (() => {
            const secureSocket = tls.connect(
              {
                host: this.connection.host,
                port: this.connection.port,
                servername: this.connection.host
              },
              () => {
                secureSocket.write(payload);
              }
            );

            return secureSocket;
          })()
        : (() => {
            const plainSocket = net.createConnection(
              {
                host: this.connection.host,
                port: this.connection.port
              },
              () => {
                plainSocket.write(payload);
              }
            );

            return plainSocket;
          })();

      let settled = false;

      const finish = (error?: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.removeAllListeners();
        socket.destroy();

        if (error) {
          reject(error);
          return;
        }

        resolve(responses);
      };

      socket.setTimeout(this.connection.timeoutMs, () => {
        finish(new Error('Redis rate limit request timed out'));
      });

      socket.on('error', (error) => {
        finish(error);
      });

      socket.on('data', (chunk) => {
        try {
          const parsed = parser.push(chunk);
          responses.push(...parsed);
        } catch (error) {
          finish(error instanceof Error ? error : new Error('Failed to parse Redis response'));
          return;
        }

        if (responses.length < commands.length) {
          return;
        }

        const errorReply = responses.find((response) => response instanceof RedisErrorReply);
        if (errorReply instanceof RedisErrorReply) {
          finish(errorReply);
          return;
        }

        finish();
      });

      socket.on('end', () => {
        if (!settled && responses.length < commands.length) {
          finish(new Error('Redis connection closed before completing rate limit request'));
        }
      });
    });
  }
}

class FallbackRateLimitStore implements RateLimitStore {
  constructor(
    private readonly primary: RateLimitStore,
    private readonly fallback: RateLimitStore
  ) {}

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    try {
      return await this.primary.increment(key, windowMs);
    } catch (error) {
      logger.error('http.rate_limit.store_fallback', {
        key,
        message: error instanceof Error ? error.message : 'Unknown rate limit store error',
        configuredStore: env.RATE_LIMIT_STORE
      });
      return this.fallback.increment(key, windowMs);
    }
  }
}

const memoryStore = new MemoryRateLimitStore();
let store: RateLimitStore | null = null;

const getRateLimitStore = () => {
  if (store) {
    return store;
  }

  if (env.RATE_LIMIT_STORE === 'redis' && env.RATE_LIMIT_REDIS_URL) {
    store = new FallbackRateLimitStore(new RedisRateLimitStore(env.RATE_LIMIT_REDIS_URL), memoryStore);
    return store;
  }

  store = memoryStore;
  return store;
};

export const rateLimitStore = {
  increment(key: string, windowMs: number) {
    return getRateLimitStore().increment(key, windowMs);
  }
};
