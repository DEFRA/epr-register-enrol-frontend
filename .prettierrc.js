export default {
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  // Preserve each file's existing line ending instead of forcing LF.
  // Without this, a Windows checkout with core.autocrlf=true (converting
  // every file to CRLF on checkout) fails `prettier --check .` repo-wide,
  // unrelated to any actual code content — reproduced here even with a
  // clean checkout of main and zero local changes.
  endOfLine: 'auto'
}
