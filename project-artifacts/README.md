# project-artifacts

A pane listing your claude.ai artifacts under the repos they belong to, with their open comments. Open it with `/repo-artifacts`.

Each repo holding an artifact gets a heading with its artifact count and open comments; pressing the heading folds the repo's artifacts under it, and a fold stays across sessions. Each row shows the artifact's title as a link, its type (`Design`, `Docs`, `Design System`), when it last changed, and how many comment threads on it are unresolved. `To prompt` adds its title and link to the prompt, unsent, so Claude can open it. Claude Docs show no comment count: the artifacts server cannot read their comments.

The session can sit in a repo or in a folder holding several. The active repo is the session's folder when that is a repo, else the repo of the file a tool last read or changed. Its heading is drawn first, in the accent color, and an artifact Claude publishes, edits or creates joins it. With no active repo yet, a new artifact stays in no repo.

`Show … in no repo` lists your own artifacts that no repo holds, each with `Link to…`, which offers the repos under the session's folder. `Unlink` takes an artifact out of its repo. Links are kept by repo, so every worktree of a repo shares them, and they stay across sessions.

The pane reads the artifacts through the `claude-artifacts` MCP server, so that server needs to be connected. It reads when the session starts, when the pane opens, after a link changes, and on `Refresh`.

With `project-status` installed, a `repo-artifacts` item in the status row shows the active repo's artifact and open comment counts, and opens this pane.

## License

[Apache License 2.0](LICENSE).
