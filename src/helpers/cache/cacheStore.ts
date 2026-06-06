import net from 'node:net';
import tls from 'node:tls';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { UpstashRestClient } from '../upstash/upstashRest';

type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
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

interface CacheBackend {
  getEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null>;
  setEnvelope<T>(key: string, envelope: CacheEnvelope<T>): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
}

class RedisErrorReply extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisErrorReply';
  }
}

class MemoryCacheStore implements CacheBackend {
  private readonly entries = new Map<string, CacheEnvelope<unknown>>();

  private sweepExpiredEntries(now: number) {
    if (this.entries.size < 5000) {
      return;
    }

    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  async getEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
    const now = Date.now();
    this.sweepExpiredEntries(now);

    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.entries.delete(key);
      return null;
    }

    return entry as CacheEnvelope<T>;
  }

  async setEnvelope<T>(key: string, envelope: CacheEnvelope<T>): Promise<void> {
    if (envelope.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return;
    }

    this.entries.set(key, envelope as CacheEnvelope<unknown>);
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.entries.delete(key);
    }
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

const parseRedisUrl = (value: string, timeoutMs: number): RedisConnectionOptions => {
  const parsed = new URL(value);
  const database = parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : 0;

  if (!Number.isInteger(database) || database < 0) {
    throw new Error('CACHE_REDIS_URL must use a numeric database path');
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : parsed.protocol === 'rediss:' ? 6380 : 6379,
    useTls: parsed.protocol === 'rediss:',
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database,
    timeoutMs
  };
};

class RedisCacheStore implements CacheBackend {
  private readonly connection: RedisConnectionOptions;

  constructor(redisUrl: string) {
    this.connection = parseRedisUrl(redisUrl, env.CACHE_REDIS_TIMEOUT_MS);
  }

  async getEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
    const response = await this.executeCommand(['GET', key]);
    if (response === null) {
      return null;
    }

    if (typeof response !== 'string') {
      throw new Error('Unexpected Redis GET response');
    }

    const envelope = JSON.parse(response) as CacheEnvelope<T>;
    if (envelope.expiresAt <= Date.now()) {
      await this.deleteMany([key]);
      return null;
    }

    return envelope;
  }

  async setEnvelope<T>(key: string, envelope: CacheEnvelope<T>): Promise<void> {
    const ttlMs = envelope.expiresAt - Date.now();
    if (ttlMs <= 0) {
      await this.deleteMany([key]);
      return;
    }

    await this.executeCommand(['SET', key, JSON.stringify(envelope), 'PX', String(ttlMs)]);
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (!keys.length) {
      return;
    }

    await this.executeCommand(['DEL', ...keys]);
  }

  private async executeCommand(parts: string[]): Promise<RedisResponseValue> {
    const command = serializeCommand(parts);
    const parser = new RespParser();

    return new Promise<RedisResponseValue>((resolve, reject) => {
      const socket = this.connection.useTls
        ? tls.connect({
            host: this.connection.host,
            port: this.connection.port,
            servername: this.connection.host
          })
        : net.createConnection({
            host: this.connection.host,
            port: this.connection.port
          });

      let settled = false;
      let expectedResponses = 1;
      const responses: RedisResponseValue[] = [];
      let writeBuffer = '';

      const finish = (error?: Error, value?: RedisResponseValue) => {
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

        resolve(value ?? null);
      };

      const timeout = setTimeout(() => {
        finish(new Error('Redis cache request timed out'));
      }, this.connection.timeoutMs);

      const clearTimerAndFinish = (error?: Error, value?: RedisResponseValue) => {
        clearTimeout(timeout);
        finish(error, value);
      };

      socket.on('error', (error) => {
        clearTimerAndFinish(error instanceof Error ? error : new Error('Redis cache request failed'));
      });

      socket.on('data', (chunk) => {
        try {
          responses.push(...parser.push(chunk));

          if (responses.length < expectedResponses) {
            return;
          }

          const errorReply = responses.find((response) => response instanceof RedisErrorReply);
          if (errorReply instanceof RedisErrorReply) {
            clearTimerAndFinish(errorReply);
            return;
          }

          if (writeBuffer) {
            socket.write(writeBuffer);
            writeBuffer = '';
            return;
          }

          clearTimerAndFinish(undefined, responses[responses.length - 1] ?? null);
        } catch (error) {
          clearTimerAndFinish(error instanceof Error ? error : new Error('Failed to parse Redis response'));
        }
      });

      socket.on('close', () => {
        if (!settled) {
          clearTimerAndFinish(new Error('Redis connection closed before completing cache request'));
        }
      });

      socket.on('connect', () => {
        const setupCommands: string[][] = [];

        if (this.connection.password) {
          if (this.connection.username) {
            setupCommands.push(['AUTH', this.connection.username, this.connection.password]);
          } else {
            setupCommands.push(['AUTH', this.connection.password]);
          }
        }

        if ((this.connection.database ?? 0) > 0) {
          setupCommands.push(['SELECT', String(this.connection.database)]);
        }

        expectedResponses = setupCommands.length + 1;
        writeBuffer = command;
        socket.write(`${setupCommands.map((setupCommand) => serializeCommand(setupCommand)).join('')}${writeBuffer}`);
        writeBuffer = '';
      });
    });
  }
}

class UpstashCacheStore implements CacheBackend {
  private readonly client = new UpstashRestClient(
    env.UPSTASH_REDIS_REST_URL as string,
    env.UPSTASH_REDIS_REST_TOKEN as string,
    env.CACHE_REDIS_TIMEOUT_MS,
    'Upstash cache'
  );

  async getEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
    const response = await this.client.command<string | null>(['GET', key]);
    if (response === null) {
      return null;
    }

    const envelope = JSON.parse(response) as CacheEnvelope<T>;
    if (envelope.expiresAt <= Date.now()) {
      await this.deleteMany([key]);
      return null;
    }

    return envelope;
  }

  async setEnvelope<T>(key: string, envelope: CacheEnvelope<T>): Promise<void> {
    const ttlMs = envelope.expiresAt - Date.now();
    if (ttlMs <= 0) {
      await this.deleteMany([key]);
      return;
    }

    await this.client.command<string>(['SET', key, JSON.stringify(envelope), 'PX', ttlMs]);
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (!keys.length) {
      return;
    }

    await this.client.command<number>(['DEL', ...keys]);
  }
}

const prefixKey = (key: string) => `${env.CACHE_REDIS_KEY_PREFIX}:${key}`;

class LayeredCacheStore {
  constructor(
    private readonly memory: CacheBackend,
    private readonly redis: CacheBackend | null
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const namespacedKey = prefixKey(key);
    const memoryEntry = await this.memory.getEnvelope<T>(namespacedKey);
    if (memoryEntry) {
      return memoryEntry.value;
    }

    if (!this.redis) {
      return null;
    }

    try {
      const redisEntry = await this.redis.getEnvelope<T>(namespacedKey);
      if (!redisEntry) {
        return null;
      }

      await this.memory.setEnvelope(namespacedKey, redisEntry);
      return redisEntry.value;
    } catch (error) {
      logger.error('cache.store.redis_get_failed', {
        message: error instanceof Error ? error.message : 'Unknown cache store error'
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number) {
    const ttlMs = ttlSeconds * 1000;
    const envelope: CacheEnvelope<T> = {
      value,
      expiresAt: Date.now() + ttlMs
    };
    const namespacedKey = prefixKey(key);

    await this.memory.setEnvelope(namespacedKey, envelope);

    if (!this.redis) {
      return;
    }

    try {
      await this.redis.setEnvelope(namespacedKey, envelope);
    } catch (error) {
      logger.error('cache.store.redis_set_failed', {
        message: error instanceof Error ? error.message : 'Unknown cache store error'
      });
    }
  }

  async delete(key: string) {
    await this.deleteMany([key]);
  }

  async deleteMany(keys: string[]) {
    const namespacedKeys = keys.map(prefixKey);
    await this.memory.deleteMany(namespacedKeys);

    if (!this.redis) {
      return;
    }

    try {
      await this.redis.deleteMany(namespacedKeys);
    } catch (error) {
      logger.error('cache.store.redis_delete_failed', {
        keyCount: keys.length,
        message: error instanceof Error ? error.message : 'Unknown cache store error'
      });
    }
  }
}

const memoryStore = new MemoryCacheStore();

const resolveCacheRedisUrl = () => env.CACHE_REDIS_URL ?? env.RATE_LIMIT_REDIS_URL ?? null;

let cache: LayeredCacheStore | null = null;

const getCacheStore = () => {
  if (cache) {
    return cache;
  }

  if (env.CACHE_STORE === 'redis') {
    const redisUrl = resolveCacheRedisUrl();
    cache = new LayeredCacheStore(memoryStore, redisUrl ? new RedisCacheStore(redisUrl) : null);
    return cache;
  }

  if (env.CACHE_STORE === 'upstash') {
    cache = new LayeredCacheStore(memoryStore, new UpstashCacheStore());
    return cache;
  }

  cache = new LayeredCacheStore(memoryStore, null);
  return cache;
};

export const cacheStore = {
  get<T>(key: string) {
    return getCacheStore().get<T>(key);
  },
  set<T>(key: string, value: T, ttlSeconds: number) {
    return getCacheStore().set(key, value, ttlSeconds);
  },
  delete(key: string) {
    return getCacheStore().delete(key);
  },
  deleteMany(keys: string[]) {
    return getCacheStore().deleteMany(keys);
  }
};
