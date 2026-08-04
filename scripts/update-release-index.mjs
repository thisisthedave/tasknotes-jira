#!/usr/bin/env node

/** Generates docs/releases.md from semantic-versioned Markdown files. */

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const releasesDir = path.join(rootDir, 'docs', 'releases');
const outputPath = path.join(rootDir, 'docs', 'releases.md');

/** Returns numeric SemVer components for sorting, or null for unrelated files. */
function parseVersion(filename) {
	const match = filename.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?\.md$/);
	return match ? { raw: filename.slice(0, -3), parts: match.slice(1, 4).map(Number), prerelease: match[4] ?? '' } : null;
}

/** Sorts stable and prerelease versions from newest to oldest. */
function compareVersions(left, right) {
	for (let index = 0; index < 3; index += 1) {
		if (left.parts[index] !== right.parts[index]) return right.parts[index] - left.parts[index];
	}
	if (!left.prerelease && right.prerelease) return -1;
	if (left.prerelease && !right.prerelease) return 1;
	return right.prerelease.localeCompare(left.prerelease, undefined, { numeric: true });
}

const versions = fs.readdirSync(releasesDir).map(parseVersion).filter(Boolean).sort(compareVersions);
const lines = ['# Release notes', '', ...versions.map(({ raw }) => `- [${raw}](releases/${raw}.md)`), ''];

// The index is derived from filenames so adding a release cannot leave navigation stale.
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Updated ${path.relative(rootDir, outputPath)}`);
