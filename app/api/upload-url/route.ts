import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY || '',
        secretAccessKey: process.env.AWS_SECRET_KEY || '',
    },
});

export async function POST(req: NextRequest) {
    try {
        const { filename, contentType } = await req.json();

        if (!filename || !contentType) {
            return NextResponse.json(
                { error: 'Missing filename or contentType' },
                { status: 400 }
            );
        }

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `uploads/${Date.now()}-${filename}`,
            ContentType: contentType,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return NextResponse.json({
            uploadUrl: signedUrl,
            fileUrl: `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${command.input.Key}`,
        });
    } catch (error: any) {
        console.error('Error creating signed URL:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
