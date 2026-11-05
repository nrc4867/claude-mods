# context-breakdown

`/ctx` opens a pane showing what fills the context window and how much of your plan you've used. It refreshes each turn.

![The Context pane](docs/context.png)

- **Session:** the session's id, a link to its transcript, and a button that copies the resume command. Background sessions also link to their job folder under `~/.claude/jobs/`.
- **Usage:** session length, cost and plan limits, with when each limit resets.
- **Window:** tokens by category, then by memory file and MCP server.

The window figures fill in after the first response.

## License

[Apache License 2.0](LICENSE).
