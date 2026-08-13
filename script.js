/* =========================================================
   Boxing Timer — shared script
   Runs on every page; each section guards itself by checking
   whether the relevant DOM elements exist on the current page.
   ========================================================= */

const STORAGE_KEYS = {
    history: 'boxingTimer.history',
    settings: 'boxingTimer.settings',
    setAgain: 'boxingTimer.setAgain'
};

const DEFAULT_SETTINGS = {
    rounds: 3,
    roundTime: 150,
    restTime: 15,
    longRest: 60,
    theme: 'dark',
    soundEffects: true,
    bell: 'Bell 1',
    volume: 70
};

/* ---------------- Utilities ---------------- */

function formatTime(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.settings);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.history);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveHistory(entries) {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(entries));
}

function addHistoryEntry(entry) {
    const entries = loadHistory();
    entries.push(entry);
    saveHistory(entries);
}

function applyTheme(theme) {
    document.body.dataset.theme = theme || 'dark';
}

/* Round-transition sound cues. Drop bell.mp3 / whistle.mp3 into a
   /sounds folder next to this file — see sounds/README.txt. */
const bellSound = new Audio('sounds/bell.mp3');
const whistleSound = new Audio('sounds/whistle.mp3');

bellSound.addEventListener('error', () => {
    console.warn('[Boxing Timer] Could not load sounds/bell.mp3 — add that file to the sounds/ folder.');
});
whistleSound.addEventListener('error', () => {
    console.warn('[Boxing Timer] Could not load sounds/whistle.mp3 — add that file to the sounds/ folder.');
});

function playClip(sound, volumePercent) {
    if (!sound) return;
    try {
        const clone = sound.cloneNode();
        clone.volume = Math.max(0, Math.min(1, (volumePercent ?? 70) / 100));
        clone.play().catch(err => console.log('Audio blocked or failed:', err));
    } catch (e) {
        /* audio isn't critical — fail silently */
    }
}

/* Apply saved theme on every page load */
applyTheme(loadSettings().theme);

/* =========================================================
   TIMER PAGE (index.html)
   ========================================================= */
(function initTimerPage() {
    const form = document.getElementById('timerForm');
    if (!form) return;

    const roundsInput = document.getElementById('rounds');
    const roundTimeInput = document.getElementById('roundTime');
    const restTimeInput = document.getElementById('restTime');

    const timerDisplay = document.getElementById('timerDisplay');
    const roundNumEl = document.getElementById('roundNum');
    const totalRoundsLabel = document.getElementById('totalRoundsLabel');
    const timerState = document.getElementById('timerState');
    const upNextLabel = document.getElementById('upNextLabel');
    const upNextTime = document.getElementById('upNextTime');
    const totalTimeDisplay = document.getElementById('totalTimeDisplay');
    const pauseResumeBtn = document.getElementById('pauseResumeBtn');
    const resetBtn = document.getElementById('resetBtn');
    const submitBtn = form.querySelector('button[type="submit"]');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenExitBtn = document.getElementById('fullscreenExitBtn');

    // Prefill from settings, or from a "Set Again" request coming from History
    const settings = loadSettings();
    roundsInput.value = settings.rounds;
    roundTimeInput.value = settings.roundTime;
    restTimeInput.value = settings.restTime;

    try {
        const setAgainRaw = sessionStorage.getItem(STORAGE_KEYS.setAgain);
        if (setAgainRaw) {
            const again = JSON.parse(setAgainRaw);
            if (again.rounds) roundsInput.value = again.rounds;
            if (again.roundTime) roundTimeInput.value = again.roundTime;
            if (again.restTime) restTimeInput.value = again.restTime;
            sessionStorage.removeItem(STORAGE_KEYS.setAgain);
        }
    } catch (e) { /* ignore */ }

    let phases = [];
    let phaseIndex = 0;
    let timeLeft = 0;
    let paused = false;
    let intervalId = null;
    let plannedTotal = 0;

    function buildPhases(rounds, roundTime, restTime) {
        const list = [];
        for (let r = 1; r <= rounds; r++) {
            list.push({ type: 'work', round: r, duration: roundTime });
            list.push({ type: 'rest', round: r, duration: restTime });
        }
        return list;
    }

    function render() {
        const phase = phases[phaseIndex];
        if (!phase) return;

        timerDisplay.textContent = formatTime(timeLeft);
        roundNumEl.textContent = phase.round;
        totalRoundsLabel.textContent = roundsInput.value;
        totalTimeDisplay.textContent = formatTime(plannedTotal);

        if (phase.type === 'work') {
            timerState.textContent = 'WORK';
            timerState.classList.remove('is-rest');
        } else {
            timerState.textContent = 'REST';
            timerState.classList.add('is-rest');
        }

        const next = phases[phaseIndex + 1];
        if (next) {
            upNextLabel.textContent = next.type === 'work' ? 'WORK' : 'REST';
            upNextTime.textContent = formatTime(next.duration);
        } else {
            upNextLabel.textContent = 'DONE';
            upNextTime.textContent = '--:--';
        }
    }

    function tick() {
        if (paused) return;
        if (timeLeft <= 0) {
            phaseIndex++;
            if (phaseIndex >= phases.length) {
                finishWorkout();
                return;
            }
            const phase = phases[phaseIndex];
            timeLeft = phase.duration;
            if (settings.soundEffects !== false) {
                playClip(bellSound, settings.volume);
            }
        } else {
            timeLeft--;
            const phase = phases[phaseIndex];
            if (settings.soundEffects !== false) {
                if (phase.type === 'rest' && timeLeft === 5) playClip(whistleSound, settings.volume);
                if (phase.type === 'work' && timeLeft === 10) playClip(whistleSound, settings.volume);
            }
        }
        render();
    }

    function setFormDisabled(disabled) {
        roundsInput.disabled = disabled;
        roundTimeInput.disabled = disabled;
        restTimeInput.disabled = disabled;
        submitBtn.disabled = disabled;
        submitBtn.style.opacity = disabled ? '0.5' : '1';
    }

    function startWorkout(e) {
        if (e) e.preventDefault();
        const rounds = Math.max(1, parseInt(roundsInput.value, 10) || 1);
        const roundTime = Math.max(1, parseInt(roundTimeInput.value, 10) || 1);
        const restTime = Math.max(1, parseInt(restTimeInput.value, 10) || 1);

        phases = buildPhases(rounds, roundTime, restTime);
        phaseIndex = 0;
        timeLeft = phases[0].duration;
        plannedTotal = rounds * roundTime + rounds * restTime;
        paused = false;
        pauseResumeBtn.textContent = 'Pause';

        setFormDisabled(true);
        render();
        if (settings.soundEffects !== false) {
            playClip(bellSound, settings.volume);
        }

        clearInterval(intervalId);
        intervalId = setInterval(tick, 1000);
    }

    function finishWorkout() {
        clearInterval(intervalId);
        intervalId = null;
        timerState.textContent = 'DONE';
        timerState.classList.remove('is-rest');
        timerDisplay.textContent = '00:00';
        upNextLabel.textContent = 'WORKOUT';
        upNextTime.textContent = 'COMPLETE';

        addHistoryEntry({
            date: new Date().toISOString(),
            rounds: parseInt(roundsInput.value, 10),
            roundTime: parseInt(roundTimeInput.value, 10),
            restTime: parseInt(restTimeInput.value, 10),
            totalTime: plannedTotal
        });

        setFormDisabled(false);
        if (settings.soundEffects !== false) {
            playClip(bellSound, settings.volume);
        }
    }

    function togglePause() {
        if (!intervalId) return;
        paused = !paused;
        pauseResumeBtn.textContent = paused ? 'Resume' : 'Pause';
    }

    function resetTimer() {
        clearInterval(intervalId);
        intervalId = null;
        paused = false;
        phases = [];
        phaseIndex = 0;
        timeLeft = 0;
        plannedTotal = 0;

        timerDisplay.textContent = '00:00';
        roundNumEl.textContent = '1';
        totalRoundsLabel.textContent = roundsInput.value;
        timerState.textContent = 'READY';
        timerState.classList.remove('is-rest');
        upNextLabel.textContent = 'REST';
        upNextTime.textContent = '00:00';
        totalTimeDisplay.textContent = '00:00';
        pauseResumeBtn.textContent = 'Pause';

        setFormDisabled(false);
    }

    form.addEventListener('submit', startWorkout);
    pauseResumeBtn.addEventListener('click', togglePause);
    resetBtn.addEventListener('click', resetTimer);

    // Fullscreen focus mode — just the countdown, no controls
    function enterFullscreenMode() {
        document.body.classList.add('is-fullscreen');
    }
    function exitFullscreenMode() {
        document.body.classList.remove('is-fullscreen');
    }
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', enterFullscreenMode);
    if (fullscreenExitBtn) fullscreenExitBtn.addEventListener('click', exitFullscreenMode);

    // Space bar: start when idle, pause/resume when running
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('is-fullscreen')) {
            exitFullscreenMode();
            return;
        }
        if (e.code !== 'Space') return;
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        if (intervalId) {
            togglePause();
        } else {
            startWorkout();
        }
    });

    resetTimer();
})();

/* =========================================================
   HISTORY + STATS shared rendering
   (history.html has the list + table; stats.html has the
   summary + chart only — both are guarded by element checks)
   ========================================================= */
(function initHistoryAndStats() {
    const historyList = document.getElementById('historyList');
    const historyBody = document.getElementById('historyBody');
    const historyEmpty = document.getElementById('historyEmpty');
    const clearBtn = document.getElementById('clearHistoryBtn');

    const statTotalWorkouts = document.getElementById('statTotalWorkouts');
    const statTotalTime = document.getElementById('statTotalTime');
    const statAvgRound = document.getElementById('statAvgRound');
    const statAvgRest = document.getElementById('statAvgRest');
    const chartEl = document.getElementById('historyChart');
    const longestSessionEl = document.getElementById('longestSession');

    const onHistoryPage = !!(historyList || historyBody);
    const onStatsPage = !!(statTotalWorkouts || chartEl);
    if (!onHistoryPage && !onStatsPage) return;

    function renderSummary(entries) {
        if (!statTotalWorkouts) return;
        const count = entries.length;
        const totalTime = entries.reduce((sum, e) => sum + (e.totalTime || 0), 0);
        const avgRound = count ? entries.reduce((sum, e) => sum + (e.roundTime || 0), 0) / count : 0;
        const avgRest = count ? entries.reduce((sum, e) => sum + (e.restTime || 0), 0) / count : 0;

        statTotalWorkouts.textContent = count;
        statTotalTime.textContent = formatTime(totalTime);
        statAvgRound.textContent = formatTime(avgRound);
        statAvgRest.textContent = formatTime(avgRest);
    }

    function renderChart(entries) {
        if (!chartEl) return;
        chartEl.innerHTML = '';
        const recent = entries.slice(-6);
        if (recent.length === 0) {
            chartEl.innerHTML = '<div class="history-empty">No workouts yet — your time overview will appear here.</div>';
            return;
        }
        const max = Math.max(...recent.map(e => e.totalTime || 0), 1);
        recent.forEach(entry => {
            const wrap = document.createElement('div');
            wrap.className = 'chart__bar-wrap';

            const bar = document.createElement('div');
            bar.className = 'chart__bar';
            const pct = Math.max(4, ((entry.totalTime || 0) / max) * 100);
            bar.style.height = pct + '%';
            bar.title = formatTime(entry.totalTime || 0);

            const label = document.createElement('div');
            label.className = 'chart__label';
            const d = new Date(entry.date);
            label.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            wrap.appendChild(bar);
            wrap.appendChild(label);
            chartEl.appendChild(wrap);
        });
    }

    function renderLongest(entries) {
        if (!longestSessionEl) return;
        if (entries.length === 0) return;
        const longest = entries.reduce((a, b) => (b.totalTime || 0) > (a.totalTime || 0) ? b : a, entries[0]);
        longestSessionEl.textContent = `Your longest session was ${formatTime(longest.totalTime || 0)} on ${formatDate(longest.date)} (${longest.rounds} rounds).`;
    }

    function goSetAgain(entry) {
        sessionStorage.setItem(STORAGE_KEYS.setAgain, JSON.stringify({
            rounds: entry.rounds,
            roundTime: entry.roundTime,
            restTime: entry.restTime
        }));
        window.location.href = 'index.html';
    }

    function renderHistoryList(entries) {
        if (!historyList) return;
        historyList.innerHTML = '';
        const reversed = [...entries].reverse();

        if (reversed.length === 0) {
            if (historyEmpty) historyEmpty.hidden = false;
        } else {
            if (historyEmpty) historyEmpty.hidden = true;
        }

        reversed.forEach((entry, i) => {
            const li = document.createElement('li');
            li.className = 'history-list__item';
            if (i === 0) li.classList.add('is-active');
            li.innerHTML = `
                <div>
                    <span class="history-list__date">${formatDate(entry.date)}</span>
                    <span class="history-list__meta">${entry.rounds} Rounds</span>
                </div>
                <span class="history-list__time">${formatTime(entry.totalTime || 0)}</span>
            `;
            li.addEventListener('click', () => {
                historyList.querySelectorAll('.history-list__item').forEach(el => el.classList.remove('is-active'));
                li.classList.add('is-active');
            });
            historyList.appendChild(li);
        });
    }

    function renderHistoryTable(entries) {
        if (!historyBody) return;
        historyBody.innerHTML = '';
        const reversed = [...entries].reverse();

        reversed.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(entry.date)}</td>
                <td>${entry.rounds}</td>
                <td>${formatTime(entry.roundTime || 0)}</td>
                <td>${formatTime(entry.restTime || 0)}</td>
                <td><button class="set-again-btn">Set Again</button></td>
            `;
            tr.querySelector('.set-again-btn').addEventListener('click', () => goSetAgain(entry));
            historyBody.appendChild(tr);
        });
    }

    function renderAll() {
        const entries = loadHistory();
        renderHistoryList(entries);
        renderHistoryTable(entries);
        renderSummary(entries);
        renderChart(entries);
        renderLongest(entries);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all workout history? This cannot be undone.')) {
                saveHistory([]);
                renderAll();
            }
        });
    }

    renderAll();
})();

/* =========================================================
   SETTINGS PAGE (settings.html)
   ========================================================= */
(function initSettingsPage() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (!saveBtn) return;

    const settings = loadSettings();

    const steppers = document.querySelectorAll('.stepper');
    steppers.forEach(stepper => {
        const targetId = stepper.dataset.target;
        const min = parseInt(stepper.dataset.min, 10) || 1;
        const step = parseInt(stepper.dataset.step, 10) || 1;
        const valueEl = document.getElementById(targetId);
        if (!valueEl) return;

        // initialize from saved settings
        const keyMap = {
            setRounds: 'rounds',
            setRoundTime: 'roundTime',
            setRestTime: 'restTime',
            setLongRest: 'longRest'
        };
        const key = keyMap[targetId];
        if (key && settings[key] !== undefined) {
            valueEl.textContent = settings[key];
        }

        stepper.querySelectorAll('.stepper__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                let current = parseInt(valueEl.textContent, 10) || min;
                current += btn.dataset.action === 'inc' ? step : -step;
                if (current < min) current = min;
                valueEl.textContent = current;
            });
        });
    });

    // Theme swatches
    const swatches = document.querySelectorAll('.theme-swatch');
    function selectTheme(theme, persist) {
        swatches.forEach(s => s.classList.toggle('is-selected', s.dataset.theme === theme));
        applyTheme(theme);
        if (persist) {
            const current = loadSettings();
            current.theme = theme;
            saveSettings(current);
        }
    }
    selectTheme(settings.theme || 'dark', false);
    swatches.forEach(swatch => {
        swatch.addEventListener('click', () => selectTheme(swatch.dataset.theme, true));
    });

    // Sound controls
    const soundEffects = document.getElementById('soundEffects');
    const bellSelect = document.getElementById('bellSelect');
    const volumeRange = document.getElementById('volumeRange');
    const volumeValue = document.getElementById('volumeValue');

    if (soundEffects) soundEffects.checked = settings.soundEffects !== false;
    if (bellSelect) bellSelect.value = settings.bell || 'Bell 1';
    if (volumeRange) volumeRange.value = settings.volume ?? 70;
    if (volumeValue) volumeValue.textContent = `${settings.volume ?? 70}%`;

    if (volumeRange) {
        volumeRange.addEventListener('input', () => {
            volumeValue.textContent = `${volumeRange.value}%`;
        });
    }

    saveBtn.addEventListener('click', () => {
        const updated = {
            ...loadSettings(),
            rounds: parseInt(document.getElementById('setRounds').textContent, 10),
            roundTime: parseInt(document.getElementById('setRoundTime').textContent, 10),
            restTime: parseInt(document.getElementById('setRestTime').textContent, 10),
            longRest: parseInt(document.getElementById('setLongRest').textContent, 10),
            soundEffects: soundEffects ? soundEffects.checked : true,
            bell: bellSelect ? bellSelect.value : 'Bell 1',
            volume: volumeRange ? parseInt(volumeRange.value, 10) : 70
        };
        saveSettings(updated);

        const original = saveBtn.textContent;
        saveBtn.textContent = 'Saved ✓';
        setTimeout(() => { saveBtn.textContent = original; }, 1500);
    });
})();

/* =========================================================
   LOGIN / REGISTER PAGE (login.html)
   This is a front-end only demo — there is no backend, so
   forms simply acknowledge submission instead of posting.
   ========================================================= */
(function initAuthPage() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (!loginForm && !registerForm) return;

    function noteDemo(form, message) {
        let note = form.querySelector('.auth__demo-note');
        if (!note) {
            note = document.createElement('p');
            note.className = 'auth__demo-note';
            note.style.color = 'var(--text-dim)';
            note.style.fontSize = '12px';
            note.style.marginTop = '12px';
            note.style.textAlign = 'center';
            form.appendChild(note);
        }
        note.textContent = message;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            noteDemo(loginForm, 'This is a demo — accounts are not yet connected to a server.');
        });
    }
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            noteDemo(registerForm, 'This is a demo — accounts are not yet connected to a server.');
        });
    }
})();
