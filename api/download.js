// /api/download.js

import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import { put } from '@vercel/blob';

// 导出 Vercel Serverless Function
export default async function handler(request, response) {
  // 只接受 POST 请求
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. 从请求体中获取 docId
    const { docId } = request.body;
    if (!docId) {
      return response.status(400).json({ error: 'docId is required' });
    }

    // 2. 配置 Google API 认证
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // 修复换行符
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'], // 只需要只读权限
    });
    const drive = google.drive({ version: 'v3', auth });

    // 3. 调用 Google Drive API 导出为 .docx 文件
    const fileResponse = await drive.files.export(
      {
        fileId: docId,
        // 指定导出为 .docx 格式
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      { responseType: 'arraybuffer' } // 告诉API返回二进制数据
    );

    // 4. 将文件上传到 Vercel Blob
    const blob = await put(
      `${docId}-${Date.now()}.docx`, // 创建一个独一无二的文件名
      Buffer.from(fileResponse.data),      // Vercel Blob 需要 Buffer
      {
        access: 'public', // 设置为公开访问
        token: process.env.BLOB_READ_WRITE_TOKEN, // 传入环境变量中的Token
      }
    );

    // 5. 返回 Vercel Blob 的公开 URL
    return response.status(200).json({ downloadUrl: blob.url });

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'An internal error occurred.', details: error.message });
  }
}