#!/usr/bin/env node

const { randomUUID, createHash } = require('crypto');
const { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, createWriteStream, rmdirSync, rmSync, existsSync } = require('fs');
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

for (let file of readdirSync(sourcePath)) {
	if (file.endsWith('.svg')) {
		let name = file.toLowerCase().replace('.svg', '').replace(/[^a-z\-0-9]/g, '-');

		while (name.includes('--')) {
			name = name.replace('--', '-');
		}
		
		iconNames.push(name);
		
		const image = new DOMParser().parseFromString(readFileSync(join(sourcePath, file)).toString());
		
		// fix image size to viewbox¨
		// svgicons2svgfont fails if the viewbox does not match the icons size
		// 
		// this will break some icons, where the viewbox does not match the icon size
		// checking if the viewbox starts at 0 will handle this
		if (image.documentElement.hasAttribute('viewBox')) {
			const viewBox = image.documentElement.getAttribute('viewBox').trim().split(/\s+/);
			
			if (viewBox[0] != '0' || viewBox[1] != '0') {
				throw new Error(`Icon '${join(sourcePath, file)}' has an invalid viewBox. All icons must have a viewBox starting at 0 0. Try to re-export the icon in a graphics tool`);
			}
			
			image.documentElement.setAttribute('width', viewBox[2]);
			image.documentElement.setAttribute('height', viewBox[3]);
		}
		
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
	
	const writer = createWriteStream(join(outputPath, 'index.ts'));

	writer.write(`import { select, style, content, Font, fontFamily, fontWeight, fontStyle } from '@acryps/style';\n\n`);
	writer.write('\n');
	
	writer.write(`export const iconFont = new Font('icons', fontWeight('normal'), fontStyle('normal'))`);

	for (let format in formats) {
		const path = join(webfontOutputDirectory, `iconfont.${format}`);
		
		if (existsSync(path)) {
			const hash = createHash('sha1').update(readFileSync(path)).digest('base64');
			
			renameSync(path, join(fontSourceFileDirectory, `index.${format}`));
		
			writer.write(`\n\t.addSource('${basePath}/index.${format}?${hash}', '${formats[format]}')`);
		}
	}
	
	writer.write(';\n\n');
	
	rmSync(webfontOutputDirectory, { recursive: true });
	
	for (let source of sourceFiles) {
		rmSync(source);
	}

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
