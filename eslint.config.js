import neostandard from 'neostandard'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true,
    noStyle: true
  }),
  {
    rules: {
      // SonarCloud (javascript:S121) requires braces on every control
      // statement body; neostandard's base config does not enforce this.
      curly: ['error', 'all']
    }
  }
]
