import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { google } from 'googleapis';
import { Readable } from 'stream';

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1SnNyENp3FpDmhIu57V2mbizKy_oQNEsX';

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.xlsx', '.xls',
  '.docx', '.doc',
  '.zip',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function isFileTypeAllowed(file: File): boolean {
  if (ALLOWED_MIME_TYPES.includes(file.type)) {
    return true;
  }
  const ext = getFileExtension(file.name);
  return ALLOWED_EXTENSIONS.includes(ext);
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getDriveClient() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS || '{}');

  // Use JWT auth directly with the service account credentials
  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth: jwt });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!isFileTypeAllowed(file)) {
      return NextResponse.json(
        {
          error: 'File type not allowed. Supported: PDF, Excel, Word, images (PNG/JPG/GIF/WebP), ZIP',
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      );
    }

    // Get Drive client
    const drive = getDriveClient();

    // Convert file to buffer then to Readable stream
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const readableStream = Readable.from(buffer);

    // Upload to Google Drive
    const driveResponse = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: file.type,
        body: readableStream,
      },
      fields: 'id, name, webViewLink',
    });

    const fileId = driveResponse.data.id!;
    const fileName = driveResponse.data.name!;
    const webViewLink = driveResponse.data.webViewLink!;

    // Make the file publicly viewable (anyone with link)
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return NextResponse.json({
      fileId,
      fileName,
      webViewLink,
      downloadLink: `https://drive.google.com/uc?export=download&id=${fileId}`,
    });
  } catch (error: unknown) {
    console.error('Drive upload error:', error);

    // Provide more specific error messages
    let message = 'Upload failed';
    if (error instanceof Error) {
      if (error.message.includes('storage')) {
        message = 'Drive storage quota exceeded. Please contact administrator.';
      } else if (error.message.includes('permission') || error.message.includes('forbidden')) {
        message = 'Permission denied. Please ensure the Drive folder is shared with the service account.';
      } else if (error.message.includes('notFound')) {
        message = 'Drive folder not found. Please check the folder configuration.';
      } else {
        message = error.message;
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
