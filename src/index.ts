import {Plugin} from 'prettier';

import {angularCliPlugin} from './angular-cli';
import {Node} from './create-plugin/parser';
import {packageJsonPlugin} from './package-json';

function mergePlugins(...plugins: Plugin<Node>[]): Plugin<Node> {
  return plugins.reduce((a, b) => ({
    languages: [...(a.languages ?? []), ...(b.languages ?? [])],
    parsers: {
      ...a.parsers,
      ...b.parsers,
    },
    printers: {
      ...a.printers,
      ...b.printers,
    },
    options: {
      ...a.options,
      ...b.options,
    },
    defaultOptions: {
      ...a.defaultOptions,
      ...b.defaultOptions,
    },
  }));
}

export = mergePlugins(angularCliPlugin, packageJsonPlugin);
