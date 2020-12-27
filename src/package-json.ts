import {
  createJsonPlugin,
  getPropertyKeys,
  sortObjectProperties,
  sortStringArray,
  combine,
  replacePropertyValues,
  deepSortObjectProperties,
} from './create-plugin';

const lifecycleScripts = [
  'install',
  'pack',
  'prepare',
  'publish',
  'restart',
  'shrinkwrap',
  'start',
  'stop',
  'test',
  'uninstall',
  'version',
];

function parseScriptName(name: string): {name: string; offset: number} {
  if (name.startsWith('pre') && name !== 'prepare') {
    return {name: name.slice(3), offset: -0.4};
  } else if (name.startsWith('post')) {
    return {name: name.slice(4), offset: 0.4};
  } else {
    return {name, offset: 0};
  }
}

const sortScripts = sortObjectProperties(node =>
  getPropertyKeys(node).sort((_a, _b) => {
    const a = parseScriptName(_a);
    const b = parseScriptName(_b);

    if (lifecycleScripts.includes(a.name)) {
      if (lifecycleScripts.includes(b.name)) {
        return (
          lifecycleScripts.indexOf(a.name) +
          1 +
          a.offset -
          (lifecycleScripts.indexOf(b.name) + 1 + b.offset)
        );
      } else {
        return -1;
      }
    } else {
      if (lifecycleScripts.includes(b.name)) {
        return 1;
      } else {
        return a.name.localeCompare(b.name) || a.offset - b.offset;
      }
    }
  }),
);

export const packageJsonPlugin = createJsonPlugin({
  language: {name: 'package-json'},
  modifier: combine(
    // Sort the top-level object in a given order
    sortObjectProperties([
      'name',
      'version',
      'private',

      'description',
      'keywords',
      'homepage',
      'bugs',
      'repository',
      'license',
      'author',
      'contributors',

      'bin',
      'man',
      'directovires',
      'files',
      'sideEffects',

      'workspaces',
      'scripts',

      'main',
      'exports',

      'umd:main',
      'jsdelivr',
      'unpkg',
      'module',
      'source',
      'jsnext:main',
      'browser',
      'types',
      'typings',
      'style',

      'dependencies',
      'bundledDependencies',
      'bundleDependencies',
      'optionalDependencies',
      'peerDependencies',
      'peerDependenciesMeta',
      'devDependencies',
      'dependenciesMeta',

      'engines',
      'publishConfig',
    ]),

    // Now sort the values of the top-level properties
    replacePropertyValues((value, opts, key) => {
      switch (key) {
        case 'exports':
        case 'imports':
          // Keep exports and imports as they are. Order can be important here,
          // depending on the shape of the declared exports/imports.
          return value;

        case 'scripts':
          // Sort scripts using a script-specific sort order
          return sortScripts(value, opts);

        case 'bundleDependencies':
        case 'bundledDependencies':
          return sortStringArray(value, opts);

        default:
          return deepSortObjectProperties()(value, opts);
      }
    }),
  ),
});
