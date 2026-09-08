// 49. INTEROPERABILITY: ABDM (Ayushman Bharat Digital Mission) Mock Adapter

export class AbhaAdapter {
  private static MOCK_REGISTRY: Record<string, any> = {
    '14-1111-2222-3333': {
      name: 'Rahul Kumar',
      gender: 'M',
      yob: 1984,
      address: 'Village Mokama, Bihar'
    }
  };

  /**
   * Verifies an ABHA ID against the national registry.
   */
  static async verifyAbhaId(abhaId: string): Promise<boolean> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // In production, this would call the NDHM Gateway
    return !!this.MOCK_REGISTRY[abhaId];
  }

  /**
   * Fetches core demographic data for auto-filling registration forms.
   */
  static async fetchDemographics(abhaId: string) {
    if (await this.verifyAbhaId(abhaId)) {
      return this.MOCK_REGISTRY[abhaId];
    }
    throw new Error('Invalid ABHA ID');
  }

  /**
   * Links a local encounter/prescription to the patient's national health locker.
   */
  static async linkHealthRecord(abhaId: string, encounterData: any) {
    console.log(`[ABDM Adapter] Linked encounter to ABHA ${abhaId}`);
    return { success: true, linkedAt: new Date().toISOString() };
  }
}
