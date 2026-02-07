import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { jobId, workerId } = await req.json();

        if (!jobId) {
            return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            // Update job status to 'started'
            const query = `
        UPDATE jobs
        SET status = 'started',
            assigned_worker_id = $1,
            started_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
            const result = await client.query(query, [workerId || 'unknown-worker', jobId]);

            if (result.rowCount === 0) {
                return NextResponse.json({ error: 'Job not found' }, { status: 404 });
            }

            return NextResponse.json({ job: result.rows[0] });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error starting job:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
