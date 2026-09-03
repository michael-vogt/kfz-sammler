import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Stellt ein Kennzeichen optisch als EU-Schild dar. */
@Component({
  selector: 'app-kennzeichen-schild',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kennzeichen-schild.component.html',
  styleUrl: './kennzeichen-schild.component.css',
})
export class KennzeichenSchildComponent {
  readonly uz = input.required<string>();
  readonly nummer = input<string>('');

  protected readonly sterne = Array.from({ length: 12 }, (_, i) => i * 30);
}
