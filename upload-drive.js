import { google } from 'googleapis';
import { Readable } from 'stream';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const FOLDER_ID = '1BFj3BcqhrUZI5XHIG6G8RD8Xv1WmQd7h';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://playthaugether.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileName, mimeType, fileData, operationId, token } = req.body;

    if (!fileName || !mimeType || !fileData || !token) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify Firebase token
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      }
    );
    const verifyData = await verifyRes.json();
    if (!verifyData.users || verifyData.users.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Auth Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        token_uri: 'https://oauth2.googleapis.com/token',
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, 'base64');
    const stream = Readable.from(buffer);

    // Upload to Drive
    const driveRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [FOLDER_ID],
        description: operationId ? `Opération: ${operationId}` : '',
      },
      media: { mimeType, body: stream },
      fields: 'id, webViewLink, name',
    });

    return res.status(200).json({
      fileId: driveRes.data.id,
      webViewLink: driveRes.data.webViewLink,
      fileName: driveRes.data.name,
    });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload failed', details: err.message });
  }
}
