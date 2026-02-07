-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- DROP TABLE IF EXISTS jobs;
-- DROP TABLE IF EXISTS tasks;
-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    scene_mesh_url TEXT NOT NULL, 
    scene_bvh_url TEXT NOT NULL,
    scene_textures_url TEXT, -- Optional (Texture Atlas)

    -- 2. The Camera (CRITICAL)
    -- All clients must agree exactly on where the eye is.
    cam_position_x FLOAT NOT NULL,
    cam_position_y FLOAT NOT NULL,
    cam_position_z FLOAT NOT NULL,
    cam_target_x FLOAT NOT NULL,
    cam_target_y FLOAT NOT NULL,
    cam_target_z FLOAT NOT NULL,
    fov FLOAT DEFAULT 45.0,

    -- 3. The Canvas
    width INTEGER NOT NULL,  -- e.g., 1920
    height INTEGER NOT NULL, -- e.g., 1080
    
    -- 4. Raytracing Settings
    max_bounces INTEGER DEFAULT 3,
    samples_per_pixel INTEGER DEFAULT 1
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    assigned_worker_id VARCHAR(100),
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    status TEXT CHECK (status IN ('created', 'started', 'completed')) DEFAULT 'created',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result_data BYTEA
);
