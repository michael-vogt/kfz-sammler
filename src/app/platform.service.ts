import { Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Kapselt die nativen Capacitor-Aufrufe. Im Browser passiert nichts,
 * damit `ng serve` und der Web-Build unverändert funktionieren.
 */
@Injectable({ providedIn: 'root' })
export class PlattformService {
  private readonly zone = inject(NgZone);

  readonly istNativ = signal(false);

  /** Wird von der Zurück-Taste aufgerufen; gibt true zurück, wenn die App schliessen soll. */
  private zurueckBehandlung: (() => boolean) | null = null;

  async initialisieren(): Promise<void> {
    // Dynamische Importe: im reinen Web-Build werden die Plugins nie geladen.
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;

    this.istNativ.set(true);

    const { App } = await import('@capacitor/app');
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const { SplashScreen } = await import('@capacitor/splash-screen');

    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#003399' });
    await SplashScreen.hide();

    App.addListener('backButton', () => {
      // Listener laufen ausserhalb der Angular-Zone – Signale müssen hinein.
      this.zone.run(() => {
        const schliessen = this.zurueckBehandlung?.() ?? true;
        if (schliessen) App.exitApp();
      });
    });
  }

  /** Registriert, was die Zurück-Taste tun soll. */
  zurueckTaste(behandlung: () => boolean): void {
    this.zurueckBehandlung = behandlung;
  }
}
