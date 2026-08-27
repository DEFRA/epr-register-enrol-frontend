import neostandard from 'neostandard'
import undocumentedAcronymRule from './eslint-rules/no-undocumented-service-acronyms.js'

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
  },
  {
    // The rule's own source necessarily contains the literal strings it
    // bans, so it can't lint itself.
    ignores: ['eslint-rules/**']
  },
  {
    plugins: {
      local: {
        rules: { 'no-undocumented-service-acronyms': undocumentedAcronymRule }
      }
    },
    rules: { 'local/no-undocumented-service-acronyms': 'error' }
  }
]
