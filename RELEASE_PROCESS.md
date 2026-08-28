# Release Process

This document outlines the steps to release a new version of the `puter-cli` package.

## 1. Update the Version

The first step is to update the version number in the `package.json` file. This should be done using the `pnpm version` command. You can use `patch`, `minor`, or `major` to increment the version automatically.

```bash
pnpm version patch
```

This will update the version in `package.json` and create a new git tag.

## 2. Update the Changelog

The `CHANGELOG.md` file is generated using the `auto-changelog` tool. The `version` script in `package.json` handles this automatically. After the version is updated, the `version` script will run, which will update the `CHANGELOG.md` file and stage it.

## 3. Push the Changes

Push the changes to the remote repository.

```bash
git push --follow-tags
```

This command will push the commit with the updated `package.json` and `CHANGELOG.md` files, as well as the new git tag.

## 4. Publish to npm

Finally, publish the new version to npm.

```bash
pnpm publish
```

## Summary

The release process can be summarized with the following commands:

```bash
pnpm version <patch|minor|major>
git push --follow-tags
pnpm publish
```