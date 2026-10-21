/**
 * Corner (half-gain) frequencies of the channel-strip shelving EQ.
 * A shelf only reaches its full boost/cut well beyond its corner, so these are set
 * a bit more inward than a real console's 80 Hz / 12 kHz so students can hear the
 * LOW and HIGH knobs on small speakers.
 */
export const CONSOLE_LOW_HZ = 120;
export const CONSOLE_HIGH_HZ = 8000;

/** EQ Wizard > FreqTweak uses even wider-reaching shelves so changes stay obvious on poor listening devices. */
export const TWEAK_LOW_HZ = 150;
export const TWEAK_HIGH_HZ = 6000;

/** "120 Hz" / "8 kHz" style labels */
export const fmtCornerHz = (f: number) => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`);
