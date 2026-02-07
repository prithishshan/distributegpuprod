import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const taskId = searchParams.get('taskId');

        if (!taskId) {
            return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            const query = `
            SELECT j.id, j.task_id, j.x, j.y, j.width, j.height, j.status, j.created_at,
                   t.scene_mesh_url, t.scene_bvh_url, t.scene_textures_url,
                   t.cam_position_x, t.cam_position_y, t.cam_position_z,
                   t.cam_target_x, t.cam_target_y, t.cam_target_z,
                   t.fov, t.width as task_width, t.height as task_height, t.max_bounces
            FROM jobs j
            JOIN tasks t ON j.task_id = t.id
            WHERE j.task_id = $1 AND j.status = 'created'
            ORDER BY j.y, j.x
            LIMIT 1
        `;
            const result = await client.query(query, [taskId]);

            if (result.rowCount === 0) {
                return NextResponse.json({ message: 'No available jobs' }, { status: 404 });
            }

            const job = result.rows[0];

            // Sign the S3 URLs to ensure worker can access them
            try {
                if (process.env.AWS_ACCESS_KEY && process.env.AWS_SECRET_KEY) {
                    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
                    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

                    const s3Client = new S3Client({
                        region: process.env.AWS_REGION || 'us-east-1',
                        credentials: {
                            accessKeyId: process.env.AWS_ACCESS_KEY,
                            secretAccessKey: process.env.AWS_SECRET_KEY,
                        },
                    });

                    const signUrl = async (url: string) => {
                        if (!url || !url.includes('.amazonaws.com/')) return url;
                        // Extract Key: https://bucket.s3.amazonaws.com/uploads/key
                        const parts = url.split('.amazonaws.com/');
                        if (parts.length < 2) return url;
                        const key = parts[1];

                        const command = new GetObjectCommand({
                            Bucket: process.env.S3_BUCKET_NAME,
                            Key: key,
                        });
                        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
                    };
                    job.scene_mesh_url = await signUrl(job.scene_mesh_url);
                    job.scene_textures_url = await signUrl(job.scene_textures_url);
                    job.scene_bvh_url = await signUrl(job.scene_bvh_url);
                    console.log(job.scene_mesh_url);
                    console.log(job.scene_textures_url);
                    console.log(job.scene_bvh_url);
                }
            } catch (e) {
                console.error("Failed to sign URLs", e);
                // Fallback to original URLs
            }

            return NextResponse.json({ job });

        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error fetching next job:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
