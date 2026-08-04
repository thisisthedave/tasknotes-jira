#!/usr/bin/env node

/**
 * Promotes the hand-maintained unreleased notes into the versioned release page.
 * Precondition: npm is running the version lifecycle and unreleased.md has entries.
 * Postcondition: the version page exists and unreleased.md is reset to its template.
 */

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const releasesDir = path.join(rootDir, 'docs', 'releases');
const unreleasedPath = path.join(releasesDir, 'unreleased.md');
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
const version = process.env.npm_package_version;

if (!version || manifest.version !== version) {
	throw new Error('Run this through `npm version <major|minor|patch|version>` so npm supplies the target version.');
}

const template = `# ${manifest.name} - Unreleased

<!--
Add user-facing changes below using Added, Changed, and Fixed sections.
The npm version lifecycle moves these entries into the versioned release page.
-->
`;
const unreleased = fs.readFileSync(unreleasedPath, 'utf8');
const body = unreleased.replace(/^#[^\r\n]*\r?\n/, '').replace(/<!--[^]*?-->/, '').trim();

if (!body) {
	throw new Error(`No release notes found in ${path.relative(rootDir, unreleasedPath)}.`);
}

const outputPath = path.join(releasesDir, `${version}.md`);
if (fs.existsSync(outputPath)) {
	throw new Error(`Release notes already exist for ${version}.`);
}

// Release promotion is atomic from the maintainer's perspective: preserve the curated prose, then reset the staging page.
fs.writeFileSync(outputPath, `# ${manifest.name} ${version}\n\n${body}\n`, 'utf8');
fs.writeFileSync(unreleasedPath, template, 'utf8');
console.log(`Prepared ${path.relative(rootDir, outputPath)}`);
