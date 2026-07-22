import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    // Basic protection using a secret header (e.g., from Vercel Cron)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized attempt to trigger background job');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Background sync job started');
    
    // Simulate background work (e.g., recalculating all project percentages or cleaning up logs)
    // await runHeavySync();
    
    logger.info('Background sync job completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Sync job completed',
    });
  } catch (error) {
    logger.error('Background sync job failed:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
