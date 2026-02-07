import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        const client = await pool.connect();
        try {
            await client.query(schemaSql);
            return NextResponse.json({
                status: 'success',
                message: 'Schema executed successfully.'
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Schema execution error:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
