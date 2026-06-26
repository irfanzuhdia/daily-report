import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { FileRepository } from '@/lib/repositories';
import { google } from 'googleapis';

function getDriveClient() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS || '{}');
  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: process.env.GOOGLE_DRIVE_IMPERSONATE_USER || undefined,
  });
  return google.drive({ version: 'v3', auth: jwt });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    const drive = getDriveClient();

    const { searchParams } = new URL(_request.url);
    const metadataOnly = searchParams.get('metadata') === 'true';

    // 1. Fetch file metadata to get MIME type, name, and size
    const metadata = await drive.files.get({
      fileId: id,
      fields: 'name, mimeType, size',
    });

    if (metadataOnly) {
      return NextResponse.json({
        name: metadata.data.name,
        mimeType: metadata.data.mimeType,
        size: metadata.data.size,
      });
    }

    // 2. Fetch the file media stream
    const driveResponse = await drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'stream' }
    );

    const headers = new Headers();
    headers.set('Content-Type', metadata.data.mimeType || 'application/octet-stream');
    if (metadata.data.size) {
      headers.set('Content-Length', metadata.data.size);
    }
    
    // Renders images inline, prompt download for other files
    const mime = (metadata.data.mimeType || '').toLowerCase();
    const isImg = mime.startsWith('image/');
    if (isImg) {
      headers.set('Content-Disposition', `inline; filename="${metadata.data.name}"`);
    } else {
      headers.set('Content-Disposition', `attachment; filename="${metadata.data.name}"`);
    }

    return new Response(driveResponse.data as any, {
      headers,
    });
  } catch (error) {
    console.error('GET /api/files/[id] error:', error);
    return new Response('File not found or access denied', { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const success = await FileRepository.softDelete(id, session.user_id);
    if (!success) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/files/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
