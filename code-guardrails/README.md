# code-guardrails

Adds a note to Claude's context after an `Edit` or `Write` when the change breaks one of two rules. It has no pane or command, and it never blocks an edit.

- **File length:** a code file passes 300 lines. The note repeats each time the file grows another 100 lines.
- **History comments:** the added text holds comments that narrate what the code used to do, rather than what it does.

Claude decides what to do with the note: it can split the file, reword the comment, or tell you why it's leaving things as they are.

The limits are in `hooks/constants.ts`, along with the file extensions that count as code.

## License

[Apache License 2.0](LICENSE).
