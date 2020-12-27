import {
  combine,
  createJsonPlugin,
  deepSortObjectProperties,
  getPropertyKeys,
  JsonFlags,
  JsonPlugin,
  renameProperty,
  replacePropertyValue,
  replacePropertyValues,
  sortObjectProperties,
} from './create-plugin';
import {ParserOptions} from 'prettier';

interface AngularCliParserOptions extends ParserOptions {
  angularCliTopProjects: string;
  angularCliBottomProjects: string;
}

const plugin = createJsonPlugin({
  language: {name: 'angular-cli'},

  printer: 'json',
  flags: JsonFlags.CommentsAllowed,
  parserFlags: JsonFlags.CommentsAllowed,

  modifier: combine(
    sortObjectProperties([
      '$schema',
      'version',
      'cli',
      'newProjectRoot',
      'projects',
      'schematics',
    ]),

    replacePropertyValue(
      'projects',
      combine(
        sortObjectProperties((projects, options) => {
          const keys = getPropertyKeys(projects).sort();

          const sortAtTheTop = new Set(
            parseProjectNamesOption(
              (options as AngularCliParserOptions).angularCliTopProjects,
            ),
          );
          const sortAtTheBottom = new Set(
            parseProjectNamesOption(
              (options as AngularCliParserOptions).angularCliBottomProjects,
            ),
          );

          return [
            ...keys.filter(key => sortAtTheTop.has(key)),

            ...keys.filter(
              key => !sortAtTheTop.has(key) && !sortAtTheBottom.has(key),
            ),

            ...keys.filter(key => sortAtTheBottom.has(key)),
          ];
        }),

        replacePropertyValues(
          combine(
            renameProperty('targets', 'architect'),

            sortObjectProperties([
              'projectType',
              'root',
              'sourceRoot',
              'architect',
              'i18n',
              'schematics',
            ]),

            replacePropertyValue(
              'architect',
              combine(
                sortObjectProperties(),
                replacePropertyValues(
                  combine(
                    sortObjectProperties([
                      'builder',
                      'options',
                      'configurations',
                      'schematics',
                    ]),
                    replacePropertyValues(deepSortObjectProperties()),
                  ),
                ),
              ),
            ),

            replacePropertyValue('i18n', deepSortObjectProperties()),
            replacePropertyValue('schematics', deepSortObjectProperties()),
          ),
        ),
      ),
    ),

    replacePropertyValue('schematics', deepSortObjectProperties()),
  ),
});

function parseProjectNamesOption(option: string) {
  return option
    .split(',')
    .map(project => project.trim())
    .filter(Boolean);
}

export const angularCliPlugin: JsonPlugin = {
  ...plugin,

  options: {
    angularCliTopProjects: {
      category: 'Angular CLI',
      default: '',
      type: 'path',
      description: 'Keys of projects to sort at the top',
    },
    angularCliBottomProjects: {
      category: 'Angular CLI',
      default: '',
      type: 'path',
      description: 'Keys of projects to sort at the bottom',
    },
  },
};
