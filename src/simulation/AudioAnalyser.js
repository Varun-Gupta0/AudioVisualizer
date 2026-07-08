/**
 * AudioAnalyser — Web Audio API wrapper.
 * Outputs normalized band energies { bass, mid, treble } every frame.
 * No rendering logic. No field logic.
 */
export default class AudioAnalyser {
    constructor(fftSize = 1024) {
        this.fftSize = fftSize;
        this.context = null;
        this.analyser = null;
        this.dataArray = null;
        this.connected = false;
    }

    /**
     * Connect to the user's microphone. Returns a promise.
     * Rejects if the user denies microphone access.
     */
    async connectMicrophone() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0.8; // Smooth FFT output over time
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const source = this.context.createMediaStreamSource(stream);
        source.connect(this.analyser);
        this.connected = true;
    }

    /**
     * Connect to an HTMLMediaElement (audio/video tag).
     * @param {HTMLMediaElement} element
     */
    connectElement(element) {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0.8;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        const source = this.context.createMediaElementSource(element);
        source.connect(this.analyser);
        this.analyser.connect(this.context.destination);
        this.connected = true;
    }

    /**
     * Read current FFT data and compute normalized band energies.
     * @returns {{ bass: number, mid: number, treble: number }}
     *          All values in [0, 1] range.
     */
    getBandEnergy() {
        if (!this.connected || !this.analyser) {
            return { bass: 0, mid: 0, treble: 0 };
        }

        this.analyser.getByteFrequencyData(this.dataArray);

        const binCount = this.analyser.frequencyBinCount;
        const nyquist = this.context.sampleRate / 2;
        const binHz = nyquist / binCount;

        // Frequency band boundaries in Hz
        const bands = {
            bass:   [20,   250],
            mid:    [250,  4000],
            treble: [4000, 20000],
        };

        const result = {};
        for (const [name, [lo, hi]] of Object.entries(bands)) {
            const binLo = Math.floor(lo / binHz);
            const binHi = Math.min(Math.ceil(hi / binHz), binCount - 1);
            let sum = 0;
            for (let i = binLo; i <= binHi; i++) sum += this.dataArray[i];
            const count = Math.max(1, binHi - binLo + 1);
            result[name] = sum / count / 255; // Normalize 0–255 → 0–1
        }

        return result;
    }
}
