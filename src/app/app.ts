import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { KennzeichenSucheComponent } from './kennzeichen/kennzeichen-suche/kennzeichen-suche.component';
import { SammlungComponent } from './sammlung/sammlung.component';
import { SammlungService } from './sammlung/sammlung.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KennzeichenSucheComponent, SammlungComponent],
  template: `
    <main class="huelle">
      <header class="kopf">
        <h1>KFZ-Kennzeichen erklärt</h1>
        <p>Gib ein deutsches Kennzeichen ein und erfahre, wofür es steht.</p>
      </header>

      <nav class="reiter" role="tablist">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="ansicht() === 'suche'"
          [class.aktiv]="ansicht() === 'suche'"
          (click)="ansicht.set('suche')"
        >
          Suche
        </button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="ansicht() === 'sammlung'"
          [class.aktiv]="ansicht() === 'sammlung'"
          (click)="ansicht.set('sammlung')"
        >
          Sammlung
          @if (sammlung.anzahl(); as n) {
            <span class="zaehler">{{ n }}</span>
          }
        </button>
      </nav>

      @if (ansicht() === 'suche') {
        <app-kennzeichen-suche />
      } @else {
        <app-sammlung />
      }

      <footer class="fuss">
        <p>
          Datengrundlage:
          <a href="https://github.com/openpotato/kfz-kennzeichen" target="_blank" rel="noopener">
            openpotato/kfz-kennzeichen
          </a>
          – Quelle der Fußnoten und Unterscheidungszeichen ist das Kraftfahrt-Bundesamt.
        </p>
      </footer>
    </main>
  `,
  styles: `
    .huelle {
      max-width: 46rem;
      margin: 0 auto;
      padding: 2rem 1.25rem 4rem;
    }
    .kopf {
      margin-bottom: 2rem;
      h1 {
        margin: 0 0 0.4rem;
        font-size: clamp(1.6rem, 5vw, 2.2rem);
      }
      p {
        margin: 0;
        color: #5b6470;
      }
    }
    .reiter {
      display: flex;
      gap: 0.25rem;
      margin-bottom: 1.75rem;
      border-bottom: 1px solid #d8dbe0;

      button {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.6rem 1rem;
        border: 0;
        border-bottom: 2px solid transparent;
        background: transparent;
        font: inherit;
        font-size: 0.95rem;
        color: #5b6470;
        cursor: pointer;

        &:hover {
          color: #003399;
        }
        &.aktiv {
          color: #003399;
          border-bottom-color: #003399;
          font-weight: 600;
        }
      }
    }
    .zaehler {
      min-width: 1.4rem;
      padding: 0.05rem 0.4rem;
      border-radius: 999px;
      background: #eef0f3;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .fuss {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #d8dbe0;
      font-size: 0.8rem;
      color: #5b6470;
      a {
        color: #003399;
      }
    }
  `,
})
export class App {
  protected readonly sammlung = inject(SammlungService);
  protected readonly ansicht = signal<'suche' | 'sammlung'>('suche');
}
