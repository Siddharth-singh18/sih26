export class SpeechAdapter {
  private isSupported: boolean;
  private recognition: any = null;

  constructor() {
    this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    
    if (this.isSupported) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
    }
  }

  public startListening(
    language: string = 'en-US',
    onResult: (text: string, isFinal: boolean) => void,
    onError: (err: any) => void
  ) {
    if (!this.isSupported) {
      onError(new Error("UNVERIFIED — EXTERNAL CREDENTIAL REQUIRED (Speech API not supported natively in this browser)"));
      return;
    }

    this.recognition.lang = language;
    
    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        onResult(finalTranscript, true);
      } else if (interimTranscript) {
        onResult(interimTranscript, false);
      }
    };

    this.recognition.onerror = (event: any) => {
      onError(event.error);
    };

    try {
      this.recognition.start();
    } catch (e) {
      onError(e);
    }
  }

  public stopListening() {
    if (this.isSupported && this.recognition) {
      this.recognition.stop();
    }
  }
}

export const speechAdapter = new SpeechAdapter();
