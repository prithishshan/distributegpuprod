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
            // Fetch all jobs for the task
            // We explicitly select fields. If result_data is large, we might want to be careful,
            // but the user requested it specifically to "render the binary pixel data".
            // Assuming result_data is stored as BYTEA, pg will return it as a Buffer.
            // We might need to encode it to base64 for JSON transport if it's not automatically handled.
            // node-postgres usually returns Buffer for bytea. JSON.stringify handles Buffers by converting to { type: 'Buffer', data: [...] }
            // which is inefficient. Better to convert to base64 string.

            const query = `
        SELECT id, task_id, x, y, width, height, status, assigned_worker_id, created_at, started_at, completed_at, result_data
        FROM jobs
        WHERE task_id = $1
        ORDER BY y, x
      `;
            const result = await client.query(query, [taskId]);

            const jobs = result.rows.map(job => {
                // Convert binary data to base64 string if it exists
                if (job.result_data) {
                    return {
                        ...job,
                        result_data: job.result_data.toString('base64')
                    };
                }
                return job;
            });

            return NextResponse.json({ jobs });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error fetching jobs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
