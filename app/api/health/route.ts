import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const start = Date.now();
    await sql`SELECT 1 as result`;
    const latency = Date.now() - start;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        latency: `${latency}ms`,
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: {
          status: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 503 }
    );
  }
}
