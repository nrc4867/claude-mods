# claude-mods

Claude Code mods that add panes, status items and guardrails to the terminal interface. Each mod works alone, and they link up when installed together: the `project-status` row opens the panes the other mods own.

![The status row](project-status/docs/status-bar.png)

| Mod | Adds | Commands |
| --- | --- | --- |
| [project-status](project-status/README.md) | A clickable status row, a worktree manager and per-repo notes | `/worktrees`, `/notes` |
| [session-files](session-files/README.md) | Files and tools used this session, plus links and commands Claude leaves for you | `/files`, `/links` |
| [context-breakdown](context-breakdown/README.md) | Context window and plan usage, with a link to the session and its job folder | `/ctx` |
| [repo-dashboard](repo-dashboard/README.md) | Git status of every repo beside the current project | `/repos` |
| [code-guardrails](code-guardrails/README.md) | Tells Claude when a file grows too long or a comment narrates history | None |

The pictures are illustrations with made-up data, drawn by `tools/render_images.py`. The real panes follow your terminal's theme.

## Install

From a shell, add this folder as a marketplace, then install the mods you want:

```sh
claude plugin marketplace add C:/Users/nicho/IdeaProjects/claude-mods
claude plugin install project-status@local-mods
claude plugin install session-files@local-mods
claude plugin install context-breakdown@local-mods
claude plugin install repo-dashboard@local-mods
claude plugin install code-guardrails@local-mods
```

The mods are read from this folder. After an edit, run `/reload-plugins` in the session.

To load a mod with no install, and have every save reload it, name its folder when you start Claude Code:

```sh
claude --plugin-dir ./project-status
```

Don't use both ways for the same mod at once.

## Develop

Run these from this folder:

```sh
claude plugin validate project-status
claude plugin test project-status
npx --yes -p typescript tsc -p project-status
```

The engine writes each mod's `.claude-plugin/types/` when it loads the mod, and git ignores that folder. A type check needs the mod to have loaded once.

To redraw the pictures on Windows, with Pillow installed:

```sh
python tools/render_images.py
```

## Platform

The mods are developed on Windows. Some features depend on it, and each mod's README names them.

## License

[Apache License 2.0](LICENSE). Copyright 2026 Nicholas Chieppa.
