#!/usr/bin/env node

import { access, constants, copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const projectDir = dirname(fileURLToPath(import.meta.url));
const defaultDestinations = [
	join(projectDir, '..', 'tasknotes', 'tasknotes-e2e-vault', '.obsidian', 'plugins', 'tasknotes-jira'),
];
const files = ['main.js', 'styles.css', 'manifest.json'];
const expandTilde = (path) => path === '~' ? homedir() : path.startsWith('~/') || path.startsWith('~\\') ? join(homedir(), path.slice(2)) : path;

async function readDestinations() {
	if (process.env.OBSIDIAN_PLUGIN_PATH?.trim()) {
		return [expandTilde(process.env.OBSIDIAN_PLUGIN_PATH.trim())];
	}
	try {
		const local = await readFile(join(projectDir, '.copy-files.local'), 'utf8');
		const paths = local.split(/\r?\n/).map((path) => path.trim()).filter((path) => path && !path.startsWith('#')).map(expandTilde);
		if (paths.length) return paths;
	} catch (error) {
		if (error?.code !== 'ENOENT') throw error;
	}
	return defaultDestinations;
}

async function copyTo(destination) {
	const resolvedDestination = resolve(destination);
	if (resolvedDestination === resolve(projectDir)) {
		throw new Error('Copy destination resolves to the source plugin directory; use npm run build instead.');
	}
	await mkdir(resolvedDestination, { recursive: true });
	for (const file of files) {
		const source = join(projectDir, file);
		await access(source, constants.F_OK);
		await copyFile(source, join(resolvedDestination, file));
	}
	console.log(`Copied plugin artifacts to ${resolvedDestination}`);
}

try {
	const destinations = await readDestinations();
	for (const destination of destinations) await copyTo(destination);
	console.log(`Copied ${files.length} artifacts to ${destinations.length} destination(s).`);
} catch (error) {
	console.error(`Failed to copy plugin artifacts: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
