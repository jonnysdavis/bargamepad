import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocketServer } from 'ws';
import { spawn, ChildProcess } from 'child_process';

const port = 3000;
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const server = http.createServer((req, res) => {
    let safePath = path.normalize(req.url || '/').replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '') safePath = '/index.html';
    const filePath = path.join(PUBLIC_DIR, safePath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    const extname = path.extname(filePath);
    const contentType = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname] || 'text/plain';
    fs.readFile(filePath, (error, content) => {
        if (error) { res.writeHead(404); res.end('File not found'); }
        else { res.writeHead(200, { 'Content-Type': contentType }); res.end(content, 'utf-8'); }
    });
});

const wss = new WebSocketServer({ server });
let psProcess: ChildProcess | null = null;
let linuxProcess: ChildProcess | null = null;

if (process.platform === 'win32') {
    const psCode = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Input {
    [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
}
"@
while($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    try {
        $parts = $line.Split(' ')
        $cmd = $parts[0]
        if ($cmd -eq 'M') { [Input]::mouse_event(0x0001, [int]$parts[1], [int]$parts[2], 0, 0) }
        elseif ($cmd -eq 'LC') { [Input]::mouse_event(if($parts[1] -eq '1'){0x0002}else{0x0004}, 0, 0, 0, 0) }
        elseif ($cmd -eq 'RC') { [Input]::mouse_event(if($parts[1] -eq '1'){0x0008}else{0x0010}, 0, 0, 0, 0) }
        elseif ($cmd -eq 'MC') { [Input]::mouse_event(if($parts[1] -eq '1'){0x0020}else{0x0040}, 0, 0, 0, 0) }
        elseif ($cmd -eq 'W') { [Input]::mouse_event(0x0800, 0, 0, [int]$parts[1], 0) }
        elseif ($cmd -eq 'K') { [Input]::keybd_event([byte][int]$parts[1], 0, if($parts[2] -eq '1'){0}else{2}, 0) }
    } catch {}
}
`;
    psProcess = spawn('powershell', ['-Command', '-'], { stdio: ['pipe', 'inherit', 'inherit'] });
    psProcess.on('error', (err) => console.error('PowerShell error:', err));
    psProcess.stdin?.write(psCode + '\n');
} else if (process.platform === 'linux') {
    try {
        linuxProcess = spawn('xdotool', ['-'], { stdio: ['pipe', 'inherit', 'inherit'] });
        linuxProcess.on('error', (err) => {
            console.error('xdotool error (likely not installed):', err.message);
            linuxProcess = null;
        });
    } catch (e) {
        console.error('Failed to spawn xdotool');
    }
}

const vkMapLinux: any = { '38': 'Up', '40': 'Down', '37': 'Left', '39': 'Right', '33': 'Prior', '34': 'Next', '18': 'alt' };
const vkMapMac: any = { '38': '126', '40': '125', '37': '123', '39': '124', '33': '116', '34': '121', '18': '58' };

function sendCmd(cmd: string) {
    const parts = cmd.split(' ');
    const action = parts[0];
    if (psProcess && psProcess.stdin?.writable) {
        psProcess.stdin?.write(cmd + '\n');
    } else if (linuxProcess && linuxProcess.stdin?.writable) {
        if (action === 'M') linuxProcess.stdin?.write(`mousemove_relative -- ${parts[1]} ${parts[2]}\n`);
        else if (action === 'LC') linuxProcess.stdin?.write(`${parts[1] === '1' ? 'mousedown' : 'mouseup'} 1\n`);
        else if (action === 'RC') linuxProcess.stdin?.write(`${parts[1] === '1' ? 'mousedown' : 'mouseup'} 3\n`);
        else if (action === 'MC') linuxProcess.stdin?.write(`${parts[1] === '1' ? 'mousedown' : 'mouseup'} 2\n`);
        else if (action === 'K') {
            const key = vkMapLinux[parts[1] || ''] || parts[1];
            linuxProcess.stdin?.write(`${parts[2] === '1' ? 'keydown' : 'keyup'} ${key}\n`);
        }
        else if (action === 'W') linuxProcess.stdin?.write(`click ${parseInt(parts[1] || '0') > 0 ? '4' : '5'}\n`);
    } else if (process.platform === 'darwin') {
        if (action === 'K') {
            const code = vkMapMac[parts[1] || ''];
            if (code) spawn('osascript', ['-e', `tell application "System Events" to ${parts[2] === '1' ? 'key down' : 'key up'} ${code}`]);
        }
    }
}

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', (message) => {
        const data = message.toString();
        if (/^[MLRCWKA-Z0-9\s-]+$/i.test(data)) {
            data.split('\n').forEach(cmd => { if (cmd.trim()) sendCmd(cmd.trim()); });
        }
    });
});

server.listen(port, '127.0.0.1', () => console.log(`BAR Gamepad Spectator running at http://localhost:${port}`));
