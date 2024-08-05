#!/usr/bin/env node

const { randomUUID } = require('crypto');
const { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, createWriteStream, rmdirSync, rmSync } = require('fs');
const { basename, dirname, join } = require('path');
const { DOMParser, XMLSerializer } = require('xmldom');
const webfontsGenerator = require('webfonts-generator');

const formats = {
	'eot': 'embedded-opentype', 
	'svg': 'svg', 
	'ttf': 'truetype', 
	'woff': 'woff', 
	'woff2': 'woff2'
};

const sourcePath = process.argv[2];
const outputPath = process.argv[3];
const basePath = process.argv[4] ?? './font';

const temporaryWorkingDirectory = join(dirname(outputPath), '.' + basename(outputPath) + '-' + randomUUID());
mkdirSync(temporaryWorkingDirectory, { recursive: true });

const sourceFiles = [];
const iconNames = [];

// scale all icons to fit this size
// webfont generator will mess up if the files have multiple sizes
// the generator will mess up with small files (rounding issues)
const targetSize = 250;

for (let file of readdirSync(sourcePath)) {
	if (file.endsWith('.svg')) {
		let name = file.toLowerCase().replace('.svg', '').replace(/[^a-z\-0-9]/g, '-');

		while (name.includes('--')) {
			name = name.replace('--', '-');
		}
		
		iconNames.push(name);
		
		const image = new DOMParser().parseFromString(readFileSync(join(sourcePath, file)).toString());
		
		// create viewbox with current dimensions, if there is none yet
		if (!image.documentElement.hasAttribute('viewBox')) {
			image.documentElement.setAttribute('viewBox', `0 0 ${image.documentElement.getAttribute('width')} ${image.documentElement.getAttribute('height')}`);
		}
		
		const aspectRatio = +image.documentElement.getAttribute('width').replace(/[^0-9]/g, '') / +image.documentElement.getAttribute('height').replace(/[^0-9]/g, '');
		
		image.documentElement.setAttribute('height', targetSize);
		image.documentElement.setAttribute('width', targetSize * aspectRatio);
		
		// write source image
		const sourceName = join(temporaryWorkingDirectory, name);
		writeFileSync(sourceName, new XMLSerializer().serializeToString(image));
		
		sourceFiles.push(sourceName);
	}
}

const webfontOutputDirectory = join(temporaryWorkingDirectory, `webfont.${randomUUID()}`);
mkdirSync(webfontOutputDirectory);

webfontsGenerator({
	files: sourceFiles,
	dest: webfontOutputDirectory
}, error => {
	if (error) {
		throw error;
	}
	
	const fontSourceFileDirectory = join(outputPath, 'font');
	mkdirSync(fontSourceFileDirectory, { recursive: true });
	
	for (let format in formats) {
		renameSync(join(webfontOutputDirectory, `iconfont.${format}`), join(fontSourceFileDirectory, `index.${format}`));
	}
	
	rmSync(webfontOutputDirectory, { recursive: true });
	
	for (let source of sourceFiles) {
		rmSync(source);
	}
	
	const writer = createWriteStream(join(outputPath, 'index.ts'));

	writer.write(`import { select, style, content, Font, fontFamily, fontWeight, fontStyle } from '@acryps/style';\n\n`);
	writer.write('\n');
	
	writer.write(`export const iconFont = new Font('icons', fontWeight('normal'), fontStyle('normal'))`);

	for (let format in formats) {
		writer.write(`\n\t.addSource('${basePath}/index.${format}', '${formats[format]}')`);
	}

	writer.write(';\n\n');

	writer.write(`export const icons = () => select('ui-icon',\n`);
	writer.write(`\tfontFamily(iconFont.name),\n`);
	writer.write(`\tfontWeight('normal'),\n\n`);
	writer.write(`\tstyle(':empty').before('?'),\n\n`);

	for (let icon of iconNames) {
		writer.write(`\tstyle('[ui-${icon}]').before('\\f1${(iconNames.indexOf(icon) + 1).toString(16).padStart(2, '0')}'),\n`);
	}

	writer.write(`);\n\n`);

	writer.write('const createIconElement = (name: string) => {\n');
	writer.write(`\tconst element = document.createElement('ui-icon');\n`);
	writer.write('\telement.setAttribute(`ui-${name}`, \'\');\n\n');
	writer.write('\treturn element;\n');
	writer.write('};\n\n');

	for (let icon of iconNames) {
		writer.write(`export const ${icon.replace(/\-[a-z]/g, match => match[1].toUpperCase())}Icon = () => createIconElement('${icon}');\n`);
	}

	writer.close();
	
	rmSync(temporaryWorkingDirectory, { recursive: true });
});
