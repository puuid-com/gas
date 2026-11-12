# Repository instructions

## Design and implementation

- For design, always refer to https://vercel.com/design.md.
- Use the appropriate TanStack libraries for functionality they cover, following official documentation, recommended patterns, and best practices.
- Use shadcn/ui and Tailwind CSS for the UI and styling.
- Before building a UI component, check whether shadcn/ui provides an appropriate component. If it does, install it through the shadcn CLI if it is not already installed, and use it instead of creating a custom replacement.
- Customize shadcn/ui components with the project's Tailwind conventions while preserving their structure, accessibility, and behavior.

## Complete every requested change

Unless the user explicitly says otherwise, every requested repository change includes authorization to complete this workflow without asking again:

1. Implement the change and run the relevant checks.
2. Commit the completed change. Use a concise, imperative subject of at most 72 characters and a body explaining what changed and why.
3. Push the current working branch to its remote. Do not force-push or merge unrelated branches.
4. Deploy using `bun run deploy` to the production domains configured in `wrangler.jsonc`.
5. Verify that the deployed site responds successfully, then report the commit and deployment result.

Do not stop after implementation or a local commit when pushing and deploying can be completed. If a check, push, or deployment fails, resolve the failure where possible and clearly report any remaining blocker. Do not include unrelated user changes in a commit.

Questions and read-only investigations do not require an empty commit or a deployment.
