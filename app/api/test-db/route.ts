import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query('SELECT NOW()');
            return NextResponse.json({
                status: 'success',
                time: result.rows[0].now
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Database connection error:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
