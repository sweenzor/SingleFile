/*
 * Copyright 2010-2020 Gildas Lormeau
 * contact : gildas.lormeau <at> gmail.com
 *
 * This file is part of SingleFile.
 *
 *   The code in this file is free software: you can redistribute it and/or
 *   modify it under the terms of the GNU Affero General Public License
 *   (GNU AGPL) as published by the Free Software Foundation, either version 3
 *   of the License, or (at your option) any later version.
 *
 *   The code in this file is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
 *   General Public License for more details.
 *
 *   As additional permission under GNU AGPL version 3 section 7, you may
 *   distribute UNMODIFIED VERSIONS OF THIS file without the copy of the GNU
 *   AGPL normally required by section 4, provided you include this license
 *   notice and a URL through which recipients can access the Corresponding
 *   Source.
 */

const EMPTY_STRING = "";
const EXTENSION_SEPARATOR = ".";
const INDEX_FILENAME_REGEXP = /\s\((\d+)\)$/;

export function splitFilename(filename) {
	let filenameWithoutExtension = filename;
	let extension = EMPTY_STRING;
	const indexExtensionSeparator = filename.lastIndexOf(EXTENSION_SEPARATOR);
	if (indexExtensionSeparator > -1) {
		filenameWithoutExtension = filename.substring(0, indexExtensionSeparator);
		extension = filename.substring(indexExtensionSeparator + 1);
	}
	let indexFilename;
	({ filenameWithoutExtension, indexFilename } = extractIndexFilename(filenameWithoutExtension));
	return { filenameWithoutExtension, extension, indexFilename };
}

export function extractIndexFilename(filenameWithoutExtension) {
	const indexFilenameMatch = filenameWithoutExtension.match(INDEX_FILENAME_REGEXP);
	let indexFilename = 0;
	if (indexFilenameMatch && indexFilenameMatch.length > 1) {
		const parsedIndexFilename = Number(indexFilenameMatch[indexFilenameMatch.length - 1]);
		if (!Number.isNaN(parsedIndexFilename)) {
			indexFilename = parsedIndexFilename;
			filenameWithoutExtension = filenameWithoutExtension.replace(INDEX_FILENAME_REGEXP, EMPTY_STRING);
		}
	}
	return { filenameWithoutExtension, indexFilename };
}
