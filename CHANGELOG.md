# Changelog

## Unreleased

- Update minimum prettier version to 3.0.0
- Change type of the `angularCliTopProjects` and `angularCliBottomProjects` options to arrays of strings
  Instead of passing

  ```yaml
  overrides:
    - files: angular.json
      options:
        parser: angular-cli
        angularCliTopProjects: top,other-top
  ```

  now pass

  ```yaml
  overrides:
    - files: angular.json
      options:
        parser: angular-cli
        angularCliTopProjects:
          - top
          - other-top
  ```
