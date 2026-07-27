const { execFileSync } = require('node:child_process');

const FIELD_SEPARATOR = '\x1f';

const FETCH_CONTACTS_SCRIPT = `
on run
  set output to {}
  tell application "Contacts"
    repeat with p in every person
      set emailVals to {}
      repeat with e in emails of p
        set end of emailVals to value of e
      end repeat
      set phoneVals to {}
      repeat with ph in phones of p
        set end of phoneVals to value of ph
      end repeat
      set AppleScript's text item delimiters to ","
      set emailStr to emailVals as text
      set phoneStr to phoneVals as text
      set AppleScript's text item delimiters to ""
      set end of output to (name of p) & (ASCII character 31) & emailStr & (ASCII character 31) & phoneStr
    end repeat
  end tell
  set AppleScript's text item delimiters to linefeed
  set finalOutput to output as text
  set AppleScript's text item delimiters to ""
  return finalOutput
end run
`;

function fetchAllContacts() {
  const stdout = execFileSync('osascript', ['-e', FETCH_CONTACTS_SCRIPT], { encoding: 'utf8' });

  return stdout
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [name, emailsCsv, phonesCsv] = line.split(FIELD_SEPARATOR);
      return {
        name,
        emails: emailsCsv ? emailsCsv.split(',').filter(Boolean) : [],
        phones: phonesCsv ? phonesCsv.split(',').filter(Boolean) : [],
      };
    });
}

module.exports = { fetchAllContacts };
