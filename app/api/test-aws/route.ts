import { NextResponse } from 'next/server';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
// STS is strictly for checking "who am i", but S3 list buckets is a good enough proxy for "do I have access"
// changing to just check S3 access since that's what we care about.

export async function GET() {
    const s3 = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY || '',
            secretAccessKey: process.env.AWS_SECRET_KEY || '',
        },
    });

    try {
        const data = await s3.send(new ListBucketsCommand({}));
        return NextResponse.json({
            status: 'success',
            message: 'AWS Credentials are valid.',
            buckets: data.Buckets?.map(b => b.Name),
            region: await s3.config.region(),
        });
    } catch (error: any) {
        console.error("AWS Verify Error:", error);
        return NextResponse.json({
            status: 'error',
            message: error.message,
            code: error.Code,
            name: error.name
        }, { status: 200 });
    }
}
