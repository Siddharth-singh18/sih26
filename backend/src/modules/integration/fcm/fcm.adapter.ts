export interface FCMMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class FCMAdapter {
  private sandboxMode = true;

  constructor(sandboxMode = true) {
    this.sandboxMode = sandboxMode;
  }

  public async sendPushNotification(message: FCMMessage): Promise<{ success: boolean; error?: string; messageId?: string }> {
    if (this.sandboxMode) {
      console.log(`[FCM SANDBOX] Simulated push sent to token ${message.token}: ${message.title}`);
      return { success: true, messageId: `sandbox-msg-${Date.now()}` };
    }

    throw new Error("UNVERIFIED — EXTERNAL CREDENTIAL REQUIRED. FCM live integration requires Firebase Admin SDK credentials.");
  }
}

export const fcmAdapter = new FCMAdapter(true);
