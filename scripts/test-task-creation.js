// Native fetch is available in Node 18+

async function testCreateTask() {
    console.log("Testing Task Creation...");
    try {
        const res = await fetch('http://localhost:3000/api/create-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scene_mesh_url: 'https://example.com/mesh.obj',
                scene_textures_url: 'https://example.com/mesh.mtl',
                cam_position_x: 0, cam_position_y: 5, cam_position_z: 10,
                cam_target_x: 0, cam_target_y: 0, cam_target_z: 0,
                width: 1920,
                height: 1080,
                fov: 45,
                max_bounces: 3,
                samples_per_pixel: 1
            })
        });

        if (!res.ok) {
            console.error("Failed:", res.status, res.statusText);
            const text = await res.text();
            console.error(text);
            return;
        }

        const data = await res.json();
        console.log("Success! Task ID:", data.taskId);
        console.log("Job Count:", data.jobCount);

    } catch (err) {
        console.error("Error:", err);
    }
}

testCreateTask();
