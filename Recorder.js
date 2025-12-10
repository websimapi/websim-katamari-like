export class Recorder {
  constructor(canvas) {
    this.canvas = canvas;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }

  isSupported() {
    return !!(window.MediaRecorder && this.canvas.captureStream);
  }

  start() {
    if (!this.isSupported()) {
      console.warn("Recording not supported in this browser.");
      return false;
    }

    if (this.isRecording) return false;

    try {
      // Capture the stream from the canvas
      // 30 FPS is a good default
      const stream = this.canvas.captureStream(30); 

      // Determine supported mime type
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4' 
      ];

      let selectedType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedType = type;
          break;
        }
      }

      if (!selectedType) {
        console.error("No supported mime type found for MediaRecorder");
        return false;
      }

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedType,
        videoBitsPerSecond: 5000000 // 5Mbps for decent quality
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.saveRecording();
      };

      this.recordedChunks = [];
      this.mediaRecorder.start();
      this.isRecording = true;
      console.log(`Recording started (${selectedType})`);

      return true;
    } catch (e) {
      console.error("Error starting recording:", e);
      return false;
    }
  }

  stop() {
    if (!this.isRecording || !this.mediaRecorder) return;

    try {
      this.mediaRecorder.stop();
    } catch(e) {
      console.error("Error stopping recorder:", e);
    }
    this.isRecording = false;
  }

  saveRecording() {
    if (this.recordedChunks.length === 0) return;

    const blob = new Blob(this.recordedChunks, {
      type: this.mediaRecorder.mimeType
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;

    // Generate filename with timestamp
    const date = new Date();
    const timestamp = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}${String(date.getSeconds()).padStart(2,'0')}`;
    a.download = `katamari_clip_${timestamp}.webm`;

    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }
}