import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const READY_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export interface DatabaseState {
  connected: boolean;
  state: string;
  readyState: number;
}

export function getDatabaseState(): DatabaseState {
  const readyState = mongoose.connection.readyState;
  return {
    connected: readyState === 1,
    state: READY_STATES[readyState] ?? 'unknown',
    readyState,
  };
}

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    logger.info(`[Database] Connecting to MongoDB...`);
    const conn = await mongoose.connect(uri);
    logger.info(
      `[Database] MongoDB connected successfully to ${conn.connection.host}/${conn.connection.name}`
    );
    return conn;
  } catch (error) {
    logger.error(`[Database] MongoDB connection failed: ${(error as Error).message}`);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    logger.info('[Database] Closing MongoDB connection...');
    await mongoose.connection.close();
    logger.info('[Database] MongoDB connection closed.');
  }
}

// Graceful shutdown listener registration
let shutdownRegistered = false;

export function registerGracefulShutdown(serverCloseFn?: () => Promise<void>): void {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  const handleSignal = async (signal: string) => {
    logger.info(`[Process] Received ${signal}. Initiating graceful shutdown...`);
    try {
      if (serverCloseFn) {
        await serverCloseFn();
      }
      await disconnectDatabase();
      logger.info('[Process] Graceful shutdown complete. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error(`[Process] Error during graceful shutdown: ${(err as Error).message}`);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void handleSignal('SIGINT');
  });
  process.on('SIGTERM', () => {
    void handleSignal('SIGTERM');
  });
}
