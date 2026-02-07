import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { jobId, resultData } = await req.json();

        if (!jobId || !resultData) {
            return NextResponse.json({ error: 'jobId and resultData are required' }, { status: 400 });
        }

        // resultData is expected to be a base64 string from the client
        // We need to convert it to a Buffer to store it as BYTEA in Postgres
        const buffer = Buffer.from(resultData, 'base64');

        const client = await pool.connect();
        try {
            // Update job status to 'completed' and save result
            const query = `
        UPDATE jobs
        SET status = 'completed',
            result_data = $1,
            completed_at = NOW()
        WHERE id = $2
        RETURNING id, status, completed_at
      `;
            const result = await client.query(query, [buffer, jobId]);

            if (result.rowCount === 0) {
                return NextResponse.json({ error: 'Job not found' }, { status: 404 });
            }

            return NextResponse.json({ job: result.rows[0] });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error completing job:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
