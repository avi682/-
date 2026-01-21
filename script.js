// State
const state = {
    tasks: [],
    nextId: 1,
    settings: {
        lunchStart: 12, // 12 PM
        lunchEnd: 13,   // 1 PM
        lunchColor: '#ffcc00',
        lunchEnabled: true,
        sleepStart: 22, // 10 PM
        sleepEnd: 6,     // 6 AM
        sleepColor: '#cccccc',
        customZones: [] // Array of { start, end, color, title }
    }
};

// Undo/Redo History System
const history = {
    undoStack: [],
    redoStack: [],
    maxSize: 50,
    pushState: function () {
        const snapshot = JSON.stringify({ tasks: state.tasks, nextId: state.nextId, settings: state.settings });
        this.undoStack.push(snapshot);
        if (this.undoStack.length > this.maxSize) this.undoStack.shift();
        this.redoStack = []; // Clear redo on new action
    },
    undo: function () {
        if (this.undoStack.length === 0) return false;
        const currentSnapshot = JSON.stringify({ tasks: state.tasks, nextId: state.nextId, settings: state.settings });
        this.redoStack.push(currentSnapshot);
        const prevSnapshot = JSON.parse(this.undoStack.pop());
        state.tasks = prevSnapshot.tasks;
        state.nextId = prevSnapshot.nextId;
        state.settings = prevSnapshot.settings;
        localStorage.setItem('win95_scheduler_state', JSON.stringify(state));
        renderCalendarGrid();
        renderTasks();
        return true;
    },
    redo: function () {
        if (this.redoStack.length === 0) return false;
        const currentSnapshot = JSON.stringify({ tasks: state.tasks, nextId: state.nextId, settings: state.settings });
        this.undoStack.push(currentSnapshot);
        const nextSnapshot = JSON.parse(this.redoStack.pop());
        state.tasks = nextSnapshot.tasks;
        state.nextId = nextSnapshot.nextId;
        state.settings = nextSnapshot.settings;
        localStorage.setItem('win95_scheduler_state', JSON.stringify(state));
        renderCalendarGrid();
        renderTasks();
        return true;
    }
};

// Sound Effects System
const SoundFX = {
    ctx: new (window.AudioContext || window.webkitAudioContext)(),
    playTone: function (freq, type, duration) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    click: function () { this.playTone(800, 'square', 0.1); },
    snap: function () { this.playTone(1200, 'sine', 0.05); },
    trash: function () {
        // Noise burst for trash
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        noise.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }
};

// Helper for Color Picker
window.pickColor = function (prefix, color) {
    const input = document.getElementById(`${prefix}-color`);
    const preview = document.getElementById(`${prefix}-color-preview`);
    if (input) input.value = color;
    if (preview) preview.style.backgroundColor = color;

    // Highlight selected swatch
    const palette = document.getElementById(`${prefix}-palette`);
    if (palette) {
        palette.querySelectorAll('.color-swatch').forEach(el => {
            if (el.dataset.col === color) el.classList.add('selected');
            else el.classList.remove('selected');
        });
    }
}

// Global modal closer
window.closeModals = function () {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
    editingTaskId = null;
}

// Config
const START_HOUR = 5; // 5 AM Start
const END_HOUR = 29;  // Ends at 5 AM next day (5+24)

// Helpers
function formatTime(h) {
    const normalized = h % 24;
    const ampm = normalized >= 12 ? 'PM' : 'AM';
    const hour12 = normalized % 12 || 12;
    return `${hour12}:00 ${ampm}`;
}

// DOM Elements
const taskListEl = document.getElementById('task-list');
const calendarGridEl = document.getElementById('calendar-grid');
const addTaskBtn = document.getElementById('add-task-btn');
const taskInputArea = document.getElementById('task-input-area');
const newTaskInput = document.getElementById('new-task-input');
const newTaskHrs = document.getElementById('new-task-hrs');
const newTaskMin = document.getElementById('new-task-min');
const newTaskCategory = document.getElementById('new-task-category');
const confirmAddTaskBtn = document.getElementById('confirm-add-task');
const clearCalendarBtn = document.getElementById('clear-calendar-btn');

// Properties Modal Elements
const propsModal = document.getElementById('properties-modal');
const propTitle = document.getElementById('prop-title');
const propCategory = document.getElementById('prop-category');
const propHrs = document.getElementById('prop-hrs');
const propMin = document.getElementById('prop-min');
const propCompleted = document.getElementById('prop-completed');
const propDay = document.getElementById('prop-day');
const propStartHr = document.getElementById('prop-start-hr');
const propStartMin = document.getElementById('prop-start-min');
const propEndHr = document.getElementById('prop-end-hr');
const propEndMin = document.getElementById('prop-end-min');
const propColor = document.getElementById('prop-color');

const btnSaveProps = document.getElementById('btn-save-props');
const btnDeleteTask = document.getElementById('btn-delete-task');
let editingTaskId = null;
let selectedTaskId = null;

const settingsModal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings');

// Pet Settings
function openPetSettings() {
    document.getElementById('pet-settings-modal').classList.remove('hidden');
    // Sync inputs with current state
    if (window.PetSystem) {
        document.getElementById('pet-size-range').value = PetSystem.width; // Assuming square
        document.getElementById('pet-jump-range').value = Math.abs(PetSystem.jumpPower || 15);
    }
}

function updatePetSettings() {
    const size = parseInt(document.getElementById('pet-size-range').value);
    const jump = parseInt(document.getElementById('pet-jump-range').value);

    if (window.PetSystem) {
        PetSystem.setSize(size);
        PetSystem.setJumpPower(jump);
    }
}

// Initialization
function init() {
    renderCalendarGrid();
    renderTasks();
    setupEventListeners();
    try { loadSettingsInputs(); } catch (e) { }
}

// Global function for direct HTML access
window.openSettings = function () {
    try {
        if (typeof closeMenus === 'function') closeMenus();
        if (typeof loadSettingsInputs === 'function') loadSettingsInputs();

        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    } catch (err) {
        alert("Settings Error: " + err.message);
    }
}

// Close Modals


// Render Calendar Grid
function renderCalendarGrid() {
    calendarGridEl.innerHTML = '';

    // Loop from Start Hour to End Hour
    for (let i = START_HOUR; i < END_HOUR; i++) {
        // Time Label
        const label = document.createElement('div');
        label.className = 'time-slot-label';
        label.innerText = formatTime(i);
        calendarGridEl.appendChild(label);

        // Day Columns
        for (let d = 0; d < 7; d++) {
            const slot = document.createElement('div');
            slot.className = 'time-slot';
            slot.dataset.day = d;
            slot.dataset.hour = i;

            // Simple dragover
            slot.ondragover = allowDrop;
            slot.ondrop = (e) => dropToCalendar(e, d, i);

            // Special Zones Logic
            renderZoneInSlot(slot, i, d);

            calendarGridEl.appendChild(slot);
        }
    }
}

function renderZoneInSlot(slot, slotHour, dayIndex) {
    const s = state.settings;
    const zones = [];
    if (s.lunchEnabled !== false) {
        zones.push({ start: s.lunchStart, end: s.lunchEnd, color: s.lunchColor, title: 'Lunch' });
    }
    zones.push({ start: s.sleepStart, end: s.sleepEnd, color: s.sleepColor, title: 'Sleep' });
    zones.push(...(s.customZones || []));

    zones.forEach(zone => {
        let start = zone.start;
        let end = zone.end;
        const color = zone.color;
        const title = zone.title;

        if (start === undefined || end === undefined) return;

        // Normalize ranges for overnight logic
        let intervals = [];
        if (start <= end) {
            intervals.push({ s: start, e: end });
        } else {
            intervals.push({ s: start, e: 24 });
            intervals.push({ s: 0, e: end });
        }

        intervals.forEach(inv => {
            const normSlot = slotHour % 24;
            const overlapStart = Math.max(normSlot, inv.s);
            const overlapEnd = Math.min(normSlot + 1, inv.e);

            if (overlapStart < overlapEnd) {
                const duration = overlapEnd - overlapStart;
                const offset = overlapStart - normSlot;

                const div = document.createElement('div');
                div.className = 'special-zone';
                div.style.backgroundColor = color || '#ccc';
                div.title = title;
                div.style.top = `${offset * 50}px`;
                div.style.height = `${duration * 50}px`;
                slot.appendChild(div);
            }
        });
    });
}

function renderTasks() {
    taskListEl.innerHTML = '';
    document.querySelectorAll('.time-slot .task-card').forEach(el => el.remove());

    // Sidebar Tasks
    state.tasks.filter(t => t.assignedDay === null).forEach(task => {
        const taskEl = createTaskElement(task);
        taskEl.style.height = 'auto';
        const hours = Math.floor(task.duration);
        const mins = Math.round((task.duration - hours) * 60);
        const timeStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        taskEl.innerHTML = `<strong>${task.title}</strong><br><small>${timeStr}</small>`;
        taskListEl.appendChild(taskEl);
    });

    // Calendar Tasks
    const calendarTasks = state.tasks.filter(t => t.assignedDay !== null);

    // Group by Day
    const tasksByDay = {};
    calendarTasks.forEach(t => {
        if (!tasksByDay[t.assignedDay]) tasksByDay[t.assignedDay] = [];
        tasksByDay[t.assignedDay].push(t);
    });

    Object.keys(tasksByDay).forEach(day => {
        const dayTasks = tasksByDay[day];
        // Sort for clustering
        dayTasks.sort((a, b) => {
            const effA = a.assignedHour < START_HOUR ? a.assignedHour + 24 : a.assignedHour;
            const effB = b.assignedHour < START_HOUR ? b.assignedHour + 24 : b.assignedHour;
            return effA - effB || b.duration - a.duration;
        });

        // Simple clustering logic from before
        const clusters = [];
        let currentCluster = [];
        let clusterEnd = -1;

        dayTasks.forEach(task => {
            let start = task.assignedHour < START_HOUR ? task.assignedHour + 24 : task.assignedHour;
            const end = start + task.duration;

            if (currentCluster.length === 0) {
                currentCluster.push(task);
                clusterEnd = end;
            } else {
                if (start < clusterEnd) {
                    currentCluster.push(task);
                    if (end > clusterEnd) clusterEnd = end;
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [task];
                    clusterEnd = end;
                }
            }
        });
        if (currentCluster.length) clusters.push(currentCluster);

        clusters.forEach(cluster => {
            const lanes = [];
            cluster.forEach(task => {
                let placed = false;
                for (let i = 0; i < lanes.length; i++) {
                    const lastTask = lanes[i][lanes[i].length - 1];
                    let lastStart = lastTask.assignedHour < START_HOUR ? lastTask.assignedHour + 24 : lastTask.assignedHour;
                    let lastEnd = lastStart + lastTask.duration;

                    let thisStart = task.assignedHour < START_HOUR ? task.assignedHour + 24 : task.assignedHour;

                    if (thisStart >= lastEnd - 0.01) {
                        lanes[i].push(task);
                        task._laneIndex = i;
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    lanes.push([task]);
                    task._laneIndex = lanes.length - 1;
                }
            });

            const widthPercent = 94 / lanes.length;
            cluster.forEach(task => {
                const taskEl = createTaskElement(task);
                let effHour = task.assignedHour < START_HOUR ? task.assignedHour + 24 : task.assignedHour;
                const visualSlotHour = Math.floor(effHour);

                const selector = `.time-slot[data-day="${task.assignedDay}"][data-hour="${visualSlotHour}"]`;
                const slot = document.querySelector(selector);

                if (slot) {
                    const height = (task.duration * 50) - 4;
                    const top = (effHour - visualSlotHour) * 50;
                    taskEl.style.height = `${height}px`;
                    taskEl.style.top = `${top}px`;
                    taskEl.style.width = `${widthPercent}%`;
                    taskEl.style.left = `${(task._laneIndex * widthPercent) + 2}%`;
                    taskEl.style.position = 'absolute';
                    taskEl.style.zIndex = 10 + task._laneIndex;
                    slot.appendChild(taskEl);
                }
            });
        });
    });

    updateStatusBar();
}

function createTaskElement(task) {
    const el = document.createElement('div');
    el.className = `task-card ${task.category}`;
    if (task.completed) el.classList.add('completed');
    if (task.color) el.style.backgroundColor = task.color;

    // Title
    const titleSpan = document.createElement('span');
    titleSpan.className = 'task-title';
    titleSpan.innerText = task.title;
    el.appendChild(titleSpan);

    // Show description as gray text under title if task has a description
    if (task.description && task.description.trim()) {
        const descText = document.createElement('div');
        descText.className = 'task-desc-preview';
        // Truncate long descriptions
        const maxLen = 30;
        const truncated = task.description.length > maxLen
            ? task.description.substring(0, maxLen) + '...'
            : task.description;
        descText.innerText = truncated;
        el.appendChild(descText);
    }

    el.draggable = true;
    el.id = `task-${task.id}`;
    el.title = task.description ? `${task.description}\n\nDouble-click to edit` : "Double-click to edit";

    // Inline handlers for better reliability
    el.setAttribute('onclick', `event.stopPropagation(); selectTask(${task.id})`);
    el.setAttribute('ondblclick', `event.stopPropagation(); openProperties(${task.id})`);

    // Resize Handle (only for scheduled tasks)
    if (task.assignedDay !== null) {
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startResize(e, task);
        });
        el.appendChild(handle);
    }

    el.ondragstart = (ev) => {
        ev.dataTransfer.setData("text/plain", task.id);
        ev.dataTransfer.effectAllowed = "move";
        selectTask(task.id);
    };

    // Vertical drag to reschedule time (only for scheduled tasks)
    if (task.assignedDay !== null) {
        el.addEventListener('mousedown', (e) => {
            // Don't interfere with resize handle
            if (e.target.classList.contains('resize-handle')) return;
            startVerticalDrag(e, task);
        });
    }

    return el;
}

// Resize Logic
let resizingTaskId = null;
let resizeStartY = 0;
let resizeStartDuration = 0;

function startResize(e, task) {
    e.stopPropagation();
    e.preventDefault(); // prevent drag
    resizingTaskId = task.id;
    resizeStartY = e.clientY;
    resizeStartDuration = task.duration;

    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
}

function onResizeMove(e) {
    if (!resizingTaskId) return;
    const dy = e.clientY - resizeStartY;
    // 50px = 1 hour.   dy / 50 = hours change
    const dHours = dy / 50;

    const task = state.tasks.find(t => t.id === resizingTaskId);
    if (task) {
        let newDur = resizeStartDuration + dHours;
        // Snap to 15 mins (0.25)
        newDur = Math.round(newDur * 4) / 4;
        if (newDur < 0.25) newDur = 0.25;

        task.duration = newDur;
        renderTasks(); // Live update
    }
}

function onResizeEnd(e) {
    if (resizingTaskId) {
        resizingTaskId = null;
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeEnd);
        saveState();
        SoundFX.snap();
    }
}

// Vertical Drag to Reschedule Time
let verticalDragTaskId = null;
let verticalDragStartY = 0;
let verticalDragStartHour = 0;

function startVerticalDrag(e, task) {
    // Only for left mouse button
    if (e.button !== 0) return;

    verticalDragTaskId = task.id;
    verticalDragStartY = e.clientY;
    verticalDragStartHour = task.assignedHour;

    document.addEventListener('mousemove', onVerticalDragMove);
    document.addEventListener('mouseup', onVerticalDragEnd);
}

function onVerticalDragMove(e) {
    if (!verticalDragTaskId) return;

    const dy = e.clientY - verticalDragStartY;
    // 50px = 1 hour
    const dHours = dy / 50;

    const task = state.tasks.find(t => t.id === verticalDragTaskId);
    if (task) {
        let newHour = verticalDragStartHour + dHours;
        // Snap to 15 mins (0.25)
        newHour = Math.round(newHour * 4) / 4;
        // Keep within valid range
        if (newHour < 0) newHour = 0;
        if (newHour > 23.75) newHour = 23.75;

        task.assignedHour = newHour;
        renderTasks(); // Live update
    }
}

function onVerticalDragEnd(e) {
    if (verticalDragTaskId) {
        verticalDragTaskId = null;
        document.removeEventListener('mousemove', onVerticalDragMove);
        document.removeEventListener('mouseup', onVerticalDragEnd);
        saveState();
        SoundFX.snap();
    }
}

// Current Time Line
function renderCurrentTime() {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();

    // Day Index (Mon=0 ... Sun=6)
    // Grid in HTML is Sunday...Friday (0..6 in getDay)
    const dayIndex = now.getDay();

    const startOffsetMinutes = START_HOUR * 60;
    let diffMinutes = totalMinutes - startOffsetMinutes;

    if (diffMinutes < 0) diffMinutes += 24 * 60;

    const top = diffMinutes * (50 / 60);

    let line = document.getElementById('current-time-line');
    if (!line) {
        line = document.createElement('div');
        line.id = 'current-time-line';
        line.style.position = 'absolute';
        line.style.height = '2px';
        line.style.backgroundColor = 'red';
        line.style.zIndex = '100';
        line.style.pointerEvents = 'none';

        // Label
        const tag = document.createElement('div');
        tag.innerText = "◀ NOW";
        tag.style.position = 'absolute';
        tag.style.right = '0';
        tag.style.top = '-10px';
        tag.style.color = 'red';
        tag.style.fontSize = '10px';
        tag.style.fontWeight = 'bold';
        line.appendChild(tag);

        calendarGridEl.appendChild(line);
    }

    // Update Position to specific day column
    // Grid: 60px fixed + 7 flexible columns
    // Left = 60px + ((100% - 60px) / 7 * dayIndex)
    // Width = (100% - 60px) / 7
    line.style.left = `calc(60px + ((100% - 60px) / 7 * ${dayIndex}))`;
    line.style.width = `calc((100% - 60px) / 7)`;
    line.style.right = 'auto'; // Reset right since we use width
    line.style.top = `${top}px`;
}

// Start Timer
setInterval(renderCurrentTime, 60000);
// Add to init
setTimeout(renderCurrentTime, 100);

// Ensure selectTask is global for inline calls
window.selectTask = function (id) {
    selectedTaskId = id;
    document.querySelectorAll('.task-card').forEach(el => el.classList.remove('selected'));
    const el = document.getElementById(`task-${id}`);
    if (el) el.classList.add('selected');
}

// Add New Task (Sidebar) - CLEAN VERSION
function addNewTask() {
    try {
        const text = newTaskInput.value.trim();
        const hrs = parseInt(newTaskHrs.value) || 0;
        const min = parseInt(newTaskMin.value) || 0;
        let duration = hrs + (min / 60);
        if (duration <= 0) duration = 1;

        if (!text) {
            alert("Please enter a task name.");
            return;
        }

        const newTask = {
            id: state.nextId++,
            title: text,
            description: '',
            duration: duration,
            category: newTaskCategory.value,
            assignedDay: null,
            assignedHour: null,
            completed: false
        };
        state.tasks.push(newTask);

        newTaskInput.value = '';
        saveState();
        renderTasks();
    } catch (err) {
        alert("Error adding task: " + err.message);
    }
}

// Add Daily Task (Settings) - WITH END TIME
// Add Daily Zone (Settings)
window.addDailyTaskSettings = function () {
    try {
        const text = document.getElementById('daily-task-name').value.trim();
        if (!text) {
            alert("Please enter a zone name.");
            return;
        }

        // Color - use the hidden input or select if we add one, 
        // but wait, I haven't added the color picker to HTML yet. 
        // I will assume the ID 'daily-task-color' exists for the input.
        const color = document.getElementById('daily-task-color')?.value || '#dddddd';

        // Start Time
        const sH = parseInt(document.getElementById('daily-task-hr').value) || 0;
        const sM = parseInt(document.getElementById('daily-task-min').value) || 0;

        // End Time
        let eH = parseInt(document.getElementById('daily-task-end-hr').value);
        let eM = parseInt(document.getElementById('daily-task-end-min').value);

        // Default End if invalid
        if (isNaN(eH)) eH = sH + 1;
        if (isNaN(eM)) eM = sM;

        let startVal = sH + (sM / 60);
        let endVal = eH + (eM / 60);

        // Handle overnight wrap for end time inputs
        if (endVal < startVal) endVal += 24;

        if (!state.settings.customZones) state.settings.customZones = [];

        state.settings.customZones.push({
            start: startVal,
            end: endVal,
            color: color,
            title: text
        });

        document.getElementById('daily-task-name').value = '';
        saveState();
        renderCalendarGrid(); // Re-render grid to show zones
        renderSettingsZonesList(); // UPDATE LIST
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// [Duplicate openProperties removed]

function saveProperties() {
    if (editingTaskId === null) return;
    const task = state.tasks.find(t => t.id === editingTaskId);
    if (task) {
        task.title = propTitle.value;
        task.description = document.getElementById('prop-description')?.value || '';
        task.category = propCategory.value;
        task.color = propColor.value;
        task.completed = propCompleted.checked;

        // Base Duration
        const durH = parseInt(propHrs.value) || 0;
        const durM = parseInt(propMin.value) || 0;
        let newDur = durH + (durM / 60);
        if (newDur <= 0) newDur = 0.5;

        const dayVal = parseInt(propDay.value);
        if (dayVal === -1) {
            task.assignedDay = null;
            task.assignedHour = null;
            task.duration = newDur;
        } else {
            task.assignedDay = dayVal;
            const sH = parseInt(propStartHr.value);
            const sM = parseInt(propStartMin.value);
            const eH = parseInt(propEndHr.value);
            const eM = parseInt(propEndMin.value);

            if (!isNaN(sH) && !isNaN(eH)) {
                const sVal = sH + ((isNaN(sM) ? 0 : sM) / 60);
                let eVal = eH + ((isNaN(eM) ? 0 : eM) / 60);
                if (eVal < sVal) eVal += 24; // Handle wrap logic in inputs

                if (eVal > sVal) {
                    task.assignedHour = sVal;
                    task.duration = eVal - sVal;
                } else {
                    task.duration = newDur; // fallback
                }
            } else {
                task.duration = newDur;
            }
        }
        saveState();
        renderTasks();
    }
    closeModals();
    editingTaskId = null;
}

window.deleteTaskFromProps = function () {
    if (editingTaskId === null) return;
    state.tasks = state.tasks.filter(t => t.id !== editingTaskId);
    saveState();
    renderTasks();
    try { SoundFX.trash(); } catch (err) { }
    editingTaskId = null;
    closeModals();
}

window.runClearCalendar = function () {
    if (confirm("Clear the calendar? Tasks will move to list.")) {
        state.tasks.forEach(t => { t.assignedDay = null; t.assignedHour = null; });
        saveState();
        renderTasks();
    }
}

window.runDeleteAll = function () {
    if (confirm("PERMANENTLY DELETE ALL TASKS?")) {
        state.tasks = [];
        state.nextId = 1;
        saveState();
        renderTasks();
    }
}

function makeDaily() {
    if (editingTaskId === null) return;
    const original = state.tasks.find(t => t.id === editingTaskId);
    if (!original || original.assignedDay === null) {
        alert("Schedule first."); return;
    }
    if (confirm("Copy to all days?")) {
        for (let d = 0; d < 7; d++) {
            if (d !== original.assignedDay) {
                state.tasks.push({
                    id: state.nextId++,
                    title: original.title,
                    duration: original.duration,
                    category: original.category,
                    color: original.color,
                    assignedDay: d,
                    assignedHour: original.assignedHour,
                    completed: false
                });
            }
        }
        renderTasks();
        closeModals();
    }
}


function loadSettingsInputs() {
    const s = state.settings;
    if (document.getElementById('lunch-start-hr')) {
        document.getElementById('lunch-start-hr').value = Math.floor(s.lunchStart);
        document.getElementById('lunch-start-min').value = Math.round((s.lunchStart % 1) * 60);
        document.getElementById('lunch-end-hr').value = Math.floor(s.lunchEnd);
        document.getElementById('lunch-end-min').value = Math.round((s.lunchEnd % 1) * 60);
        document.getElementById('lunch-color').value = s.lunchColor;
        const lunchCheckbox = document.getElementById('lunch-enabled');
        if (lunchCheckbox) lunchCheckbox.checked = s.lunchEnabled !== false;
    }
    if (document.getElementById('sleep-start-hr')) {
        document.getElementById('sleep-start-hr').value = Math.floor(s.sleepStart);
        document.getElementById('sleep-start-min').value = Math.round((s.sleepStart % 1) * 60);
        document.getElementById('sleep-end-hr').value = Math.floor(s.sleepEnd);
        document.getElementById('sleep-end-min').value = Math.round((s.sleepEnd % 1) * 60);
        document.getElementById('sleep-color').value = s.sleepColor;
    }
    if (typeof renderSettingsZonesList === 'function') {
        renderSettingsZonesList();
    }
}

window.saveSettings = function () {
    try {
        const getVal = (id, def) => {
            const el = document.getElementById(id);
            return el ? parseFloat(el.value) : def;
        }

        // Helper to get H.M from inputs
        const getTime = (name) => {
            const h = parseInt(document.getElementById(`${name}-hr`).value) || 0;
            const m = parseInt(document.getElementById(`${name}-min`).value) || 0;
            return h + (m / 60);
        }

        state.settings.lunchStart = getTime('lunch-start');
        state.settings.lunchEnd = getTime('lunch-end');
        state.settings.lunchColor = document.getElementById('lunch-color').value;
        const lunchCheckbox = document.getElementById('lunch-enabled');
        state.settings.lunchEnabled = lunchCheckbox ? lunchCheckbox.checked : true;

        state.settings.sleepStart = getTime('sleep-start');
        state.settings.sleepEnd = getTime('sleep-end');
        state.settings.sleepColor = document.getElementById('sleep-color').value;

        saveState();
        renderCalendarGrid(); // Refresh grid for new colors/times
        renderTasks();
        closeModals();
    } catch (e) {
        alert("Error saving settings: " + e.message);
    }
}

window.openProperties = function (id) {
    try {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;
        editingTaskId = id;

        propTitle.value = task.title;
        const propDescription = document.getElementById('prop-description');
        if (propDescription) propDescription.value = task.description || '';
        propCategory.value = task.category;

        // Sync Color
        if (typeof pickColor === 'function') {
            pickColor('prop', task.color || '#ffffba');
        } else {
            // Fallback
            propColor.value = task.color || '#ffffba';
        }

        propCompleted.checked = !!task.completed;

        // Duration inputs
        const h = Math.floor(task.duration);
        const m = Math.round((task.duration - h) * 60);
        propHrs.value = h;
        propMin.value = m;

        if (task.assignedDay !== null) {
            propDay.value = task.assignedDay;
            // Start
            const sH = Math.floor(task.assignedHour);
            const sM = Math.round((task.assignedHour - sH) * 60);
            propStartHr.value = sH;
            propStartMin.value = sM;
            // End
            const endVal = task.assignedHour + task.duration;
            const eH = Math.floor(endVal) % 24;
            const eM = Math.round((endVal - Math.floor(endVal)) * 60);
            propEndHr.value = eH;
            propEndMin.value = eM;
        } else {
            propDay.value = -1;
            propStartHr.value = ''; propStartMin.value = '';
            propEndHr.value = ''; propEndMin.value = '';
        }
        propsModal.classList.remove('hidden');
    } catch (err) {
        alert("Error opening properties: " + err.message);
    }
}

// Drag and Drop
function allowDrop(ev) { ev.preventDefault(); }
function dropToSide(ev) {
    ev.preventDefault();
    const id = parseInt(ev.dataTransfer.getData("text/plain"));
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.assignedDay = null;
        task.assignedHour = null;
        saveState();
        renderTasks();
    }
}
function dropToCalendar(ev, day, slotHour) {
    ev.preventDefault();
    const id = parseInt(ev.dataTransfer.getData("text/plain"));
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.assignedDay = day;
        task.assignedHour = slotHour;
        saveState();
        renderTasks();
    }
}

// Setup Event Listeners
function setupEventListeners() {
    addTaskBtn.addEventListener('click', () => {
        taskInputArea.classList.toggle('hidden');
        if (!taskInputArea.classList.contains('hidden')) newTaskInput.focus();
    });
    confirmAddTaskBtn.addEventListener('click', addNewTask);
    newTaskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addNewTask(); });

    btnSaveProps.addEventListener('click', saveProperties);

    // Input Auto-Calc listeners in properties
    const recalcEnd = () => {
        const sH = parseInt(propStartHr.value) || 0;
        const sM = parseInt(propStartMin.value) || 0;
        const dH = parseInt(propHrs.value) || 0;
        const dM = parseInt(propMin.value) || 0;
        let end = (sH + sM / 60) + (dH + dM / 60);
        propEndHr.value = Math.floor(end) % 24;
        propEndMin.value = Math.round((end % 1) * 60);
    };
    // Menu Bar Handlers
    const toggleMenu = (id) => {
        const el = document.getElementById(id);
        const allMenus = document.querySelectorAll('.dropdown-menu');
        allMenus.forEach(m => {
            if (m.id !== id) m.classList.add('hidden');
        });
        if (el) el.classList.toggle('hidden');
    };

    document.getElementById('menu-file-wrapper').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu('dropdown-file');
    });

    document.getElementById('menu-pets-wrapper').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu('dropdown-pets');
    });

    document.getElementById('menu-help-wrapper').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu('dropdown-help');
    });

    // Close menus when clicking elsewhere
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
    });

    // Stop propagation on menu items
    document.querySelectorAll('.dropdown-menu').forEach(el => {
        el.addEventListener('click', (e) => e.stopPropagation());
    });

    [propStartHr, propStartMin, propHrs, propMin].forEach(e => e.addEventListener('input', recalcEnd));

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Check if we're in an input/textarea
        const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

        // Escape - close modals
        if (e.key === 'Escape') {
            closeModals();
            closeMenus();
            return;
        }

        // Enter - save in properties modal (if open and not typing in textarea)
        if (e.key === 'Enter' && !isTyping) {
            if (!propsModal.classList.contains('hidden')) {
                saveProperties();
                return;
            }
        }

        // Don't process shortcuts while typing
        if (isTyping) return;

        // Delete - remove selected task
        if (e.key === 'Delete' && selectedTaskId !== null) {
            const task = state.tasks.find(t => t.id === selectedTaskId);
            if (task) {
                state.tasks = state.tasks.filter(t => t.id !== selectedTaskId);
                saveState();
                renderTasks();
                try { SoundFX.trash(); } catch (err) { }
                selectedTaskId = null;
            }
            return;
        }

        // Ctrl+Z - Undo
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (history.undo()) {
                try { SoundFX.click(); } catch (err) { }
            }
            return;
        }

        // Ctrl+Y or Ctrl+Shift+Z - Redo
        if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
            (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
            e.preventDefault();
            if (history.redo()) {
                try { SoundFX.click(); } catch (err) { }
            }
            return;
        }
    });
}

function closeMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
}

// Persistence
function saveState() {
    history.pushState(); // Push to undo stack before saving
    localStorage.setItem('win95_scheduler_state', JSON.stringify(state));
}
function loadState() {
    const saved = localStorage.getItem('win95_scheduler_state');
    if (saved) {
        try {
            const p = JSON.parse(saved);
            state.tasks = p.tasks || [];
            if (p.nextId) state.nextId = p.nextId;
            if (p.settings) {
                state.settings = { ...state.settings, ...p.settings };
                // Ensure array exists for old saves
                if (!state.settings.customZones) state.settings.customZones = [];
            }
        } catch (e) { console.error(e); }
    }
}

// (Duplicate RESTORE MISSING FUNCTIONS block removed)

function renderSettingsZonesList() {
    const list = document.getElementById('daily-zones-list');
    if (!list) return;
    list.innerHTML = '';
    const zones = state.settings.customZones || [];

    if (zones.length === 0) {
        list.innerHTML = '<div style="padding:2px; font-style:italic; color:gray;">None</div>';
        return;
    }

    zones.forEach((z, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.borderBottom = '1px solid #eee';
        row.style.padding = '2px';

        const info = document.createElement('div');
        info.style.display = 'flex';
        info.style.alignItems = 'center';
        info.style.gap = '5px';

        const colBox = document.createElement('div');
        colBox.style.width = '12px';
        colBox.style.height = '12px';
        colBox.style.backgroundColor = z.color;
        colBox.style.border = '1px solid gray';

        const txt = document.createElement('span');
        txt.innerText = `${z.title} (${formatTime(z.start)} - ${formatTime(z.end)})`;
        txt.style.fontSize = '11px';

        info.appendChild(colBox);
        info.appendChild(txt);

        const delBtn = document.createElement('button');
        delBtn.innerText = 'X';
        delBtn.style.minWidth = '20px';
        delBtn.style.padding = '0';
        delBtn.style.color = 'red';
        delBtn.style.fontWeight = 'bold';
        delBtn.onclick = () => deleteZone(idx);

        row.appendChild(info);
        row.appendChild(delBtn);
        list.appendChild(row);
    });
}

window.deleteZone = function (idx) {
    if (!state.settings.customZones) return;
    state.settings.customZones.splice(idx, 1);
    saveState();
    renderCalendarGrid();
    renderSettingsZonesList();
}



// Drag and Drop


window.dropToBin = function (ev) {
    ev.preventDefault();
    const id = parseInt(ev.dataTransfer.getData("text/plain"));
    // Removed confirm check
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    renderTasks();
    try { SoundFX.trash(); } catch (e) { }
    closeModals();
}



// Taskbar Clock
function updateTaskbarClock() {
    const el = document.getElementById('taskbar-clock');
    if (el) {
        const now = new Date();
        el.innerText = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
}
setInterval(updateTaskbarClock, 1000);
setTimeout(updateTaskbarClock, 100);

// Status Bar
function updateStatusBar() {
    const el = document.querySelectorAll('.status-field')[1];
    if (el) el.innerText = `items: ${state.tasks.length}`;
}

// Menu Actions
// Menu Actions
window.openTips = function () {
    const modal = document.getElementById('tips-modal');
    if (modal) modal.classList.remove('hidden');
    else alert("Tips modal missing!");
    closeMenus();
}
window.openAbout = function () {
    const modal = document.getElementById('about-modal');
    if (modal) modal.classList.remove('hidden');
    closeMenus();
}
window.runExport = function () {
    // Generate ICS
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Win95Scheduler//EN\n";

    // Helper to get next occurrence of Day Index
    const getNextDay = (dayIndex, hour) => {
        const now = new Date();
        const result = new Date();
        // Adjust to next occurrence of dayIndex (0=Sun, 1=Mon...)
        // Our app: 0=Mon, 6=Sun (based on DAYS array)
        // Re-map: 0(Mon)->1, 1(Tue)->2 ... 6(Sun)->0
        const jsDay = (dayIndex + 1) % 7;

        result.setDate(now.getDate() + (jsDay + 7 - now.getDay()) % 7);
        // If today is the day and time passed, maybe move to next week? 
        // For simplicity, just next occurrence from now or today.

        const h = Math.floor(hour);
        const m = Math.round((hour - h) * 60);
        result.setHours(h, m, 0, 0);
        return result;
    }

    state.tasks.forEach(task => {
        if (task.assignedDay === null) return;

        const startDate = getNextDay(task.assignedDay, task.assignedHour);
        const endDate = new Date(startDate.getTime() + task.duration * 60 * 60 * 1000);

        const fmt = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";

        icsContent += "BEGIN:VEVENT\n";
        icsContent += `SUMMARY:${task.title}\n`;
        icsContent += `DTSTART:${fmt(startDate)}\n`;
        icsContent += `DTEND:${fmt(endDate)}\n`;
        icsContent += `DESCRIPTION:Category: ${task.category}\n`;
        icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "schedule.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    closeMenus();
}
window.runExit = function () {
    window.close();
    closeMenus();
}

// Pet Helpers
window.updatePetSize = function (size) {
    if (window.PetSystem) PetSystem.setSize(size);
}

window.updatePetJump = function (power) {
    if (window.PetSystem) PetSystem.setJumpPower(power);
}
// Global Helper
window.closeMenus = function () {
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
};

// Boot
try {
    loadState();
    init();

    // Init Pet System
    // Since it's loaded in HTML, window.PetSystem should be available immediately
    if (window.PetSystem) {
        PetSystem.init();
        // Load saved pet
        if (state.settings && state.settings.currentPet) {
            PetSystem.setPet(state.settings.currentPet);
        }
    } else {
        console.error("PetSystem not found on boot.");
    }
} catch (err) {
    console.error("Initialization Error:", err);
    alert("Scheduler Error: " + err.message);
}

// Dark Mode Toggle
window.toggleDarkMode = function() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('win95_dark_mode', isDark);
}

// Load Dark Mode Preference
if (localStorage.getItem('win95_dark_mode') === 'true') {
    document.body.classList.add('dark-mode');
}
