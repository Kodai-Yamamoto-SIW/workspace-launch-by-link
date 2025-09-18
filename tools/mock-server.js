// Simple mock server for Classroom Live Sync
// Endpoints:
// GET /manifest -> returns a basic template of files
// POST /event/* -> logs received events in memory and to console

const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 8787;

/** @type {Array<{type:string, body:any, time:number}>} */
const events = [];

function sendJson(res, code, obj) {
    const json = JSON.stringify(obj);
    res.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(json);
}

function notFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
}

function decodeBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname || '/';

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
    }

    if (req.method === 'GET' && pathname === '/manifest') {
        const { student = 'unknown', exercise = 'demo' } = parsed.query;
        console.log(`[manifest] student=${student} exercise=${exercise}`);
        // Provide a tiny multi-file workspace
        const manifest = [
            { path: '', type: 'directory' },
            { path: 'src/', type: 'directory' },
            {
                path: 'README.md',
                type: 'file',
                contentBase64: Buffer.from(`# ${exercise}\n\n学生: ${student}\n\n以下のファイルを編集して提出内容を同期します。`, 'utf8').toString('base64'),
            },
            {
                path: 'src/main.py',
                type: 'file',
                contentBase64: Buffer.from("print('Hello, classroom!')\n", 'utf8').toString('base64'),
            },
            {
                path: 'src/style.css',
                type: 'file',
                contentBase64: Buffer.from('body { font-family: sans-serif; }\n', 'utf8').toString('base64'),
            },
        ];
        return sendJson(res, 200, manifest);
    }

    if (req.method === 'GET' && pathname === '/_events') {
        return sendJson(res, 200, events);
    }

    if (req.method === 'POST' && pathname.startsWith('/event/')) {
        try {
            const body = await decodeBody(req);
            const item = { type: pathname.substring('/event/'.length), body, time: Date.now() };
            events.push(item);
            // Also log compactly
            console.log(`[event:${item.type}]`, JSON.stringify(body));
            return sendJson(res, 200, { ok: true });
        } catch (e) {
            console.error('event error', e);
            return sendJson(res, 400, { ok: false, error: String(e) });
        }
    }

    return notFound(res);
});

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.log(`Mock server: port ${PORT} already in use. Assuming server is running. Skipping start.`);
        process.exit(0);
    } else {
        console.error('Mock server error:', err);
        process.exit(1);
    }
});

server.listen(PORT, () => {
    console.log(`Mock server listening on http://localhost:${PORT}`);
    console.log(`Manifest: http://localhost:${PORT}/manifest`);
    console.log(`Events:   http://localhost:${PORT}/_events`);
});
