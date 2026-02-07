import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log(body);
        const {
            scene_mesh_url,
            scene_bvh_url = "",
            scene_textures_url = "",
            cam_position_x,
            cam_position_y,
            cam_position_z,
            cam_target_x,
            cam_target_y,
            cam_target_z,
            fov,
            width,
            height,
            max_bounces,
            samples_per_pixel,
        } = body;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Insert Task
            const insertTaskQuery = `
        INSERT INTO tasks (
          scene_mesh_url, scene_bvh_url, scene_textures_url,
          cam_position_x, cam_position_y, cam_position_z,
          cam_target_x, cam_target_y, cam_target_z,
          fov, width, height, max_bounces, samples_per_pixel
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `;

            const taskValues = [
                scene_mesh_url,
                scene_bvh_url,
                scene_textures_url,
                cam_position_x,
                cam_position_y,
                cam_position_z,
                cam_target_x,
                cam_target_y,
                cam_target_z,
                fov || 45.0,
                width,
                height,
                max_bounces || 3,
                samples_per_pixel || 1,
            ];

            const taskResult = await client.query(insertTaskQuery, taskValues);
            const taskId = taskResult.rows[0].id;

            // 2. Generate Jobs (Tile based)
            const TILE_SIZE = 100;
            const jobs = [];

            for (let y = 0; y < height; y += TILE_SIZE) {
                for (let x = 0; x < width; x += TILE_SIZE) {
                    const w = Math.min(TILE_SIZE, width - x);
                    const h = Math.min(TILE_SIZE, height - y);
                    jobs.push([taskId, x, y, w, h, 'created']);
                }
            }

            // Bulk insert jobs could be optimized, but using a loop for simplicity or constructing a large VALUES string
            // For proper bulk insert with pg, we construct the query dynamically
            // Batch insert jobs to strictly avoid the PostgreSQL parameter limit (65535)
            // Each job has 6 parameters. 20,000 jobs * 6 = 120,000 params > 65,535.
            // Safe limit per batch: ~10,000 parameters.
            // Let's use a batch size of 1000 jobs (6000 params).

            const BATCH_SIZE = 1000;
            for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
                const batch = jobs.slice(i, i + BATCH_SIZE);
                let placeholders = [];
                let values = [];
                let counter = 1;

                for (const job of batch) {
                    placeholders.push(`($${counter}, $${counter + 1}, $${counter + 2}, $${counter + 3}, $${counter + 4}, $${counter + 5})`);
                    values.push(...job);
                    counter += 6;
                }

                const insertJobsQuery = `
                  INSERT INTO jobs (task_id, x, y, width, height, status)
                  VALUES ${placeholders.join(', ')}
                `;

                await client.query(insertJobsQuery, values);
            }

            await client.query('COMMIT');

            return NextResponse.json({
                status: 'success',
                taskId: taskId,
                jobCount: jobs.length
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('Error creating task:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
