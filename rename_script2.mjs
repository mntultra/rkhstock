import fs from 'fs/promises';
import path from 'path';

const TARGET_DIR_SRC = 'd:/OneDrive/Dev/Antigravity/RKHSTOCK/src';
const TARGET_DIR_SUPABASE = 'd:/OneDrive/Dev/Antigravity/RKHSTOCK/supabase';

async function replaceInContent(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const newContent = content
      .replace(/DISPENSE/g, 'ISSUE')
      .replace(/Dispense/g, 'Issue')
      .replace(/dispense/g, 'issue');
      
    if (content !== newContent) {
      await fs.writeFile(filePath, newContent, 'utf-8');
      console.log(`Updated content: ${filePath}`);
    }
  } catch (err) {
    console.error(`Failed to process ${filePath}:`, err);
  }
}

async function walkDir(dir) {
  let files = [];
  try {
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const file of list) {
      const fullPath = path.join(dir, file.name);
      if (file.name === 'node_modules' || file.name === '.git') continue;
      
      if (file.isDirectory()) {
        const subFiles = await walkDir(fullPath);
        files = files.concat(subFiles);
      } else {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading ${dir}:`, err);
  }
  return files;
}

async function main() {
  console.log('Starting phase 2...');
  const dirsToWalk = [TARGET_DIR_SRC, TARGET_DIR_SUPABASE];
  
  for (const dir of dirsToWalk) {
    const files = await walkDir(dir);
    // Replace content in all files
    for (let file of files) {
      await replaceInContent(file);
    }
    
    // Rename files
    for (let file of files) {
      const basename = path.basename(file);
      if (basename.toLowerCase().includes('dispense')) {
        const newBasename = basename
          .replace(/DISPENSE/g, 'ISSUE')
          .replace(/Dispense/g, 'Issue')
          .replace(/dispense/g, 'issue');
        const newPath = path.join(path.dirname(file), newBasename);
        await fs.rename(file, newPath);
        console.log(`Renamed file: ${file} -> ${newPath}`);
      }
    }
  }
  console.log('Done.');
}

main().catch(console.error);
