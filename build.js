const fs = require('fs-extra');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const srcDir = path.join(__dirname, '.');
const distDir = path.join(__dirname, 'dist');

// Define files and folders to ignore
const excludeList = [
    'node_modules',
    'dist',
    '.git',
    'sessions',
    'session',
    '.env',
    'build.js'
];

async function obfuscateFile(filePath, destPath) {
    const code = await fs.readFile(filePath, 'utf8');
    
    // Check if file is small or empty
    if (!code || code.trim().length === 0) {
        await fs.copy(filePath, destPath);
        return;
    }

    try {
        const obfuscated = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            debugProtection: false, // Turn on for additional security, but can break debugging
            disableConsoleOutput: false,
            identifierNamesGenerator: 'hexadecimal',
            log: false,
            numbersToExpressions: true,
            renameGlobals: false,
            selfDefending: true,
            simplify: true,
            splitStrings: true,
            splitStringsChunkLength: 10,
            stringArray: true,
            stringArrayCallsTransform: true,
            stringArrayCallsTransformThreshold: 0.5,
            stringArrayEncoding: ['base64'],
            stringArrayIndexShift: true,
            stringArrayRotate: true,
            stringArrayShuffle: true,
            stringArrayWrappersCount: 1,
            stringArrayWrappersChainedCalls: true,
            stringArrayWrappersParametersMaxCount: 2,
            stringArrayWrappersType: 'variable',
            stringArrayThreshold: 0.75,
            unicodeEscapeSequence: false
        });

        await fs.outputFile(destPath, obfuscated.getObfuscatedCode());
        console.log(`Protected: ${filePath} -> ${destPath}`);
    } catch (error) {
        console.error(`Failed to obfuscate ${filePath}:`, error.message);
        // Fallback: Just copy the file on failure (e.g., if there is invalid syntax)
        await fs.copy(filePath, destPath);
    }
}

async function build() {
    console.log('Cleaning old build...');
    await fs.remove(distDir);
    await fs.ensureDir(distDir);

    console.log('Copying static assets and obfuscating JavaScript files...');

    async function processDirectory(currentPath, currentDest) {
        const items = await fs.readdir(currentPath);

        for (const item of items) {
            if (excludeList.includes(item)) continue;

            const itemPath = path.join(currentPath, item);
            const itemDest = path.join(currentDest, item);

            const stat = await fs.stat(itemPath);

            if (stat.isDirectory()) {
                await fs.ensureDir(itemDest);
                await processDirectory(itemPath, itemDest);
            } else if (stat.isFile()) {
                if (itemPath.endsWith('.js')) {
                    await obfuscateFile(itemPath, itemDest);
                } else {
                    // Just copy non-js files as-is
                    await fs.copy(itemPath, itemDest);
                    console.log(`Copied: ${itemPath} -> ${itemDest}`);
                }
            }
        }
    }

    await processDirectory(srcDir, distDir);
    
    // Add additional startup script / entry point modification for dist if needed
    console.log('Build completed successfully. Check the /dist folder.');
}

build().catch(console.error);
