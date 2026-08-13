let timer;
let totalSeconds;
let currentRound = 1;
let totalRounds;
let isRestPeriod = false;
let isPaused = false;
let currentRoundTime;
let currentRestTime;

const bellSound = new Audio('sounds/bell.mp3');
const whistleSound = new Audio('sounds/whistle.mp3');

function playSound(sound) {
    const clone = sound.cloneNode();
    clone.play().catch(err => console.log('Audio blocked or failed:', err));
}

document.getElementById('timerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    totalRounds = parseInt(document.getElementById('rounds').value);
    currentRoundTime = parseInt(document.getElementById('roundTime').value);
    currentRestTime = parseInt(document.getElementById('restTime').value);

    currentRound = 1;
    isRestPeriod = false;
    isPaused = false;
    totalSeconds = currentRoundTime;
    updateDisplay();
    playSound(bellSound); // bell on initial start

    document.getElementById('pauseResumeBtn').textContent = 'Pause';

    clearInterval(timer);
    timer = setInterval(tick, 1000);
});

document.getElementById('pauseResumeBtn').addEventListener('click', function() {
    if (totalSeconds === undefined) return; // no timer started yet

    if (isPaused) {
        timer = setInterval(tick, 1000);
        isPaused = false;
        this.textContent = 'Pause';
    } else {
        clearInterval(timer);
        isPaused = true;
        this.textContent = 'Resume';
    }
});

document.getElementById('resetBtn').addEventListener('click', function() {
    clearInterval(timer);
    isPaused = false;
    isRestPeriod = false;
    currentRound = 1;
    totalSeconds = 0;
    document.getElementById('timerDisplay').textContent = '00:00';
    document.getElementById('roundDisplay').textContent = 'Round: 0';
    document.getElementById('pauseResumeBtn').textContent = 'Pause';
});

function tick() {
    totalSeconds--;
    updateDisplay();

    if (isRestPeriod && totalSeconds === 5) {
        playSound(whistleSound);
    }

    if (!isRestPeriod && totalSeconds === 10) {
        playSound(whistleSound);
    }

    if (totalSeconds <= 0) {
        if (isRestPeriod) {
            currentRound++;
            if (currentRound > totalRounds) {
                clearInterval(timer);
                document.getElementById('timerDisplay').textContent = "Done!";
                playSound(bellSound); // final bell
                return;
            }
            isRestPeriod = false;
            totalSeconds = currentRoundTime;
            playSound(bellSound); // round starts
        } else {
            isRestPeriod = true;
            totalSeconds = currentRestTime;
            playSound(bellSound); // round ends
        }
    }

    document.getElementById('roundDisplay').textContent = isRestPeriod
        ? "Rest"
        : `Round: ${currentRound}`;
}

function updateDisplay() {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    document.getElementById('timerDisplay').textContent = `${mins}:${secs}`;
}