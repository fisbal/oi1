// The "Every app" group of the Office In 1 tab, the same in every app (Martin, 2026-10-31: keep In 1 Letter's design
// and title as the reference, soft and colourful, with a little animation, nothing too much). One key per app in its
// colour with its little 3D picture from the launcher, which comes alive under the mouse; a soft lift; apps still to
// come stay pastel with "soon".

import type { CSSProperties } from 'react';
import { t } from '../shell/i18n';
import { modules, shortName } from '../shell/modules';
import type { AppInfo } from '../shell/contract';
import { SceneArt } from '../shell/Scene';

/** The soft colour of an app (Letter blue, Class green, Stage orange…), for tinting what leads to it. */
export const appColor = (id: string) => modules.find(m => m.id === id)?.color;

export function AppKeys({ apps, self, onOpen }: { apps: AppInfo[]; self: string; onOpen: (id: string) => void }) {
  return (
    <div className="app-keys">
      {apps.filter(a => a.id !== self).map((a, i) => {
        const name = shortName(a.name);
        const label = a.ready ? a.name : `${a.name} (${t('home.soon')})`;
        return (
          <button key={a.id} type="button" className="app-key" disabled={!a.ready} onClick={() => onOpen(a.id)}
            style={{ '--accent': a.color, '--i': i } as CSSProperties} title={label} aria-label={label} data-help={`tuto.app.${a.id}`}>
            <SceneArt app={a.id} accent={a.color} className="app-key-art" /><span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
