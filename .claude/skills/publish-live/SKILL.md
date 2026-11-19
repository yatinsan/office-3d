---
name: publish-live
description: Build the 3D office walkthrough with Vite and publish the build to the public GitHub Pages repo yatinsan/office-live (site at https://yatinsan.github.io/office-live/). Use when the user says "build and host", "publish live", "update the live site", or "rebuild and push the site".
disable-model-invocation: true
---

# Publish the office walkthrough to office-live

This publishes only the production build (`dist/`) to https://github.com/yatinsan/office-live. Source code is never pushed to that repo. Pages serves it at https://yatinsan.github.io/office-live/.

Run from the project root (`/Users/yatin/Documents/3d office`).

## Steps

1. **Check the working tree.** Run `git status --short`. If there are uncommitted source changes, say so in the final reply: the live site will include them but the source repo won't. Do not commit them unless the user asks.

2. **Build.** Run `npm run build`. If it fails, stop and report the error. Do not publish a broken build.

3. **Clone the live repo into a temp folder.**
   ```bash
   LIVE=$(mktemp -d)/office-live
   git clone -q https://github.com/yatinsan/office-live.git "$LIVE"
   ```

4. **Replace the contents with the new build.** Keep `.git`, then copy `dist/` in and add `.nojekyll` so Pages does not skip folders.
   ```bash
   cd "$LIVE" && find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
   cp -R "/Users/yatin/Documents/3d office/dist/." "$LIVE/"
   touch "$LIVE/.nojekyll"
   git add -A
   ```

5. **Commit and push only if something changed.** Use the configured git identity. Never set an email address by hand.
   ```bash
   if git diff --cached --quiet; then echo "No changes to publish"; else
     git commit -q -m "Rebuild office walkthrough from latest source

   Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>" && git push -q origin main
   fi
   ```

6. **Verify.** Wait about 45 seconds for Pages to deploy, then check that the live page references the new bundle name from `dist/index.html`:
   ```bash
   curl -s https://yatinsan.github.io/office-live/ | grep -o 'assets/index-[^"]*'
   ```

7. **Report** the new bundle name, the commit hash pushed, and the live URL. Mention that suggestions are view-only on the live site, because `/api/suggestions` only exists in the Vite dev server.

## Notes

- Never force-push to `office-live`.
- Do not copy `ref images/`, `suggestions/`, or any other project folder into the live repo. Only `dist/` goes there.
- To change the target repo, edit the clone URL in step 3 and the URL in step 6.
