// لحظات قابلة للقص (قسم 22): منسجّل الشاشة وصوت اللعبة بشكل دوّار، ولما تخلص الليلة منحفظ آخر لحظات كفيديو.
// كل SEG منبلّش تسجيل جديد ومنخلّي آخر 3، فأقدم واحد شغّال بيغطّي آخر 14–21 ثانية.
// كل شي بيضل على جهاز اللاعب: الفيديو ما بيطلع إلا إذا نزّله بنفسه.
const SEG = 7000;
const KEEP = 3;

export class Clipper {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.audio = audio;
    this.recs = [];
    this.timer = null;
  }

  get supported() {
    return typeof MediaRecorder !== 'undefined' && !!this.canvas.captureStream;
  }

  start() {
    if (!this.supported || this.timer) return false;
    const tracks = [...this.canvas.captureStream(30).getVideoTracks()];
    try {
      tracks.push(...this.audio.tap().getAudioTracks());
    } catch {
      /* بدون صوت */
    }
    this.stream = new MediaStream(tracks);
    this.mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    const spawn = () => {
      const rec = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: 2_500_000 });
      rec.chunks = [];
      rec.ondataavailable = (e) => e.data.size && rec.chunks.push(e.data);
      rec.start(1000);
      this.recs.push(rec);
      while (this.recs.length > KEEP) {
        const old = this.recs.shift();
        if (old.state !== 'inactive') old.stop();
      }
    };
    spawn();
    this.timer = setInterval(spawn, SEG);
    return true;
  }

  // بيوقّف التسجيل وبيرجّع فيديو آخر لحظات (من أقدم تسجيل شغّال)
  async grab() {
    if (!this.recs.length) return null;
    clearInterval(this.timer);
    this.timer = null;
    const rec = this.recs[0];
    const done = new Promise((r) => (rec.onstop = r));
    for (const r of this.recs) if (r.state !== 'inactive') r.stop();
    await done;
    this.recs = [];
    return rec.chunks.length ? new Blob(rec.chunks, { type: this.mime || 'video/webm' }) : null;
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    for (const r of this.recs) if (r.state !== 'inactive') r.stop();
    this.recs = [];
  }
}
