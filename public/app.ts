const statusEl = document.getElementById('status')!;
const wsStatusEl = document.getElementById('ws-status')!;
const debugEl = document.getElementById('debug')!;
const mappingTable = document.getElementById('mapping-table')!;
const mappingConfig = document.getElementById('mapping-config')!;
const scanBtn = document.getElementById('scan-btn')!;

const ws = new WebSocket(`ws://${location.host}`);
let gamepadIndex: number | null = null;
let mode: 'mouse' | 'arrows' = 'mouse';
let lastButtons: boolean[] = [];

function log(msg: string) {
    const time = new Date().toLocaleTimeString();
    debugEl.innerHTML = `[${time}] ${msg}<br>${debugEl.innerHTML}`.substring(0, 1000);
}

ws.onopen = () => {
    wsStatusEl.textContent = 'Server: Connected';
    wsStatusEl.className = 'ws-connected';
    log('WebSocket connected');
};

ws.onclose = () => {
    wsStatusEl.textContent = 'Server: Disconnected';
    wsStatusEl.className = 'ws-disconnected';
    log('WebSocket disconnected');
};

interface ButtonMapping {
    id: number;
    name: string;
    cmd: string;
    val?: number;
    label: string;
    labelId?: string;
}

const mappings: ButtonMapping[] = [
    { id: 2, name: 'X (Left)', cmd: 'LC', label: 'Left Click', labelId: 'lbl-btn-2' },
    { id: 1, name: 'B (Right)', cmd: 'RC', label: 'Right Click', labelId: 'lbl-btn-1' },
    { id: 0, name: 'A (Bottom)', cmd: 'K', val: 32, label: 'Space', labelId: 'lbl-btn-0' },
    { id: 3, name: 'Y (Top)', cmd: 'K', val: 27, label: 'Esc', labelId: 'lbl-btn-3' },
    { id: 4, name: 'LB', cmd: 'W', val: -120, label: 'Zoom Out', labelId: 'lbl-btn-4' },
    { id: 5, name: 'RB', cmd: 'W', val: 120, label: 'Zoom In', labelId: 'lbl-btn-5' },
    { id: 6, name: 'LT', cmd: 'W', val: -120, label: 'Zoom Out', labelId: 'lbl-btn-6' },
    { id: 7, name: 'RT', cmd: 'W', val: 120, label: 'Zoom In', labelId: 'lbl-btn-7' },
    { id: 12, name: 'D-Pad Up', cmd: 'K', val: 38, label: 'Up' },
    { id: 13, name: 'D-Pad Down', cmd: 'K', val: 40, label: 'Down' },
    { id: 14, name: 'D-Pad Left', cmd: 'K', val: 37, label: 'Left' },
    { id: 15, name: 'D-Pad Right', cmd: 'K', val: 39, label: 'Right' },
];

function renderMappings() {
    mappingTable.innerHTML = '';
    mappings.forEach((m, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.name}</td>
            <td><select id="sel-${i}">
                <option value="LC" ${m.cmd === 'LC' ? 'selected' : ''}>Left Click</option>
                <option value="RC" ${m.cmd === 'RC' ? 'selected' : ''}>Right Click</option>
                <option value="W" ${m.cmd === 'W' ? 'selected' : ''}>Wheel/Zoom</option>
                <option value="K" ${m.cmd === 'K' ? 'selected' : ''}>Key</option>
            </select></td>
            <td><input type="number" id="val-${i}" value="${m.val || ''}" style="width: 50px"></td>
            <td><input type="text" id="lbl-in-${i}" value="${m.label}" style="width: 80px"></td>
        `;
        mappingTable.appendChild(tr);

        document.getElementById(`sel-${i}`)!.onchange = (e) => updateMapping(i, 'cmd', (e.target as HTMLSelectElement).value);
        document.getElementById(`val-${i}`)!.onchange = (e) => updateMapping(i, 'val', parseInt((e.target as HTMLInputElement).value));
        document.getElementById(`lbl-in-${i}`)!.onchange = (e) => updateMapping(i, 'label', (e.target as HTMLInputElement).value);
    });
    mappings.forEach((_, i) => updateLabel(i));
}

function updateLabel(i: number) {
    const m = mappings[i]!;
    if (m.labelId) {
        const el = document.getElementById(m.labelId);
        if (el) el.textContent = m.label;
    }
}

function updateMapping(i: number, key: keyof ButtonMapping, val: any) {
    (mappings[i] as any)[key] = val;
    updateLabel(i);
    log(`Updated mapping ${mappings[i]!.name}: ${key}=${val}`);
}

(window as any).updateMapping = updateMapping;

function onGamepadConnected(index: number, id: string) {
    if (gamepadIndex === index) return;
    gamepadIndex = index;
    statusEl.textContent = `Active: ${id}`;
    mappingConfig.style.display = 'block';
    renderMappings();
    log(`Gamepad detected at index ${index}: ${id}`);
}

window.addEventListener("gamepadconnected", (e) => {
    onGamepadConnected((e as GamepadEvent).gamepad.index, (e as GamepadEvent).gamepad.id);
});

window.addEventListener("gamepaddisconnected", (e) => {
    const disconnectedIndex = (e as GamepadEvent).gamepad.index;
    if (gamepadIndex === disconnectedIndex) {
        gamepadIndex = null;
        statusEl.textContent = "Gamepad disconnected";
        mappingConfig.style.display = 'none';
        log(`Gamepad disconnected from index ${disconnectedIndex}`);
    }
});

scanBtn.onclick = () => {
    const gamepads = navigator.getGamepads();
    log(`Scanning... found ${gamepads.filter(g => g !== null).length} devices`);
    let found = false;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            onGamepadConnected(i, gamepads[i]!.id);
            found = true;
            break;
        }
    }
    if (!found) log("No gamepads found. Try pressing a button on the controller.");
};

function send(msg: string) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
}

let rightStickActive = false;

function update() {
    const gamepads = navigator.getGamepads();

    // Auto-detect any active gamepad if none selected
    if (gamepadIndex === null) {
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp) {
                // If any button is pressed or axis moved significantly, select it
                const hasInput = gp.buttons.some(b => b.pressed) || gp.axes.some(a => Math.abs(a) > 0.5);
                if (hasInput) {
                    onGamepadConnected(i, gp.id);
                    break;
                }
            }
        }
    }

    const gp = gamepadIndex !== null ? gamepads[gamepadIndex] : null;
    if (!gp) {
        requestAnimationFrame(update);
        return;
    }

    // Toggle mode with L3 (Button 10)
    if (gp.buttons[10]?.pressed && !(window as any).l3Pressed) {
        mode = mode === 'mouse' ? 'arrows' : 'mouse';
        const label = document.getElementById('lbl-stick-left');
        if (label) label.textContent = mode === 'mouse' ? 'Mouse' : 'Arrows';
        log(`Left Stick Mode: ${mode.toUpperCase()}`);
    }
    (window as any).l3Pressed = gp.buttons[10]?.pressed;

    // Sticks
    const lx = Math.abs(gp.axes[0] || 0) > 0.1 ? (gp.axes[0] || 0) : 0;
    const ly = Math.abs(gp.axes[1] || 0) > 0.1 ? (gp.axes[1] || 0) : 0;
    if (mode === 'mouse') {
        if (lx !== 0 || ly !== 0) send(`M ${Math.round(lx * 15)} ${Math.round(ly * 15)}`);
    } else {
        handleStickAsKeys(lx, ly, 37, 39, 38, 40, 'leftStick');
    }

    const rx = Math.abs(gp.axes[2] || 0) > 0.1 ? (gp.axes[2] || 0) : 0;
    const ry = Math.abs(gp.axes[3] || 0) > 0.1 ? (gp.axes[3] || 0) : 0;
    const nowRightActive = rx !== 0 || ry !== 0;
    if (nowRightActive && !rightStickActive) {
        send('K 18 1\nMC 1');
    } else if (!nowRightActive && rightStickActive) {
        send('MC 0\nK 18 0');
    }
    if (nowRightActive) send(`M ${Math.round(rx * 15)} ${Math.round(ry * 15)}`);
    rightStickActive = nowRightActive;

    // Buttons
    mappings.forEach(m => {
        const b = gp.buttons[m.id];
        if (b && b.pressed !== lastButtons[m.id]) {
            if (m.cmd === 'W') {
                if (b.pressed) send(`W ${m.val}`);
            } else if (m.cmd === 'K') {
                send(`K ${m.val} ${b.pressed ? 1 : 0}`);
            } else if (m.cmd === 'LC' || m.cmd === 'RC' || m.cmd === 'MC') {
                send(`${m.cmd} ${b.pressed ? 1 : 0}`);
            }
        }
    });

    // Visual feedback
    gp.buttons.forEach((b, i) => {
        document.getElementById(`btn-${i}`)?.classList.toggle('active', b.pressed);
    });
    document.getElementById('pad-up')?.classList.toggle('active', gp.buttons[12]?.pressed);
    document.getElementById('pad-down')?.classList.toggle('active', gp.buttons[13]?.pressed);
    document.getElementById('pad-left')?.classList.toggle('active', gp.buttons[14]?.pressed);
    document.getElementById('pad-right')?.classList.toggle('active', gp.buttons[15]?.pressed);

    const stickL = document.getElementById('stick-left');
    if (stickL) {
        stickL.setAttribute('cx', (250 + lx * 20).toString());
        stickL.setAttribute('cy', (220 + ly * 20).toString());
        stickL.classList.toggle('active', mode === 'arrows');
    }
    const stickR = document.getElementById('stick-right');
    if (stickR) {
        stickR.setAttribute('cx', (500 + rx * 20).toString());
        stickR.setAttribute('cy', (320 + ry * 20).toString());
    }

    lastButtons = gp.buttons.map(b => b.pressed);
    requestAnimationFrame(update);
}

const stickKeyState: any = {};
function handleStickAsKeys(x: number, y: number, left: number, right: number, up: number, down: number, id: string) {
    const check = (key: number, pressed: boolean) => {
        const stateId = `${id}_${key}`;
        if (pressed !== stickKeyState[stateId]) {
            send(`K ${key} ${pressed ? 1 : 0}`);
            stickKeyState[stateId] = pressed;
        }
    };
    check(left, x < -0.5);
    check(right, x > 0.5);
    check(up, y < -0.5);
    check(down, y > 0.5);
}

requestAnimationFrame(update);
export {};
